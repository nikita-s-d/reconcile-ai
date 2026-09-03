import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ReconciliationResult } from '../types';
import { FormulaVisualizer } from '../components/FormulaVisualizer';
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, FileText, Building, CreditCard, RefreshCw } from 'lucide-react';

export const TransactionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ transaction: ReconciliationResult; details: any } | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/transactions/${id}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch transaction details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <span className="inline-block w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-2"></span>
        <p>Loading transaction details...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Transaction record not found.
      </div>
    );
  }

  const { transaction: tx, details } = data;
  const ev = tx.evidence || {};
  const scores = ev.signal_scores || { tx_id: 0, ids_rel: 0, amount: 0, date: 0, bank_ref: 0 };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/transactions')}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 rounded-lg text-gray-600 dark:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">
              {tx.transactionId}
            </h1>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                tx.status === 'MATCHED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : tx.status === 'REVIEW'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {tx.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Order ID: {tx.orderId || 'N/A'} • Confidence Score: {tx.confidence}%
          </p>
        </div>
      </div>

      {/* Decision Summary Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          <span>Decision Reason & Explanation</span>
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg font-medium border border-gray-200 dark:border-gray-700">
          {tx.reason}
        </p>
      </div>

      {/* Financial Formula Visualizer */}
      <FormulaVisualizer
        grossAmount={ev.gross_amount || 0.0}
        fee={ev.fee || 0.0}
        tax={ev.tax || 0.0}
        refund={ev.refund || 0.0}
        expectedBankAmount={ev.expected_bank_amount || 0.0}
        actualBankAmount={ev.actual_bank_amount || 0.0}
        amountDifference={tx.amountDifference}
        status={tx.status}
      />

      {/* Confidence Signal Breakdown Checklist */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          Confidence Score Signals Breakdown (Total: {tx.confidence}/100)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase block">Tx ID Match</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">+{scores.tx_id}/40</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase block">Related IDs</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">+{scores.ids_rel}/20</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase block">Amount Formula</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">+{scores.amount}/20</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase block">Date Window</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">+{scores.date}/10</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-400 font-semibold uppercase block">Bank Ref</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">+{scores.bank_ref}/10</span>
          </div>
        </div>
      </div>

      {/* Raw Linked Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white border-b pb-2">
            <FileText className="w-4 h-4 text-brand-600" />
            <span>Order Record (orders.csv)</span>
          </div>
          {details.order ? (
            <div className="space-y-1 font-mono text-gray-600 dark:text-gray-300">
              <p>Order ID: {details.order.orderId}</p>
              <p>Customer ID: {details.order.customerId}</p>
              <p>Date: {details.order.orderDate}</p>
              <p>Amount: ₹{details.order.orderAmount}</p>
              <p>Status: {details.order.orderStatus}</p>
            </div>
          ) : (
            <p className="text-gray-400 italic">No linked order record.</p>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white border-b pb-2">
            <CreditCard className="w-4 h-4 text-brand-600" />
            <span>Payment Record (payments.csv)</span>
          </div>
          {details.payment ? (
            <div className="space-y-1 font-mono text-gray-600 dark:text-gray-300">
              <p>Payment ID: {details.payment.paymentId}</p>
              <p>Date: {details.payment.paymentDate} {details.payment.paymentTime}</p>
              <p>Amount: ₹{details.payment.amount}</p>
              <p>Method: {details.payment.paymentMethod}</p>
              <p>Status: {details.payment.paymentStatus}</p>
            </div>
          ) : (
            <p className="text-gray-400 italic">No linked payment record.</p>
          )}
        </div>

        {/* Settlement */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white border-b pb-2">
            <Building className="w-4 h-4 text-brand-600" />
            <span>Settlement Record (settlements.csv)</span>
          </div>
          {details.settlement ? (
            <div className="space-y-1 font-mono text-gray-600 dark:text-gray-300">
              <p>Settlement ID: {details.settlement.settlementId}</p>
              <p>Date: {details.settlement.settlementDate}</p>
              <p>Gross Amount: ₹{details.settlement.grossAmount}</p>
              <p>Fee: ₹{details.settlement.fee} | Tax: ₹{details.settlement.tax}</p>
              <p>Net Amount: ₹{details.settlement.netAmount}</p>
            </div>
          ) : (
            <p className="text-gray-400 italic">No linked settlement record.</p>
          )}
        </div>

        {/* Refund */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white border-b pb-2">
            <RefreshCw className="w-4 h-4 text-brand-600" />
            <span>Refund Adjustment (refunds.csv)</span>
          </div>
          {details.refund ? (
            <div className="space-y-1 font-mono text-gray-600 dark:text-gray-300">
              <p>Refund ID: {details.refund.refundId}</p>
              <p>Date: {details.refund.refundDate}</p>
              <p>Refund Amount: ₹{details.refund.refundAmount}</p>
              <p>Reason: {details.refund.refundReason || 'Customer return'}</p>
            </div>
          ) : (
            <p className="text-gray-400 italic">No refund adjustment recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};
