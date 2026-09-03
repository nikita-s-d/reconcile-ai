import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';
import { triggerReconciliationRun } from '../services/reconciliationService';

const prisma = new PrismaClient();

export const runReconciliation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId } = req.body;

    if (!batchId) {
      // If batchId not specified, pick the latest READY batch
      const latestBatch = await prisma.datasetBatch.findFirst({
        orderBy: { uploadedAt: 'desc' },
      });
      if (!latestBatch) {
        return res.status(400).json({ error: 'No dataset batch found. Please upload a dataset first.' });
      }
      const outcome = await triggerReconciliationRun(latestBatch.id, req.user?.userId);
      return res.status(200).json({
        message: 'Reconciliation run completed successfully.',
        run: outcome.run,
      });
    }

    const outcome = await triggerReconciliationRun(batchId, req.user?.userId);
    return res.status(200).json({
      message: 'Reconciliation run completed successfully.',
      run: outcome.run,
    });
  } catch (error: any) {
    console.error('Run reconciliation error:', error);
    return res.status(500).json({ error: `Reconciliation run failed: ${error.message}` });
  }
};

export const getRuns = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const runs = await prisma.reconciliationRun.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        batch: {
          select: { name: true, recordCount: true },
        },
      },
    });
    return res.status(200).json({ runs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch reconciliation runs.' });
  }
};

export const getRunById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.reconciliationRun.findUnique({
      where: { id },
      include: {
        batch: true,
        results: {
          take: 50,
          orderBy: { confidence: 'desc' },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Reconciliation run not found.' });
    }

    return res.status(200).json({ run });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch run details.' });
  }
};

export const getResults = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId, status, page = '1', limit = '50', search } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (runId) where.runId = runId as string;
    if (status) where.status = status as any;
    if (search) {
      where.OR = [
        { transactionId: { contains: search as string, mode: 'insensitive' } },
        { orderId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [results, total] = await Promise.all([
      prisma.reconciliationResult.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { exception: true },
      }),
      prisma.reconciliationResult.count({ where }),
    ]);

    return res.status(200).json({
      results,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch reconciliation results.' });
  }
};

export const getResultById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await prisma.reconciliationResult.findUnique({
      where: { id },
      include: {
        run: true,
        exception: true,
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Reconciliation result not found.' });
    }

    // Fetch related raw records from batch for rich visual breakdown
    const txId = result.transactionId;
    const batchId = result.run.batchId;

    const [order, payment, settlement, bankTxns, refund] = await Promise.all([
      prisma.order.findFirst({ where: { batchId, OR: [{ paymentId: result.matchedPaymentId || '' }, { orderId: result.orderId || '' }] } }),
      prisma.payment.findFirst({ where: { batchId, transactionId: txId } }),
      prisma.settlement.findFirst({ where: { batchId, transactionId: txId } }),
      prisma.bankTransaction.findMany({ where: { batchId, OR: [{ reference: txId }, { settlementId: result.matchedSettlementId || '' }] } }),
      prisma.refund.findFirst({ where: { batchId, transactionId: txId } }),
    ]);

    return res.status(200).json({
      result,
      relatedRecords: {
        order,
        payment,
        settlement,
        bankTransactions: bankTxns,
        refund,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch result details.' });
  }
};
