import React, { useState } from 'react';
import api from '../services/api';
import { Search, HelpCircle, MessageSquare, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export const SettlementQA: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ query: string; answer: string; supportingRecords: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedQueries = [
    'How much was settled today?',
    'What is the total pending settlement?',
    'Why was TX1023 not settled?',
    'What was the largest settlement?',
    'How many settlements failed?',
  ];

  const handleExecuteQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setQuery(queryText);
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/finance/settlements/qa', { query: queryText });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process settlement query.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Settlement Intelligence & Q&A
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ask natural questions or query specific transaction settlements computed directly from PostgreSQL financial records.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Query Search Box */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteQuery(query);
          }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Why was TX1023 not settled?"
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            <span>{loading ? 'Analyzing...' : 'Ask AI'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Suggested Query Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-2">
          <span className="text-xs font-semibold text-gray-400">Suggested Questions:</span>
          {suggestedQueries.map((qText, idx) => (
            <button
              key={idx}
              onClick={() => handleExecuteQuery(qText)}
              className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600 dark:hover:text-brand-400 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              {qText}
            </button>
          ))}
        </div>
      </div>

      {/* Query Result Card */}
      {result && (
        <div className="bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-900 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Query Answer & Analysis
            </h3>
          </div>

          <div className="bg-brand-50/60 dark:bg-brand-950/40 p-4 rounded-xl border border-brand-100 dark:border-brand-900/60">
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-200 leading-relaxed">
              {result.answer}
            </p>
          </div>

          {result.supportingRecords && result.supportingRecords.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase text-gray-400">Supporting Database Evidence Records</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      <th className="p-2 border border-gray-200 dark:border-gray-700">Record ID</th>
                      <th className="p-2 border border-gray-200 dark:border-gray-700">Type / Field</th>
                      <th className="p-2 border border-gray-200 dark:border-gray-700">Amount / Value</th>
                      <th className="p-2 border border-gray-200 dark:border-gray-700">Date / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {result.supportingRecords.map((rec: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-2 border border-gray-200 dark:border-gray-700 font-semibold">{rec.transactionId || rec.settlementId || rec.paymentId || rec.id || `REC-${i + 1}`}</td>
                        <td className="p-2 border border-gray-200 dark:border-gray-700">{rec.type || rec.category || 'FINANCIAL_RECORD'}</td>
                        <td className="p-2 border border-gray-200 dark:border-gray-700 text-emerald-600">₹{(rec.amount || rec.gross || rec.credit || rec.grossAmount || 0).toLocaleString()}</td>
                        <td className="p-2 border border-gray-200 dark:border-gray-700">{rec.date || rec.settlementDate || rec.status || 'RECORDED'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
