import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Pick latest completed reconciliation run
    const latestRun = await prisma.reconciliationRun.findFirst({
      orderBy: { startedAt: 'desc' },
      include: { batch: true },
    });

    if (!latestRun) {
      return res.status(200).json({
        hasData: false,
        totalRecords: 0,
        matchedCount: 0,
        reviewCount: 0,
        exceptionCount: 0,
        matchRate: null,
        accuracy: null,
        precision: null,
        recall: null,
        f1Score: null,
        processingTimeMs: null,
        throughput: null,
        statusBreakdown: [],
        categoryBreakdown: [],
      });
    }

    // Dynamic metrics from PostgreSQL
    const statusCounts = await prisma.reconciliationResult.groupBy({
      by: ['status'],
      where: { runId: latestRun.id },
      _count: { id: true },
    });

    const categoryCounts = await prisma.exception.groupBy({
      by: ['category'],
      where: { result: { runId: latestRun.id } },
      _count: { id: true },
    });

    const statusBreakdown = statusCounts.map((sc) => ({
      status: sc.status,
      count: sc._count.id,
    }));

    const categoryBreakdown = categoryCounts.map((cc) => ({
      category: cc.category,
      count: cc._count.id,
    }));

    return res.status(200).json({
      hasData: true,
      latestRunId: latestRun.id,
      batchName: latestRun.batch.name,
      totalRecords: latestRun.totalRecords,
      matchedCount: latestRun.matchedCount,
      reviewCount: latestRun.reviewCount,
      exceptionCount: latestRun.exceptionCount,
      matchRate: latestRun.matchRate,
      accuracy: latestRun.accuracy,
      precision: latestRun.precision,
      recall: latestRun.recall,
      f1Score: latestRun.f1Score,
      processingTimeMs: latestRun.processingTimeMs,
      throughput: latestRun.throughput,
      startedAt: latestRun.startedAt,
      completedAt: latestRun.completedAt,
      statusBreakdown,
      categoryBreakdown,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch analytics metrics.' });
  }
};

export const getExceptionsAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categoryStats = await prisma.exception.groupBy({
      by: ['category', 'status'],
      _count: { id: true },
    });

    const severityStats = await prisma.exception.groupBy({
      by: ['severity'],
      _count: { id: true },
    });

    return res.status(200).json({
      categoryStats,
      severityStats,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch exception analytics.' });
  }
};

export const getPerformanceAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const runs = await prisma.reconciliationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        startedAt: true,
        totalRecords: true,
        matchRate: true,
        processingTimeMs: true,
        throughput: true,
      },
    });

    return res.status(200).json({ runs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch performance analytics.' });
  }
};
