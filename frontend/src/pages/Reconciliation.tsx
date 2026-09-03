import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DatasetBatch, ReconciliationRun } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { PlaySquare, CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, Zap, Percent, Clock, FileText, Check, Activity } from 'lucide-react';

export const Reconciliation: React.FC = () => {
  const [batches, setBatches] = useState<DatasetBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeRunResult, setActiveRunResult] = useState<ReconciliationRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchRes, runRes] = await Promise.all([
        api.get('/datasets'),
        api.get('/reconciliation/runs'),
      ]);
      setBatches(batchRes.data.batches);
      if (batchRes.data.batches.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchRes.data.batches[0].id);
      }
      setRuns(runRes.data.runs);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reconciliation datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const recordCount = selectedBatch?.recordCount || 0;

  const handleStartReconciliation = async () => {
    setShowConfirm(false);
    setIsRunning(true);
    setError(null);
    setActiveRunResult(null);

    try {
      const res = await api.post('/reconciliation/run', { batchId: selectedBatchId });
      setActiveRunResult(res.data.run);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reconciliation execution failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const agentStages = [
    { label: 'Loading multi-source financial records', done: true },
    { label: 'Normalizing transaction schema & BOM headers', done: true },
    { label: 'Finding candidate matches across Orders, Payments, Settlements, Bank & Refunds', done: true },
    { label: 'Verifying amounts, fees, dates, and taxes', done: true },
    { label: 'Detecting duplicates and surfacing honest exceptions', done: true },
    { label: 'Calculating match rate, throughput, and generating audit logs', done: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            AI Finance Controller Agent
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Execute multi-source financial reconciliation with deterministic rules, decision traces, and throughput measurement.
          </p>
        </div>

        <button
          onClick={fetchData}
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

      {/* Dataset Selection Box */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Select Dataset Batch to Reconcile
        </h3>

        {batches.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            No datasets uploaded yet. Please upload dataset CSV files first.
            <div className="mt-3">
              <button
                onClick={() => navigate('/upload')}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold"
              >
                Go to Upload Page
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.recordCount} Records ({new Date(b.uploadedAt).toLocaleDateString()})
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={isRunning || !selectedBatchId}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-md transition-colors flex items-center gap-2 shrink-0"
            >
              <PlaySquare className="w-4 h-4" />
              <span>START AI CONTROLLER</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Agent Execution Status Stages */}
      {isRunning && (
        <div className="bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-900 rounded-xl p-6 space-y-4 shadow-md">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-brand-600 animate-spin" />
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                AI Finance Controller Processing Batch...
              </h3>
              <p className="text-xs text-gray-500">Executing multi-source decision engine across {recordCount} records</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2">
            {agentStages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{stage.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Run Result Summary */}
      {activeRunResult && (
        <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Reconciliation Execution Completed
                </h3>
                <p className="text-xs text-gray-500">Run ID: {activeRunResult.id}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transactions')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              Inspect Decision Explanations →
            </button>
          </div>

          {/* Execution Stages Completed Checklist */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-400">Agent Execution Workflow Stages</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {agentStages.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-900 dark:text-emerald-300 font-medium">{stage.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance & Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400 font-semibold uppercase block">Records Processed</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{activeRunResult.totalRecords}</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-emerald-600 font-semibold uppercase block">Matched</span>
              <span className="text-xl font-bold text-emerald-600">{activeRunResult.matchedCount}</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-amber-600 font-semibold uppercase block">Needs Review</span>
              <span className="text-xl font-bold text-amber-600">{activeRunResult.reviewCount}</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-rose-600 font-semibold uppercase block">Exceptions</span>
              <span className="text-xl font-bold text-rose-600">{activeRunResult.exceptionCount}</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-brand-600 font-semibold uppercase block">Measured Throughput</span>
              <span className="text-xl font-bold text-brand-600">{activeRunResult.throughput} rec/s</span>
            </div>
          </div>
        </div>
      )}

      {/* Historical Reconciliation Runs Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base">
            Agent Run History & Execution Log
          </h3>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No reconciliation runs executed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3">Run Date</th>
                  <th className="px-6 py-3">Dataset Batch</th>
                  <th className="px-6 py-3">Records</th>
                  <th className="px-6 py-3">Matched</th>
                  <th className="px-6 py-3">Review</th>
                  <th className="px-6 py-3">Exceptions</th>
                  <th className="px-6 py-3">Match Rate</th>
                  <th className="px-6 py-3">Throughput</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {r.batch?.name || r.batchId}
                    </td>
                    <td className="px-6 py-4 font-mono">{r.totalRecords}</td>
                    <td className="px-6 py-4 font-mono text-emerald-600 font-semibold">{r.matchedCount}</td>
                    <td className="px-6 py-4 font-mono text-amber-600 font-semibold">{r.reviewCount}</td>
                    <td className="px-6 py-4 font-mono text-rose-600 font-semibold">{r.exceptionCount}</td>
                    <td className="px-6 py-4 font-bold text-brand-600">{r.matchRate}%</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{r.throughput} rec/s</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate('/transactions')}
                        className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        View Results →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Confirm Reconciliation Execution"
        message={`You are about to reconcile ${recordCount} records in batch "${selectedBatch?.name}". This will trigger automated signal matching, financial formula calculation, and exception classification.`}
        confirmText="Confirm & Run"
        confirmVariant="primary"
        isLoading={isRunning}
        onConfirm={handleStartReconciliation}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
};
