# Machine learning

The hostname phishing classifier: data, training, evaluation and inference. The dataset card is in [ml/DATASET.md](../ml/DATASET.md).

## The machine-learning model

### Data

- **PhiUSIIL Phishing URL Dataset**: Prasad & Chandra (2024), UCI ML Repository #967, **CC BY 4.0**.
- Retrieved 26 Oct 2026; zip SHA-256 `0a639fd0…c9a59a`.
- 235,795 rows: 134,850 legitimate and 100,945 phishing. The raw data is downloaded by `train.py` and not committed.

### Preprocessing

1. Only the `URL` and `label` columns are used. The dataset's page-content features are ignored, because QRShield never downloads pages.
2. Hostnames are extracted, `www.` is stripped, and the result is IDNA-encoded.
3. De-duplication by hostname removed 16,701 rows. 58 hostnames carrying both labels were dropped.
4. **219,036 unique hostnames** remain: 84,244 phishing / 134,792 legitimate.

### Why hostname-only

PhiUSIIL's legitimate URLs are overwhelmingly bare homepages. A model allowed to see paths would learn "has a path ⇒ phishing", which would wrongly flag every deep link a restaurant or ticket QR code contains. Path-level signals stay in the transparent rule engine instead.

### Features (59)

- Hostname length, label count, hyphens, digits and digit ratio.
- Shannon entropy, longest and mean label length, TLD length.
- IP literal, punycode, vowel ratio, longest consonant run, keyword hits (30 words), underscores.
- Hyphen in the registrable label, first label length, longest repeated-character run.
- One-hot encoding for 40 TLDs plus "other".

### Leakage control

`GroupShuffleSplit` by **registrable domain** (175,451 groups; 80/20; seed 42). Without it, `a.evil.com` in training and `b.evil.com` in test would inflate scores. The code **asserts** that no group appears in both splits.

### Model and regularization

`StandardScaler` + `LogisticRegression(class_weight="balanced")`. Five-fold **GroupKFold** CV on the training split gave ROC-AUC 0.8716 / 0.8746 / 0.8751 / 0.8751 for C = 0.01 / 0.1 / 1 / 10. **C = 0.1** was selected: the most regularized value within 0.001 AUC of the best. With C = 10, coefficients on collinear length features were inflated (one feature contributed −10 logits while others pushed the opposite way), which made the per-feature explanations misleading. C = 0.1 costs 0.0005 AUC.

### Measured performance (held-out test set: 47,774 hostnames, threshold 0.5)

| Precision | Recall | F1     | Accuracy | ROC-AUC | Brier  |
| --------- | ------ | ------ | -------- | ------- | ------ |
| 0.9023    | 0.7681 | 0.8298 | 0.8620   | 0.9061  | 0.1074 |

Confusion matrix: TN 25,108 · FP 1,741 · FN 4,853 · TP 16,072. In plain terms, it misses about 23 % of phishing hostnames and wrongly flags about 6.5 % of legitimate ones on this data. Grouped CV gives 0.875 AUC, so treat **0.87–0.91** as the realistic range.

### Calibration and use

The model is **not calibrated**. Balanced class weights shift probabilities, and no calibration step was fitted. The UI labels the output "uncalibrated", shows it separately and **never averages** it into the score. Averaging an uncalibrated probability with a heuristic sum has no statistical meaning, and it would make the score no longer explainable by its listed evidence.

### Deployment without Python

`train.py` exports `model.json` (feature names, scaler mean/scale, coefficients, intercept, metrics, dataset metadata). `ml.ts` computes `sigmoid(intercept + Σ((x−μ)/σ)·w)` in about 10 lines of TypeScript. `modelIsUsable()` checks that the feature list matches the build. If it doesn't, the panel shows "Unavailable" and no substitute value is invented.

### Parity guarantee

Python writes 206 hostnames (200 held-out plus edge cases such as an IP, punycode, an underscore and `localhost`) with their feature vectors and probabilities. A Vitest test asserts that the TypeScript output matches **to 9 decimal places**.

### Explanations

The ML panel shows the five strongest per-feature contributions (standardized value × coefficient), labelled as pushing toward phishing (▲) or toward legitimate (▼).
