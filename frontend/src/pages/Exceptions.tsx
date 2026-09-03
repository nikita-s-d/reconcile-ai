import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { ExceptionRecord } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { AlertTriangle, CheckCircle2, XCircle, Search, Filter, ShieldAlert } from 'lucide-react';

export const Exceptions: React.FC = () => {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Human review modal states
  const [selectedException, setSelectedException] = useState<ExceptionRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'resolve' | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exceptions', {
        params: {
          category: categoryFilter || undefined,
          status: statusFilter || undefined,
          severity: severityFilter || undefined,
          search: searchTerm || undefined,
          limit: 50,
        },
      });
      setExceptions(res.data.exceptions);
    } catch (err) {
      console.error('Failed to fetch exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [categoryFilter, statusFilter, severityFilter]);

  const handleActionConfirm = async () => {
    if (!selectedException || !actionType) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (actionType === 'approve') {
        await api.post(`/exceptions/${selectedException.id}/approve`, { reason: note });
      } else if (actionType === 'reject') {
        await api.post(`/exceptions/${selectedException.id}/reject`, { reason: note });
      } else if (actionType === 'resolve') {
        await api.post(`/exceptions/${selectedException.id}/resolve`, { resolutionNote: note || 'Resolved by analyst' });
      }
      setSelectedException(null);
      setActionType(null);
      setNote('');
      await fetchExceptions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Honest Exception & Human Review List
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Escalate uncertain discrepancies for human review without artificial suppression.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchExceptions()}
            placeholder="Search Tx ID or description..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
          >
            <option value="">All Categories</option>
            <option value="AMOUNT_MISMATCH">AMOUNT_MISMATCH</option>
            <option value="MISSING_SETTLEMENT">MISSING_SETTLEMENT</option>
            <option value="DUPLICATE_TRANSACTION">DUPLICATE_TRANSACTION</option>
            <option value="PARTIAL_SETTLEMENT">PARTIAL_SETTLEMENT</option>
            <option value="UNKNOWN_TRANSACTION">UNKNOWN_TRANSACTION</option>
            <option value="DATE_MISMATCH">DATE_MISMATCH</option>
            <option value="OTHER">OTHER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
          >
            <option value="">All Severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Exception Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Loading exceptions list...
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No exceptions found matching current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Severity</th>
                  <th className="px-5 py-3.5">Expected</th>
                  <th className="px-5 py-3.5">Actual</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Description & Reason</th>
                  <th className="px-5 py-3.5 text-right">Human Review Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {exceptions.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3.5 font-mono font-semibold text-gray-900 dark:text-white">
                      {e.transactionId}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          e.severity === 'HIGH' || e.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : e.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {e.expectedValue !== null && e.expectedValue !== undefined ? `₹${e.expectedValue.toLocaleString()}` : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {e.actualValue !== null && e.actualValue !== undefined ? `₹${e.actualValue.toLocaleString()}` : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          e.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate" title={e.description}>
                      {e.description}
                      {e.resolutionNote && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                          Note: {e.resolutionNote} ({e.resolvedBy})
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      {e.result?.status === 'REVIEW' && e.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedException(e);
                              setActionType('approve');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors"
                          >
                            Approve Match
                          </button>
                          <button
                            onClick={() => {
                              setSelectedException(e);
                              setActionType('reject');
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded transition-colors"
                          >
                            Mark Exception
                          </button>
                        </>
                      )}

                      {e.status === 'OPEN' && e.result?.status !== 'REVIEW' && (
                        <button
                          onClick={() => {
                            setSelectedException(e);
                            setActionType('resolve');
                          }}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded transition-colors"
                        >
                          Resolve
                        </button>
                      )}

                      {e.status === 'RESOLVED' && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Resolved ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Human Review Action Modal */}
      {selectedException && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {actionType === 'approve'
                ? 'Approve Match (REVIEW → MATCHED)'
                : actionType === 'reject'
                ? 'Mark Exception (REVIEW → EXCEPTION)'
                : 'Resolve Exception Record'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Transaction: <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedException.transactionId}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reason / Resolution Note (Required)
              </label>
              <textarea
                required
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter justification or audit resolution note..."
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedException(null);
                  setActionType(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
