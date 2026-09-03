import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Any

def normalize_date(date_str: Any) -> str:
    if pd.isna(date_str) or not date_str:
        return ""
    try:
        dt = pd.to_datetime(date_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(date_str).strip()

def calculate_days_diff(date1_str: str, date2_str: str) -> int:
    if not date1_str or not date2_str:
        return 0
    try:
        d1 = pd.to_datetime(date1_str)
        d2 = pd.to_datetime(date2_str)
        return abs((d2 - d1).days)
    except Exception:
        return 0

def prepare_dataframes(payload: Any) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    # Orders
    orders_data = [item.model_dump() for item in payload.orders] if payload.orders else []
    df_orders = pd.DataFrame(orders_data) if orders_data else pd.DataFrame(columns=["order_id", "customer_id", "order_date", "order_amount", "currency", "payment_id", "order_status"])
    if not df_orders.empty:
        df_orders["order_date"] = df_orders["order_date"].apply(normalize_date)
        df_orders["order_amount"] = pd.to_numeric(df_orders["order_amount"], errors="coerce").fillna(0.0)

    # Payments
    payments_data = [item.model_dump() for item in payload.payments] if payload.payments else []
    df_payments = pd.DataFrame(payments_data) if payments_data else pd.DataFrame(columns=["payment_id", "order_id", "transaction_id", "payment_date", "payment_time", "amount", "payment_status", "payment_method"])
    if not df_payments.empty:
        df_payments["payment_date"] = df_payments["payment_date"].apply(normalize_date)
        df_payments["amount"] = pd.to_numeric(df_payments["amount"], errors="coerce").fillna(0.0)

    # Settlements
    settlements_data = [item.model_dump() for item in payload.settlements] if payload.settlements else []
    df_settlements = pd.DataFrame(settlements_data) if settlements_data else pd.DataFrame(columns=["settlement_id", "transaction_id", "settlement_date", "gross_amount", "fee", "tax", "net_amount", "settlement_status"])
    if not df_settlements.empty:
        df_settlements["settlement_date"] = df_settlements["settlement_date"].apply(normalize_date)
        df_settlements["gross_amount"] = pd.to_numeric(df_settlements["gross_amount"], errors="coerce").fillna(0.0)
        df_settlements["fee"] = pd.to_numeric(df_settlements["fee"], errors="coerce").fillna(0.0)
        df_settlements["tax"] = pd.to_numeric(df_settlements["tax"], errors="coerce").fillna(0.0)
        df_settlements["net_amount"] = pd.to_numeric(df_settlements["net_amount"], errors="coerce").fillna(0.0)

    # Bank Transactions
    bank_data = [item.model_dump() for item in payload.bank_transactions] if payload.bank_transactions else []
    df_bank = pd.DataFrame(bank_data) if bank_data else pd.DataFrame(columns=["bank_transaction_id", "settlement_id", "transaction_date", "transaction_time", "reference", "credit_amount", "bank_status"])
    if not df_bank.empty:
        df_bank["transaction_date"] = df_bank["transaction_date"].apply(normalize_date)
        df_bank["credit_amount"] = pd.to_numeric(df_bank["credit_amount"], errors="coerce").fillna(0.0)

    # Refunds
    refunds_data = [item.model_dump() for item in payload.refunds] if payload.refunds else []
    df_refunds = pd.DataFrame(refunds_data) if refunds_data else pd.DataFrame(columns=["refund_id", "transaction_id", "refund_date", "refund_amount", "refund_status", "refund_reason"])
    if not df_refunds.empty:
        df_refunds["refund_date"] = df_refunds["refund_date"].apply(normalize_date)
        df_refunds["refund_amount"] = pd.to_numeric(df_refunds["refund_amount"], errors="coerce").fillna(0.0)

    return df_orders, df_payments, df_settlements, df_bank, df_refunds
