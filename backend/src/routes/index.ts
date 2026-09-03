import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

import { login, logout, getMe } from '../controllers/authController';
import { uploadDataset, getDatasets, getDatasetById } from '../controllers/datasetController';
import { runReconciliation, getRuns, getRunById, getResults, getResultById } from '../controllers/reconciliationController';
import { getTransactions, getTransactionById } from '../controllers/transactionController';
import { getExceptions, getExceptionById, approveMatch, rejectMatch, resolveException, reopenException } from '../controllers/exceptionController';
import { getMetrics, getExceptionsAnalytics, getPerformanceAnalytics } from '../controllers/analyticsController';
import { uploadGroundTruth, runEvaluation, getEvaluationResults } from '../controllers/evaluationController';
import { getAuditLogs } from '../controllers/auditController';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { exportResultsCSV, exportExceptionsCSV, exportAuditCSV, exportEvaluationCSV } from '../controllers/exportController';
import {
  getDashboardMetricsHandler,
  getRunHistoryHandler,
  getFinanceReportHandler,
  querySettlementsHandler,
  getCashPositionHandler,
  getTaxVerificationHandler,
} from '../controllers/financeController';
import { processAgentChatHandler } from '../controllers/agentController';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// AUTH
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticateJWT, getMe);

// DATASETS
router.post(
  '/datasets/upload',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.ANALYST]),
  upload.fields([
    { name: 'orders', maxCount: 1 },
    { name: 'payments', maxCount: 1 },
    { name: 'settlements', maxCount: 1 },
    { name: 'bank_transactions', maxCount: 1 },
    { name: 'refunds', maxCount: 1 },
  ]),
  uploadDataset
);
router.get('/datasets', authenticateJWT, getDatasets);
router.get('/datasets/:id', authenticateJWT, getDatasetById);

// RECONCILIATION
router.post('/reconciliation/run', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), runReconciliation);
router.get('/reconciliation/runs', authenticateJWT, getRuns);
router.get('/reconciliation/runs/:id', authenticateJWT, getRunById);
router.get('/reconciliation/results', authenticateJWT, getResults);
router.get('/reconciliation/results/:id', authenticateJWT, getResultById);

// TRANSACTIONS
router.get('/transactions', authenticateJWT, getTransactions);
router.get('/transactions/:id', authenticateJWT, getTransactionById);

// EXCEPTIONS
router.get('/exceptions', authenticateJWT, getExceptions);
router.get('/exceptions/:id', authenticateJWT, getExceptionById);
router.post('/exceptions/:id/approve', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), approveMatch);
router.post('/exceptions/:id/reject', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), rejectMatch);
router.post('/exceptions/:id/resolve', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), resolveException);
router.post('/exceptions/:id/reopen', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), reopenException);

// ANALYTICS
router.get('/analytics/metrics', authenticateJWT, getMetrics);
router.get('/analytics/exceptions', authenticateJWT, getExceptionsAnalytics);
router.get('/analytics/performance', authenticateJWT, getPerformanceAnalytics);

// EVALUATION
router.post('/evaluation/upload-ground-truth', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), upload.single('file'), uploadGroundTruth);
router.post('/evaluation/run', authenticateJWT, requireRole([Role.ADMIN, Role.ANALYST]), runEvaluation);
router.get('/evaluation/results', authenticateJWT, getEvaluationResults);

// AI FINANCE CONTROLLER ENDPOINTS
router.get('/finance/dashboard', authenticateJWT, getDashboardMetricsHandler);
router.get('/finance/runs', authenticateJWT, getRunHistoryHandler);
router.get('/finance/reports/:runId', authenticateJWT, getFinanceReportHandler);
router.post('/finance/settlements/qa', authenticateJWT, querySettlementsHandler);
router.get('/finance/cash-position', authenticateJWT, getCashPositionHandler);
router.get('/finance/tax-verification', authenticateJWT, getTaxVerificationHandler);

// AI FINANCE CONTROLLER AGENT CHAT
router.post('/agent/chat', authenticateJWT, processAgentChatHandler);

// AUDIT LOGS
router.get('/audit-logs', authenticateJWT, getAuditLogs);

// EXPORT
router.get('/export/results', authenticateJWT, exportResultsCSV);
router.get('/export/exceptions', authenticateJWT, exportExceptionsCSV);
router.get('/export/audit', authenticateJWT, exportAuditCSV);
router.get('/export/evaluation', authenticateJWT, exportEvaluationCSV);

// SETTINGS
router.get('/settings', authenticateJWT, getSettings);
router.put('/settings', authenticateJWT, requireRole([Role.ADMIN]), updateSettings);

export default router;
