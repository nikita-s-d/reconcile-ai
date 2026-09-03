import pandas as pd
from typing import Dict, List, Any, Optional

def build_transaction_graph(df_orders: pd.DataFrame, 
                             df_payments: pd.DataFrame, 
                             df_settlements: pd.DataFrame, 
                             df_bank: pd.DataFrame, 
                             df_refunds: pd.DataFrame) -> List[Dict[str, Any]]:
    
    # Collect all unique transaction_ids from payments, settlements, refunds, or bank reference
    tx_ids = set()
    
    if not df_payments.empty and "transaction_id" in df_payments.columns:
        tx_ids.update(df_payments["transaction_id"].dropna().astype(str).unique())
        
    if not df_settlements.empty and "transaction_id" in df_settlements.columns:
        tx_ids.update(df_settlements["transaction_id"].dropna().astype(str).unique())

    if not df_refunds.empty and "transaction_id" in df_refunds.columns:
        tx_ids.update(df_refunds["transaction_id"].dropna().astype(str).unique())

    if not df_bank.empty and "reference" in df_bank.columns:
        for ref in df_bank["reference"].dropna().astype(str).unique():
            if not ref.startswith("UNKNOWN"):
                tx_ids.add(ref)

    # Also handle unknown bank transactions as standalone cases
    unknown_bank_txs = []
    if not df_bank.empty:
        for _, bank_row in df_bank.iterrows():
            ref = str(bank_row.get("reference", ""))
            if ref.startswith("UNKNOWN") or not ref:
                unknown_bank_txs.append(bank_row.to_dict())

    bundled_records = []
    
    for tx_id in sorted(list(tx_ids)):
        # Find matching payment
        pay_rows = df_payments[df_payments["transaction_id"] == tx_id] if not df_payments.empty else pd.DataFrame()
        pay_item = pay_rows.iloc[0].to_dict() if not pay_rows.empty else None
        
        # Find matching order
        ord_item = None
        if pay_item and pay_item.get("order_id"):
            ord_id = pay_item.get("order_id")
            ord_rows = df_orders[df_orders["order_id"] == ord_id] if not df_orders.empty else pd.DataFrame()
            if not ord_rows.empty:
                ord_item = ord_rows.iloc[0].to_dict()
        elif not df_orders.empty and "order_id" in df_orders.columns:
            # Fallback search by tx_id or payment_id
            ord_rows = df_orders[df_orders["payment_id"] == (pay_item.get("payment_id") if pay_item else "")]
            if not ord_rows.empty:
                ord_item = ord_rows.iloc[0].to_dict()

        # Find matching settlement
        set_rows = df_settlements[df_settlements["transaction_id"] == tx_id] if not df_settlements.empty else pd.DataFrame()
        set_item = set_rows.iloc[0].to_dict() if not set_rows.empty else None

        # Find matching bank transactions
        bank_matches = []
        if set_item and set_item.get("settlement_id"):
            set_id = set_item.get("settlement_id")
            bank_rows = df_bank[df_bank["settlement_id"] == set_id] if not df_bank.empty else pd.DataFrame()
            bank_matches = bank_rows.to_dict("records") if not bank_rows.empty else []
        elif not df_bank.empty and "reference" in df_bank.columns:
            bank_rows = df_bank[df_bank["reference"] == tx_id]
            bank_matches = bank_rows.to_dict("records") if not bank_rows.empty else []

        # Find matching refund
        ref_rows = df_refunds[df_refunds["transaction_id"] == tx_id] if not df_refunds.empty else pd.DataFrame()
        ref_item = ref_rows.iloc[0].to_dict() if not ref_rows.empty else None

        bundled_records.append({
            "transaction_id": tx_id,
            "order": ord_item,
            "payment": pay_item,
            "settlement": set_item,
            "bank_transactions": bank_matches,
            "refund": ref_item,
            "is_unknown": False
        })

    # Append standalone unknown bank transactions
    for bank_row in unknown_bank_txs:
        bt_id = str(bank_row.get("bank_transaction_id", "UNKNOWN"))
        ref_val = str(bank_row.get("reference", f"TXN_UNK_{bt_id}"))
        bundled_records.append({
            "transaction_id": ref_val if ref_val else f"TXN_UNK_{bt_id}",
            "order": None,
            "payment": None,
            "settlement": None,
            "bank_transactions": [bank_row],
            "refund": None,
            "is_unknown": True
        })

    return bundled_records
