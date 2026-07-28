#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
IOS_ASSETS = ROOT / "ios-role-shell" / "Resources" / "Assets.xcassets"
NAVY = (7, 26, 51, 255)
SIZES = (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024)

ROLES = {
    "driver": {
        "source": ROOT / "android-role-shell" / "app" / "src" / "driver" / "res" / "drawable-nodpi" / "app_icon.png",
        "destination": IOS_ASSETS / "DriverAppIcon.appiconset",
    },
    "merchant": {
        "source": ROOT / "android-role-shell" / "app" / "src" / "merchant" / "res" / "drawable-nodpi" / "app_icon.png",
        "destination": IOS_ASSETS / "MerchantAppIcon.appiconset",
    },
}


def opaque_square(source: Path) -> Image.Image:
    if not source.is_file():
        raise FileNotFoundError(f"Missing role icon: {source}")

    image = Image.open(source).convert("RGBA")
    side = max(image.size)
    canvas = Image.new("RGBA", (side, side), NAVY)
    contained = ImageOps.contain(image, (side, side), method=Image.Resampling.LANCZOS)
    x = (side - contained.width) // 2
    y = (side - contained.height) // 2
    canvas.alpha_composite(contained, (x, y))
    return canvas.convert("RGB")


def main() -> None:
    for role, config in ROLES.items():
        source = config["source"]
        destination = config["destination"]
        destination.mkdir(parents=True, exist_ok=True)
        base = opaque_square(source)

        for size in SIZES:
            output = ImageOps.fit(base, (size, size), method=Image.Resampling.LANCZOS)
            output.save(destination / f"{role}-{size}.png", format="PNG", optimize=True)

        marketing = Image.open(destination / f"{role}-1024.png")
        if marketing.mode != "RGB":
            raise RuntimeError(f"{role} App Store icon must be opaque RGB")

        print(f"Prepared {role} iOS icons from {source.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
