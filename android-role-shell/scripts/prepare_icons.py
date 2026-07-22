#!/usr/bin/env python3
"""Download and package the two official DAY NIGHT role icons at build time.

The resulting PNG files are compiled into each APK/AAB. The apps never fetch
launcher artwork from the network at runtime.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICON_SIZE = 1024
ART_SIZE = 840

ROLE_ICONS = {
    "driver": "https://i.postimg.cc/htdnDjJv/cropped-circle-image-(1).png",
    "merchant": "https://i.postimg.cc/RC29jKht/cropped-circle-image.png",
}


def download_image(url: str) -> Image.Image:
    safe_url = quote(url, safe=":/._-")
    request = Request(
        safe_url,
        headers={
            "User-Agent": "DAY-NIGHT-Android-Build/1.0",
            "Accept": "image/png,image/*;q=0.9,*/*;q=0.1",
        },
    )
    with urlopen(request, timeout=45) as response:
        payload = response.read()
    image = Image.open(BytesIO(payload)).convert("RGBA")
    if image.width < 128 or image.height < 128:
        raise RuntimeError(f"Icon is unexpectedly small: {image.size} from {url}")
    return image


def normalize_icon(source: Image.Image) -> Image.Image:
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        source = source.crop(bounds)

    source.thumbnail((ART_SIZE, ART_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    offset = ((ICON_SIZE - source.width) // 2, (ICON_SIZE - source.height) // 2)
    canvas.alpha_composite(source, offset)
    return canvas


def write_role_icon(role: str, url: str) -> None:
    output = ROOT / "app" / "src" / role / "res" / "drawable-nodpi" / "app_icon.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    image = normalize_icon(download_image(url))
    image.save(output, format="PNG", optimize=True)
    print(f"Prepared {role} icon: {output} ({output.stat().st_size} bytes)")


def main() -> None:
    for role, url in ROLE_ICONS.items():
        write_role_icon(role, url)


if __name__ == "__main__":
    main()
