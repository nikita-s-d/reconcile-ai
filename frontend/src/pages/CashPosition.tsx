import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from 'lucide-react';

interface CashPositionData {
  currentCashPosition: number;
  totalBankCredits: number;
  totalRefunds: number;
  totalNetSettlements: number;
  assumptions: string[];
  forecasts: {
    days7: number;
    days14: number;
    days30: number;
  };
}

export const CashPosition: React.FC = () => {
  const [data, setData] = useState<CashPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/finance/cash-position');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch cash position data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Cash Position & Liquidity Forecast
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Calculated current cash position and 7/14/30-day velocity projections.
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

      {/* Main Cash Position Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase">
            <span>Current Cash Position</span>
            <Wallet className="w-5 h-5 text-purple-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-purple-600 dark:text-purple-400">
            {data ? formatCurrency(data.currentCashPosition) : '₹0'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Bank Credits - Refund Outflows</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase">
            <span>Confirmed Inflows (Bank)</span>
            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-600">
            {data ? formatCurrency(data.totalBankCredits) : '₹0'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Credited bank transactions</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase">
            <span>Confirmed Outflows (Refunds)</span>
            <ArrowDownRight className="w-5 h-5 text-rose-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-rose-600">
            {data ? formatCurrency(data.totalRefunds) : '₹0'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Processed refund payouts</p>
        </div>
      </div>

      {/* 7, 14, 30 Day Cash Forecasts */}
      {data && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Transparent Liquidity Forecasts
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400 font-semibold uppercase block">7-Day Projected Cash</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(data.forecasts.days7)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400 font-semibold uppercase block">14-Day Projected Cash</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(data.forecasts.days14)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400 font-semibold uppercase block">30-Day Projected Cash</span>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">{formatCurrency(data.forecasts.days30)}</p>
            </div>
          </div>

          {/* Documented Calculation Assumptions */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-gray-400">Calculation Assumptions & Methodology</h4>
            <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
              {data.assumptions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
