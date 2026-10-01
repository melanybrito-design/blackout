"""Prepara las imágenes de Higgsfield para el presupuesto de la demo PS2."""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "HIGGSFIELD_ASSETS.json"


def footprint_decal() -> Image.Image:
    # El modelo dibujó pies completos; esta huella procedural mantiene el efecto sin otra generación.
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    rng = random.Random(241024)
    for step in range(7):
        stamp = Image.new("RGBA", (170, 240), (0, 0, 0, 0))
        draw = ImageDraw.Draw(stamp)
        base = (29, 50, 55, 175 - step * 10)
        draw.ellipse((38, 102, 133, 220), fill=base)
        draw.ellipse((26, 39, 143, 145), fill=base)
        for toe, radius in enumerate((15, 12, 10, 9, 8)):
            x = 26 + toe * 24
            y = 30 + abs(toe - 1) * 6
            draw.ellipse((x, y, x + radius * 2, y + radius * 2), fill=base)
        stamp = stamp.rotate((-16 if step % 2 else 14) + rng.randint(-5, 5), expand=True)
        x = 190 + step % 2 * 270 + rng.randint(-22, 22)
        y = 800 - step * 125
        canvas.alpha_composite(stamp, (x, y))
    return canvas


def remove_white(image: Image.Image) -> Image.Image:
    pixels = []
    for r, g, b in image.convert("RGB").getdata():
        lo = min(r, g, b)
        hi = max(r, g, b)
        alpha = min(255, max(0, (235 - lo) * 5))
        if lo > 215 and hi - lo < 24:
            alpha = 0
        pixels.append((r, g, b, alpha))
    output = Image.new("RGBA", image.size)
    output.putdata(pixels)
    return output


def main() -> None:
    items = json.loads(MANIFEST.read_text())["images"]
    for item in items:
        path = ROOT / item["path"]
        name = path.name
        target = (1920, 1080) if name == "menu_plate.png" else (2048, 896) if name == "facade.png" else (1024, 1024)
        if name == "decal_footprints.png":
            image = footprint_decal()
        else:
            with Image.open(path) as source:
                if source.mode == "P" and source.size == target:
                    print(f"{item['path']}: already optimized", flush=True)
                    continue
                image = ImageOps.fit(source.convert("RGB"), target, method=Image.Resampling.LANCZOS)
            if name.startswith("decal_"):
                image = remove_white(image)
        colors = 256 if name in {"facade.png", "menu_plate.png"} else 128
        method = Image.Quantize.FASTOCTREE if image.mode == "RGBA" else Image.Quantize.MEDIANCUT
        image = image.quantize(colors=colors, method=method, dither=Image.Dither.NONE)
        temp = path.with_suffix(".optimized.png")
        image.save(temp, optimize=True, compress_level=9)
        temp.replace(path)
        print(f"{item['path']}: {path.stat().st_size:,} bytes", flush=True)


if __name__ == "__main__":
    main()
