"""Reproducible training pipeline for the QRShield hostname phishing classifier.

Usage (from ml/):  uv run python train.py

Steps: download PhiUSIIL (UCI #967, CC BY 4.0) -> extract hostnames -> deduplicate ->
group-aware train/test split by registrable domain -> StandardScaler + LogisticRegression ->
evaluate on held-out groups -> export model.json (TypeScript inference) + parity fixtures.
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import tldextract
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import extract_features, feature_names, ml_hostname

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DATASET_URL = "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip"
MODEL_OUT = ROOT.parent / "lib" / "engine" / "model.json"
PARITY_OUT = ROOT.parent / "tests" / "fixtures" / "ml-parity.json"
METRICS_OUT = ROOT / "metrics.json"
SEED = 42

# Offline PSL snapshot bundled with tldextract: no network fetch, deterministic grouping.
EXTRACT = tldextract.TLDExtract(suffix_list_urls=())


def download() -> tuple[pd.DataFrame, dict]:
    DATA.mkdir(exist_ok=True)
    zpath = DATA / "phiusiil.zip"
    if not zpath.exists():
        print(f"Downloading {DATASET_URL}")
        with urllib.request.urlopen(DATASET_URL, timeout=120) as r:
            zpath.write_bytes(r.read())
    raw = zpath.read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        df = pd.read_csv(z.open(name), usecols=["URL", "label"])
    meta = {
        "name": "PhiUSIIL Phishing URL Dataset",
        "source": DATASET_URL,
        "citation": "Prasad, A. & Chandra, S. (2024). PhiUSIIL Phishing URL Dataset. UCI Machine Learning Repository. https://doi.org/10.1016/j.cose.2023.103545",
        "license": "CC BY 4.0",
        "file": name,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved": datetime.fromtimestamp(zpath.stat().st_mtime, timezone.utc).date().isoformat(),
        "original_rows": int(len(df)),
        "original_label_counts": {
            "legitimate (label=1)": int((df.label == 1).sum()),
            "phishing (label=0)": int((df.label == 0).sum()),
        },
    }
    return df, meta


def to_ascii_host(url: str) -> str | None:
    host = ml_hostname(str(url))
    if not host:
        return None
    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError:
        return None
    return host or None


def prepare(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = df.assign(phishing=(df.label == 0).astype(int), host=df.URL.map(to_ascii_host))
    no_host = int(df.host.isna().sum())
    df = df.dropna(subset=["host"])
    # One row per hostname. Hostnames that carry both labels are ambiguous and dropped.
    agg = df.groupby("host").phishing.agg(["min", "max"]).reset_index()
    conflicting = int((agg["min"] != agg["max"]).sum())
    agg = agg[agg["min"] == agg["max"]].rename(columns={"min": "phishing"})[["host", "phishing"]]
    agg["group"] = agg.host.map(lambda h: EXTRACT(h).top_domain_under_public_suffix or h)
    stats = {
        "rows_without_parsable_host": no_host,
        "duplicate_rows_removed": int(len(df) - len(agg) - conflicting),
        "conflicting_hostnames_removed": conflicting,
        "unique_hostnames": int(len(agg)),
        "class_counts": {
            "phishing": int(agg.phishing.sum()),
            "legitimate": int((agg.phishing == 0).sum()),
        },
        "registrable_domain_groups": int(agg.group.nunique()),
    }
    return agg.reset_index(drop=True), stats


def evaluate(y: np.ndarray, p: np.ndarray, threshold: float = 0.5) -> dict:
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "threshold": threshold,
        "precision": round(float(precision_score(y, pred)), 4),
        "recall": round(float(recall_score(y, pred)), 4),
        "f1": round(float(f1_score(y, pred)), 4),
        "accuracy": round(float(accuracy_score(y, pred)), 4),
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "support": {"phishing": int(y.sum()), "legitimate": int(len(y) - y.sum())},
    }


def main() -> None:
    df_raw, dataset_meta = download()
    data, prep_stats = prepare(df_raw)
    print(json.dumps(prep_stats, indent=2))

    X = np.array([extract_features(h) for h in data.host], dtype=float)
    y = data.phishing.to_numpy()
    groups = data.group.to_numpy()

    split = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, test_idx = next(split.split(X, y, groups))
    assert not set(groups[train_idx]) & set(groups[test_idx]), "group leakage between splits"

    # Pick regularization strength with group-aware CV on the training split only.
    best_c, best_auc = 1.0, -1.0
    cv_results = {}
    for c in (0.01, 0.1, 1.0, 10.0):
        aucs = []
        for tr, va in GroupKFold(n_splits=5).split(X[train_idx], y[train_idx], groups[train_idx]):
            m = make_pipeline(
                StandardScaler(),
                LogisticRegression(C=c, class_weight="balanced", max_iter=3000),
            )
            m.fit(X[train_idx][tr], y[train_idx][tr])
            aucs.append(roc_auc_score(y[train_idx][va], m.predict_proba(X[train_idx][va])[:, 1]))
        cv_results[str(c)] = round(float(np.mean(aucs)), 4)
        if np.mean(aucs) > best_auc:
            best_c, best_auc = c, float(np.mean(aucs))
    print("CV ROC-AUC by C:", cv_results, "-> C =", best_c)

    model = make_pipeline(
        StandardScaler(), LogisticRegression(C=best_c, class_weight="balanced", max_iter=3000)
    )
    model.fit(X[train_idx], y[train_idx])
    p_test = model.predict_proba(X[test_idx])[:, 1]
    test_metrics = evaluate(y[test_idx], p_test)
    train_metrics = evaluate(y[train_idx], model.predict_proba(X[train_idx])[:, 1])
    print("Test metrics:", json.dumps(test_metrics, indent=2))

    scaler: StandardScaler = model.named_steps["standardscaler"]
    clf: LogisticRegression = model.named_steps["logisticregression"]
    names = feature_names()
    trained_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    metrics = {
        "trained_at": trained_at,
        "dataset": dataset_meta,
        "preprocessing": prep_stats,
        "split": {
            "method": "GroupShuffleSplit by registrable domain (test_size=0.2, seed=42)",
            "train_hostnames": int(len(train_idx)),
            "test_hostnames": int(len(test_idx)),
            "train_class_counts": {"phishing": int(y[train_idx].sum()), "legitimate": int(len(train_idx) - y[train_idx].sum())},
            "test_class_counts": {"phishing": int(y[test_idx].sum()), "legitimate": int(len(test_idx) - y[test_idx].sum())},
        },
        "model": {
            "type": "StandardScaler + LogisticRegression (class_weight=balanced)",
            "C": best_c,
            "cv_roc_auc_by_C": cv_results,
            "features": len(names),
        },
        "test": test_metrics,
        "train": train_metrics,
        "calibrated": False,
        "sklearn_version": __import__("sklearn").__version__,
        "python_version": sys.version.split()[0],
    }
    METRICS_OUT.write_text(json.dumps(metrics, indent=2))

    coef = clf.coef_[0]
    MODEL_OUT.write_text(
        json.dumps(
            {
                "name": "QRShield hostname logistic regression",
                "version": trained_at[:10],
                "features": names,
                "mean": [float(v) for v in scaler.mean_],
                "scale": [float(v) for v in scaler.scale_],
                "coef": [float(v) for v in coef],
                "intercept": float(clf.intercept_[0]),
                "threshold": 0.5,
                "calibrated": False,
                "metrics": {k: test_metrics[k] for k in ("precision", "recall", "f1", "accuracy", "roc_auc", "brier", "confusion_matrix", "support")},
                "dataset": {
                    "name": dataset_meta["name"],
                    "license": dataset_meta["license"],
                    "source": dataset_meta["source"],
                    "retrieved": dataset_meta["retrieved"],
                    "unique_hostnames": prep_stats["unique_hostnames"],
                    "class_counts": prep_stats["class_counts"],
                },
                "trained_at": trained_at,
            },
            indent=1,
        )
    )

    # Parity fixtures: held-out hostnames plus hand-picked edge cases (not training data).
    rng = np.random.default_rng(SEED)
    sample = list(data.host.to_numpy()[rng.choice(test_idx, size=200, replace=False)])
    sample += ["192.168.0.1", "xn--pypal-4ve.com", "a_b.example", "x.y", "login-secure-paypal.com.verify.tk", "localhost"]
    Xs = np.array([extract_features(h) for h in sample], dtype=float)
    PARITY_OUT.parent.mkdir(parents=True, exist_ok=True)
    PARITY_OUT.write_text(
        json.dumps(
            [
                {"host": h, "features": [float(v) for v in x], "probability": float(p)}
                for h, x, p in zip(sample, Xs, model.predict_proba(Xs)[:, 1])
            ]
        )
    )
    print(f"Wrote {MODEL_OUT}, {METRICS_OUT}, {PARITY_OUT}")


if __name__ == "__main__":
    main()
