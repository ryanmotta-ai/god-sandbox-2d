"""Normalize a chroma-keyed source into an ART-V1 atlas-ready PNG."""

from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--colors", type=int, default=24)
    parser.add_argument("--layout", choices=("anchored", "tile"), default="anchored")
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    if bbox is None:
        raise SystemExit(f"No visible sprite pixels in {args.input}")
    crop = source.crop(bbox)

    # Work at the logical 1x pixel-art resolution, then expand every art pixel
    # to a clean 2x2 source block as required by ART_STYLE_GUIDE.md.
    logical_w, logical_h = args.width // 2, args.height // 2
    max_w = logical_w if args.layout == "tile" else max(1, round(logical_w * 0.90))
    max_h = logical_h if args.layout == "tile" else max(1, round(logical_h * 0.88))
    scale = min(max_w / crop.width, max_h / crop.height)
    resized_w = max(1, round(crop.width * scale))
    resized_h = max(1, round(crop.height * scale))
    crop = crop.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    reduced_rgb = crop.convert("RGB").quantize(
        colors=max(8, min(32, args.colors)), method=Image.Quantize.MEDIANCUT
    ).convert("RGB")
    reduced = reduced_rgb.convert("RGBA")
    reduced.putalpha(crop.getchannel("A"))

    logical = Image.new("RGBA", (logical_w, logical_h), (0, 0, 0, 0))
    x = (logical_w - resized_w) // 2
    y = ((logical_h - resized_h) // 2 if args.layout == "tile"
         else min(logical_h - resized_h, round(logical_h * 0.94) - resized_h))
    logical.alpha_composite(reduced, (x, max(0, y)))
    final = logical.resize((args.width, args.height), Image.Resampling.NEAREST)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    final.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
