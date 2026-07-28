#!/usr/bin/env python3
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
IOS_ASSETS = ROOT / "ios-role-shell" / "Resources" / "Assets.xcassets"
NAVY = (7, 26, 51, 255)
SIZES = (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024)

ROLES = {
    "driver": {
        "source": ROOT / "android-role-shell" / "app" / "src" / "driver" / "res" / "drawable-nodpi" / "app_icon.png",
        "url": "https://i.postimg.cc/htdnDjJv/cropped-circle-image-(1).png",
        "destination": IOS_ASSETS / "DriverAppIcon.appiconset",
    },
    "merchant": {
        "source": ROOT / "android-role-shell" / "app" / "src" / "merchant" / "res" / "drawable-nodpi" / "app_icon.png",
        "url": "https://i.postimg.cc/RC29jKht/cropped-circle-image.png",
        "destination": IOS_ASSETS / "MerchantAppIcon.appiconset",
    },
}


def download_image(url: str) -> Image.Image:
    request = Request(
        quote(url, safe=":/._-"),
        headers={
            "User-Agent": "DAY-NIGHT-iOS-Build/1.2",
            "Accept": "image/png,image/*;q=0.9,*/*;q=0.1",
        },
    )
    with urlopen(request, timeout=45) as response:
        payload = response.read()
    image = Image.open(BytesIO(payload)).convert("RGBA")
    if image.width < 128 or image.height < 128:
        raise RuntimeError(f"Icon is unexpectedly small: {image.size}")
    return image


def load_source(source: Path, url: str) -> Image.Image:
    if source.is_file():
        return Image.open(source).convert("RGBA")
    return download_image(url)


def opaque_square(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        image = image.crop(bounds)

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
        base = opaque_square(load_source(source, config["url"]))

        for size in SIZES:
            output = ImageOps.fit(base, (size, size), method=Image.Resampling.LANCZOS)
            output.save(destination / f"{role}-{size}.png", format="PNG", optimize=True)

        marketing = Image.open(destination / f"{role}-1024.png")
        if marketing.mode != "RGB":
            raise RuntimeError(f"{role} App Store icon must be opaque RGB")

        origin = source.relative_to(ROOT) if source.is_file() else config["url"]
        print(f"Prepared {role} iOS icons from {origin}")


if __name__ == "__main__":
    main()
