# VisionAttend AI — SVM Face Classifier

This module adds a trainable ML classifier without replacing the existing InsightFace embedding model or anti-spoofing system.

## Data flow

`InsightFace embedding -> training_embeddings in MongoDB -> SVM -> student ID`

The original `embedding` field is preserved for backward compatibility with the existing recognition pipeline.

## 1. Collect training samples

Complete the normal, verified student registration first. Then run:

```bash
python ml/classification/collect_training_embeddings.py STUDENT_ID
```

The collector:
- requires exactly one visible face;
- uses the existing MediaPipe liveness signals;
- waits for a live signal before accepting a sample;
- rejects near-duplicate embeddings;
- collects 10 samples by default;
- stores them in `training_embeddings` while leaving `embedding` unchanged.

You can override the count for testing:

```bash
python ml/classification/collect_training_embeddings.py STUDENT_ID --samples 10
```

## 2. Train the SVM

After multiple students have training samples:

```bash
python ml/classification/train_svm.py
```

The script performs a stratified train/test split and reports accuracy, precision, recall, F1-score, and a confusion matrix. It saves the trained classifier as `ml/classification/model/face_svm.joblib` and metrics beside it.

Do not train with only one sample per student. The old single `embedding` field is supported only as a compatibility fallback; meaningful SVM training requires multiple samples per class.

## 3. Live integration

`svm_recognizer.py` provides inference from an embedding. The existing attendance pipeline is intentionally not replaced in this first stage. Anti-spoofing remains independent from identity classification.
