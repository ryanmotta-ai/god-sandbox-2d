"""Normalize an alpha-cut ART-V2 render to the exact Aethoria sprite contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--anchor-y", type=float, default=0.875)
    parser.add_argument("--fill-canvas", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise SystemExit(f"sprite has no opaque pixels: {args.input}")

    subject = source.crop(bounds)
    # Work at half resolution and upscale with nearest-neighbour so one authored
    # art pixel always occupies a stable 2x2 source block.
    work_w = max(1, args.width // 2)
    work_h = max(1, args.height // 2)
    max_w = work_w if args.fill_canvas else max(1, int(work_w * 0.88))
    max_h = work_h if args.fill_canvas else max(1, int(work_h * 0.78))
    scale = min(max_w / subject.width, max_h / subject.height)
    target_w = max(1, round(subject.width * scale))
    target_h = max(1, round(subject.height * scale))
    subject = subject.resize((target_w, target_h), Image.Resampling.NEAREST)

    # Quantize opaque colour while retaining the authored alpha silhouette.
    rgb = subject.convert("RGB").quantize(colors=31, method=Image.Quantize.MEDIANCUT).convert("RGB")
    rgb.putalpha(subject.getchannel("A"))
    subject = rgb

    canvas = Image.new("RGBA", (work_w, work_h), (0, 0, 0, 0))
    x = (work_w - target_w) // 2
    ground_y = work_h if args.fill_canvas else min(work_h - 1, round(work_h * args.anchor_y))
    y = max(0, ground_y - target_h)
    canvas.alpha_composite(subject, (x, y))
    canvas = canvas.resize((args.width, args.height), Image.Resampling.NEAREST)
    if args.fill_canvas:
        canvas.putalpha(Image.new("L", canvas.size, 255))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
