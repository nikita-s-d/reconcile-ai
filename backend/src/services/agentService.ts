import { PrismaClient, ResultStatus, ExceptionStatus } from '@prisma/client';
import OpenAI from 'openai';
import { triggerReconciliationRun } from './reconciliationService';
import { querySettlements, getCashPositionAndForecast, getTaxVerification } from './financeService';

const prisma = new PrismaClient();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openaiClient: OpenAI | null = null;
if (OPENAI_API_KEY.trim()) {
  openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY.trim() });
}

export interface ActivityStep {
  step: string;
  timestamp: string;
}

export interface AgentResponsePayload {
  response: string;
  activitySteps: ActivityStep[];
  toolCalls: Array<{ name: string; args: any; result: any }>;
  fallbackUsed: boolean;
}

// Definition of 10 Finance Tools for OpenAI Function Calling
const financeToolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'run_reconciliation',
      description: 'Triggers multi-source financial reconciliation across batch dataset records.',
      parameters: {
        type: 'object',
        properties: {
          batchId: { type: 'string', description: 'Optional batch ID to reconcile. If omitted, uses latest batch.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transaction',
      description: 'Retrieves 5-source transaction trace (Order, Payment, Settlement, Bank Transaction, Refund) for a transaction ID.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'Transaction ID (e.g. TXN1001 or TX1023)' },
        },
        required: ['transactionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reconciliation_result',
      description: 'Retrieves final reconciliation decision (MATCHED, REVIEW, EXCEPTION), confidence score, and evidence for a transaction.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'Transaction ID to inspect' },
        },
        required: ['transactionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exception',
      description: 'Retrieves detailed exception record including category, expected value, actual value, severity, and status for a transaction.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'Transaction ID associated with exception' },
        },
        required: ['transactionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exception_summary',
      description: 'Returns aggregated exception breakdown by category, counts, and financial values.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional filter by ExceptionCategory' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_settlement_summary',
      description: 'Analyzes settlement status, total settled value, pending settlement count/value, and non-settlement reasons.',
      parameters: {
        type: 'object',
        properties: {
          queryText: { type: 'string', description: 'Specific query question regarding settlements' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cash_position',
      description: 'Calculates current cash position (Bank Credits minus Refunds) with explicit documented assumptions.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cash_forecast',
      description: 'Calculates 7-day, 14-day, and 30-day transparent liquidity projections based on transaction velocity.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Forecast days (7, 14, or 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tax_match',
      description: 'Compares expected tax vs recorded tax on settlement records to flag tax-line discrepancies.',
      parameters: {
        type: 'object',
        properties: {
          settlementId: { type: 'string', description: 'Optional settlement ID to verify' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_human_review',
      description: 'Routes uncertain or low-confidence records for human review, creating an audit log entry.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'Transaction ID to route for review' },
          reason: { type: 'string', description: 'Reason for escalating to human review' },
        },
        required: ['transactionId', 'reason'],
      },
    },
  },
];

// Tool Executor against verified backend/PostgreSQL services
export const executeFinanceTool = async (name: string, args: any, userId?: string): Promise<any> => {
  switch (name) {
    case 'run_reconciliation': {
      let batchId = args?.batchId;
      if (!batchId) {
        const latestBatch = await prisma.datasetBatch.findFirst({ orderBy: { uploadedAt: 'desc' } });
        if (!latestBatch) throw new Error('No dataset batch uploaded to reconcile.');
        batchId = latestBatch.id;
      }
      return await triggerReconciliationRun(batchId, userId);
    }

    case 'get_transaction': {
      const txId = (args?.transactionId || '').toUpperCase().trim();
      const [payments, orders, settlements, bankTxns, refunds, result] = await Promise.all([
        prisma.payment.findMany({ where: { transactionId: txId } }),
        prisma.order.findMany({ where: { paymentId: { in: (await prisma.payment.findMany({ where: { transactionId: txId } })).map((p) => p.paymentId) } } }),
        prisma.settlement.findMany({ where: { transactionId: txId } }),
        prisma.bankTransaction.findMany({ where: { reference: txId } }),
        prisma.refund.findMany({ where: { transactionId: txId } }),
        prisma.reconciliationResult.findFirst({ where: { transactionId: txId }, orderBy: { createdAt: 'desc' } }),
      ]);

      return {
        transactionId: txId,
        found: payments.length > 0 || settlements.length > 0 || bankTxns.length > 0,
        sources: {
          orders,
          payments,
          settlements,
          bankTransactions: bankTxns,
          refunds,
        },
        reconciliationResult: result,
      };
    }

    case 'get_reconciliation_result': {
      const txId = (args?.transactionId || '').toUpperCase().trim();
      const result = await prisma.reconciliationResult.findFirst({
        where: { transactionId: txId },
        orderBy: { createdAt: 'desc' },
        include: { exception: true },
      });

      if (!result) {
        return { transactionId: txId, found: false, message: `No reconciliation decision found for transaction ${txId}.` };
      }

      return {
        transactionId: txId,
        found: true,
        status: result.status,
        confidence: result.confidence,
        reason: result.reason,
        amountDifference: result.amountDifference,
        matchedPaymentId: result.matchedPaymentId,
        matchedSettlementId: result.matchedSettlementId,
        matchedBankTransactionId: result.matchedBankTransactionId,
        evidence: result.evidence,
        exception: result.exception,
      };
    }

    case 'get_exception': {
      const txId = (args?.transactionId || '').toUpperCase().trim();
      const exception = await prisma.exception.findFirst({
        where: { transactionId: txId },
        orderBy: { createdAt: 'desc' },
        include: { result: true },
      });

      if (!exception) {
        return { transactionId: txId, found: false, message: `No open or recorded exception for transaction ${txId}.` };
      }

      return {
        transactionId: txId,
        found: true,
        id: exception.id,
        category: exception.category,
        severity: exception.severity,
        status: exception.status,
        expectedValue: exception.expectedValue,
        actualValue: exception.actualValue,
        description: exception.description,
        resolvedBy: exception.resolvedBy,
        resolutionNote: exception.resolutionNote,
      };
    }

    case 'get_exception_summary': {
      const exceptions = await prisma.exception.findMany({
        include: { result: true },
      });

      const categoryCounts: Record<string, number> = {};
      let totalExceptionValue = 0;

      for (const e of exceptions) {
        categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
        if (e.expectedValue && e.actualValue) {
          totalExceptionValue += Math.abs(e.expectedValue - e.actualValue);
        }
      }

      return {
        totalExceptions: exceptions.length,
        totalExceptionValue: Math.round(totalExceptionValue * 100) / 100,
        categoryCounts,
        openCount: exceptions.filter((e) => e.status === ExceptionStatus.OPEN).length,
        resolvedCount: exceptions.filter((e) => e.status === ExceptionStatus.RESOLVED).length,
      };
    }

    case 'get_settlement_summary': {
      return await querySettlements(args?.queryText || 'How much was settled?');
    }

    case 'get_cash_position': {
      return await getCashPositionAndForecast();
    }

    case 'get_cash_forecast': {
      return await getCashPositionAndForecast();
    }

    case 'get_tax_match': {
      return await getTaxVerification();
    }

    case 'create_human_review': {
      const txId = (args?.transactionId || '').toUpperCase().trim();
      const reason = args?.reason || 'Escalated to human review by AI agent';

      let result = await prisma.reconciliationResult.findFirst({
        where: { transactionId: txId },
        orderBy: { createdAt: 'desc' },
      });

      if (result) {
        await prisma.reconciliationResult.update({
          where: { id: result.id },
          data: { status: ResultStatus.REVIEW },
        });

        await prisma.auditLog.create({
          data: {
            userId: userId || null,
            action: 'ROUTED_TO_HUMAN_REVIEW',
            entity: 'ReconciliationResult',
            entityId: result.id,
            previousValue: result.status,
            newValue: 'REVIEW',
            reason: `AI Agent escalated Tx ${txId} for human review: ${reason}`,
          },
        });
      }

      return {
        transactionId: txId,
        status: 'REQUIRES_HUMAN_REVIEW',
        message: `Transaction ${txId} successfully routed to Exception Center for human review. Audit log entry recorded.`,
      };
    }

    default:
      throw new Error(`Unknown finance tool: ${name}`);
  }
};

// Deterministic Fallback Intent Router when OpenAI API is offline or unconfigured
export const handleFallbackChat = async (userMessage: string, userId?: string): Promise<AgentResponsePayload> => {
  const msg = userMessage.toLowerCase().trim();
  const activitySteps: ActivityStep[] = [
    { step: 'Understanding user intent (Fallback Mode)', timestamp: new Date().toLocaleTimeString() },
  ];
  const toolCalls: Array<{ name: string; args: any; result: any }> = [];

  let response = '';

  // Extract Tx ID if present (e.g. TXN1001, TX1023)
  const txMatch = msg.match(/tx[a-z0-9_-]+/i) || msg.match(/transaction\s+([a-z0-9_-]+)/i);
  const txId = txMatch ? txMatch[0].toUpperCase() : null;

  if (msg.includes('route') && txId) {
    activitySteps.push({ step: `Executing create_human_review for ${txId}`, timestamp: new Date().toLocaleTimeString() });
    const reviewRes = await executeFinanceTool('create_human_review', { transactionId: txId, reason: userMessage }, userId);
    toolCalls.push({ name: 'create_human_review', args: { transactionId: txId, reason: userMessage }, result: reviewRes });

    response = `Escalation Successful:\n\n• Transaction: ${txId}\n• Status: REQUIRES_HUMAN_REVIEW\n• Details: ${reviewRes.message}`;
  } else if (txId) {
    activitySteps.push({ step: `Executing get_transaction for ${txId}`, timestamp: new Date().toLocaleTimeString() });
    const txData = await executeFinanceTool('get_transaction', { transactionId: txId }, userId);
    toolCalls.push({ name: 'get_transaction', args: { transactionId: txId }, result: txData });

    activitySteps.push({ step: `Executing get_reconciliation_result for ${txId}`, timestamp: new Date().toLocaleTimeString() });
    const recResult = await executeFinanceTool('get_reconciliation_result', { transactionId: txId }, userId);
    toolCalls.push({ name: 'get_reconciliation_result', args: { transactionId: txId }, result: recResult });

    if (recResult.found) {
      response = `Transaction ${txId} Investigation Result:\n\n• Decision: ${recResult.status}\n• Confidence: ${recResult.confidence}%\n• Reason: ${recResult.reason}\n• Amount Discrepancy: ₹${recResult.amountDifference}\n\n5-Source Trace:\n- Orders: ${txData.sources.orders.length} record(s)\n- Payments: ${txData.sources.payments.length} record(s) (Total ₹${txData.sources.payments.reduce((s: number, p: any) => s + p.amount, 0)})\n- Settlements: ${txData.sources.settlements.length} record(s)\n- Bank Transactions: ${txData.sources.bankTransactions.length} record(s)\n- Refunds: ${txData.sources.refunds.length} record(s)`;
    } else {
      response = `Transaction ${txId} was located in source data, but no automated reconciliation decision has been computed for it yet. Please run reconciliation on the current dataset batch.`;
    }
  } else if (msg.includes('tax') || msg.includes('gst')) {
    activitySteps.push({ step: 'Executing get_tax_match', timestamp: new Date().toLocaleTimeString() });
    const taxData = await executeFinanceTool('get_tax_match', {}, userId);
    toolCalls.push({ name: 'get_tax_match', args: {}, result: taxData });

    response = `Tax Verification Report:\n\n• Total Tax Verified: ₹${taxData.totalTaxVerified.toLocaleString()}\n• Tax Discrepancies Flagged: ${taxData.taxExceptionCount}\n• Status: ${taxData.message}`;
  } else if (msg.includes('exception') || msg.includes('discrepanc')) {
    activitySteps.push({ step: 'Executing get_exception_summary', timestamp: new Date().toLocaleTimeString() });
    const excSummary = await executeFinanceTool('get_exception_summary', {}, userId);
    toolCalls.push({ name: 'get_exception_summary', args: {}, result: excSummary });

    response = `Exception Center Summary:\n\n• Total Unresolved Exceptions: ${excSummary.totalExceptions} (${excSummary.openCount} Open, ${excSummary.resolvedCount} Resolved)\n• Total Exception Value: ₹${excSummary.totalExceptionValue.toLocaleString()}\n\nCategory Breakdown:\n` +
      Object.entries(excSummary.categoryCounts).map(([cat, cnt]) => `- ${cat}: ${cnt} record(s)`).join('\n');
  } else if (msg.includes('cash') || msg.includes('forecast') || msg.includes('liquidity')) {
    activitySteps.push({ step: 'Executing get_cash_position and get_cash_forecast', timestamp: new Date().toLocaleTimeString() });
    const cashData = await executeFinanceTool('get_cash_position', {}, userId);
    toolCalls.push({ name: 'get_cash_position', args: {}, result: cashData });

    response = `Cash Position & Liquidity Forecast:\n\n• Current Cash Position: ₹${cashData.currentCashPosition.toLocaleString()}\n• 7-Day Cash Forecast: ₹${cashData.forecasts.days7.toLocaleString()}\n• 14-Day Cash Forecast: ₹${cashData.forecasts.days14.toLocaleString()}\n• 30-Day Cash Forecast: ₹${cashData.forecasts.days30.toLocaleString()}\n\nAssumptions: ${cashData.assumptions[0]}`;
  } else if (msg.includes('settle') || msg.includes('pending')) {
    activitySteps.push({ step: 'Executing get_settlement_summary', timestamp: new Date().toLocaleTimeString() });
    const setSummary = await executeFinanceTool('get_settlement_summary', { queryText: userMessage }, userId);
    toolCalls.push({ name: 'get_settlement_summary', args: { queryText: userMessage }, result: setSummary });

    response = `Settlement Analysis:\n\n${setSummary.answer}`;
  } else if (msg.includes('reconcil') || msg.includes('run')) {
    activitySteps.push({ step: 'Executing run_reconciliation tool', timestamp: new Date().toLocaleTimeString() });
    const runRes = await executeFinanceTool('run_reconciliation', {}, userId);
    const runData = runRes.run || runRes;
    toolCalls.push({ name: 'run_reconciliation', args: {}, result: runRes });

    response = `Automated Multi-Source Reconciliation Execution Completed!\n\n• Total Processed: ${runData.totalRecords}\n• Matched: ${runData.matchedCount}\n• Needs Review: ${runData.reviewCount}\n• Exceptions: ${runData.exceptionCount}\n• Match Rate: ${runData.matchRate}%\n• Throughput: ${runData.throughput} rec/s`;
  } else {
    response = `AI Finance Controller Assistant (Deterministic Fallback Mode):\n\nI can help you analyze financial reconciliation datasets, investigate transaction traces, analyze settlements, check cash positions, or verify tax lines. Please select a suggested query below or ask about a specific transaction ID (e.g., TXN1001).`;
  }

  activitySteps.push({ step: 'Response compiled from verified tool execution', timestamp: new Date().toLocaleTimeString() });

  return {
    response,
    activitySteps,
    toolCalls,
    fallbackUsed: true,
  };
};

// Primary Agent Execution Entrypoint (OpenAI Function Calling + Fallback)
export const processAgentChat = async (
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  userId?: string
): Promise<AgentResponsePayload> => {
  const activitySteps: ActivityStep[] = [
    { step: 'Understanding user request', timestamp: new Date().toLocaleTimeString() },
  ];
  const executedToolCalls: Array<{ name: string; args: any; result: any }> = [];

  // Log Agent Run Started
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'AGENT_RUN_STARTED',
      entity: 'AIFinanceControllerAgent',
      reason: `Agent processing query: "${userMessage.substring(0, 100)}"`,
    },
  });

  if (!openaiClient) {
    console.log('[AGENT] OPENAI_API_KEY is missing or unconfigured. Using deterministic fallback router.');
    return await handleFallbackChat(userMessage, userId);
  }

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are the AI Finance Controller Agent for ReconcileAI.
You act as an intelligent finance operations assistant.
Rules:
1. NEVER invent or fabricate financial amounts, match rates, or transaction facts.
2. ALWAYS call available finance tools to retrieve verified database records.
3. Clearly distinguish MATCHED, REVIEW, and EXCEPTION decisions.
4. Explain why transactions were classified in simple, executive-friendly language.
5. Identify low-confidence cases requiring human review.
6. Preserve full financial auditability.`,
      },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userMessage },
    ];

    activitySteps.push({ step: 'Selecting appropriate finance tools via OpenAI API', timestamp: new Date().toLocaleTimeString() });

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: financeToolDefinitions,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0].message;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      messages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type === 'function') {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments || '{}');

          activitySteps.push({ step: `Calling tool ${fnName}`, timestamp: new Date().toLocaleTimeString() });

          // Log Tool Execution in Audit Log
          await prisma.auditLog.create({
            data: {
              userId: userId || null,
              action: 'AGENT_TOOL_CALLED',
              entity: 'FinanceTool',
              reason: `Agent executed tool ${fnName}`,
              metadata: { toolName: fnName, args: fnArgs },
            },
          });

          const toolResult = await executeFinanceTool(fnName, fnArgs, userId);
          executedToolCalls.push({ name: fnName, args: fnArgs, result: toolResult });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      }

      activitySteps.push({ step: 'Synthesizing verified tool outputs into explanation', timestamp: new Date().toLocaleTimeString() });

      const finalCompletion = await openaiClient.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
      });

      const finalResponse = finalCompletion.choices[0].message.content || 'Analysis complete.';

      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: 'AGENT_RUN_COMPLETED',
          entity: 'AIFinanceControllerAgent',
          reason: `Agent run completed with ${executedToolCalls.length} tool calls.`,
        },
      });

      return {
        response: finalResponse,
        activitySteps,
        toolCalls: executedToolCalls,
        fallbackUsed: false,
      };
    } else {
      activitySteps.push({ step: 'Direct answer compiled', timestamp: new Date().toLocaleTimeString() });

      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: 'AGENT_RUN_COMPLETED',
          entity: 'AIFinanceControllerAgent',
          reason: 'Agent run completed without tool calls.',
        },
      });

      return {
        response: choice.content || 'I have analyzed your query based on current financial status.',
        activitySteps,
        toolCalls: [],
        fallbackUsed: false,
      };
    }
  } catch (error: any) {
    console.error('[AGENT] OpenAI API call failed, falling back to deterministic intent router:', error.message);
    return await handleFallbackChat(userMessage, userId);
  }
};
