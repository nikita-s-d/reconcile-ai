import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';
import { parseCSVBuffer } from '../utils/csvParser';
import { processEvaluation } from '../services/evaluationService';

const prisma = new PrismaClient();

const VALID_STATUSES = ['MATCHED', 'REVIEW', 'EXCEPTION'];

export const uploadGroundTruth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file selected. Please select ground_truth.csv.' });
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ error: 'Invalid file type. Please select a CSV file.' });
    }

    const rawRows = await parseCSVBuffer(file.buffer);

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'Uploaded ground truth CSV file is empty.' });
    }

    const firstRow = rawRows[0];
    const keys = Object.keys(firstRow).map((k) => k.replace(/^\ufeff/, '').toLowerCase().trim());

    if (!keys.includes('transaction_id')) {
      return res.status(400).json({ error: 'Missing required column: transaction_id' });
    }

    if (!keys.includes('ground_truth_status')) {
      return res.status(400).json({ error: 'Missing required column: ground_truth_status' });
    }

    const seenTxIds = new Set<string>();
    const recordsToCreate: { transactionId: string; groundTruthStatus: string; groundTruthReason: string | null; expectedExceptionCategory: string | null }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      let txId = '';
      let status = '';
      let reason: string | null = null;
      let expectedCategory: string | null = null;

      for (const [key, val] of Object.entries(row)) {
        const normKey = key.replace(/^\ufeff/, '').toLowerCase().trim();
        if (normKey === 'transaction_id' || normKey === 'transactionid') {
          txId = String(val || '').trim();
        } else if (normKey === 'ground_truth_status' || normKey === 'status') {
          status = String(val || '').toUpperCase().trim();
        } else if (normKey === 'ground_truth_reason') {
          reason = val ? String(val).trim() : null;
        } else if (normKey === 'expected_exception_category') {
          expectedCategory = val ? String(val).trim() : null;
        }
      }

      if (!txId) {
        return res.status(400).json({ error: `Invalid or missing transaction_id at row ${i + 1}.` });
      }

      if (seenTxIds.has(txId)) {
        return res.status(400).json({ error: `Duplicate transaction_id found: ${txId}` });
      }
      seenTxIds.add(txId);

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid ground_truth_status: ${status}. Allowed values are MATCHED, REVIEW, or EXCEPTION.`,
        });
      }

      recordsToCreate.push({
        transactionId: txId,
        groundTruthStatus: status,
        groundTruthReason: reason,
        expectedExceptionCategory: expectedCategory,
      });
    }

    // Atomic PostgreSQL Transaction: Archive previous ACTIVE datasets, create new GroundTruthDataset, create GroundTruthRecord rows, create audit log
    const uploadResult = await prisma.$transaction(async (tx) => {
      // Mark previous active datasets as ARCHIVED
      await tx.groundTruthDataset.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });

      // Create new versioned GroundTruthDataset
      const dataset = await tx.groundTruthDataset.create({
        data: {
          filename: file.originalname || 'ground_truth.csv',
          recordCount: recordsToCreate.length,
          status: 'ACTIVE',
          uploadedBy: req.user?.userId || 'Analyst',
          records: {
            createMany: {
              data: recordsToCreate,
            },
          },
        },
      });

      // Create audit log entry inside the SAME atomic transaction
      await tx.auditLog.create({
        data: {
          userId: req.user?.userId,
          action: 'GROUND_TRUTH_UPLOADED',
          entity: 'GroundTruthDataset',
          entityId: dataset.id,
          reason: `Uploaded ground_truth.csv containing ${recordsToCreate.length} records.`,
          metadata: {
            datasetId: dataset.id,
            filename: file.originalname,
            recordCount: recordsToCreate.length,
          },
        },
      });

      return dataset;
    });

    return res.status(200).json({
      success: true,
      message: 'Ground truth uploaded successfully',
      filename: file.originalname || 'ground_truth.csv',
      recordCount: recordsToCreate.length,
      datasetId: uploadResult.id,
    });
  } catch (error: any) {
    console.error('Ground truth upload error:', error);
    return res.status(400).json({ error: `Ground truth upload failed: ${error.message}` });
  }
};

export const runEvaluation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId, groundTruthDatasetId } = req.body;

    if (req.user?.role === 'VIEWER') {
      return res.status(403).json({ error: 'You do not have permission to run evaluation.' });
    }

    const activeDataset = await prisma.groundTruthDataset.findFirst({
      where: groundTruthDatasetId ? { id: groundTruthDatasetId } : { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeDataset || activeDataset.recordCount === 0) {
      return res.status(400).json({
        error: 'Please upload a valid ground_truth.csv before running evaluation.',
      });
    }

    let targetRunId = runId;
    if (!targetRunId) {
      const latestRun = await prisma.reconciliationRun.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
      });

      if (!latestRun) {
        return res.status(400).json({
          error: 'No completed reconciliation run available for evaluation.',
        });
      }
      targetRunId = latestRun.id;
    } else {
      const specifiedRun = await prisma.reconciliationRun.findUnique({
        where: { id: targetRunId },
      });
      if (!specifiedRun || specifiedRun.status !== 'COMPLETED') {
        return res.status(400).json({
          error: 'No completed reconciliation run available for evaluation.',
        });
      }
    }

    const predCount = await prisma.reconciliationResult.count({
      where: { runId: targetRunId },
    });
    if (predCount === 0) {
      return res.status(400).json({
        error: 'No reconciliation predictions found.',
      });
    }

    const evalOutcome = await processEvaluation(targetRunId, activeDataset.id, req.user?.userId);

    return res.status(200).json({
      success: true,
      message: 'Evaluation completed successfully',
      evaluation: evalOutcome,
      metrics: evalOutcome,
    });
  } catch (error: any) {
    console.error('Run evaluation error:', error);
    return res.status(400).json({ error: error.message || 'Evaluation failed due to a server error. Please try again.' });
  }
};

export const getEvaluationResults = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeDataset = await prisma.groundTruthDataset.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const groundTruthDatasetPayload = activeDataset
      ? {
          id: activeDataset.id,
          filename: activeDataset.filename,
          recordCount: activeDataset.recordCount,
          status: activeDataset.status,
          createdAt: activeDataset.createdAt.toISOString(),
        }
      : null;

    if (!activeDataset) {
      return res.status(200).json({
        hasEvaluated: false,
        groundTruthDataset: null,
        evaluation: null,
        metrics: null,
      });
    }

    // Query EvaluationResult strictly associated with the current ACTIVE GroundTruthDataset
    const latestEval = await prisma.evaluationResult.findFirst({
      where: { groundTruthDatasetId: activeDataset.id },
      orderBy: { createdAt: 'desc' },
      include: { run: true, groundTruthDataset: true },
    });

    if (!latestEval) {
      return res.status(200).json({
        hasEvaluated: false,
        groundTruthDataset: groundTruthDatasetPayload,
        evaluation: null,
        metrics: null,
      });
    }

    const metricsObj = {
      total_gt_records: latestEval.totalGtRecords,
      matched_eval_records: latestEval.matchedEvalRecords,
      unmatched_gt_records: latestEval.unmatchedGtRecords,
      missing_predictions_count: latestEval.missingPredictionsCount,
      correct_predictions: latestEval.correctPredictions,
      incorrect_predictions: latestEval.incorrectPredictions,
      accuracy: latestEval.accuracy,
      precision_macro: latestEval.precisionMacro,
      recall_macro: latestEval.recallMacro,
      f1_macro: latestEval.f1Macro,
      f1_weighted: latestEval.f1Weighted,
      per_class_metrics: latestEval.perClassMetrics,
      confusion_matrix: latestEval.confusionMatrix,
    };

    return res.status(200).json({
      hasEvaluated: true,
      groundTruthDataset: groundTruthDatasetPayload,
      latestRunId: latestEval.runId,
      groundTruthDatasetId: latestEval.groundTruthDatasetId,
      evaluationId: latestEval.id,
      accuracy: latestEval.accuracy,
      precision: latestEval.precisionMacro,
      recall: latestEval.recallMacro,
      f1Score: latestEval.f1Macro,
      f1Weighted: latestEval.f1Weighted,
      matchRate: latestEval.run.matchRate,
      metrics: metricsObj,
      evaluation: metricsObj,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch evaluation status.' });
  }
};
