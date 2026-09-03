import pytest
from app.schemas import (
    OrderItem, PaymentItem, SettlementItem, BankTransactionItem, RefundItem,
    ReconcileRequestPayload, ReconciliationSettings, GroundTruthItem, EvaluateRequestPayload
)
from app.reconciliation import run_reconciliation_pipeline
from app.evaluation import run_evaluation_pipeline

def test_exact_match():
    payload = ReconcileRequestPayload(
        orders=[OrderItem(order_id="ORD1", order_date="2026-08-01", order_amount=1000.0, payment_id="PAY1")],
        payments=[PaymentItem(payment_id="PAY1", order_id="ORD1", transaction_id="TXN1", payment_date="2026-08-01", amount=1000.0)],
        settlements=[SettlementItem(settlement_id="SET1", transaction_id="TXN1", settlement_date="2026-08-02", gross_amount=1000.0, fee=0.0, tax=0.0, net_amount=1000.0)],
        bank_transactions=[BankTransactionItem(bank_transaction_id="BANK1", settlement_id="SET1", transaction_date="2026-08-02", reference="TXN1", credit_amount=1000.0)],
        refunds=[]
    )
    response = run_reconciliation_pipeline(payload)
    assert response.total_records == 1
    assert response.matched_count == 1
    assert response.results[0].status == "MATCHED"

def test_fee_adjusted_match():
    payload = ReconcileRequestPayload(
        orders=[OrderItem(order_id="ORD2", order_date="2026-08-01", order_amount=10000.0, payment_id="PAY2")],
        payments=[PaymentItem(payment_id="PAY2", order_id="ORD2", transaction_id="TXN2", payment_date="2026-08-01", amount=10000.0)],
        settlements=[SettlementItem(settlement_id="SET2", transaction_id="TXN2", settlement_date="2026-08-02", gross_amount=10000.0, fee=200.0, tax=36.0, net_amount=9764.0)],
        bank_transactions=[BankTransactionItem(bank_transaction_id="BANK2", settlement_id="SET2", transaction_date="2026-08-02", reference="TXN2", credit_amount=9764.0)],
        refunds=[]
    )
    response = run_reconciliation_pipeline(payload)
    assert response.results[0].status == "MATCHED"
    assert response.results[0].amount_difference == 0.0

def test_refund_adjusted_match():
    payload = ReconcileRequestPayload(
        orders=[OrderItem(order_id="ORD3", order_date="2026-08-01", order_amount=10000.0, payment_id="PAY3")],
        payments=[PaymentItem(payment_id="PAY3", order_id="ORD3", transaction_id="TXN3", payment_date="2026-08-01", amount=10000.0)],
        settlements=[SettlementItem(settlement_id="SET3", transaction_id="TXN3", settlement_date="2026-08-02", gross_amount=10000.0, fee=200.0, tax=36.0, net_amount=9764.0)],
        bank_transactions=[BankTransactionItem(bank_transaction_id="BANK3", settlement_id="SET3", transaction_date="2026-08-02", reference="TXN3", credit_amount=8764.0)],
        refunds=[RefundItem(refund_id="REF3", transaction_id="TXN3", refund_date="2026-08-03", refund_amount=1000.0)]
    )
    response = run_reconciliation_pipeline(payload)
    assert response.results[0].status == "MATCHED"

def test_amount_mismatch_exception():
    payload = ReconcileRequestPayload(
        orders=[OrderItem(order_id="ORD4", order_date="2026-08-01", order_amount=10000.0, payment_id="PAY4")],
        payments=[PaymentItem(payment_id="PAY4", order_id="ORD4", transaction_id="TXN4", payment_date="2026-08-01", amount=10000.0)],
        settlements=[SettlementItem(settlement_id="SET4", transaction_id="TXN4", settlement_date="2026-08-02", gross_amount=10000.0, fee=200.0, tax=36.0, net_amount=9764.0)],
        bank_transactions=[BankTransactionItem(bank_transaction_id="BANK4", settlement_id="SET4", transaction_date="2026-08-02", reference="TXN4", credit_amount=9200.0)],
        refunds=[]
    )
    response = run_reconciliation_pipeline(payload)
    assert response.results[0].status == "EXCEPTION"
    assert response.results[0].exception_category == "AMOUNT_MISMATCH"

def test_missing_settlement_exception():
    payload = ReconcileRequestPayload(
        orders=[OrderItem(order_id="ORD5", order_date="2026-08-01", order_amount=5000.0, payment_id="PAY5")],
        payments=[PaymentItem(payment_id="PAY5", order_id="ORD5", transaction_id="TXN5", payment_date="2026-08-01", amount=5000.0)],
        settlements=[],
        bank_transactions=[],
        refunds=[]
    )
    response = run_reconciliation_pipeline(payload)
    assert response.results[0].status == "EXCEPTION"
    assert response.results[0].exception_category == "MISSING_SETTLEMENT"

def test_evaluation_pipeline():
    preds = [
        {"transaction_id": "TXN1", "status": "MATCHED", "confidence": 100.0, "reason": "", "amount_difference": 0.0, "date_difference": 0},
        {"transaction_id": "TXN2", "status": "REVIEW", "confidence": 85.0, "reason": "", "amount_difference": 0.0, "date_difference": 0},
        {"transaction_id": "TXN3", "status": "EXCEPTION", "confidence": 40.0, "reason": "", "amount_difference": 500.0, "date_difference": 0}
    ]
    gt = [
        {"transaction_id": "TXN1", "ground_truth_status": "MATCHED"},
        {"transaction_id": "TXN2", "ground_truth_status": "REVIEW"},
        {"transaction_id": "TXN3", "ground_truth_status": "EXCEPTION"}
    ]
    req = EvaluateRequestPayload(predictions=preds, ground_truth=gt)
    res = run_evaluation_pipeline(req)
    assert res.accuracy == 100.0
    assert res.f1_macro == 100.0
