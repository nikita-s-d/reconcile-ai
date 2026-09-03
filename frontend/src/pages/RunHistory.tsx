import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { History, FileText, CheckCircle2, AlertTriangle, Zap, Download, RefreshCw, X } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

interface RunHistoryItem {
  runId: string;
  batchId: string;
  batchName: string;
  startedAt: string;
  completedAt: string;
  totalRecords: number;
  matchedCount: number;
  reviewCount: number;
  exceptionCount: number;
  matchRate: number;
  processingTimeSec: number;
  throughput: number;
  status: string;
  accuracy: number | null;
  f1Score: number | null;
}

export const RunHistory: React.FC = () => {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunReport, setSelectedRunReport] = useState<any | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/finance/runs');
      setRuns(res.data.runs);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch run history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleOpenReport = async (runId: string) => {
    setIsReportLoading(true);
    try {
      const res = await api.get(`/finance/reports/${runId}`);
      setSelectedRunReport(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load report.');
    } finally {
      setIsReportLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Agent Run History & Controller Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete historical audit trail of reconciliation executions, throughput benchmarks, and business reports.
          </p>
        </div>

        <button
          onClick={fetchRuns}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Runs Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading run history...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No reconciliation runs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3.5">Run Date</th>
                  <th className="px-5 py-3.5">Batch Name</th>
                  <th className="px-5 py-3.5">Records</th>
                  <th className="px-5 py-3.5">Matched</th>
                  <th className="px-5 py-3.5">Review</th>
                  <th className="px-5 py-3.5">Exceptions</th>
                  <th className="px-5 py-3.5">Match Rate</th>
                  <th className="px-5 py-3.5">Throughput</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {runs.map((run) => (
                  <tr key={run.runId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 font-mono text-xs">{run.batchName}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">{run.totalRecords}</td>
                    <td className="px-5 py-3.5 font-semibold text-emerald-600">{run.matchedCount}</td>
                    <td className="px-5 py-3.5 font-semibold text-amber-600">{run.reviewCount}</td>
                    <td className="px-5 py-3.5 font-semibold text-rose-600">{run.exceptionCount}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">{run.matchRate}%</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-purple-600 font-bold">{run.throughput} rec/s</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenReport(run.runId)}
                        className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Report</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finance Controller Report Modal */}
      {selectedRunReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-4">
                <BrandLogo size="small" variant="full" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Executive Finance Controller Report
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">Run ID: {selectedRunReport.runInfo.runId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRunReport(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance & Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 block font-semibold">TOTAL RECORDS</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedRunReport.performance.totalRecords}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 block font-semibold">MATCH RATE</span>
                <span className="text-lg font-bold text-emerald-600">{selectedRunReport.reconciliation.matchRate}%</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 block font-semibold">THROUGHPUT</span>
                <span className="text-lg font-bold text-purple-600">{selectedRunReport.performance.throughput} rec/s</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 block font-semibold">PROCESSING TIME</span>
                <span className="text-lg font-bold text-indigo-600">{selectedRunReport.performance.processingTimeSec}s</span>
              </div>
            </div>

            {/* Financial Values */}
            <div className="bg-brand-50/60 dark:bg-brand-950/30 p-4 rounded-xl border border-brand-100 dark:border-brand-900/40 flex justify-around text-center">
              <div>
                <span className="text-xs text-gray-500 uppercase font-semibold">Reconciled Value</span>
                <p className="text-xl font-bold text-emerald-600">₹{selectedRunReport.financialSummary.reconciledValue.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase font-semibold">Exception Value</span>
                <p className="text-xl font-bold text-rose-600">₹{selectedRunReport.financialSummary.exceptionValue.toLocaleString()}</p>
              </div>
            </div>

            {/* Ground Truth Evaluation if Available */}
            {selectedRunReport.evaluation && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-400">Ground Truth Evaluated Metrics</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 font-bold text-emerald-700">Accuracy: {selectedRunReport.evaluation.accuracy}%</div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-200 font-bold text-blue-700">Precision: {selectedRunReport.evaluation.precision}%</div>
                  <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-200 font-bold text-indigo-700">Recall: {selectedRunReport.evaluation.recall}%</div>
                  <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-lg border border-purple-200 font-bold text-purple-700">F1 Score: {selectedRunReport.evaluation.f1Macro}%</div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setSelectedRunReport(null)}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-xs rounded-lg"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
