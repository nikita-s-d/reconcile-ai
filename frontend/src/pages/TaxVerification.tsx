import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Receipt, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface TaxVerificationData {
  taxDataAvailable: boolean;
  message: string;
  totalTaxVerified: number;
  taxExceptionCount: number;
  verifiedRecords: Array<{
    settlementId: string;
    transactionId: string;
    grossAmount: number;
    fee: number;
    recordedTax: number;
    expectedTax: number;
    difference: number;
    status: string;
  }>;
}

export const TaxVerification: React.FC = () => {
  const [data, setData] = useState<TaxVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/finance/tax-verification');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to execute tax verification.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Tax-Line Verification & Matching
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automated verification comparing expected GST (18%) vs recorded tax on settlement records.
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

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-gray-400 uppercase">Total Tax Verified</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              ₹{data.totalTaxVerified.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Recorded settlement tax</p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-gray-400 uppercase">Tax Discrepancy Count</span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">
              {data.taxExceptionCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">Expected vs recorded variance &gt; ₹5</p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-gray-400 uppercase">Data Status</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">
              {data.taxDataAvailable ? 'Tax Fields Active' : 'Tax Data Unavailable'}
            </p>
            <p className="text-xs text-gray-400 mt-1">{data.message}</p>
          </div>
        </div>
      )}

      {/* Verification Records Table */}
      {data && data.verifiedRecords.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              Settlement Tax-Line Analysis
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3">Settlement ID</th>
                  <th className="px-5 py-3">Tx ID</th>
                  <th className="px-5 py-3">Gross Amount</th>
                  <th className="px-5 py-3">Expected GST (18%)</th>
                  <th className="px-5 py-3">Recorded Tax</th>
                  <th className="px-5 py-3">Difference</th>
                  <th className="px-5 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                {data.verifiedRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{r.settlementId}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{r.transactionId}</td>
                    <td className="px-5 py-3">₹{r.grossAmount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-indigo-600">₹{r.expectedTax.toLocaleString()}</td>
                    <td className="px-5 py-3 text-emerald-600">₹{r.recordedTax.toLocaleString()}</td>
                    <td className="px-5 py-3">₹{r.difference.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-xs ${
                        r.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
