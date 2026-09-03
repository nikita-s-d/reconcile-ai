import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { AuditLog } from '../types';
import { History, Search, Filter, ShieldCheck, Download, AlertCircle } from 'lucide-react';

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/audit-logs', {
        params: {
          action: actionFilter || undefined,
          search: searchTerm || undefined,
          limit: 50,
        },
      });
      setLogs(res.data.auditLogs);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await api.get('/export/audit', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit_log.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      // Decode blob error JSON if backend returned HTTP error status
      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const parsed = JSON.parse(errorText);
          setError(parsed.error || 'Failed to export audit log.');
        } catch {
          setError('Failed to export audit log. Please try again.');
        }
      } else {
        setError(err.response?.data?.error || 'Failed to export audit log. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            System Audit Trail
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete chronological record of all system events, dataset uploads, manual review decisions, and setting updates.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Exporting...' : 'Export Audit Log CSV'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchLogs();
          }}
          className="relative flex-1 min-w-[200px] max-w-xs"
        >
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action or entity..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
          />
        </form>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white"
        >
          <option value="">All Actions</option>
          <option value="DATASET_UPLOAD">DATASET_UPLOAD</option>
          <option value="RECONCILIATION_COMPLETED">RECONCILIATION_COMPLETED</option>
          <option value="MANUAL_MATCH_APPROVED">MANUAL_MATCH_APPROVED</option>
          <option value="MANUAL_MATCH_REJECTED">MANUAL_MATCH_REJECTED</option>
          <option value="EXCEPTION_RESOLVED">EXCEPTION_RESOLVED</option>
          <option value="GROUND_TRUTH_UPLOADED">GROUND_TRUTH_UPLOADED</option>
          <option value="EVALUATION_COMPLETED">EVALUATION_COMPLETED</option>
          <option value="EVALUATION_REPORT_EXPORTED">EVALUATION_REPORT_EXPORTED</option>
          <option value="AUDIT_LOG_EXPORTED">AUDIT_LOG_EXPORTED</option>
          <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Loading audit log history...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No audit log entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Entity</th>
                  <th className="px-5 py-3.5">Reason & Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-xs">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3.5 text-gray-500">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-sans font-semibold text-gray-900 dark:text-white">
                      {l.user ? l.user.email : 'System Engine'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-brand-700 dark:text-brand-300 font-bold">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                      {l.entity} {l.entityId ? `(${l.entityId.slice(0, 8)})` : ''}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-xs text-gray-700 dark:text-gray-300 max-w-sm truncate" title={l.reason || ''}>
                      {l.reason || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
