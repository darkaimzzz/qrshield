# QRShield ML: dataset and model card

All numbers below are copied from `ml/metrics.json`, which `train.py` writes on every run.

## Dataset

| Field | Value |
|---|---|
| Name | PhiUSIIL Phishing URL Dataset |
| Source | UCI Machine Learning Repository #967. Download: https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip |
| Citation | Prasad, A. & Chandra, S. (2024). *PhiUSIIL: A diverse security profile empowered phishing URL detection framework based on similarity index and incremental learning.* Computers & Security 136. doi:10.1016/j.cose.2023.103545 |
| License | CC BY 4.0 (attribution required, which the citation above provides) |
| Retrieved | 2026-10-26 (zip SHA-256 `0a639fd03aea6308c5b1c10c92aa23c2ce1505447a9137271865cd0badc9a59a`) |
| Original labels | `label = 1` legitimate (134,850 rows), `label = 0` phishing (100,945 rows), 235,795 rows total |

The raw data is **not** committed (`ml/data/` is git-ignored). `train.py` downloads it.

## Preprocessing

1. Only the `URL` and `label` columns are used. The dataset's precomputed page-content features are ignored, because QRShield never downloads pages.
2. The hostname is extracted, lowercased, a trailing dot and a leading `www.` are removed, and the result is converted to ASCII (IDNA).
3. Rows are de-duplicated by hostname (16,701 duplicate rows removed). 58 hostnames that appear with both labels are dropped as ambiguous.
4. Result: **219,036 unique hostnames** (84,244 phishing / 134,792 legitimate) in 175,451 registrable-domain groups. Grouping uses tldextract's bundled Public Suffix List snapshot, so it works offline and is deterministic.

### Why hostname-only

PhiUSIIL's legitimate URLs are almost all bare homepages (`https://www.example.com`), while phishing URLs often carry paths. A model given path or query features learns "has a path ⇒ phishing", which would flag ordinary deep links from QR codes (menus, tickets). The model therefore sees **only the hostname**, and path-level signals stay in the transparent rule engine.

## Split, model and evaluation

* **Split:** `GroupShuffleSplit` by registrable domain, 80/20, seed 42. No registrable domain appears in both train and test (this is asserted in code). Train: 171,262 hostnames (63,319 phishing). Test: 47,774 (20,925 phishing).
* **Model:** `StandardScaler` + `LogisticRegression(class_weight="balanced")`, 59 features (see `features.py`).
* **Regularization:** 5-fold `GroupKFold` CV on the training split gave ROC-AUC 0.8716 / 0.8746 / 0.8751 / 0.8751 for C = 0.01 / 0.1 / 1 / 10. C = 0.1 was chosen: the smallest C within 0.001 of the best, which gives nearly the same accuracy with smaller, more stable coefficients for per-feature explanations.

**Held-out test metrics** (threshold 0.5):

| Precision | Recall | F1 | Accuracy | ROC-AUC | Brier |
|---|---|---|---|---|---|
| 0.9023 | 0.7681 | 0.8298 | 0.8620 | 0.9061 | 0.1074 |

Confusion matrix: TN 25,108 · FP 1,741 · FN 4,853 · TP 16,072.

On the training split the model scores *lower* (ROC-AUC 0.8751). This is the grouped CV estimate, and the gap reflects how the random group split happened to compose the test set, not overfitting. Treat ~0.87–0.91 as the plausible range.

## Calibration and use

The probability is **not calibrated**: `class_weight="balanced"` deliberately shifts it, and no calibration step was fitted. The app labels it "uncalibrated", shows it separately from the heuristic score, and never averages the two.

## Known limitations

* The model was trained on 2023-era web URLs, not specifically on URLs from QR codes.
* Hostname-only features cannot see phishing hosted on reputable platforms (compromised sites, free hosting subdomains, shorteners).
* Labels come from the dataset authors; label noise is possible.

## Reproduce

```bash
cd ml
uv sync
uv run python train.py   # writes lib/engine/model.json, ml/metrics.json, tests/fixtures/ml-parity.json
cd .. && npx vitest run tests/unit/services.test.ts   # TypeScript/Python parity check
```
