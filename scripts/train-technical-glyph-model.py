"""Train a small, genuinely learned, offline technical glyph classifier.

This is an experimental glyph model, NOT a Tesseract LSTM model or a general
text recognizer. Only local system fonts are read. Fonts are never copied.
The pre-existing FreeType evaluation fixtures are never opened by this script.
Train, calibration, and final holdout use disjoint font families and seeds.
"""
import os

# Bound CPU use before NumPy/OpenBLAS is loaded.
os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
MODEL_PATH = ROOT / "ocr" / "experimental-model" / "technical-glyph-v1.json"
REPORT_DIR = ROOT / "outputs" / "technical-glyph-training"
LABELS = list("0123456789") + [".", "-", "+", "±", "Ø", "O", "R", "<reject>"]
SPLITS = {
    "train": ["arial.ttf", "arialbd.ttf", "ariali.ttf", "times.ttf", "timesi.ttf", "cour.ttf", "courbd.ttf"],
    "calibration": ["calibri.ttf", "calibrii.ttf"],
    "holdout": ["consola.ttf", "verdana.ttf", "segoeui.ttf"],
}
SEEDS = {"train": 9271401, "calibration": 4832502, "holdout": 7183603}
SIDE = 24
INPUTS = SIDE * SIDE + 6
HIDDEN = 64
FONT_CACHE = {}


def font_for(name, size):
    key = (name, size)
    if key not in FONT_CACHE:
        FONT_CACHE[key] = ImageFont.truetype(str(FONT_DIR / name), size)
    return FONT_CACHE[key]


def extract_features(gray, reference_height=0):
    """Exact nearest-neighbour feature contract duplicated in the JS reader."""
    ink = 1.0 - np.asarray(gray, dtype=np.float32) / 255.0
    ys, xs = np.where(ink >= 0.2)
    if not len(xs):
        return np.zeros(INPUTS, dtype=np.float32)
    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    crop = ink[top:bottom, left:right]
    height, width = crop.shape
    factor = 22.0 / max(width, height)
    # Explicit half-up rounding matches Math.round for positive values.
    out_w = max(1, int(math.floor(width * factor + 0.5)))
    out_h = max(1, int(math.floor(height * factor + 0.5)))
    pixel_x = np.minimum(width - 1, np.floor((np.arange(out_w) + 0.5) * width / out_w).astype(int))
    pixel_y = np.minimum(height - 1, np.floor((np.arange(out_h) + 0.5) * height / out_h).astype(int))
    normalized = np.zeros((SIDE, SIDE), dtype=np.float32)
    ox, oy = (SIDE - out_w) // 2, (SIDE - out_h) // 2
    normalized[oy:oy + out_h, ox:ox + out_w] = crop[pixel_y[:, None], pixel_x[None, :]]
    extras = np.array([
        max(-1.0, min(1.0, math.log2(width / height) / 3.0)),
        float(crop.mean()),
        float((crop >= 0.2).mean()),
        min(2.0, height / reference_height) / 2.0 if reference_height > 0 else 0.0,
        min(2.0, width / reference_height) / 2.0 if reference_height > 0 else 0.0,
        1.0 if reference_height > 0 else 0.0,
    ], dtype=np.float32)
    return np.concatenate((normalized.ravel(), extras))


def render_glyph(label, font_name, rng):
    size = int(rng.integers(18, 57))
    font = font_for(font_name, size)
    if label == "<reject>":
        # Visually confusable out-of-vocabulary characters and non-glyph marks.
        char = str(rng.choice(list("ABCDEFGHIKLMNPQSTUVWXYZabcdefgijklmnpqrstuvwxyz,;:=*#%()[]?")))
    elif label == "-" and rng.random() < 0.45:
        char = "−"
    elif label == "Ø" and rng.random() < 0.2:
        char = "⌀" if font_name.startswith("arial") else "Ø"
    else:
        char = label
    left, top, right, bottom = font.getbbox(char)
    padding = 6
    image = Image.new("L", (max(1, right - left) + 2 * padding, max(1, bottom - top) + 2 * padding), 255)
    draw = ImageDraw.Draw(image)
    draw.text((padding - left, padding - top), char, font=font, fill=int(rng.integers(0, 85)))
    reference_height = font.getbbox("0")[3] - font.getbbox("0")[1]
    if label == "<reject>" and rng.random() < 0.12:
        draw.line((2, 2, image.width - 3, image.height - 3), fill=30, width=int(rng.integers(1, 3)))
    angle = float(rng.uniform(-4.5, 4.5))
    image = image.rotate(angle, resample=Image.Resampling.BILINEAR, expand=True, fillcolor=255)
    if rng.random() < 0.65:
        image = image.filter(ImageFilter.GaussianBlur(float(rng.uniform(0.1, 0.65))))
    scale = float(rng.uniform(0.55, 1.2))
    image = image.resize((max(3, round(image.width * scale)), max(3, round(image.height * scale))), Image.Resampling.BILINEAR)
    reference_height *= scale
    arr = np.asarray(image, dtype=np.float32)
    arr = np.clip(arr + rng.normal(0, float(rng.uniform(0, 3.0)), arr.shape), 0, 255).astype(np.uint8)
    # Missing line-size context is explicitly represented and trained as such.
    if rng.random() < 0.35:
        reference_height = 0
    return Image.fromarray(arr), reference_height, char


def generate(split, count_per_font_label, fixture_count=0):
    rng = np.random.default_rng(SEEDS[split])
    xs, ys, details, fixture_items = [], [], [], []
    fixture_dir = REPORT_DIR / "holdout-fixtures"
    if fixture_count:
        fixture_dir.mkdir(parents=True, exist_ok=True)
    for font in SPLITS[split]:
        for label_index, label in enumerate(LABELS):
            for index in range(count_per_font_label):
                image, reference_height, rendered_char = render_glyph(label, font, rng)
                vector = extract_features(image, reference_height)
                xs.append(vector)
                ys.append(label_index)
                details.append({"font": font, "label": label})
                if fixture_count and index < fixture_count:
                    filename = f"{Path(font).stem}-{label_index:02d}-{index:02d}.png"
                    image.save(fixture_dir / filename)
                    fixture_items.append({"file": filename, "label": label, "font": font, "referenceHeight": reference_height,
                                          "renderedCharacter": rendered_char, "features": vector.astype(float).tolist()})
    return np.asarray(xs, dtype=np.float32), np.asarray(ys, dtype=np.int64), details, fixture_items


def probabilities(x, params):
    w1, b1, w2, b2 = params
    hidden = np.maximum(0, x @ w1 + b1)
    logits = hidden @ w2 + b2
    logits -= logits.max(axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / exp.sum(axis=1, keepdims=True)


def train(x, y, epochs):
    rng = np.random.default_rng(20260916)
    params = [rng.normal(0, math.sqrt(2 / INPUTS), (INPUTS, HIDDEN)).astype(np.float32), np.zeros(HIDDEN, dtype=np.float32),
              rng.normal(0, math.sqrt(2 / HIDDEN), (HIDDEN, len(LABELS))).astype(np.float32), np.zeros(len(LABELS), dtype=np.float32)]
    momentum = [np.zeros_like(p) for p in params]
    velocity = [np.zeros_like(p) for p in params]
    history, step = [], 0
    for epoch in range(epochs):
        order = rng.permutation(len(y))
        losses = []
        learning_rate = 0.0015 * (0.4 + 0.6 * (1 - epoch / max(1, epochs)))
        for start in range(0, len(order), 128):
            indexes = order[start:start + 128]
            bx, by = x[indexes], y[indexes]
            w1, b1, w2, b2 = params
            pre = bx @ w1 + b1
            hidden = np.maximum(0, pre)
            logits = hidden @ w2 + b2
            logits -= logits.max(axis=1, keepdims=True)
            exp = np.exp(logits)
            prob = exp / exp.sum(axis=1, keepdims=True)
            losses.append(float(-np.log(np.maximum(1e-9, prob[np.arange(len(by)), by])).mean()))
            delta = prob
            delta[np.arange(len(by)), by] -= 1
            delta /= len(by)
            hidden_delta = (delta @ w2.T) * (pre > 0)
            gradients = [bx.T @ hidden_delta + 0.0001 * w1, hidden_delta.sum(axis=0),
                         hidden.T @ delta + 0.0001 * w2, delta.sum(axis=0)]
            step += 1
            for i, gradient in enumerate(gradients):
                momentum[i] = 0.9 * momentum[i] + 0.1 * gradient
                velocity[i] = 0.999 * velocity[i] + 0.001 * gradient * gradient
                params[i] -= learning_rate * (momentum[i] / (1 - 0.9 ** step)) / (np.sqrt(velocity[i] / (1 - 0.999 ** step)) + 1e-8)
        accuracy = float((probabilities(x, params).argmax(axis=1) == y).mean())
        item = {"epoch": epoch + 1, "meanLoss": float(np.mean(losses)), "trainAccuracy": accuracy}
        history.append(item)
        if epoch == 0 or (epoch + 1) % 10 == 0 or epoch == epochs - 1:
            print(json.dumps(item), flush=True)
    return params, history


def acceptance(p, score_min, margin_min):
    order = np.argsort(p, axis=1)
    predicted = order[:, -1]
    top = p[np.arange(len(p)), predicted]
    margin = top - p[np.arange(len(p)), order[:, -2]]
    return predicted, (top >= score_min) & (margin >= margin_min) & (predicted != LABELS.index("<reject>"))


def choose_thresholds(p, y):
    # Fixed procedure: maximize accepted coverage with <=0.5% observed errors in
    # calibration. This is not a statistical safety guarantee on unseen images.
    eligible = []
    for score in [0.80, 0.85, 0.90, 0.93, 0.95, 0.97, 0.98, 0.99, 0.995, 0.999]:
        for margin in [0.25, 0.40, 0.55, 0.70, 0.80, 0.90, 0.95, 0.99]:
            prediction, accepted = acceptance(p, score, margin)
            count = int(accepted.sum())
            errors = int(((prediction != y) & accepted).sum())
            if count >= 100 and errors / count <= 0.005:
                eligible.append((count, -errors, score, margin))
    if not eligible:
        return {"scoreMin": 1.0, "marginMin": 1.0, "reason": "No calibration setting met the fixed error target; model remains advisory/reject-only."}
    _, _, score, margin = max(eligible)
    return {"scoreMin": score, "marginMin": margin, "reason": "Selected only on disjoint calibration fonts; scores are uncalibrated softmax values, not correctness probabilities."}


def evaluate(p, y, details, threshold):
    prediction, accepted = acceptance(p, threshold["scoreMin"], threshold["marginMin"])
    correct = prediction == y
    count, errors = int(accepted.sum()), int((accepted & ~correct).sum())
    return {"samples": len(y), "exact": int(correct.sum()), "accuracy": float(correct.mean()),
            "accepted": count, "coverage": count / len(y), "acceptedErrors": errors,
            "acceptedAccuracy": (count - errors) / count if count else None,
            "rejected": int((~accepted).sum()), "unknownSamples": int((y == LABELS.index("<reject>")).sum()),
            "unknownAcceptedAsKnown": int((accepted & (y == LABELS.index("<reject>"))).sum()),
            "perLabel": {label: {"samples": int((y == i).sum()), "exact": int((correct & (y == i)).sum()),
                                  "accepted": int((accepted & (y == i)).sum()), "acceptedErrors": int((accepted & ~correct & (y == i)).sum())}
                         for i, label in enumerate(LABELS)},
            "perFont": {font: {"samples": sum(d["font"] == font for d in details),
                                "exact": sum(bool(c) and d["font"] == font for c, d in zip(correct, details)),
                                "acceptedErrors": sum(bool(a and not c) and d["font"] == font for a, c, d in zip(accepted, correct, details))}
                        for font in sorted(set(d["font"] for d in details))}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=45)
    args = parser.parse_args()
    if not 1 <= args.epochs <= 150:
        raise SystemExit("epochs must be between 1 and 150")
    started = time.perf_counter()
    for names in SPLITS.values():
        for name in names:
            if not (FONT_DIR / name).is_file():
                raise SystemExit("Missing local font: " + name)
    if not features.check_module("freetype2"):
        raise SystemExit("FreeType support required")
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    x, y, train_details, _ = generate("train", 70)
    cx, cy, calibration_details, _ = generate("calibration", 45)
    print(json.dumps({"trainSamples": len(y), "calibrationSamples": len(cy), "trainingInputs": INPUTS, "hiddenUnits": HIDDEN}), flush=True)
    training_started = time.perf_counter()
    params, history = train(x, y, args.epochs)
    training_seconds = time.perf_counter() - training_started
    cp = probabilities(cx, params)
    threshold = choose_thresholds(cp, cy)
    # Final holdout is generated/evaluated once, only after fitting and threshold
    # selection. Its results never influence the exported model or thresholds.
    hx, hy, holdout_details, fixtures = generate("holdout", 50, fixture_count=2)
    hp = probabilities(hx, params)
    model = {"schemaVersion": 1, "modelId": "technical-glyph-mlp-v1", "modelVersion": "1.0.0", "advisoryOnly": True, "purpose": "experimental-glyph-advisory",
             "labels": LABELS, "input": {"side": SIDE, "extras": 6, "features": INPUTS, "thresholdInk": 0.2, "fitSize": 22},
             "architecture": {"kind": "mlp-relu-softmax", "hidden": HIDDEN}, "thresholds": threshold,
             "weights": {"w1": np.round(params[0].ravel(), 7).astype(float).tolist(), "b1": np.round(params[1], 7).astype(float).tolist(),
                         "w2": np.round(params[2].ravel(), 7).astype(float).tolist(), "b2": np.round(params[3], 7).astype(float).tolist()},
             "training": {"method": "supervised Adam/backpropagation", "epochs": args.epochs, "samples": len(y),
                          "seed": 20260916, "splitSeeds": SEEDS, "fontSplits": SPLITS, "freetypeVersion": features.version_module("freetype2")},
             "limitations": ["Not Tesseract LSTM fine-tuning or a full-line OCR engine.", "Synthetic glyph training and disjoint-font holdout, not real drawing validation.",
                             "Softmax scores are not calibrated correctness probabilities.", "Segmented glyphs only; joined/broken glyphs, GD&T frames and multi-glyph crops unsupported.",
                             "Unknown rejection cannot guarantee out-of-distribution detection.", "Never silently replace accepted production OCR with this model."]}
    # Compact decimal strings reduce distributable size while preserving agreed precision.
    encoded = json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n"
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(encoded, encoding="utf-8", newline="\n")
    model_hash = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    report = {"schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat(), "modelSha256": model_hash,
              "modelBytes": len(encoded.encode("utf-8")), "trainingSeconds": training_seconds,
              "totalSeconds": time.perf_counter() - started, "fontSplits": SPLITS, "splitSeeds": SEEDS, "epochs": args.epochs,
              "train": evaluate(probabilities(x, params), y, train_details, threshold),
              "calibration": evaluate(cp, cy, calibration_details, threshold), "holdout": evaluate(hp, hy, holdout_details, threshold),
              "thresholds": threshold, "history": history, "limitations": model["limitations"],
              "existingEvaluationRead": False, "fontBinariesRedistributed": False, "cpuThreads": 2}
    (REPORT_DIR / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (REPORT_DIR / "holdout-fixtures.json").write_text(json.dumps({"modelSha256": model_hash, "purpose": "js-python-feature-parity-and-heldout-glyph-check", "fixtures": fixtures}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["modelBytes", "trainingSeconds", "totalSeconds", "thresholds", "holdout"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
