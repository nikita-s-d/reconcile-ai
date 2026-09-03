export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface DatasetBatch {
  id: string;
  name: string;
  description?: string;
  recordCount: number;
  status: string;
  uploadedAt: string;
}

export interface ReconciliationRun {
  id: string;
  batchId: string;
  startedAt: string;
  completedAt?: string;
  totalRecords: number;
  matchedCount: number;
  reviewCount: number;
  exceptionCount: number;
  matchRate: number;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1Score?: number | null;
  processingTimeMs: number;
  throughput: number;
  status: string;
  batch?: { name: string; recordCount: number };
}

export interface EvidenceData {
  signal_scores?: {
    tx_id: number;
    ids_rel: number;
    amount: number;
    date: number;
    bank_ref: number;
  };
  gross_amount?: number;
  fee?: number;
  tax?: number;
  refund?: number;
  expected_bank_amount?: number;
  actual_bank_amount?: number;
  duplicate_count?: number;
}

export interface ReconciliationResult {
  id: string;
  runId: string;
  transactionId: string;
  orderId?: string | null;
  status: 'MATCHED' | 'REVIEW' | 'EXCEPTION';
  confidence: number;
  reason: string;
  amountDifference: number;
  dateDifference: number;
  matchedPaymentId?: string | null;
  matchedSettlementId?: string | null;
  matchedBankTransactionId?: string | null;
  evidence?: EvidenceData;
  createdAt: string;
  exception?: ExceptionRecord | null;
}

export interface ExceptionRecord {
  id: string;
  resultId: string;
  transactionId: string;
  category: 'AMOUNT_MISMATCH' | 'MISSING_SETTLEMENT' | 'DUPLICATE_TRANSACTION' | 'PARTIAL_SETTLEMENT' | 'UNKNOWN_TRANSACTION' | 'DATE_MISMATCH' | 'OTHER';
  description: string;
  expectedValue?: number | null;
  actualValue?: number | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  result?: ReconciliationResult;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  metadata?: any;
  user?: User | null;
}

export interface Settings {
  id: string;
  matchedThreshold: number;
  reviewThreshold: number;
  settlementWindowDays: number;
  updatedAt?: string;
}

export interface AnalyticsMetrics {
  hasData: boolean;
  latestRunId?: string;
  batchName?: string;
  totalRecords: number;
  matchedCount: number;
  reviewCount: number;
  exceptionCount: number;
  matchRate: number | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  processingTimeMs: number | null;
  throughput: number | null;
  statusBreakdown: { status: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

export interface EvaluationMetrics {
  total_gt_records: number;
  matched_eval_records: number;
  unmatched_gt_records: number;
  missing_predictions_count: number;
  correct_predictions: number;
  incorrect_predictions: number;
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  f1_weighted: number;
  per_class_metrics: Record<string, { precision: number; recall: number; f1: number; support: number }>;
  match_rate: number;
  confusion_matrix: {
    matrix: Record<string, Record<string, number>>;
    labels: string[];
  };
}
