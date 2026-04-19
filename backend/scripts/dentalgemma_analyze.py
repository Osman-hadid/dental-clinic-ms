#!/usr/bin/env python3
import argparse
import json
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DentalGemma locally on a dental image.")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model-dir", required=True, help="Local DentalGemma model directory")
    parser.add_argument("--modality", default="xray", help="Input modality")
    parser.add_argument("--context", default="", help="Clinical context")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not os.path.exists(args.image):
        raise RuntimeError("Input image was not found.")

    if not os.path.isdir(args.model_dir):
        raise RuntimeError("DentalGemma model directory was not found.")

    try:
        import torch
        from PIL import Image
        from transformers import AutoProcessor, Gemma3ForConditionalGeneration
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "DentalGemma local dependencies are missing. Install transformers, accelerate, safetensors, and pillow first."
        ) from exc

    image = Image.open(args.image).convert("RGB")
    processor = AutoProcessor.from_pretrained(args.model_dir, local_files_only=True)
    model = Gemma3ForConditionalGeneration.from_pretrained(
        args.model_dir,
        local_files_only=True,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    if not torch.cuda.is_available():
        model = model.to("cpu")

    prompt = (
        "You are a dental radiology assistant. Analyze this dental image and return only valid JSON with "
        "keys summary, findings, concerns, recommendations, urgency, confidence, disclaimer. "
        f"Modality: {args.modality}. Clinical context: {args.context or 'No extra clinical context provided.'}"
    )

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    chat_prompt = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    inputs = processor(text=chat_prompt, images=image, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {key: value.to(model.device) for key, value in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(**inputs, max_new_tokens=512, do_sample=False)

    generated = output_ids[:, inputs["input_ids"].shape[-1]:]
    raw_text = processor.batch_decode(generated, skip_special_tokens=True)[0].strip()

    payload = {
        "analysisWarning": None,
        "rawText": raw_text,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(str(exc))
        raise SystemExit(1)
