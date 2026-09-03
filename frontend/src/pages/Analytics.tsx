import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EvaluationMetrics, AnalyticsMetrics } from '../types';
import { BarChart3, UploadCloud, Play, Download, CheckCircle2, AlertCircle, FileText, Activity } from 'lucide-react';

interface GroundTruthDataset {
  id: string;
  filename: string;
  recordCount: number;
  status: string;
  createdAt: string;
}

// Robust client-side CSV parser handling quoted fields, commas, and BOM
const parseCSVText = (text: string): Record<string, string>[] => {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
      if (char === '\r' && text[i + 1] === '\n') {
        i++; // skip \n after \r
      }
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const tokens: string[] = [];
    let token = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === ',' && !inQ) {
        tokens.push(token.trim().replace(/^"|"$/g, ''));
        token = '';
      } else {
        token += c;
      }
    }
    tokens.push(token.trim().replace(/^"|"$/g, ''));
    return tokens;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\ufeff/, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[j] !== undefined ? values[j] : '';
    }
    rows.push(rowObj);
  }

  return rows;
};

export const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluationMetrics | null>(null);

  // Active dataset state initialized strictly as null (ZERO fallback default objects or hardcoded numbers)
  const [activeDataset, setActiveDataset] = useState<GroundTruthDataset | null>(null);
  const [isLoadingDataset, setIsLoadingDataset] = useState(true);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isUploadingGt, setIsUploadingGt] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    setIsLoadingDataset(true);
    try {
      const [mRes, eRes] = await Promise.all([
        api.get('/analytics/metrics'),
        api.get('/evaluation/results'),
      ]);
      setMetrics(mRes.data);

      if (eRes.data.groundTruthDataset) {
        setActiveDataset(eRes.data.groundTruthDataset);
      } else {
        setActiveDataset(null);
      }

      // Scoped evaluation metrics from PostgreSQL (null if no evaluation has been run for activeDataset yet)
      if (eRes.data.hasEvaluated && (eRes.data.metrics || eRes.data.evaluation)) {
        setEvalResult(eRes.data.metrics || eRes.data.evaluation);
      } else {
        setEvalResult(null);
      }
    } catch (err) {
      console.error('Failed to fetch analytics status:', err);
    } finally {
      setIsLoadingDataset(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleChooseGroundTruthFile = () => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input value before triggering file picker
      fileInputRef.current.click();
    }
  };

  const handleGroundTruthFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const text = await file.text();
    if (!text.trim()) {
      setError('The selected CSV file is empty.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const rows = parseCSVText(text);
    if (!rows || rows.length === 0) {
      setError('The selected CSV file is empty.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const firstRow = rows[0];
    const keys = Object.keys(firstRow).map((k) => k.replace(/^\ufeff/, '').trim().toLowerCase());

    if (!keys.includes('transaction_id')) {
      setError('Missing required column: transaction_id');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!keys.includes('ground_truth_status')) {
      setError('Missing required column: ground_truth_status');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const VALID_STATUSES = ['MATCHED', 'REVIEW', 'EXCEPTION'];
    const seenTxIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let txId = '';
      let status = '';

      for (const [key, val] of Object.entries(row)) {
        const normKey = key.replace(/^\ufeff/, '').trim().toLowerCase();
        if (normKey === 'transaction_id' || normKey === 'transactionid') {
          txId = String(val || '').trim();
        } else if (normKey === 'ground_truth_status' || normKey === 'status') {
          status = String(val || '').toUpperCase().trim();
        }
      }

      if (!txId) {
        setError(`Invalid or missing transaction_id at row ${i + 1}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (seenTxIds.has(txId)) {
        setError(`Duplicate transaction_id found: ${txId}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      seenTxIds.add(txId);

      if (!VALID_STATUSES.includes(status)) {
        setError(`Invalid ground_truth_status: ${status}. Allowed values are MATCHED, REVIEW, or EXCEPTION.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploadingGt(true);
    const formData = new FormData();
    formData.append('file', file); // Multer field name "file"

    try {
      // Post FormData without manual Content-Type header so Axios auto-generates boundary
      await api.post('/evaluation/upload-ground-truth', formData);
      // Re-fetch /api/evaluation/results so PostgreSQL ACTIVE dataset is the sole source of truth for the UI
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ground truth upload failed.');
    } finally {
      setIsUploadingGt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunEvaluation = async () => {
    setError(null);

    if (!activeDataset || activeDataset.recordCount === 0) {
      setError('Please upload a valid evaluation dataset before running evaluation.');
      return;
    }

    if (user?.role === 'VIEWER') {
      setError('You do not have permission to run evaluation.');
      return;
    }

    setIsEvaluating(true);

    try {
      const res = await api.post('/evaluation/run', {
        groundTruthDatasetId: activeDataset.id,
      });
      const returnedMetrics = res.data.evaluation || res.data.metrics;
      setEvalResult(returnedMetrics);
      await fetchStatus();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to run evaluation.');
      } else {
        const errorMsg = err.response?.data?.error || 'Evaluation engine is unavailable. Please make sure the Python evaluation service is running.';
        setError(typeof errorMsg === 'string' ? errorMsg : 'Evaluation failed due to a server error. Please try again.');
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportReport = async () => {
    if (!evalResult) return;
    setIsExporting(true);
    setError(null);

    try {
      const response = await api.get('/export/evaluation', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'evaluation_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const parsed = JSON.parse(errorText);
          setError(parsed.error || 'Failed to export evaluation report.');
        } catch {
          setError('Failed to export evaluation report. Please try again.');
        }
      } else {
        setError(err.response?.data?.error || 'Failed to export evaluation report. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const isViewer = user?.role === 'VIEWER';
  const isGtReady = !!activeDataset && activeDataset.recordCount > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Reconciliation Performance
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Measure the accuracy and reliability of the finance reconciliation engine against a verified evaluation dataset.
          </p>
        </div>

        <button
          onClick={handleExportReport}
          disabled={!evalResult || isExporting}
          title={!evalResult ? 'Run an evaluation before exporting the report.' : 'Export Evaluation Report CSV'}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Exporting...' : 'Export Evaluation Report CSV'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Evaluation Dataset Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Evaluation Dataset
            </h3>
            {activeDataset && (
              <span className="text-xs text-gray-400 font-mono ml-1">{activeDataset.filename}</span>
            )}
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
            isGtReady
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {isLoadingDataset ? 'Loading Dataset...' : isGtReady ? 'Ready for Evaluation' : 'Dataset Required'}
          </span>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleGroundTruthFileChange}
          style={{ display: 'none' }}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg text-purple-600 dark:text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">EVALUATION DATASET</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {isLoadingDataset
                  ? 'Loading Evaluation Dataset...'
                  : activeDataset
                  ? `${activeDataset.recordCount.toLocaleString()} Records Ready`
                  : 'No Evaluation Dataset'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleChooseGroundTruthFile}
              disabled={isUploadingGt}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isUploadingGt ? 'Uploading Dataset...' : 'Upload Evaluation Dataset'}</span>
            </button>

            <button
              onClick={handleRunEvaluation}
              disabled={!isGtReady || isEvaluating || isViewer}
              title={isViewer ? 'You do not have permission to run evaluation.' : !isGtReady ? 'Upload a valid evaluation dataset before running evaluation.' : 'Run Ground Truth Evaluation'}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>{isEvaluating ? 'Running Evaluation...' : 'RUN EVALUATION'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State when Dataset exists but Evaluation has not been run for it yet */}
      {activeDataset && !evalResult && !isLoadingDataset && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center space-y-3 shadow-xs">
          <div className="mx-auto w-12 h-12 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            No Evaluation Results Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Click <span className="font-semibold text-gray-900 dark:text-white">RUN EVALUATION</span> to measure the accuracy and reliability of the reconciliation engine for <span className="font-mono text-purple-600 dark:text-purple-400">{activeDataset.filename}</span> ({activeDataset.recordCount.toLocaleString()} records).
          </p>
        </div>
      )}

      {/* Evaluated Metrics Cards */}
      {evalResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase block">ACCURACY</span>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{evalResult.accuracy}%</p>
              <p className="text-xs text-gray-400 mt-1">{evalResult.correct_predictions} / {evalResult.matched_eval_records} correct</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase block">PRECISION (MACRO)</span>
              <p className="mt-2 text-3xl font-extrabold text-brand-600">{evalResult.precision_macro}%</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase block">RECALL (MACRO)</span>
              <p className="mt-2 text-3xl font-extrabold text-indigo-600">{evalResult.recall_macro}%</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase block">F1 SCORE (MACRO)</span>
              <p className="mt-2 text-3xl font-extrabold text-purple-600">{evalResult.f1_macro}%</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase block">F1 WEIGHTED</span>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{evalResult.f1_weighted}%</p>
            </div>
          </div>

          {/* Coverage & Join Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs font-medium">
            <div>
              <span className="text-gray-400 block">Total Evaluation Records</span>
              <span className="text-base font-bold text-gray-900 dark:text-white">{evalResult.total_gt_records}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Matched Records</span>
              <span className="text-base font-bold text-emerald-600">{evalResult.matched_eval_records}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Unmatched Records</span>
              <span className="text-base font-bold text-amber-600">{evalResult.unmatched_gt_records}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Missing Predictions</span>
              <span className="text-base font-bold text-rose-600">{evalResult.missing_predictions_count}</span>
            </div>
          </div>

          {/* Confusion Matrix Section */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Reconciliation Classification Results
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Actual Evaluation Status vs AI Prediction
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 font-semibold text-xs text-gray-600 dark:text-gray-300">
                    <th className="p-3 border border-gray-200 dark:border-gray-700 text-left">Actual \ Predicted</th>
                    <th className="p-3 border border-gray-200 dark:border-gray-700 text-emerald-600">MATCHED</th>
                    <th className="p-3 border border-gray-200 dark:border-gray-700 text-amber-600">REVIEW</th>
                    <th className="p-3 border border-gray-200 dark:border-gray-700 text-rose-600">EXCEPTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono">
                  {['MATCHED', 'REVIEW', 'EXCEPTION'].map((actual) => (
                    <tr key={actual}>
                      <td className="p-3 font-semibold text-left bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white">
                        {actual}
                      </td>
                      {['MATCHED', 'REVIEW', 'EXCEPTION'].map((pred) => {
                        const val = evalResult.confusion_matrix?.matrix?.[actual]?.[pred] || 0;
                        const isDiagonal = actual === pred;
                        return (
                          <td
                            key={pred}
                            className={`p-3 font-bold text-base border border-gray-200 dark:border-gray-700 ${
                              isDiagonal ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : val > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'text-gray-400'
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
