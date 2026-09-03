import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient, ResultStatus, ExceptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const getExceptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, status, severity, page = '1', limit = '50', search } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (category) where.category = category as any;
    if (status) where.status = status as any;
    if (severity) where.severity = severity as any;
    if (search) {
      where.OR = [
        { transactionId: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [exceptions, total] = await Promise.all([
      prisma.exception.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          result: true,
        },
      }),
      prisma.exception.count({ where }),
    ]);

    return res.status(200).json({
      exceptions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch exceptions.' });
  }
};

export const getExceptionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const exception = await prisma.exception.findUnique({
      where: { id },
      include: {
        result: {
          include: { run: true },
        },
      },
    });

    if (!exception) {
      return res.status(404).json({ error: 'Exception record not found.' });
    }

    return res.status(200).json({ exception });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch exception details.' });
  }
};

export const approveMatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const exception = await prisma.exception.findUnique({
      where: { id },
      include: { result: true },
    });

    if (!exception) {
      return res.status(404).json({ error: 'Exception not found.' });
    }

    // Update result status from REVIEW -> MATCHED
    await prisma.reconciliationResult.update({
      where: { id: exception.resultId },
      data: {
        status: ResultStatus.MATCHED,
        reason: `Manually Approved Match: ${reason || 'Approved by analyst after review'}`,
      },
    });

    // Update exception status to RESOLVED
    const updatedException = await prisma.exception.update({
      where: { id },
      data: {
        status: ExceptionStatus.RESOLVED,
        resolvedBy: req.user?.name || req.user?.email || 'Analyst',
        resolutionNote: `MANUAL MATCH APPROVED: ${reason || 'Approved by human reviewer'}`,
        resolvedAt: new Date(),
      },
    });

    // Update run counts
    await prisma.reconciliationRun.update({
      where: { id: exception.result.runId },
      data: {
        matchedCount: { increment: 1 },
        reviewCount: { decrement: 1 },
      },
    });

    // Log Audit Entry
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'MANUAL_MATCH_APPROVED',
        entity: 'Exception',
        entityId: id,
        previousValue: 'REVIEW',
        newValue: 'MATCHED',
        reason: reason || 'Manual match approved by reviewer.',
        metadata: {
          transactionId: exception.transactionId,
          resultId: exception.resultId,
        },
      },
    });

    return res.status(200).json({
      message: 'Match approved successfully. Status updated to MATCHED.',
      exception: updatedException,
    });
  } catch (error: any) {
    return res.status(500).json({ error: `Failed to approve match: ${error.message}` });
  }
};

export const rejectMatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const exception = await prisma.exception.findUnique({
      where: { id },
      include: { result: true },
    });

    if (!exception) {
      return res.status(404).json({ error: 'Exception not found.' });
    }

    // Update result status to EXCEPTION
    await prisma.reconciliationResult.update({
      where: { id: exception.resultId },
      data: {
        status: ResultStatus.EXCEPTION,
        reason: `Manually Classified as Exception: ${reason || 'Rejected by reviewer'}`,
      },
    });

    const updatedException = await prisma.exception.update({
      where: { id },
      data: {
        severity: 'HIGH',
      },
    });

    // Update run counts
    if (exception.result.status === ResultStatus.REVIEW) {
      await prisma.reconciliationRun.update({
        where: { id: exception.result.runId },
        data: {
          reviewCount: { decrement: 1 },
          exceptionCount: { increment: 1 },
        },
      });
    }

    // Log Audit Entry
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'MANUAL_MATCH_REJECTED',
        entity: 'Exception',
        entityId: id,
        previousValue: exception.result.status,
        newValue: 'EXCEPTION',
        reason: reason || 'Manual review marked record as exception.',
        metadata: {
          transactionId: exception.transactionId,
          resultId: exception.resultId,
        },
      },
    });

    return res.status(200).json({
      message: 'Record marked as EXCEPTION.',
      exception: updatedException,
    });
  } catch (error: any) {
    return res.status(500).json({ error: `Failed to mark exception: ${error.message}` });
  }
};

export const resolveException = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;

    if (!resolutionNote) {
      return res.status(400).json({ error: 'Resolution note is required.' });
    }

    const exception = await prisma.exception.findUnique({ where: { id } });
    if (!exception) {
      return res.status(404).json({ error: 'Exception not found.' });
    }

    const updatedException = await prisma.exception.update({
      where: { id },
      data: {
        status: ExceptionStatus.RESOLVED,
        resolvedBy: req.user?.name || req.user?.email || 'Analyst',
        resolutionNote,
        resolvedAt: new Date(),
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'EXCEPTION_RESOLVED',
        entity: 'Exception',
        entityId: id,
        previousValue: 'OPEN',
        newValue: 'RESOLVED',
        reason: resolutionNote,
        metadata: {
          transactionId: exception.transactionId,
        },
      },
    });

    return res.status(200).json({
      message: 'Exception marked as RESOLVED.',
      exception: updatedException,
    });
  } catch (error: any) {
    return res.status(500).json({ error: `Failed to resolve exception: ${error.message}` });
  }
};

export const reopenException = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const exception = await prisma.exception.findUnique({ where: { id } });
    if (!exception) {
      return res.status(404).json({ error: 'Exception not found.' });
    }

    const updatedException = await prisma.exception.update({
      where: { id },
      data: {
        status: ExceptionStatus.OPEN,
        resolvedBy: null,
        resolutionNote: null,
        resolvedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'EXCEPTION_REOPENED',
        entity: 'Exception',
        entityId: id,
        previousValue: 'RESOLVED',
        newValue: 'OPEN',
        reason: 'Exception reopened by analyst.',
      },
    });

    return res.status(200).json({
      message: 'Exception reopened.',
      exception: updatedException,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reopen exception.' });
  }
};
