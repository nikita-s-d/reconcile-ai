import { PrismaClient, ResultStatus, ExceptionCategory, Severity, ExceptionStatus } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const PYTHON_SERVICE_URL = process.env.RECONCILIATION_SERVICE_URL || 'http://localhost:8000';

export const triggerReconciliationRun = async (batchId: string, userId?: string) => {
  const batch = await prisma.datasetBatch.findUnique({
    where: { id: batchId },
    include: {
      orders: true,
      payments: true,
      settlements: true,
      bankTxns: true,
      refunds: true,
    },
  });

  if (!batch) {
    throw new Error('Dataset batch not found.');
  }

  // Fetch current system settings
  let settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 'default', matchedThreshold: 95.0, reviewThreshold: 80.0, settlementWindowDays: 2 },
    });
  }

  // Map to Python payload schema
  const payload = {
    orders: batch.orders.map((o) => ({
      order_id: o.orderId,
      customer_id: o.customerId || undefined,
      order_date: o.orderDate,
      order_amount: o.orderAmount,
      currency: o.currency,
      payment_id: o.paymentId || undefined,
      order_status: o.orderStatus,
    })),
    payments: batch.payments.map((p) => ({
      payment_id: p.paymentId,
      order_id: p.orderId || undefined,
      transaction_id: p.transactionId,
      payment_date: p.paymentDate,
      payment_time: p.paymentTime || '00:00:00',
      amount: p.amount,
      payment_status: p.paymentStatus,
      payment_method: p.paymentMethod,
    })),
    settlements: batch.settlements.map((s) => ({
      settlement_id: s.settlementId,
      transaction_id: s.transactionId,
      settlement_date: s.settlementDate,
      gross_amount: s.grossAmount,
      fee: s.fee,
      tax: s.tax,
      net_amount: s.netAmount,
      settlement_status: s.settlementStatus,
    })),
    bank_transactions: batch.bankTxns.map((b) => ({
      bank_transaction_id: b.bankTransactionId,
      settlement_id: b.settlementId || undefined,
      transaction_date: b.transactionDate,
      transaction_time: b.transactionTime || '00:00:00',
      reference: b.reference || undefined,
      credit_amount: b.creditAmount,
      bank_status: b.bankStatus,
    })),
    refunds: batch.refunds.map((r) => ({
      refund_id: r.refundId,
      transaction_id: r.transactionId,
      refund_date: r.refundDate,
      refund_amount: r.refundAmount,
      refund_status: r.refundStatus,
      refund_reason: r.refundReason || undefined,
    })),
    settings: {
      matched_threshold: settings.matchedThreshold,
      review_threshold: settings.reviewThreshold,
      settlement_window_days: settings.settlementWindowDays,
    },
  };

  const startTime = Date.now();

  // Call Python Decision Engine
  const response = await axios.post(`${PYTHON_SERVICE_URL}/reconcile`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  const engineOutput = response.data;
  const endTime = Date.now();
  const processingTimeMs = endTime - startTime;
  const processingTimeSec = Math.max(processingTimeMs / 1000.0, 0.001);
  const throughput = Math.round((engineOutput.total_records / processingTimeSec) * 100) / 100;

  // Create ReconciliationRun record in PostgreSQL
  const run = await prisma.reconciliationRun.create({
    data: {
      batchId: batch.id,
      startedAt: new Date(startTime),
      completedAt: new Date(endTime),
      totalRecords: engineOutput.total_records,
      matchedCount: engineOutput.matched_count,
      reviewCount: engineOutput.review_count,
      exceptionCount: engineOutput.exception_count,
      matchRate: engineOutput.match_rate,
      processingTimeMs,
      throughput,
      status: 'COMPLETED',
    },
  });

  // Create ReconciliationResult & Exception records
  const resultRecords = [];
  const exceptionRecords = [];

  for (const item of engineOutput.results) {
    const resStatus = item.status as ResultStatus;

    const result = await prisma.reconciliationResult.create({
      data: {
        runId: run.id,
        transactionId: item.transaction_id,
        orderId: item.order_id || null,
        status: resStatus,
        confidence: item.confidence,
        reason: item.reason,
        amountDifference: item.amount_difference || 0.0,
        dateDifference: item.date_difference || 0,
        matchedPaymentId: item.matched_payment_id || null,
        matchedSettlementId: item.matched_settlement_id || null,
        matchedBankTransactionId: item.matched_bank_transaction_id || null,
        evidence: item.evidence || {},
      },
    });

    resultRecords.push(result);

    // If REVIEW or EXCEPTION, create an Exception record
    if (resStatus === ResultStatus.REVIEW || resStatus === ResultStatus.EXCEPTION) {
      let category: ExceptionCategory = ExceptionCategory.OTHER;
      if (item.exception_category && Object.values(ExceptionCategory).includes(item.exception_category as any)) {
        category = item.exception_category as ExceptionCategory;
      }

      let severity: Severity = Severity.MEDIUM;
      if (item.severity && Object.values(Severity).includes(item.severity as any)) {
        severity = item.severity as Severity;
      } else if (resStatus === ResultStatus.EXCEPTION) {
        severity = Severity.HIGH;
      }

      const expectedVal = item.evidence?.expected_bank_amount ?? null;
      const actualVal = item.evidence?.actual_bank_amount ?? null;

      const exceptionObj = await prisma.exception.create({
        data: {
          resultId: result.id,
          transactionId: item.transaction_id,
          category,
          description: item.reason,
          expectedValue: expectedVal,
          actualValue: actualVal,
          severity,
          status: ExceptionStatus.OPEN,
        },
      });

      exceptionRecords.push(exceptionObj);
    }
  }

  // Update batch status
  await prisma.datasetBatch.update({
    where: { id: batch.id },
    data: {
      status: 'COMPLETED',
      processedAt: new Date(endTime),
    },
  });

  // Log Audit Entry
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'RECONCILIATION_COMPLETED',
      entity: 'ReconciliationRun',
      entityId: run.id,
      reason: `Completed reconciliation for ${engineOutput.total_records} records. Match rate: ${engineOutput.match_rate}%.`,
      metadata: {
        totalRecords: engineOutput.total_records,
        matchedCount: engineOutput.matched_count,
        reviewCount: engineOutput.review_count,
        exceptionCount: engineOutput.exception_count,
        matchRate: engineOutput.match_rate,
        throughput,
        processingTimeMs,
      },
    },
  });

  return {
    run,
    resultsCount: resultRecords.length,
    exceptionsCount: exceptionRecords.length,
  };
};
