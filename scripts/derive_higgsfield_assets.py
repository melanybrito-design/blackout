"""Deriva recortes listos para el juego a partir de las imágenes de Higgsfield.

Los originales no se tocan: cada salida es un archivo nuevo junto al original.
Requiere Pillow (`pip install pillow`). Uso: `python scripts/derive_higgsfield_assets.py`
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets"
UI = ASSETS / "ui"
TEX = ASSETS / "textures"
CHARS = ASSETS / "characters"


def save(image: Image.Image, path: Path) -> None:
    image.save(path, optimize=True)
    print(f"{path.relative_to(ASSETS)}  {image.size[0]}x{image.size[1]}  {path.stat().st_size // 1024} KB")


def journal_pages() -> None:
    """La libreta abierta viene en una sola foto: una página por panel del diario."""
    book = Image.open(UI / "journal_paper.png").convert("RGB")
    save(book.crop((8, 24, 506, 968)).resize((400, 760), Image.LANCZOS), UI / "journal_page_left.png")
    save(book.crop((506, 24, 1010, 968)).resize((760, 760), Image.LANCZOS), UI / "journal_page_right.png")


def cork_tile() -> None:
    """Sin las chinchetas de las esquinas, que al repetirse delatan el mosaico."""
    cork = Image.open(UI / "journal_cork.png").convert("RGB").crop((96, 96, 928, 928))
    # Espejado 2×2 para que los bordes calcen.
    w, h = cork.size
    tile = Image.new("RGB", (w * 2, h * 2))
    tile.paste(cork, (0, 0))
    tile.paste(cork.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    tile.paste(cork.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
    tile.paste(cork.transpose(Image.ROTATE_180), (w, h))
    tile = ImageEnhance.Brightness(tile.resize((512, 512), Image.LANCZOS)).enhance(0.82)
    save(tile, UI / "journal_cork_tile.png")


def polaroid() -> None:
    """Marco con la ventana negra y el fondo blanco transparentes: la foto va debajo."""
    box = (166, 126, 886, 933)
    frame = Image.open(UI / "polaroid_frame.png").convert("RGBA").crop(box)
    px = frame.load()
    w, h = frame.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            in_window = 40 < x < w - 40 and 50 < y < h - 150
            if in_window and max(r, g, b) < 120:
                px[x, y] = (r, g, b, 0)
            elif g - r < 3 and min(r, g, b) > 205:
                px[x, y] = (r, g, b, 0)  # fondo del estudio
            else:
                # papel envejecido: de gris azulado a blanco cálido
                px[x, y] = (min(255, int(r * 1.2)), min(255, int(g * 1.13)), min(255, int(b * 1.06)), 255)
    save(frame.resize((360, 407), Image.LANCZOS), UI / "polaroid_cut.png")


def tape_strip() -> None:
    """El modelo generó un rollo: se recorta el tramo plano de cinta y se le rasgan las puntas."""
    roll = Image.open(UI / "tape.png").convert("RGB")
    flat = roll.rotate(61, resample=Image.BICUBIC, expand=True, fillcolor=(220, 224, 224))
    strip = flat.crop((512, 657, 742, 750)).convert("RGBA")
    w, h = strip.size
    rng = random.Random(631)
    mask = Image.new("L", (w, h), 225)
    draw = ImageDraw.Draw(mask)
    for side in (0, 1):
        y = 0
        while y < h:
            step = rng.randint(5, 12)
            depth = rng.randint(2, 12)
            if side == 0:
                draw.polygon([(0, y), (depth, y + step // 2), (0, y + step)], fill=0)
            else:
                draw.polygon([(w, y), (w - depth, y + step // 2), (w, y + step)], fill=0)
            y += step
    strip.putalpha(mask.filter(ImageFilter.GaussianBlur(0.6)))
    save(strip.resize((240, 97), Image.LANCZOS), UI / "tape_strip.png")


def doors() -> None:
    """Hoja izquierda de la puerta doble: con ventanita transparente (2°B) y ciega (el resto)."""
    box = (124, 4, 616, 890)
    leaf = Image.open(TEX / "door_classroom.png").convert("RGBA").crop(box)
    solid = leaf.copy()
    # Ventana → transparente
    px = leaf.load()
    for y in range(40, 470):
        for x in range(50, 450):
            r, g, b, _ = px[x, y]
            if max(r, g, b) < 45:
                px[x, y] = (0, 0, 0, 0)
    save(leaf.resize((246, 443), Image.LANCZOS), TEX / "door_window.png")
    # Ventana → panel de madera (se estira el panel del medio)
    panel = solid.crop((80, 520, 370, 650)).resize((372, 400), Image.LANCZOS)
    solid.paste(panel, (68, 52))
    save(solid.convert("RGB").resize((246, 443), Image.LANCZOS), TEX / "door_solid.png")


def locker_door() -> None:
    """Un solo casillero (el de la placa en blanco); el número se escribe en código."""
    locker = Image.open(TEX / "locker_front.png").convert("RGB").crop((98, 18, 522, 1000))
    save(locker.resize((128, 256), Image.LANCZOS), TEX / "locker_door.png")


def gym_floor_tile() -> None:
    """La foto del parquet tiene perspectiva y reflejos: se usa el tramo más parejo, espejado."""
    floor = Image.open(TEX / "gym_floor.png").convert("RGB").crop((690, 770, 1010, 1010))
    w, h = floor.size
    tile = Image.new("RGB", (w * 2, h * 2))
    tile.paste(floor, (0, 0))
    tile.paste(floor.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    tile.paste(floor.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
    tile.paste(floor.transpose(Image.ROTATE_180), (w, h))
    save(tile.resize((512, 384), Image.LANCZOS), TEX / "gym_floor_tile.png")


def mirror_cracks() -> None:
    """El paso de blanco a transparente dejó media imagen con un velo gris: quedarse solo con las grietas."""
    cracks = Image.open(TEX / "decal_cracks.png").convert("RGBA")
    px = cracks.load()
    w, h = cracks.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            keep = max(0.0, min(1.0, (222 - lum) / 70))
            px[x, y] = (r, g, b, int(min(a, 255 * keep)))
    save(cracks.resize((512, 512), Image.LANCZOS), TEX / "decal_cracks_clean.png")


def lucia_print() -> None:
    """Solo la foto impresa, sin la mesa oscura de fondo."""
    photo = Image.open(CHARS / "photo_lucia.png").convert("RGB").crop((74, 200, 950, 850))
    save(photo.resize((438, 325), Image.LANCZOS), CHARS / "photo_lucia_print.png")


if __name__ == "__main__":
    journal_pages()
    cork_tile()
    polaroid()
    tape_strip()
    doors()
    locker_door()
    gym_floor_tile()
    mirror_cracks()
    lucia_print()
