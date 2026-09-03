import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const exportResultsCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await prisma.reconciliationResult.findMany({
      orderBy: { createdAt: 'desc' },
      include: { run: true },
    });

    const headers = ['transaction_id', 'order_id', 'status', 'confidence', 'amount_difference', 'date_difference', 'reason', 'matched_payment_id', 'matched_settlement_id', 'matched_bank_tx_id', 'created_at'];
    const rows = results.map((r) => [
      r.transactionId,
      r.orderId || '',
      r.status,
      r.confidence,
      r.amountDifference,
      r.dateDifference,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.matchedPaymentId || '',
      r.matchedSettlementId || '',
      r.matchedBankTransactionId || '',
      r.createdAt.toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reconciliation_results.csv"');
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to export results CSV.' });
  }
};

export const exportExceptionsCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exceptions = await prisma.exception.findMany({
      orderBy: { createdAt: 'desc' },
      include: { result: true },
    });

    const headers = ['id', 'transaction_id', 'category', 'description', 'expected_value', 'actual_value', 'severity', 'status', 'resolved_by', 'resolution_note', 'resolved_at', 'created_at'];
    const rows = exceptions.map((e) => [
      e.id,
      e.transactionId,
      e.category,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.expectedValue ?? '',
      e.actualValue ?? '',
      e.severity,
      e.status,
      e.resolvedBy || '',
      `"${(e.resolutionNote || '').replace(/"/g, '""')}"`,
      e.resolvedAt ? e.resolvedAt.toISOString() : '',
      e.createdAt.toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="exceptions_list.csv"');
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to export exceptions CSV.' });
  }
};

export const exportAuditCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: { user: true },
    });

    if (!logs || logs.length === 0) {
      return res.status(400).json({ error: 'No audit records available for export.' });
    }

    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Reason', 'Description', 'Previous Value', 'New Value'];
    const rows = logs.map((l) => [
      l.timestamp.toISOString(),
      l.user ? l.user.email : 'System Engine',
      l.action,
      l.entity,
      l.entityId || '',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.previousValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Create Audit Log for export action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'AUDIT_LOG_EXPORTED',
        entity: 'AuditLog',
        reason: 'Exported audit log to CSV.',
      },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to export audit CSV.' });
  }
};

export const exportEvaluationCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const latestEval = await prisma.evaluationResult.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { run: true },
    });

    if (!latestEval) {
      return res.status(400).json({ error: 'No completed evaluation available for export.' });
    }

    const cm = (latestEval.confusionMatrix as any)?.matrix || {};

    const rows = [
      ['Metric', 'Value'],
      ['Accuracy (%)', latestEval.accuracy],
      ['Precision (Macro %)', latestEval.precisionMacro],
      ['Recall (Macro %)', latestEval.recallMacro],
      ['F1 Score (Macro %)', latestEval.f1Macro],
      ['F1 Score (Weighted %)', latestEval.f1Weighted],
      ['Match Rate (%)', latestEval.run.matchRate],
      ['Total Records', latestEval.run.totalRecords],
      ['Evaluated Records', latestEval.matchedEvalRecords],
      ['Correct Predictions', latestEval.correctPredictions],
      ['Incorrect Predictions', latestEval.incorrectPredictions],
      ['Unmatched Ground Truth Records', latestEval.unmatchedGtRecords],
      ['Missing Predictions', latestEval.missingPredictionsCount],
      ['Processing Time (ms)', latestEval.run.processingTimeMs],
      ['Throughput (records/sec)', latestEval.run.throughput],
      ['', ''],
      ['CONFUSION MATRIX (Actual \\ Predicted)', 'MATCHED', 'REVIEW', 'EXCEPTION'],
      ['MATCHED', cm.MATCHED?.MATCHED || 0, cm.MATCHED?.REVIEW || 0, cm.MATCHED?.EXCEPTION || 0],
      ['REVIEW', cm.REVIEW?.MATCHED || 0, cm.REVIEW?.REVIEW || 0, cm.REVIEW?.EXCEPTION || 0],
      ['EXCEPTION', cm.EXCEPTION?.MATCHED || 0, cm.EXCEPTION?.REVIEW || 0, cm.EXCEPTION?.EXCEPTION || 0],
    ];

    const csvContent = rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

    // Create Audit Log for export action
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'EVALUATION_REPORT_EXPORTED',
        entity: 'EvaluationResult',
        entityId: latestEval.id,
        reason: 'Exported evaluation report CSV.',
      },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluation_report.csv"');
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to export evaluation report.' });
  }
};
