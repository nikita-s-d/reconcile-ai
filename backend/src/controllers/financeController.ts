import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  getDashboardMetrics,
  getRunHistory,
  getFinanceReport,
  querySettlements,
  getCashPositionAndForecast,
  getTaxVerification,
} from '../services/financeService';

export const getDashboardMetricsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getDashboardMetrics();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch AI Finance Controller dashboard metrics.' });
  }
};

export const getRunHistoryHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const runs = await getRunHistory();
    return res.status(200).json({ runs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch run history.' });
  }
};

export const getFinanceReportHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const report = await getFinanceReport(runId);
    return res.status(200).json(report);
  } catch (error: any) {
    return res.status(404).json({ error: error.message || 'Finance report not found.' });
  }
};

export const querySettlementsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid question text.' });
    }
    const result = await querySettlements(query);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to execute settlement query.' });
  }
};

export const getCashPositionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cashData = await getCashPositionAndForecast();
    return res.status(200).json(cashData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to calculate cash position and forecast.' });
  }
};

export const getTaxVerificationHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taxData = await getTaxVerification();
    return res.status(200).json(taxData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to execute tax verification.' });
  }
};
