from typing import Dict, Any, Tuple
from app.validation import calculate_days_diff

def calculate_confidence_and_decision(bundle: Dict[str, Any], settings: Any) -> Dict[str, Any]:
    matched_threshold = getattr(settings, "matched_threshold", 95.0)
    review_threshold = getattr(settings, "review_threshold", 80.0)
    settlement_window_days = getattr(settings, "settlement_window_days", 2)

    tx_id = bundle.get("transaction_id", "")
    order = bundle.get("order")
    payment = bundle.get("payment")
    settlement = bundle.get("settlement")
    bank_txs = bundle.get("bank_transactions", [])
    refund = bundle.get("refund")
    is_unknown = bundle.get("is_unknown", False)

    # 1. Unknown transaction scenario
    if is_unknown or (not payment and not settlement and not order):
        return {
            "status": "EXCEPTION",
            "confidence": 10.0,
            "reason": "Bank transaction cannot be linked to any known payment or settlement record.",
            "amount_difference": float(bank_txs[0].get("credit_amount", 0.0)) if bank_txs else 0.0,
            "date_difference": 0,
            "exception_category": "UNKNOWN_TRANSACTION",
            "severity": "HIGH",
            "evidence": {
                "signal_scores": {"tx_id": 0, "ids_rel": 0, "amount": 0, "date": 0, "bank_ref": 10 if bank_txs else 0},
                "gross_amount": 0.0,
                "fee": 0.0,
                "tax": 0.0,
                "refund": 0.0,
                "expected_bank_amount": 0.0,
                "actual_bank_amount": float(bank_txs[0].get("credit_amount", 0.0)) if bank_txs else 0.0
            }
        }

    # Signal Scores
    signal_tx_id = 0.0
    signal_ids_rel = 0.0
    signal_amount_recon = 0.0
    signal_date_window = 0.0
    signal_bank_ref = 0.0

    # Signal 1: Transaction ID (+40)
    if payment and payment.get("transaction_id") == tx_id:
        signal_tx_id = 40.0
    elif settlement and settlement.get("transaction_id") == tx_id:
        signal_tx_id = 40.0

    # Signal 2: Related IDs (+20)
    if order and payment and (order.get("payment_id") == payment.get("payment_id") or order.get("order_id") == payment.get("order_id")):
        signal_ids_rel += 10.0
    if settlement and payment and settlement.get("transaction_id") == payment.get("transaction_id"):
        signal_ids_rel += 10.0

    gross_amount = float(settlement.get("gross_amount", 0.0)) if settlement else float(payment.get("amount", 0.0)) if payment else 0.0
    fee = float(settlement.get("fee", 0.0)) if settlement else 0.0
    tax = float(settlement.get("tax", 0.0)) if settlement else 0.0
    settlement_net = float(settlement.get("net_amount", 0.0)) if settlement else 0.0
    refund_amount = float(refund.get("refund_amount", 0.0)) if refund else 0.0

    expected_bank_amount = round(gross_amount - fee - tax - refund_amount, 2)

    actual_bank_amount = 0.0
    if bank_txs:
        actual_bank_amount = round(sum(float(b.get("credit_amount", 0.0)) for b in bank_txs), 2)

    amount_diff = round(abs(actual_bank_amount - expected_bank_amount), 2)

    # Signal 3: Amount Reconciliation (+20)
    if amount_diff < 0.01:
        signal_amount_recon = 20.0
    elif amount_diff < 10.0:
        signal_amount_recon = 10.0
    else:
        signal_amount_recon = 0.0

    # Signal 4: Date Window (+10)
    pay_date = payment.get("payment_date") if payment else (order.get("order_date") if order else "")
    set_date = settlement.get("settlement_date") if settlement else ""
    bank_date = bank_txs[0].get("transaction_date") if bank_txs else ""

    date_diff_pay_set = calculate_days_diff(pay_date, set_date) if set_date else 0
    date_diff_set_bank = calculate_days_diff(set_date, bank_date) if bank_date and set_date else 0
    max_date_diff = max(date_diff_pay_set, date_diff_set_bank)

    if max_date_diff <= settlement_window_days:
        signal_date_window = 10.0
    else:
        signal_date_window = 0.0

    # Signal 5: Bank Reference (+10)
    if bank_txs and bank_txs[0].get("reference") == tx_id:
        signal_bank_ref = 10.0

    total_score = signal_tx_id + signal_ids_rel + signal_amount_recon + signal_date_window + signal_bank_ref

    # ----------------------------------------------------
    # Specific Scenario Evaluation (Order of precedence)
    # ----------------------------------------------------

    # 1. Missing Settlement Exception
    if payment and not settlement:
        return {
            "status": "EXCEPTION",
            "confidence": 35.0,
            "reason": "No settlement record was found for this transaction.",
            "amount_difference": float(payment.get("amount", 0.0)),
            "date_difference": 0,
            "exception_category": "MISSING_SETTLEMENT",
            "severity": "HIGH",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": 0, "date": 0, "bank_ref": 0},
                "gross_amount": float(payment.get("amount", 0.0)),
                "fee": 0.0,
                "tax": 0.0,
                "refund": 0.0,
                "expected_bank_amount": float(payment.get("amount", 0.0)),
                "actual_bank_amount": 0.0
            }
        }

    # 2. Duplicate Bank Transaction Review
    if len(bank_txs) > 1:
        return {
            "status": "REVIEW",
            "confidence": 88.0,
            "reason": f"Duplicate bank transaction detected ({len(bank_txs)} bank entries reference settlement {settlement.get('settlement_id', '') if settlement else ''}). Requires human review.",
            "amount_difference": amount_diff,
            "date_difference": max_date_diff,
            "exception_category": "DUPLICATE_TRANSACTION",
            "severity": "MEDIUM",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount,
                "duplicate_count": len(bank_txs)
            }
        }

    # 3. Date Mismatch Review
    if max_date_diff > settlement_window_days:
        return {
            "status": "REVIEW",
            "confidence": 88.0,
            "reason": f"The transaction dates are outside the configured settlement window ({max_date_diff} days difference vs max {settlement_window_days} days).",
            "amount_difference": amount_diff,
            "date_difference": max_date_diff,
            "exception_category": "DATE_MISMATCH",
            "severity": "LOW",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": 0, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }

    # 4. Partial Settlement Review (Settlement net_amount is less than gross_amount - fee - tax)
    expected_settlement_net = round(gross_amount - fee - tax, 2)
    if settlement and settlement_net < expected_settlement_net and abs(settlement_net - expected_settlement_net) > 1.0:
        return {
            "status": "REVIEW",
            "confidence": 85.0,
            "reason": f"Settlement net amount (₹{settlement_net:,.2f}) is lower than expected gross minus fees (₹{expected_settlement_net:,.2f}). Requires review.",
            "amount_difference": round(abs(settlement_net - expected_settlement_net), 2),
            "date_difference": max_date_diff,
            "exception_category": "PARTIAL_SETTLEMENT",
            "severity": "MEDIUM",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }

    # 5. Amount Mismatch Exception (Expected bank credit vs Actual bank credit discrepancy)
    if amount_diff > 0.01:
        return {
            "status": "EXCEPTION",
            "confidence": 40.0,
            "reason": f"The expected bank credit is ₹{expected_bank_amount:,.2f}, while actual bank credit is ₹{actual_bank_amount:,.2f}. No recorded fee, tax or refund explains the ₹{amount_diff:,.2f} difference.",
            "amount_difference": amount_diff,
            "date_difference": max_date_diff,
            "exception_category": "AMOUNT_MISMATCH",
            "severity": "HIGH",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": 0, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }

    # 6. Matches (Exact, Fee-Adjusted, Refund-Adjusted)
    if total_score >= matched_threshold:
        if refund_amount > 0:
            reason = f"The order & payment gross amount is ₹{gross_amount:,.2f}. Fee of ₹{fee:,.2f}, tax of ₹{tax:,.2f}, and refund of ₹{refund_amount:,.2f} yield expected net credit of ₹{expected_bank_amount:,.2f}, matching actual bank credit."
        elif fee > 0 or tax > 0:
            reason = f"The gross amount is ₹{gross_amount:,.2f}. Fee of ₹{fee:,.2f} and tax of ₹{tax:,.2f} yield net amount of ₹{expected_bank_amount:,.2f}, matching actual bank credit."
        else:
            reason = f"Exact match confirmed across order, payment, settlement, and bank credit of ₹{gross_amount:,.2f}."

        return {
            "status": "MATCHED",
            "confidence": total_score,
            "reason": reason,
            "amount_difference": 0.0,
            "date_difference": max_date_diff,
            "exception_category": None,
            "severity": None,
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }
    elif total_score >= review_threshold:
        return {
            "status": "REVIEW",
            "confidence": total_score,
            "reason": f"Transaction matched with partial confidence ({total_score:.1f}%). Requires review.",
            "amount_difference": amount_diff,
            "date_difference": max_date_diff,
            "exception_category": "OTHER",
            "severity": "LOW",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }
    else:
        return {
            "status": "EXCEPTION",
            "confidence": total_score,
            "reason": f"Confidence score ({total_score:.1f}%) is below minimum threshold for automated matching.",
            "amount_difference": amount_diff,
            "date_difference": max_date_diff,
            "exception_category": "OTHER",
            "severity": "HIGH",
            "evidence": {
                "signal_scores": {"tx_id": signal_tx_id, "ids_rel": signal_ids_rel, "amount": signal_amount_recon, "date": signal_date_window, "bank_ref": signal_bank_ref},
                "gross_amount": gross_amount,
                "fee": fee,
                "tax": tax,
                "refund": refund_amount,
                "expected_bank_amount": expected_bank_amount,
                "actual_bank_amount": actual_bank_amount
            }
        }
