from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class OrderItem(BaseModel):
    order_id: str
    customer_id: Optional[str] = None
    order_date: str
    order_amount: float
    currency: Optional[str] = "INR"
    payment_id: Optional[str] = None
    order_status: Optional[str] = "COMPLETED"

class PaymentItem(BaseModel):
    payment_id: str
    order_id: Optional[str] = None
    transaction_id: str
    payment_date: str
    payment_time: Optional[str] = "00:00:00"
    amount: float
    payment_status: Optional[str] = "CAPTURED"
    payment_method: Optional[str] = "UPI"

class SettlementItem(BaseModel):
    settlement_id: str
    transaction_id: str
    settlement_date: str
    gross_amount: float
    fee: float = 0.0
    tax: float = 0.0
    net_amount: float
    settlement_status: Optional[str] = "SETTLED"

class BankTransactionItem(BaseModel):
    bank_transaction_id: str
    settlement_id: Optional[str] = None
    transaction_date: str
    transaction_time: Optional[str] = "00:00:00"
    reference: Optional[str] = None
    credit_amount: float
    bank_status: Optional[str] = "CREDITED"

class RefundItem(BaseModel):
    refund_id: str
    transaction_id: str
    refund_date: str
    refund_amount: float
    refund_status: Optional[str] = "PROCESSED"
    refund_reason: Optional[str] = None

class ReconciliationSettings(BaseModel):
    matched_threshold: float = 95.0
    review_threshold: float = 80.0
    settlement_window_days: int = 2

class ReconcileRequestPayload(BaseModel):
    orders: List[OrderItem] = []
    payments: List[PaymentItem] = []
    settlements: List[SettlementItem] = []
    bank_transactions: List[BankTransactionItem] = []
    refunds: List[RefundItem] = []
    settings: Optional[ReconciliationSettings] = ReconciliationSettings()

class ReconciliationResultItem(BaseModel):
    transaction_id: str
    order_id: Optional[str] = None
    matched_payment_id: Optional[str] = None
    matched_settlement_id: Optional[str] = None
    matched_bank_transaction_id: Optional[str] = None
    status: str  # MATCHED, REVIEW, EXCEPTION
    confidence: float
    reason: str
    amount_difference: float
    date_difference: int
    evidence: Dict[str, Any] = {}
    exception_category: Optional[str] = None
    severity: Optional[str] = None  # LOW, MEDIUM, HIGH, CRITICAL

class ReconcileResponsePayload(BaseModel):
    results: List[ReconciliationResultItem]
    total_records: int
    matched_count: int
    review_count: int
    exception_count: int
    match_rate: float
    processing_time_ms: float
    throughput: float

class GroundTruthItem(BaseModel):
    transaction_id: str
    ground_truth_status: str
    ground_truth_reason: Optional[str] = None
    expected_exception_category: Optional[str] = None

class EvaluateRequestPayload(BaseModel):
    predictions: List[ReconciliationResultItem]
    ground_truth: List[GroundTruthItem]

class ConfusionMatrixData(BaseModel):
    matrix: Dict[str, Dict[str, int]]  # actual -> predicted -> count
    labels: List[str]

class EvaluateResponsePayload(BaseModel):
    total_gt_records: int
    matched_eval_records: int
    unmatched_gt_records: int
    missing_predictions_count: int
    correct_predictions: int
    incorrect_predictions: int
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    f1_weighted: float
    per_class_metrics: Dict[str, Dict[str, float]]
    match_rate: float
    confusion_matrix: ConfusionMatrixData
