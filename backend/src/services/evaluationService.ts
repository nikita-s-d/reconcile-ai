import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const PYTHON_SERVICE_URL = process.env.RECONCILIATION_SERVICE_URL || 'http://localhost:8000';

export interface GroundTruthRow {
  transaction_id: string;
  ground_truth_status: string;
  ground_truth_reason?: string;
  expected_exception_category?: string;
}

export const processEvaluation = async (runId: string, groundTruthDatasetId?: string, userId?: string) => {
  const run = await prisma.reconciliationRun.findUnique({
    where: { id: runId },
    include: {
      results: true,
    },
  });

  if (!run) {
    throw new Error('No completed reconciliation run available for evaluation.');
  }

  if (!run.results || run.results.length === 0) {
    throw new Error('No reconciliation predictions found.');
  }

  // Resolve target Ground Truth Dataset
  let targetGtDataset;
  if (groundTruthDatasetId) {
    targetGtDataset = await prisma.groundTruthDataset.findUnique({
      where: { id: groundTruthDatasetId },
      include: { records: true },
    });
  } else {
    targetGtDataset = await prisma.groundTruthDataset.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { records: true },
    });
  }

  if (!targetGtDataset || !targetGtDataset.records || targetGtDataset.records.length === 0) {
    throw new Error('Please upload a valid ground_truth.csv before running evaluation.');
  }

  const groundTruthEntries: GroundTruthRow[] = targetGtDataset.records.map((gt) => ({
    transaction_id: gt.transactionId,
    ground_truth_status: gt.groundTruthStatus,
    ground_truth_reason: gt.groundTruthReason || undefined,
    expected_exception_category: gt.expectedExceptionCategory || undefined,
  }));

  // Log EVALUATION_STARTED audit log
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'EVALUATION_STARTED',
      entity: 'ReconciliationRun',
      entityId: runId,
      reason: `Started ground truth evaluation for reconciliation run ${runId} using ground truth dataset ${targetGtDataset.id} (${targetGtDataset.recordCount} records).`,
      metadata: {
        runId,
        groundTruthDatasetId: targetGtDataset.id,
        gtRecordCount: targetGtDataset.recordCount,
        predictionCount: run.results.length,
      },
    },
  });

  // Format prediction items for Python evaluate payload
  const predictionsPayload = run.results.map((r) => ({
    transaction_id: r.transactionId,
    order_id: r.orderId || undefined,
    matched_payment_id: r.matchedPaymentId || undefined,
    matched_settlement_id: r.matchedSettlementId || undefined,
    matched_bank_transaction_id: r.matchedBankTransactionId || undefined,
    status: r.status,
    confidence: r.confidence,
    reason: r.reason,
    amount_difference: r.amountDifference,
    date_difference: r.dateDifference,
    evidence: (r.evidence as any) || {},
  }));

  const payload = {
    predictions: predictionsPayload,
    ground_truth: groundTruthEntries,
  };

  let response;
  try {
    response = await axios.post(`${PYTHON_SERVICE_URL}/evaluate`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  } catch (err: any) {
    throw new Error('Evaluation engine is unavailable. Please make sure the Python evaluation service is running.');
  }

  const evalMetrics = response.data;

  // Persist EvaluationResult in PostgreSQL associated with BOTH runId AND groundTruthDatasetId
  const savedEval = await prisma.evaluationResult.create({
    data: {
      runId,
      groundTruthDatasetId: targetGtDataset.id,
      totalGtRecords: evalMetrics.total_gt_records,
      matchedEvalRecords: evalMetrics.matched_eval_records,
      unmatchedGtRecords: evalMetrics.unmatched_gt_records,
      missingPredictionsCount: evalMetrics.missing_predictions_count,
      correctPredictions: evalMetrics.correct_predictions,
      incorrectPredictions: evalMetrics.incorrect_predictions,
      accuracy: evalMetrics.accuracy,
      precisionMacro: evalMetrics.precision_macro,
      recallMacro: evalMetrics.recall_macro,
      f1Macro: evalMetrics.f1_macro,
      f1Weighted: evalMetrics.f1_weighted,
      perClassMetrics: evalMetrics.per_class_metrics || {},
      confusionMatrix: evalMetrics.confusion_matrix || {},
      createdBy: userId || 'Analyst',
    },
  });

  // Update ReconciliationRun record in PostgreSQL with evaluated metrics
  await prisma.reconciliationRun.update({
    where: { id: runId },
    data: {
      accuracy: evalMetrics.accuracy,
      precision: evalMetrics.precision_macro,
      recall: evalMetrics.recall_macro,
      f1Score: evalMetrics.f1_macro,
    },
  });

  // Log EVALUATION_COMPLETED audit log entry
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: 'EVALUATION_COMPLETED',
      entity: 'EvaluationResult',
      entityId: savedEval.id,
      reason: `Completed ground truth evaluation for reconciliation run ${runId}. Accuracy: ${evalMetrics.accuracy}%, F1: ${evalMetrics.f1_macro}%.`,
      metadata: {
        evaluationId: savedEval.id,
        runId,
        groundTruthDatasetId: targetGtDataset.id,
        accuracy: evalMetrics.accuracy,
        precisionMacro: evalMetrics.precision_macro,
        recallMacro: evalMetrics.recall_macro,
        f1Macro: evalMetrics.f1_macro,
        f1Weighted: evalMetrics.f1_weighted,
        totalGtRecords: evalMetrics.total_gt_records,
        matchedEvalRecords: evalMetrics.matched_eval_records,
      },
    },
  });

  return {
    evaluationId: savedEval.id,
    runId,
    groundTruthDatasetId: targetGtDataset.id,
    accuracy: evalMetrics.accuracy,
    precisionMacro: evalMetrics.precision_macro,
    recallMacro: evalMetrics.recall_macro,
    f1Macro: evalMetrics.f1_macro,
    f1Weighted: evalMetrics.f1_weighted,

    // Snake case properties for complete compatibility
    precision_macro: evalMetrics.precision_macro,
    recall_macro: evalMetrics.recall_macro,
    f1_macro: evalMetrics.f1_macro,
    f1_weighted: evalMetrics.f1_weighted,
    total_gt_records: evalMetrics.total_gt_records,
    matched_eval_records: evalMetrics.matched_eval_records,
    unmatched_gt_records: evalMetrics.unmatched_gt_records,
    missing_predictions_count: evalMetrics.missing_predictions_count,
    correct_predictions: evalMetrics.correct_predictions,
    incorrect_predictions: evalMetrics.incorrect_predictions,

    totalGtRecords: evalMetrics.total_gt_records,
    matchedEvalRecords: evalMetrics.matched_eval_records,
    unmatchedGtRecords: evalMetrics.unmatched_gt_records,
    missingPredictionsCount: evalMetrics.missing_predictions_count,
    correctPredictions: evalMetrics.correct_predictions,
    incorrectPredictions: evalMetrics.incorrect_predictions,
    confusionMatrix: evalMetrics.confusion_matrix,
    confusion_matrix: evalMetrics.confusion_matrix,
    perClassMetrics: evalMetrics.per_class_metrics,
    per_class_metrics: evalMetrics.per_class_metrics,
    matchRate: run.matchRate,
  };
};
