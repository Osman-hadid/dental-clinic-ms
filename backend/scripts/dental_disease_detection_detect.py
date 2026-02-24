#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

def resolve_home_dir() -> str:
    for key in ("USERPROFILE", "HOME"):
        value = os.environ.get(key)
        if value and os.path.isdir(value):
            return value

    app_data = os.environ.get("APPDATA")
    if app_data and os.path.isdir(app_data):
        return os.path.dirname(os.path.dirname(app_data))

    script_path = os.path.abspath(__file__).replace("/", "\\")
    match = re.search(r"[A-Za-z]:\\Users\\[^\\]+", script_path)
    if match:
        return match.group(0)

    system_drive = os.environ.get("SystemDrive", "C:")
    fallback = os.path.join(f"{system_drive}\\", "Users", "Public")
    if os.path.isdir(fallback):
        return fallback

    return os.getcwd()


def bootstrap_runtime_env() -> None:
    home_dir = resolve_home_dir()

    os.environ.setdefault("HOME", home_dir)
    os.environ.setdefault("USERPROFILE", home_dir)

    if len(home_dir) >= 2 and home_dir[1] == ":":
        os.environ.setdefault("HOMEDRIVE", home_dir[:2])
        os.environ.setdefault("HOMEPATH", home_dir[2:])

    username = (
        os.environ.get("USERNAME")
        or os.environ.get("USER")
        or os.path.basename(home_dir.rstrip("\\/"))
        or "user"
    )
    os.environ.setdefault("USERNAME", username)
    os.environ.setdefault("USER", username)
    os.environ.setdefault("LOGNAME", username)
    os.environ.setdefault("LNAME", username)

    roaming = os.path.join(home_dir, "AppData", "Roaming")
    local = os.path.join(home_dir, "AppData", "Local")
    os.makedirs(roaming, exist_ok=True)
    os.makedirs(local, exist_ok=True)
    os.environ.setdefault("APPDATA", roaming)
    os.environ.setdefault("LOCALAPPDATA", local)

    cache_base = os.path.join(local, "cpamis-ai-cache")
    tmp_dir = os.path.join(cache_base, "tmp")
    ultralytics_dir = os.path.join(cache_base, "ultralytics")
    torch_dir = os.path.join(cache_base, "torchinductor")
    os.makedirs(tmp_dir, exist_ok=True)
    os.makedirs(ultralytics_dir, exist_ok=True)
    os.makedirs(torch_dir, exist_ok=True)

    os.environ.setdefault("TEMP", tmp_dir)
    os.environ.setdefault("TMP", tmp_dir)
    os.environ.setdefault("ULTRALYTICS_SETTINGS_DIR", ultralytics_dir)
    os.environ.setdefault("TORCHINDUCTOR_CACHE_DIR", torch_dir)
    os.environ.setdefault("TORCH_DISABLE_DYNAMO", "1")
    os.environ.setdefault("PYTORCH_NO_CUDA_MEMORY_CACHING", "1")
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Dental Disease Detection model on one image.")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model", required=True, help="Path to YOLO model weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Primary confidence threshold")
    parser.add_argument("--fallback-conf", type=float, default=0.1, help="Fallback confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold for NMS")
    parser.add_argument("--imgsz", type=int, default=1280, help="Inference image size")
    parser.add_argument("--augment", type=int, default=0, help="Use test-time augmentation (0/1)")
    parser.add_argument("--multi-pass", type=int, default=1, help="Try enhanced image variants (0/1)")
    return parser.parse_args()


def normalize_threshold(value: float, default: float) -> float:
    if not isinstance(value, (float, int)):
        return default

    clipped = max(0.001, min(0.99, float(value)))
    return round(clipped, 4)


def normalize_imgsz(value: int, default: int) -> int:
    if not isinstance(value, int):
        return default
    return max(320, min(2048, value))


def extract_detections(result) -> list[dict]:
    detections = []
    for box in result.boxes:
        x1, y1, x2, y2 = [int(round(x)) for x in box.xyxy[0].tolist()]
        class_id = int(box.cls[0].item())
        confidence = float(box.conf[0].item())
        label = str(result.names[class_id])

        detections.append(
            {
                "label": label,
                "confidence": round(confidence, 4),
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
            }
        )
    return detections


def run_inference(model, image: Image.Image, conf: float, iou: float, imgsz: int, augment: bool) -> list[dict]:
    results = model.predict(
        source=image,
        conf=conf,
        iou=iou,
        imgsz=imgsz,
        augment=augment,
        device="cpu",
        verbose=False,
        max_det=300,
    )
    return extract_detections(results[0])


def build_variants(image: Image.Image, multi_pass: bool) -> list[tuple[str, Image.Image]]:
    variants: list[tuple[str, Image.Image]] = [("original", image)]
    if not multi_pass:
        return variants

    working = image.copy()
    variants.extend(
        [
            ("autocontrast", ImageOps.autocontrast(working.copy())),
            ("equalized", ImageOps.equalize(working.copy())),
            ("contrast_plus", ImageEnhance.Contrast(working.copy()).enhance(1.3)),
            ("sharp_plus", ImageEnhance.Sharpness(working.copy()).enhance(1.8)),
            (
                "contrast_sharp",
                ImageEnhance.Sharpness(
                    ImageEnhance.Contrast(working.copy()).enhance(1.35)
                ).enhance(1.7),
            ),
            ("median_denoise", working.copy().filter(ImageFilter.MedianFilter(size=3))),
        ]
    )

    return variants


def candidate_rank(detections: list[dict]) -> tuple[int, int, float]:
    if not detections:
        return (0, 0, 0.0)

    non_healthy = sum(1 for d in detections if d["label"].strip().lower() != "healthy")
    total = len(detections)
    avg_conf = sum(float(d["confidence"]) for d in detections) / max(total, 1)
    return (non_healthy, total, avg_conf)


def select_best_candidate(candidates: list[dict]) -> dict:
    if not candidates:
        return {"conf": None, "detections": [], "variant": "none"}

    best = max(candidates, key=lambda item: candidate_rank(item["detections"]))
    return best


def run_multi_pass(model, variants: list[tuple[str, Image.Image]], conf: float, iou: float, imgsz: int, augment: bool) -> dict:
    candidates = []
    for variant_name, variant_image in variants:
        try:
            detections = run_inference(model, variant_image, conf, iou, imgsz, augment)
            candidates.append(
                {
                    "conf": conf,
                    "detections": detections,
                    "variant": variant_name,
                }
            )
        except Exception:
            continue

    return select_best_candidate(candidates)


def main() -> int:
    bootstrap_runtime_env()
    from ultralytics import YOLO

    args = parse_args()
    primary_conf = normalize_threshold(args.conf, 0.25)
    fallback_conf = normalize_threshold(args.fallback_conf, 0.1)
    iou = normalize_threshold(args.iou, 0.45)
    imgsz = normalize_imgsz(args.imgsz, 1280)
    augment = bool(int(args.augment))
    multi_pass = bool(int(args.multi_pass))

    image = Image.open(args.image).convert("RGB")
    model = YOLO(args.model)
    variants = build_variants(image, multi_pass)

    best_primary = run_multi_pass(model, variants, primary_conf, iou, imgsz, augment)
    best = best_primary

    if not best_primary["detections"] and fallback_conf < primary_conf:
        best_fallback = run_multi_pass(model, variants, fallback_conf, iou, imgsz, augment)
        if candidate_rank(best_fallback["detections"]) > candidate_rank(best_primary["detections"]):
            best = best_fallback

    payload = {
        "detections": best["detections"],
        "meta": {
            "augment": augment,
            "confUsed": best["conf"],
            "imgsz": imgsz,
            "iou": iou,
            "multiPass": multi_pass,
            "variantUsed": best["variant"],
        },
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(str(exc))
        raise SystemExit(1)
