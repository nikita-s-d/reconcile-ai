import pandas as pd
import numpy as np
from typing import Dict, Any, List
from app.schemas import EvaluateRequestPayload, EvaluateResponsePayload, ConfusionMatrixData

def run_evaluation_pipeline(payload: EvaluateRequestPayload) -> EvaluateResponsePayload:
    pred_dicts = [item.model_dump() for item in payload.predictions]
    gt_dicts = [item.model_dump() for item in payload.ground_truth]

    df_pred = pd.DataFrame(pred_dicts) if pred_dicts else pd.DataFrame(columns=["transaction_id", "status"])
    df_gt = pd.DataFrame(gt_dicts) if gt_dicts else pd.DataFrame(columns=["transaction_id", "ground_truth_status"])

    total_gt_records = len(df_gt)
    total_pred_records = len(df_pred)

    if df_pred.empty or df_gt.empty:
        return EvaluateResponsePayload(
            total_gt_records=total_gt_records,
            matched_eval_records=0,
            unmatched_gt_records=total_gt_records,
            missing_predictions_count=total_gt_records,
            correct_predictions=0,
            incorrect_predictions=0,
            accuracy=0.0,
            precision_macro=0.0,
            recall_macro=0.0,
            f1_macro=0.0,
            f1_weighted=0.0,
            per_class_metrics={},
            match_rate=0.0,
            confusion_matrix=ConfusionMatrixData(
                matrix={"MATCHED": {}, "REVIEW": {}, "EXCEPTION": {}},
                labels=["MATCHED", "REVIEW", "EXCEPTION"]
            )
        )

    # Join on transaction_id
    df_merged = pd.merge(df_gt, df_pred, on="transaction_id", how="inner", suffixes=("_gt", "_pred"))

    matched_eval_records = len(df_merged)
    unmatched_gt_records = total_gt_records - matched_eval_records
    missing_predictions_count = max(0, total_gt_records - matched_eval_records)

    labels = ["MATCHED", "REVIEW", "EXCEPTION"]
    matrix_dict = {actual: {pred: 0 for pred in labels} for actual in labels}

    correct_count = 0
    incorrect_count = 0

    for _, row in df_merged.iterrows():
        act = str(row.get("ground_truth_status", "")).upper().strip()
        pred = str(row.get("status", "")).upper().strip()

        if act not in matrix_dict:
            matrix_dict[act] = {p: 0 for p in labels}
        if pred not in matrix_dict[act]:
            matrix_dict[act][pred] = 0

        matrix_dict[act][pred] += 1

        if act == pred:
            correct_count += 1
        else:
            incorrect_count += 1

    accuracy = round((correct_count / matched_eval_records * 100.0), 2) if matched_eval_records > 0 else 0.0

    # Per-class & Macro metrics
    per_class = {}
    precisions = []
    recalls = []
    f1s = []
    support_weights = []

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
        support_weights.append(support)

    prec_macro = round(np.mean(precisions) * 100.0, 2)
    rec_macro = round(np.mean(recalls) * 100.0, 2)
    f1_macro = round(np.mean(f1s) * 100.0, 2)

    total_supp = sum(support_weights)
    if total_supp > 0:
        f1_weighted = round(sum(f1s[i] * support_weights[i] for i in range(len(labels))) / total_supp * 100.0, 2)
    else:
        f1_weighted = 0.0

    matched_preds_count = len(df_pred[df_pred["status"] == "MATCHED"])
    match_rate = round((matched_preds_count / total_pred_records * 100.0), 2) if total_pred_records > 0 else 0.0

    return EvaluateResponsePayload(
        total_gt_records=total_gt_records,
        matched_eval_records=matched_eval_records,
        unmatched_gt_records=unmatched_gt_records,
        missing_predictions_count=missing_predictions_count,
        correct_predictions=correct_count,
        incorrect_predictions=incorrect_count,
        accuracy=accuracy,
        precision_macro=prec_macro,
        recall_macro=rec_macro,
        f1_macro=f1_macro,
        f1_weighted=f1_weighted,
        per_class_metrics=per_class,
        match_rate=match_rate,
        confusion_matrix=ConfusionMatrixData(matrix=matrix_dict, labels=labels)
    )
