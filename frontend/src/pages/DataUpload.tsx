import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, PlaySquare } from 'lucide-react';

export const DataUpload: React.FC = () => {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    orders: null,
    payments: null,
    settlements: null,
    bank_transactions: null,
    refunds: null,
  });

  const [batchName, setBatchName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleDrop = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(key, e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploadResult(null);

    if (!files.orders || !files.payments || !files.settlements || !files.bank_transactions) {
      setError('Please provide all 4 mandatory reconciliation files: orders.csv, payments.csv, settlements.csv, bank_transactions.csv');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    if (batchName) formData.append('name', batchName);

    if (files.orders) formData.append('orders', files.orders);
    if (files.payments) formData.append('payments', files.payments);
    if (files.settlements) formData.append('settlements', files.settlements);
    if (files.bank_transactions) formData.append('bank_transactions', files.bank_transactions);
    if (files.refunds) formData.append('refunds', files.refunds);

    try {
      const res = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload and CSV validation failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const fileSpecs = [
    { key: 'orders', label: '1. Orders File (orders.csv)', req: true },
    { key: 'payments', label: '2. Payments File (payments.csv)', req: true },
    { key: 'settlements', label: '3. Settlements File (settlements.csv)', req: true },
    { key: 'bank_transactions', label: '4. Bank Transactions File (bank_transactions.csv)', req: true },
    { key: 'refunds', label: '5. Refunds File (refunds.csv)', req: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Financial Data Upload
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload synthetic financial CSV data files for multi-source reconciliation.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {uploadResult && (
        <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>{uploadResult.message}</span>
            </div>
            <button
              onClick={() => navigate('/reconciliation')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <PlaySquare className="w-4 h-4" />
              <span>Proceed to Reconciliation Run →</span>
            </button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-2 text-xs">
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Batch Name</span>
              <span className="font-semibold text-gray-900 dark:text-white truncate block">{uploadResult.batch.name}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Total Records</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 block text-sm">{uploadResult.batch.recordCount}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Orders</span>
              <span className="font-semibold text-gray-900 dark:text-white block">{uploadResult.counts.orders}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Payments</span>
              <span className="font-semibold text-gray-900 dark:text-white block">{uploadResult.counts.payments}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Settlements</span>
              <span className="font-semibold text-gray-900 dark:text-white block">{uploadResult.counts.settlements}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-gray-400 block font-medium">Bank Records</span>
              <span className="font-semibold text-gray-900 dark:text-white block">{uploadResult.counts.bankTransactions}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleUploadSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Dataset Batch Designation (Optional)
          </label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. Synthetic_Batch_Aug_2026"
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fileSpecs.map((spec) => {
            const selectedFile = files[spec.key];
            return (
              <div
                key={spec.key}
                onDrop={(e) => handleDrop(spec.key, e)}
                onDragOver={handleDragOver}
                className={`p-5 rounded-xl border-2 border-dashed transition-all ${
                  selectedFile
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    {spec.label}
                  </span>
                  {spec.req && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded font-semibold">
                      Required
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center py-4 text-center">
                  {selectedFile ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                      <FileText className="w-5 h-5" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                      <span className="text-xs text-gray-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Drag & drop or click to choose CSV
                      </p>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileChange(spec.key, e.target.files?.[0] || null)}
                  className="mt-2 block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 dark:file:bg-brand-900/30 dark:file:text-brand-300 hover:file:bg-brand-100"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={isUploading}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg shadow-md transition-colors flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Validating & Parsing CSV Files...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload and Store Batch</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
