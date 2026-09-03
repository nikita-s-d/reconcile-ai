import time
from typing import Dict, Any, List
from app.validation import prepare_dataframes
from app.matching import build_transaction_graph
from app.scoring import calculate_confidence_and_decision
from app.schemas import ReconcileRequestPayload, ReconcileResponsePayload, ReconciliationResultItem

def run_reconciliation_pipeline(payload: ReconcileRequestPayload) -> ReconcileResponsePayload:
    start_time = time.time()

    # 1. Prepare DataFrames
    df_orders, df_payments, df_settlements, df_bank, df_refunds = prepare_dataframes(payload)

    # 2. Build multi-source graph bundles
    bundles = build_transaction_graph(df_orders, df_payments, df_settlements, df_bank, df_refunds)

    results: List[ReconciliationResultItem] = []

    matched_count = 0
    review_count = 0
    exception_count = 0

    for bundle in bundles:
        tx_id = bundle.get("transaction_id", "")
        ord_item = bundle.get("order")
        pay_item = bundle.get("payment")
        set_item = bundle.get("settlement")
        bank_txs = bundle.get("bank_transactions", [])

        ord_id = ord_item.get("order_id") if ord_item else (pay_item.get("order_id") if pay_item else None)
        pay_id = pay_item.get("payment_id") if pay_item else None
        set_id = set_item.get("settlement_id") if set_item else None
        bank_id = bank_txs[0].get("bank_transaction_id") if bank_txs else None

        decision = calculate_confidence_and_decision(bundle, payload.settings)

        status = decision["status"]
        if status == "MATCHED":
            matched_count += 1
        elif status == "REVIEW":
            review_count += 1
        else:
            exception_count += 1

        results.append(ReconciliationResultItem(
            transaction_id=tx_id,
            order_id=ord_id,
            matched_payment_id=pay_id,
            matched_settlement_id=set_id,
            matched_bank_transaction_id=bank_id,
            status=status,
            confidence=decision["confidence"],
            reason=decision["reason"],
            amount_difference=decision["amount_difference"],
            date_difference=decision["date_difference"],
            evidence=decision["evidence"],
            exception_category=decision.get("exception_category"),
            severity=decision.get("severity")
        ))

    total_records = len(results)
    match_rate = round((matched_count / total_records * 100.0), 2) if total_records > 0 else 0.0

    end_time = time.time()
    processing_time_ms = round((end_time - start_time) * 1000.0, 2)
    processing_time_sec = max((end_time - start_time), 0.001)
    throughput = round(total_records / processing_time_sec, 2)

    return ReconcileResponsePayload(
        results=results,
        total_records=total_records,
        matched_count=matched_count,
        review_count=review_count,
        exception_count=exception_count,
        match_rate=match_rate,
        processing_time_ms=processing_time_ms,
        throughput=throughput
    )
