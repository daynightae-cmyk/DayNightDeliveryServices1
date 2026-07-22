#!/usr/bin/env python3
"""Fail CI when a role app renders a blank/solid WebView screen."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageStat


def analyse(path: Path) -> dict[str, float | int | str]:
    with Image.open(path) as source:
        image = source.convert("RGB")
        width, height = image.size
        top = max(0, int(height * 0.04))
        bottom = max(top + 1, int(height * 0.96))
        image = image.crop((0, top, width, bottom))
        image.thumbnail((240, 480))

        stat = ImageStat.Stat(image)
        mean_stddev = sum(stat.stddev) / 3.0
        extrema_span = sum(high - low for low, high in stat.extrema) / 3.0

        quantized = image.quantize(colors=32)
        colours = quantized.getcolors(maxcolors=32) or []
        total = max(1, image.width * image.height)
        dominant_ratio = max((count for count, _ in colours), default=total) / total
        visible_colours = sum(1 for count, _ in colours if count / total >= 0.001)

        return {
            "file": str(path),
            "width": width,
            "height": height,
            "mean_stddev": round(mean_stddev, 3),
            "extrema_span": round(extrema_span, 3),
            "dominant_ratio": round(dominant_ratio, 5),
            "visible_colours": visible_colours,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--role", required=True)
    args = parser.parse_args()

    if not args.image.is_file() or args.image.stat().st_size < 10_000:
        raise SystemExit(f"{args.role}: screenshot is missing or unexpectedly small")

    metrics = analyse(args.image)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))

    # A solid blue/white/navy cover has almost no tonal variation and one
    # quantized colour occupies nearly the entire viewport. Real login and
    # dashboard screens contain cards, fields, text, borders, and icons.
    if float(metrics["mean_stddev"]) < 10.0:
        raise SystemExit(f"{args.role}: screen is visually blank (low variance)")
    if float(metrics["extrema_span"]) < 40.0:
        raise SystemExit(f"{args.role}: screen has insufficient visual range")
    if float(metrics["dominant_ratio"]) > 0.93:
        raise SystemExit(f"{args.role}: a single colour covers more than 93% of the screen")
    if int(metrics["visible_colours"]) < 5:
        raise SystemExit(f"{args.role}: too few visible colour groups")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
