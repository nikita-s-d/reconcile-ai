import React from 'react';
import { Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';

interface FormulaVisualizerProps {
  grossAmount: number;
  fee: number;
  tax: number;
  refund: number;
  expectedBankAmount: number;
  actualBankAmount: number;
  amountDifference: number;
  status: string;
}

export const FormulaVisualizer: React.FC<FormulaVisualizerProps> = ({
  grossAmount,
  fee,
  tax,
  refund,
  expectedBankAmount,
  actualBankAmount,
  amountDifference,
  status,
}) => {
  const isMatch = amountDifference < 0.01;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
            Financial Formula Calculation Breakdown
          </h4>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            status === 'MATCHED'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : status === 'REVIEW'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Gross Transaction Amount</span>
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            ₹{grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 text-gray-500 dark:text-gray-400">
          <span>− Payment Processing Fee</span>
          <span className="font-mono text-rose-600 dark:text-rose-400">
            - ₹{fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 text-gray-500 dark:text-gray-400">
          <span>− Applicable Tax (GST)</span>
          <span className="font-mono text-rose-600 dark:text-rose-400">
            - ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 text-gray-500 dark:text-gray-400">
          <span>− Refund Adjustment</span>
          <span className="font-mono text-rose-600 dark:text-rose-400">
            - ₹{refund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center font-semibold">
          <span className="text-gray-900 dark:text-white">Expected Bank Credit Amount</span>
          <span className="font-mono text-brand-600 dark:text-brand-400 text-base">
            ₹{expectedBankAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 font-semibold">
          <span className="text-gray-900 dark:text-white">Actual Bank Credit Recorded</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
            ₹{actualBankAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="border-t border-dashed border-gray-200 dark:border-gray-800 pt-3 flex justify-between items-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Variance / Discrepancy
          </span>
          <span
            className={`font-mono font-bold text-sm ${
              isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            ₹{amountDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};
