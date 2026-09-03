import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, minAmount, maxAmount, minConfidence, maxConfidence, search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Pick latest run if runId not provided
    const latestRun = await prisma.reconciliationRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!latestRun) {
      return res.status(200).json({
        transactions: [],
        pagination: { total: 0, page: 1, limit: limitNum, totalPages: 0 },
      });
    }

    const where: any = { runId: latestRun.id };

    if (status) where.status = status as any;
    if (minConfidence) where.confidence = { gte: parseFloat(minConfidence as string) };
    if (maxConfidence) {
      where.confidence = { ...where.confidence, lte: parseFloat(maxConfidence as string) };
    }

    if (search) {
      where.OR = [
        { transactionId: { contains: search as string, mode: 'insensitive' } },
        { orderId: { contains: search as string, mode: 'insensitive' } },
        { reason: { contains: search as string, mode: 'insensitive' } },
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
      transactions: results,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};

export const getTransactionById = async (req: AuthenticatedRequest, res: Response) => {
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
      return res.status(404).json({ error: 'Transaction result not found.' });
    }

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
      transaction: result,
      details: {
        order,
        payment,
        settlement,
        bankTransactions: bankTxns,
        refund,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch transaction details.' });
  }
};
