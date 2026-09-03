import csv
import random
import os
from datetime import datetime, timedelta

def generate_dataset(num_records=100, output_dir="data"):
    os.makedirs(output_dir, exist_ok=True)
    
    orders = []
    payments = []
    settlements = []
    bank_txns = []
    refunds = []
    ground_truth = []
    
    base_date = datetime(2026, 8, 1)
    
    # 9 Scenarios distribution
    scenarios_list = [
        "EXACT_MATCH",
        "FEE_ADJUSTED",
        "REFUND_ADJUSTED",
        "AMOUNT_MISMATCH",
        "MISSING_SETTLEMENT",
        "DUPLICATE_TRANSACTION",
        "PARTIAL_SETTLEMENT",
        "UNKNOWN_TRANSACTION",
        "DATE_MISMATCH"
    ]
    
    for i in range(1, num_records + 1):
        txn_num = 9000 + i
        ord_num = 1000 + i
        cust_num = 5000 + (i % 30)
        pay_num = 3000 + i
        set_num = 7000 + i
        bank_num = 8000 + i
        ref_num = 6000 + i
        
        txn_id = f"TXN{txn_num}"
        ord_id = f"ORD{ord_num}"
        cust_id = f"CUST{cust_num}"
        pay_id = f"PAY{pay_num}"
        set_id = f"SET{set_num}"
        bank_id = f"BANK{bank_num}"
        ref_id = f"REF{ref_num}"
        
        # Pick scenario deterministically for first 100, or weighted random
        if i <= 100:
            # Fixed mapping for initial 100 dataset to maintain exact ground truth repeatability
            if i in [1, 33, 82, 90, 93]:
                scenario = "DUPLICATE_TRANSACTION"
            elif i in [2, 4, 5, 24, 27, 32, 41, 63, 64, 65, 67, 72, 74, 86, 100]:
                scenario = "FEE_ADJUSTED"
            elif i in [3, 13, 25, 30, 37, 38, 66, 68, 92, 97]:
                scenario = "AMOUNT_MISMATCH"
            elif i in [8, 17, 18, 47, 56, 71, 77, 94]:
                scenario = "MISSING_SETTLEMENT"
            elif i in [15, 22, 60, 91, 99]:
                scenario = "PARTIAL_SETTLEMENT"
            elif i in [21, 49, 58, 61, 69, 73, 76, 80, 81, 96]:
                scenario = "REFUND_ADJUSTED"
            elif i in [28, 35, 44, 79]:
                scenario = "UNKNOWN_TRANSACTION"
            elif i in [62, 70, 75]:
                scenario = "DATE_MISMATCH"
            else:
                scenario = "EXACT_MATCH"
        else:
            scenario = random.choice(scenarios_list)
            
        order_days = (i % 20)
        ord_date = base_date + timedelta(days=order_days)
        pay_date = ord_date
        set_date = pay_date + timedelta(days=1)
        bank_date = set_date
        
        # Amounts
        possible_amounts = [499.0, 799.0, 1299.0, 2499.0, 4999.0, 7999.0, 12499.0, 19999.0, 29999.0]
        base_amount = possible_amounts[i % len(possible_amounts)]
        
        fee = 0.0
        tax = 0.0
        if scenario in ["FEE_ADJUSTED", "REFUND_ADJUSTED", "AMOUNT_MISMATCH", "PARTIAL_SETTLEMENT", "DUPLICATE_TRANSACTION"]:
            fee = round(base_amount * 0.02, 2)
            tax = round(fee * 0.18, 2)
            
        net_amount = round(base_amount - fee - tax, 2)
        
        refund_amount = 0.0
        has_refund = False
        if scenario == "REFUND_ADJUSTED":
            has_refund = True
            refund_amount = round(base_amount * 0.25, 2)
            expected_bank_credit = round(net_amount - refund_amount, 2)
        else:
            expected_bank_credit = net_amount

        actual_bank_credit = expected_bank_credit
        
        if scenario == "AMOUNT_MISMATCH":
            actual_bank_credit = round(expected_bank_credit - 564.0, 2)
        elif scenario == "PARTIAL_SETTLEMENT":
            actual_bank_credit = round(expected_bank_credit - 1000.0, 2)
            net_amount = actual_bank_credit
        elif scenario == "UNKNOWN_TRANSACTION":
            txn_id_in_bank = f"UNKNOWN{txn_num}"
        else:
            txn_id_in_bank = txn_id

        if scenario == "DATE_MISMATCH":
            bank_date = pay_date + timedelta(days=7) # Outside 2 day window
            set_date = bank_date

        # 1. Orders
        orders.append({
            "order_id": ord_id,
            "customer_id": cust_id,
            "order_date": ord_date.strftime("%Y-%m-%d"),
            "order_amount": base_amount,
            "currency": "INR",
            "payment_id": pay_id,
            "order_status": "COMPLETED"
        })
        
        # 2. Payments
        payments.append({
            "payment_id": pay_id,
            "order_id": ord_id,
            "transaction_id": txn_id,
            "payment_date": pay_date.strftime("%Y-%m-%d"),
            "payment_time": "10:15:00",
            "amount": base_amount,
            "payment_status": "CAPTURED",
            "payment_method": "UPI" if i % 2 == 0 else "CARD"
        })
        
        # 3. Settlements (Skip if MISSING_SETTLEMENT)
        if scenario != "MISSING_SETTLEMENT":
            settlements.append({
                "settlement_id": set_id,
                "transaction_id": txn_id,
                "settlement_date": set_date.strftime("%Y-%m-%d"),
                "gross_amount": base_amount,
                "fee": fee,
                "tax": tax,
                "net_amount": net_amount,
                "settlement_status": "SETTLED"
            })
            
            # 4. Bank Transactions
            bank_txns.append({
                "bank_transaction_id": bank_id,
                "settlement_id": set_id,
                "transaction_date": bank_date.strftime("%Y-%m-%d"),
                "transaction_time": "10:30:00",
                "reference": txn_id if scenario != "UNKNOWN_TRANSACTION" else f"UNKNOWN{txn_num}",
                "credit_amount": actual_bank_credit,
                "bank_status": "CREDITED"
            })
            
            if scenario == "DUPLICATE_TRANSACTION":
                # Add duplicate bank transaction
                bank_txns.append({
                    "bank_transaction_id": f"{bank_id}D",
                    "settlement_id": set_id,
                    "transaction_date": bank_date.strftime("%Y-%m-%d"),
                    "transaction_time": "10:31:00",
                    "reference": txn_id,
                    "credit_amount": actual_bank_credit,
                    "bank_status": "CREDITED"
                })
        
        # 5. Refunds
        if has_refund:
            refunds.append({
                "refund_id": ref_id,
                "transaction_id": txn_id,
                "refund_date": (pay_date + timedelta(days=2)).strftime("%Y-%m-%d"),
                "refund_amount": refund_amount,
                "refund_status": "PROCESSED",
                "refund_reason": "Customer return"
            })

        # 6. Ground Truth
        if scenario in ["EXACT_MATCH", "FEE_ADJUSTED", "REFUND_ADJUSTED"]:
            expected_status = "MATCHED"
            expected_reason = "Exact match or verified fee/refund adjustments"
        elif scenario in ["DUPLICATE_TRANSACTION", "PARTIAL_SETTLEMENT", "DATE_MISMATCH"]:
            expected_status = "REVIEW"
            expected_reason = f"Requires human review: {scenario}"
        else:
            expected_status = "EXCEPTION"
            expected_reason = f"Unresolved exception: {scenario}"
            
        ground_truth.append({
            "transaction_id": txn_id,
            "ground_truth_status": expected_status,
            "ground_truth_reason": expected_reason,
            "expected_exception_category": scenario
        })
        
    # Write to CSV files
    def write_csv(filepath, fieldnames, data):
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
            
    write_csv(os.path.join(output_dir, "orders.csv"), 
              ["order_id", "customer_id", "order_date", "order_amount", "currency", "payment_id", "order_status"], orders)
    write_csv(os.path.join(output_dir, "payments.csv"), 
              ["payment_id", "order_id", "transaction_id", "payment_date", "payment_time", "amount", "payment_status", "payment_method"], payments)
    write_csv(os.path.join(output_dir, "settlements.csv"), 
              ["settlement_id", "transaction_id", "settlement_date", "gross_amount", "fee", "tax", "net_amount", "settlement_status"], settlements)
    write_csv(os.path.join(output_dir, "bank_transactions.csv"), 
              ["bank_transaction_id", "settlement_id", "transaction_date", "transaction_time", "reference", "credit_amount", "bank_status"], bank_txns)
    write_csv(os.path.join(output_dir, "refunds.csv"), 
              ["refund_id", "transaction_id", "refund_date", "refund_amount", "refund_status", "refund_reason"], refunds)
    write_csv(os.path.join(output_dir, "ground_truth.csv"), 
              ["transaction_id", "ground_truth_status", "ground_truth_reason", "expected_exception_category"], ground_truth)
              
    print(f"Successfully generated {num_records} synthetic records in {output_dir}")

if __name__ == "__main__":
    generate_dataset(100, "data")
