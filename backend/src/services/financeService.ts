import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DashboardMetricsPayload {
  totalRecordsProcessed: number;
  totalTransactionValue: number;
  reconciledValue: number;
  exceptionValue: number;
  reviewValue: number;
  matchedCount: number;
  reviewCount: number;
  exceptionCount: number;
  matchRate: number;
  reconciliationCoverage: number;
  processingTimeSec: number;
  throughput: number;
  pendingSettlementsCount: number;
  pendingSettlementValue: number;
  currentCashPosition: number;
  projectedCashPosition30d: number;
  latestRunId: string | null;
  batchName: string | null;
}

export const getDashboardMetrics = async (): Promise<DashboardMetricsPayload> => {
  const latestRun = await prisma.reconciliationRun.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    include: {
      batch: {
        include: {
          orders: true,
          payments: true,
          settlements: true,
          bankTxns: true,
          refunds: true,
        },
      },
      results: true,
    },
  });

  if (!latestRun) {
    return {
      totalRecordsProcessed: 0,
      totalTransactionValue: 0,
      reconciledValue: 0,
      exceptionValue: 0,
      reviewValue: 0,
      matchedCount: 0,
      reviewCount: 0,
      exceptionCount: 0,
      matchRate: 0,
      reconciliationCoverage: 0,
      processingTimeSec: 0,
      throughput: 0,
      pendingSettlementsCount: 0,
      pendingSettlementValue: 0,
      currentCashPosition: 0,
      projectedCashPosition30d: 0,
      latestRunId: null,
      batchName: null,
    };
  }

  // Calculate Transaction Values from results & source tables
  let totalTransactionValue = 0;
  let reconciledValue = 0;
  let exceptionValue = 0;
  let reviewValue = 0;

  const paymentMap = new Map<string, number>();
  if (latestRun.batch && latestRun.batch.payments) {
    for (const p of latestRun.batch.payments) {
      paymentMap.set(p.transactionId, p.amount);
      totalTransactionValue += p.amount;
    }
  }

  for (const res of latestRun.results) {
    const val = paymentMap.get(res.transactionId) || 0;
    if (res.status === 'MATCHED') {
      reconciledValue += val;
    } else if (res.status === 'EXCEPTION') {
      exceptionValue += val;
    } else if (res.status === 'REVIEW') {
      reviewValue += val;
    }
  }

  // Pending settlements
  let pendingSettlementsCount = 0;
  let pendingSettlementValue = 0;
  if (latestRun.batch && latestRun.batch.payments && latestRun.batch.settlements) {
    const settledTxIds = new Set(latestRun.batch.settlements.map((s) => s.transactionId));
    for (const p of latestRun.batch.payments) {
      if (!settledTxIds.has(p.transactionId)) {
        pendingSettlementsCount++;
        pendingSettlementValue += p.amount;
      }
    }
  }

  // Cash Position: Inflows (credited bank transactions) - Refunds
  let bankInflows = 0;
  if (latestRun.batch && latestRun.batch.bankTxns) {
    for (const b of latestRun.batch.bankTxns) {
      bankInflows += b.creditAmount;
    }
  }

  let refundOutflows = 0;
  if (latestRun.batch && latestRun.batch.refunds) {
    for (const r of latestRun.batch.refunds) {
      refundOutflows += r.refundAmount;
    }
  }

  const currentCashPosition = Math.max(0, bankInflows - refundOutflows);
  const projectedCashPosition30d = Math.round((currentCashPosition + pendingSettlementValue * 0.95) * 100) / 100;

  const processingTimeSec = Math.round((latestRun.processingTimeMs / 1000) * 100) / 100;
  const coverage = latestRun.totalRecords > 0 ? 100.0 : 0.0;

  return {
    totalRecordsProcessed: latestRun.totalRecords,
    totalTransactionValue: Math.round(totalTransactionValue * 100) / 100,
    reconciledValue: Math.round(reconciledValue * 100) / 100,
    exceptionValue: Math.round(exceptionValue * 100) / 100,
    reviewValue: Math.round(reviewValue * 100) / 100,
    matchedCount: latestRun.matchedCount,
    reviewCount: latestRun.reviewCount,
    exceptionCount: latestRun.exceptionCount,
    matchRate: latestRun.matchRate,
    reconciliationCoverage: coverage,
    processingTimeSec,
    throughput: latestRun.throughput,
    pendingSettlementsCount,
    pendingSettlementValue: Math.round(pendingSettlementValue * 100) / 100,
    currentCashPosition: Math.round(currentCashPosition * 100) / 100,
    projectedCashPosition30d,
    latestRunId: latestRun.id,
    batchName: latestRun.batch ? latestRun.batch.name : 'Latest Batch',
  };
};

export const getRunHistory = async () => {
  const runs = await prisma.reconciliationRun.findMany({
    orderBy: { startedAt: 'desc' },
    include: {
      batch: true,
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return runs.map((run) => {
    const durationSec = Math.round((run.processingTimeMs / 1000) * 100) / 100;
    const latestEval = run.evaluations[0] || null;

    return {
      runId: run.id,
      batchId: run.batchId,
      batchName: run.batch ? run.batch.name : 'Financial Batch',
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalRecords: run.totalRecords,
      matchedCount: run.matchedCount,
      reviewCount: run.reviewCount,
      exceptionCount: run.exceptionCount,
      matchRate: run.matchRate,
      processingTimeSec: durationSec,
      throughput: run.throughput,
      status: run.status,
      accuracy: latestEval ? latestEval.accuracy : run.accuracy,
      f1Score: latestEval ? latestEval.f1Macro : run.f1Score,
    };
  });
};

export const getFinanceReport = async (runId: string) => {
  const run = await prisma.reconciliationRun.findUnique({
    where: { id: runId },
    include: {
      batch: {
        include: {
          orders: true,
          payments: true,
          settlements: true,
          bankTxns: true,
          refunds: true,
        },
      },
      results: {
        include: {
          exception: true,
        },
      },
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!run) {
    throw new Error('Reconciliation run not found.');
  }

  const latestEval = run.evaluations[0] || null;
  const durationSec = Math.round((run.processingTimeMs / 1000) * 100) / 100;

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  let totalExceptionVal = 0;
  let totalReconciledVal = 0;

  const paymentMap = new Map<string, number>();
  if (run.batch && run.batch.payments) {
    for (const p of run.batch.payments) {
      paymentMap.set(p.transactionId, p.amount);
    }
  }

  for (const res of run.results) {
    const val = paymentMap.get(res.transactionId) || 0;
    if (res.status === 'MATCHED') {
      totalReconciledVal += val;
    } else {
      totalExceptionVal += val;
      if (res.exception) {
        const cat = res.exception.category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }
  }

  // Audit Logs for this run
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: run.id },
        { entityId: run.batchId },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 20,
  });

  return {
    runInfo: {
      runId: run.id,
      batchId: run.batchId,
      batchName: run.batch ? run.batch.name : 'Financial Batch',
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
    },
    performance: {
      totalRecords: run.totalRecords,
      processingTimeSec: durationSec,
      throughput: run.throughput,
    },
    reconciliation: {
      matchedCount: run.matchedCount,
      reviewCount: run.reviewCount,
      exceptionCount: run.exceptionCount,
      matchRate: run.matchRate,
      coverage: run.totalRecords > 0 ? 100.0 : 0.0,
    },
    financialSummary: {
      reconciledValue: Math.round(totalReconciledVal * 100) / 100,
      exceptionValue: Math.round(totalExceptionVal * 100) / 100,
    },
    exceptionsBreakdown: {
      categoryCounts,
      totalExceptions: run.exceptionCount + run.reviewCount,
    },
    evaluation: latestEval
      ? {
          accuracy: latestEval.accuracy,
          precision: latestEval.precisionMacro,
          recall: latestEval.recallMacro,
          f1Macro: latestEval.f1Macro,
          f1Weighted: latestEval.f1Weighted,
          totalGtRecords: latestEval.totalGtRecords,
        }
      : null,
    auditTrail: auditLogs,
  };
};

export const querySettlements = async (queryText: string) => {
  const q = queryText.toLowerCase().trim();

  const [settlements, payments, bankTxns, exceptions] = await Promise.all([
    prisma.settlement.findMany({ take: 200 }),
    prisma.payment.findMany({ take: 200 }),
    prisma.bankTransaction.findMany({ take: 200 }),
    prisma.exception.findMany({ take: 200, include: { result: true } }),
  ]);

  let totalSettled = 0;
  for (const s of settlements) {
    totalSettled += s.netAmount;
  }

  // Pending settlements
  const settledTxIds = new Set(settlements.map((s) => s.transactionId));
  const pendingPayments = payments.filter((p) => !settledTxIds.has(p.transactionId));
  let pendingValue = 0;
  for (const p of pendingPayments) pendingValue += p.amount;

  // Largest settlement
  let largestSettlement = settlements.length > 0 ? settlements[0] : null;
  for (const s of settlements) {
    if (largestSettlement && s.netAmount > largestSettlement.netAmount) {
      largestSettlement = s;
    }
  }

  // Specific transaction query (e.g. TX1023)
  const txMatch = q.match(/tx\d+/i) || q.match(/transaction\s+([a-z0-9_-]+)/i);
  let specificTxId = txMatch ? txMatch[0].toUpperCase() : null;

  let answer = '';
  let supportingRecords: any[] = [];

  if (specificTxId) {
    const pay = payments.find((p) => p.transactionId === specificTxId);
    const set = settlements.find((s) => s.transactionId === specificTxId);
    const bank = bankTxns.find((b) => b.reference === specificTxId || (set && b.settlementId === set.settlementId));
    const exc = exceptions.find((e) => e.transactionId === specificTxId);

    if (pay || set || bank) {
      supportingRecords = [
        pay ? { type: 'PAYMENT', id: pay.paymentId, amount: pay.amount, date: pay.paymentDate } : null,
        set ? { type: 'SETTLEMENT', id: set.settlementId, gross: set.grossAmount, net: set.netAmount, date: set.settlementDate } : null,
        bank ? { type: 'BANK', id: bank.bankTransactionId, credit: bank.creditAmount, date: bank.transactionDate } : null,
      ].filter(Boolean);

      if (exc) {
        answer = `Transaction ${specificTxId} requires review (${exc.category}): ${exc.description}. Payment amount is ₹${pay?.amount || 0}, but settlement net amount is ₹${set?.netAmount || 0}.`;
      } else if (pay && set && pay.amount === set.grossAmount) {
        answer = `Transaction ${specificTxId} is fully settled. Payment of ₹${pay.amount} matches Settlement gross amount of ₹${set.grossAmount} (Net credited: ₹${set.netAmount} after fee/tax).`;
      } else if (pay && !set) {
        answer = `Transaction ${specificTxId} has a payment of ₹${pay.amount} recorded on ${pay.paymentDate}, but no settlement record has been received yet.`;
      } else {
        answer = `Transaction ${specificTxId} details: Payment ₹${pay?.amount || 0}, Settlement Gross ₹${set?.grossAmount || 0}, Net ₹${set?.netAmount || 0}.`;
      }
    } else {
      answer = `No financial records found matching transaction ID ${specificTxId}.`;
    }
  } else if (q.includes('how much') || q.includes('total settled')) {
    answer = `Total settled amount across available settlement records is ₹${Math.round(totalSettled).toLocaleString('en-IN')}.`;
    supportingRecords = settlements.slice(0, 5).map((s) => ({
      settlementId: s.settlementId,
      transactionId: s.transactionId,
      grossAmount: s.grossAmount,
      netAmount: s.netAmount,
      date: s.settlementDate,
    }));
  } else if (q.includes('pending') || q.includes('unsettled')) {
    answer = `There are ${pendingPayments.length} pending settlements totaling ₹${Math.round(pendingValue).toLocaleString('en-IN')}.`;
    supportingRecords = pendingPayments.slice(0, 5).map((p) => ({
      transactionId: p.transactionId,
      paymentId: p.paymentId,
      amount: p.amount,
      date: p.paymentDate,
    }));
  } else if (q.includes('largest') || q.includes('biggest')) {
    if (largestSettlement) {
      answer = `The largest single settlement is ${largestSettlement.settlementId} (Transaction ${largestSettlement.transactionId}) with a gross amount of ₹${largestSettlement.grossAmount.toLocaleString('en-IN')} (Net: ₹${largestSettlement.netAmount.toLocaleString('en-IN')}).`;
      supportingRecords = [largestSettlement];
    } else {
      answer = `No settlement records available.`;
    }
  } else if (q.includes('failed') || q.includes('exception')) {
    answer = `There are ${exceptions.length} settlement exceptions currently flagged for review.`;
    supportingRecords = exceptions.slice(0, 5).map((e) => ({
      transactionId: e.transactionId,
      category: e.category,
      description: e.description,
      severity: e.severity,
    }));
  } else {
    answer = `Financial Settlement Engine Summary: Total settled is ₹${Math.round(totalSettled).toLocaleString('en-IN')} across ${settlements.length} records. ${pendingPayments.length} payments pending settlement (₹${Math.round(pendingValue).toLocaleString('en-IN')}).`;
    supportingRecords = settlements.slice(0, 3);
  }

  return {
    query: queryText,
    answer,
    supportingRecords,
  };
};

export const getCashPositionAndForecast = async () => {
  const [bankTxns, refunds, settlements] = await Promise.all([
    prisma.bankTransaction.findMany(),
    prisma.refund.findMany(),
    prisma.settlement.findMany(),
  ]);

  let totalBankCredits = 0;
  for (const b of bankTxns) totalBankCredits += b.creditAmount;

  let totalRefunds = 0;
  for (const r of refunds) totalRefunds += r.refundAmount;

  let totalNetSettlements = 0;
  for (const s of settlements) totalNetSettlements += s.netAmount;

  const currentCashPosition = Math.max(0, Math.round((totalBankCredits - totalRefunds) * 100) / 100);

  // Daily average inflow velocity
  const dailyInflowVelocity = bankTxns.length > 0 ? totalBankCredits / 7.0 : 15000.0;
  const dailyOutflowVelocity = refunds.length > 0 ? totalRefunds / 7.0 : 1000.0;

  const forecast7d = Math.round(currentCashPosition + (dailyInflowVelocity - dailyOutflowVelocity) * 7);
  const forecast14d = Math.round(currentCashPosition + (dailyInflowVelocity - dailyOutflowVelocity) * 14);
  const forecast30d = Math.round(currentCashPosition + (dailyInflowVelocity - dailyOutflowVelocity) * 30);

  return {
    currentCashPosition,
    totalBankCredits: Math.round(totalBankCredits * 100) / 100,
    totalRefunds: Math.round(totalRefunds * 100) / 100,
    totalNetSettlements: Math.round(totalNetSettlements * 100) / 100,
    assumptions: [
      'Current cash position = Sum of credited bank transactions minus processed refunds.',
      '7-day, 14-day, and 30-day forecasts extrapolate daily inflow and refund velocity.',
      'Opening balance assumes synthetic initial pool starting from 0.',
    ],
    forecasts: {
      days7: forecast7d,
      days14: forecast14d,
      days30: forecast30d,
    },
  };
};

export const getTaxVerification = async () => {
  const settlements = await prisma.settlement.findMany({ take: 300 });

  if (!settlements || settlements.length === 0) {
    return {
      taxDataAvailable: false,
      message: 'No settlement records available for tax verification.',
      verifiedRecords: [],
      taxExceptionCount: 0,
      totalTaxVerified: 0,
    };
  }

  let totalTaxVerified = 0;
  let taxExceptionCount = 0;
  const verifiedRecords = [];

  for (const s of settlements) {
    // Expected GST (18% of grossAmount) vs recorded tax
    const expectedTax = Math.round(s.grossAmount * 0.18 * 100) / 100;
    const recordedTax = s.tax;
    const diff = Math.round(Math.abs(expectedTax - recordedTax) * 100) / 100;
    const isException = diff > 5.0 && recordedTax > 0;

    if (isException) taxExceptionCount++;
    totalTaxVerified += recordedTax;

    verifiedRecords.push({
      settlementId: s.settlementId,
      transactionId: s.transactionId,
      grossAmount: s.grossAmount,
      fee: s.fee,
      recordedTax,
      expectedTax,
      difference: diff,
      status: isException ? 'TAX_MISMATCH' : 'VERIFIED',
    });
  }

  return {
    taxDataAvailable: true,
    message: `Tax-line verification evaluated across ${settlements.length} settlement records.`,
    totalTaxVerified: Math.round(totalTaxVerified * 100) / 100,
    taxExceptionCount,
    verifiedRecords: verifiedRecords.slice(0, 50),
  };
};
