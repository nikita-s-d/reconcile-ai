import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Settings as SettingsType } from '../types';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const [matchedThreshold, setMatchedThreshold] = useState(95.0);
  const [reviewThreshold, setReviewThreshold] = useState(80.0);
  const [settlementWindowDays, setSettlementWindowDays] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const s: SettingsType = res.data.settings;
      setMatchedThreshold(s.matchedThreshold);
      setReviewThreshold(s.reviewThreshold);
      setSettlementWindowDays(s.settlementWindowDays);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      await api.put('/settings', {
        matchedThreshold,
        reviewThreshold,
        settlementWindowDays,
      });
      setSuccess('Reconciliation thresholds updated and persisted in PostgreSQL database.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Engine Parameters & Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure classification confidence thresholds and date window validation limits.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-6">
        {/* Matched Threshold */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Automated MATCHED Threshold (%)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Confidence score requirement for automatic MATCHED classification (Default: 95.0%).
          </p>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={matchedThreshold}
            onChange={(e) => setMatchedThreshold(parseFloat(e.target.value))}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-mono"
          />
        </div>

        {/* Review Threshold */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Human REVIEW Escalation Threshold (%)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Minimum score threshold before falling into EXCEPTION (Default: 80.0%).
          </p>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={reviewThreshold}
            onChange={(e) => setReviewThreshold(parseFloat(e.target.value))}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-mono"
          />
        </div>

        {/* Settlement Window Days */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Max Settlement Window (Days)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Allowed date difference between payment and bank settlement before flagging DATE_MISMATCH (Default: 2 days).
          </p>
          <input
            type="number"
            min="0"
            max="30"
            value={settlementWindowDays}
            onChange={(e) => setSettlementWindowDays(parseInt(e.target.value, 10))}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
