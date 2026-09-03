import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AnalyticsMetrics } from '../types';
import {
  UploadCloud,
  PlaySquare,
  RefreshCw,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  HelpCircle,
  Zap,
  Percent,
  Clock,
  IndianRupee,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface FinanceDashboardMetrics {
  totalRecordsProcessed: number;
  totalTransactionValue: number;
  reconciledValue: number;
  exceptionValue: number;
  reviewValue: number;
  matchedCount: number;
  reviewCount: number;
  exceptionCount: number;
  matchRate: number;
  reconciliationCoverage: number;
  processingTimeSec: number;
  throughput: number;
  pendingSettlementsCount: number;
  pendingSettlementValue: number;
  currentCashPosition: number;
  projectedCashPosition30d: number;
  latestRunId: string | null;
  batchName: string | null;
}

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [financeMetrics, setFinanceMetrics] = useState<FinanceDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, fRes] = await Promise.all([
        api.get('/analytics/metrics'),
        api.get('/finance/dashboard'),
      ]);
      setMetrics(mRes.data);
      setFinanceMetrics(fRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const COLORS = {
    MATCHED: '#10b981', // emerald
    REVIEW: '#f59e0b',  // amber
    EXCEPTION: '#ef4444', // red
  };

  const pieData = metrics?.statusBreakdown?.map((item) => ({
    name: item.status,
    value: item.count,
    color: COLORS[item.status as keyof typeof COLORS] || '#6b7280',
  })) || [];

  const barData = metrics?.categoryBreakdown?.map((item) => ({
    category: item.category.replace('_', ' '),
    count: item.count,
  })) || [];

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            AI Finance Controller Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time financial reconciliation status, throughput, and cash flow intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/reconciliation')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <PlaySquare className="w-4 h-4" />
            <span>Reconciliation Agent</span>
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 text-gray-700 dark:text-gray-200 font-medium text-sm rounded-lg shadow-xs transition-colors flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Dataset</span>
          </button>
          <button
            onClick={fetchMetrics}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 text-gray-500 dark:text-gray-400 rounded-lg shadow-xs transition-colors"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <span>Records Processed</span>
            <Receipt className="w-4 h-4" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white">
            {metrics?.hasData ? metrics.totalRecords.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {metrics?.batchName ? `Batch: ${metrics.batchName}` : 'No batch uploaded'}
          </p>
        </div>

        {/* Matched */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Matched</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {metrics?.hasData ? metrics.matchedCount.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Automated 100% verification</p>
        </div>

        {/* Review */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Needs Review</span>
            <HelpCircle className="w-4 h-4" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics?.hasData ? metrics.reviewCount.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Human escalation required</p>
        </div>

        {/* Exceptions */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <span>Exceptions</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-rose-600 dark:text-rose-400">
            {metrics?.hasData ? metrics.exceptionCount.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Honest unresolved discrepancies</p>
        </div>
      </div>

      {/* Financial Valuation Cards Bar */}
      {financeMetrics && financeMetrics.totalTransactionValue > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Total Transaction Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(financeMetrics.totalTransactionValue)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Reconciled Value</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(financeMetrics.reconciledValue)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Exception Value</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(financeMetrics.exceptionValue)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Current Cash Position</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(financeMetrics.currentCashPosition)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Performance Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Match Rate */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Match Rate</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {metrics?.hasData && metrics.matchRate !== null ? `${metrics.matchRate}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Evaluated Accuracy */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Accuracy</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {metrics?.hasData && metrics.accuracy !== null ? `${metrics.accuracy}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Processing Time */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Processing Time</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {financeMetrics && financeMetrics.processingTimeSec > 0 ? `${financeMetrics.processingTimeSec}s` : metrics?.hasData && metrics.processingTimeMs !== null ? `${metrics.processingTimeMs} ms` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Throughput */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Throughput</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {metrics?.hasData && metrics.throughput !== null ? `${metrics.throughput} rec/s` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Empty State Banner when no run has been executed */}
      {metrics && !metrics.hasData && (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No reconciliation data available yet.
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Upload a dataset batch of CSV files to begin automated multi-source reconciliation.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => navigate('/upload')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
            >
              Upload Dataset Batch
            </button>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {metrics?.hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Reconciliation Status Breakdown */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Reconciliation Status Distribution
            </h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>MATCHED ({metrics.matchedCount})</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>REVIEW ({metrics.reviewCount})</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span>EXCEPTION ({metrics.exceptionCount})</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Exception Categories */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Exception Categories Breakdown
            </h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-400">Total Unresolved Escalations</span>
              <button
                onClick={() => navigate('/exceptions')}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                View Exception List →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
