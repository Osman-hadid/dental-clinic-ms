#!/usr/bin/env python3
import argparse
import json
import sys

from PIL import Image
from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DentalXrayAI YOLO detection on one image.")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model", required=True, help="Path to YOLO model weights (best.pt)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    model = YOLO(args.model)
    results = model.predict(Image.open(args.image), verbose=False)
    result = results[0]

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

    output = {"detections": detections}
    sys.stdout.write(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(str(exc))
        raise SystemExit(1)
