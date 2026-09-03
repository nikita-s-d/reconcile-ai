import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          matchedThreshold: 95.0,
          reviewThreshold: 80.0,
          settlementWindowDays: 2,
        },
      });
    }

    return res.status(200).json({ settings });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matchedThreshold, reviewThreshold, settlementWindowDays } = req.body;

    const previousSettings = await prisma.settings.findUnique({ where: { id: 'default' } });

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        matchedThreshold: matchedThreshold !== undefined ? parseFloat(matchedThreshold) : undefined,
        reviewThreshold: reviewThreshold !== undefined ? parseFloat(reviewThreshold) : undefined,
        settlementWindowDays: settlementWindowDays !== undefined ? parseInt(settlementWindowDays, 10) : undefined,
      },
      create: {
        id: 'default',
        matchedThreshold: matchedThreshold !== undefined ? parseFloat(matchedThreshold) : 95.0,
        reviewThreshold: reviewThreshold !== undefined ? parseFloat(reviewThreshold) : 80.0,
        settlementWindowDays: settlementWindowDays !== undefined ? parseInt(settlementWindowDays, 10) : 2,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'SETTINGS_UPDATED',
        entity: 'Settings',
        entityId: 'default',
        previousValue: JSON.stringify(previousSettings),
        newValue: JSON.stringify(settings),
        reason: 'Reconciliation parameters updated by user.',
      },
    });

    return res.status(200).json({
      message: 'Settings updated successfully.',
      settings,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
};
