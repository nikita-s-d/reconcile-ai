import json
import csv
import pandas as pd
import numpy as np

def run_evaluation_script(predictions_path="data/predictions.json", ground_truth_path="data/ground_truth.csv", output_dir="data"):
    # 1. Load predictions
    with open(predictions_path, "r", encoding="utf-8") as f:
        predictions_data = json.load(f)
        
    df_pred = pd.DataFrame(predictions_data)
    
    # 2. Load ground truth
    df_gt = pd.read_csv(ground_truth_path)
    
    total_gt = len(df_gt)
    total_pred = len(df_pred)
    
    # 3. Join on transaction_id
    df_merged = pd.merge(df_gt, df_pred, on="transaction_id", how="inner", suffixes=("_gt", "_pred"))
    matched_eval = len(df_merged)
    unmatched_gt = total_gt - matched_eval
    missing_pred = max(0, total_gt - matched_eval)
    
    labels = ["MATCHED", "REVIEW", "EXCEPTION"]
    matrix_dict = {actual: {pred: 0 for pred in labels} for actual in labels}
    
    correct = 0
    incorrect = 0
    
    for _, row in df_merged.iterrows():
        act = str(row.get("ground_truth_status", "")).upper().strip()
        pred = str(row.get("status", "")).upper().strip()
        
        if act in matrix_dict and pred in matrix_dict[act]:
            matrix_dict[act][pred] += 1
            
        if act == pred:
            correct += 1
        else:
            incorrect += 1
            
    accuracy = round((correct / matched_eval * 100.0), 2) if matched_eval > 0 else 0.0
    
    per_class = {}
    precisions = []
    recalls = []
    f1s = []
    supports = []
    
    for cls in labels:
        tp = matrix_dict[cls].get(cls, 0)
        fp = sum(matrix_dict[other].get(cls, 0) for other in labels if other != cls)
        fn = sum(matrix_dict[cls].get(other, 0) for other in labels if other != cls)
        
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        support = tp + fn
        
        per_class[cls] = {
            "precision": round(prec * 100.0, 2),
            "recall": round(rec * 100.0, 2),
            "f1": round(f1 * 100.0, 2),
            "support": support
        }
        
        precisions.append(prec)
        recalls.append(rec)
        f1s.append(f1)
        supports.append(support)
        
    prec_macro = round(np.mean(precisions) * 100.0, 2)
    rec_macro = round(np.mean(recalls) * 100.0, 2)
    f1_macro = round(np.mean(f1s) * 100.0, 2)
    
    report_json = {
        "dataset": ground_truth_path,
        "total_gt_records": total_gt,
        "matched_eval_records": matched_eval,
        "unmatched_gt_records": unmatched_gt,
        "missing_predictions": missing_pred,
        "correct_predictions": correct,
        "incorrect_predictions": incorrect,
        "accuracy": accuracy,
        "precision_macro": prec_macro,
        "recall_macro": rec_macro,
        "f1_macro": f1_macro,
        "per_class_metrics": per_class,
        "confusion_matrix": matrix_dict
    }
    
    with open(f"{output_dir}/evaluation_report.json", "w", encoding="utf-8") as f:
        json.dump(report_json, f, indent=2)
        
    # Also write evaluation_report.csv
    with open(f"{output_dir}/evaluation_report.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "value"])
        for k, v in report_json.items():
            if not isinstance(v, (dict, list)):
                writer.writerow([k, v])
                
    print("Successfully generated evaluation_report.json and evaluation_report.csv!")
    return report_json

if __name__ == "__main__":
    import sys
    pred_file = sys.argv[1] if len(sys.argv) > 1 else "data/predictions.json"
    gt_file = sys.argv[2] if len(sys.argv) > 2 else "data/ground_truth.csv"
    run_evaluation_script(pred_file, gt_file)
