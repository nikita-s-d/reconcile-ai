import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, entity, userId, page = '1', limit = '50', search } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (action) where.action = action as string;
    if (entity) where.entity = entity as string;
    if (userId) where.userId = userId as string;
    if (search) {
      where.OR = [
        { action: { contains: search as string, mode: 'insensitive' } },
        { entity: { contains: search as string, mode: 'insensitive' } },
        { reason: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.status(200).json({
      auditLogs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
};
