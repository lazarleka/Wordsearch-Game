from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "ChatGPT Image 23. јун 2026. 01_36_33.png"
OUTPUT = ROOT / "public" / "ukrstene-gameplay.gif"

SIZE = 600
FPS = 12
FRAME_COUNT = 72
FRAME_MS = round(1000 / FPS)

# Pločice nakon skaliranja originala na 600x600.
FILMOVI = [(145 + i * 36, 160, 177 + i * 36, 193) for i in range(7)]
NAUKA = [(202 + i * 36, 302, 234 + i * 36, 335) for i in range(5)]


def fit_source() -> Image.Image:
    image = Image.open(SOURCE).convert("RGB")
    edge = min(image.size)
    x = (image.width - edge) // 2
    y = (image.height - edge) // 2
    return image.crop((x, y, x + edge, y + edge)).resize(
        (SIZE, SIZE), Image.Resampling.LANCZOS
    )


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/seguisb.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def add_selected_tiles(
    frame: Image.Image,
    tiles: list[tuple[int, int, int, int]],
    count: float,
    complete: bool,
) -> Image.Image:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    glow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    glow_draw = ImageDraw.Draw(glow)

    full = int(count)
    fractional = count - full
    visible = min(len(tiles), full + (1 if fractional > 0 else 0))

    for index, box in enumerate(tiles[:visible]):
        strength = 1.0 if index < full else fractional
        if complete:
            color = (0, 255, 170)
            strength = 1.0
        else:
            color = (255, 215, 55)
        expanded = (box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3)
        glow_draw.rounded_rectangle(
            expanded,
            radius=8,
            fill=(*color, round(125 * strength)),
        )
        draw.rounded_rectangle(
            expanded,
            radius=7,
            outline=(*color, round(245 * strength)),
            width=3,
        )
        draw.rounded_rectangle(
            box,
            radius=5,
            fill=(*color, round((72 if complete else 46) * strength)),
        )

    glow = glow.filter(ImageFilter.GaussianBlur(10))
    result = Image.alpha_composite(frame.convert("RGBA"), glow)
    return Image.alpha_composite(result, layer).convert("RGB")


def tile_center(box: tuple[int, int, int, int]) -> tuple[float, float]:
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def add_cursor(frame: Image.Image, position: tuple[float, float], pulse: float) -> Image.Image:
    x, y = position
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = 8 + pulse * 3
    draw.ellipse(
        (x - radius, y - radius, x + radius, y + radius),
        fill=(255, 255, 255, 245),
        outline=(0, 235, 255, 255),
        width=3,
    )
    draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(15, 20, 35, 255))
    glow = layer.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(
        Image.alpha_composite(frame.convert("RGBA"), glow), layer
    ).convert("RGB")


def add_success_badge(
    frame: Image.Image,
    text: str,
    progress: float,
    anchor: tuple[int, int],
) -> Image.Image:
    progress = ease(progress)
    if progress <= 0:
        return frame
    scale = 0.72 + 0.28 * progress
    alpha = round(255 * min(1, progress * 1.8))
    badge = Image.new("RGBA", (230, 78), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle(
        (8, 8, 222, 70),
        radius=24,
        fill=(8, 18, 25, alpha),
        outline=(0, 255, 174, alpha),
        width=3,
    )
    draw.text(
        (115, 39),
        text,
        font=font(25),
        anchor="mm",
        fill=(255, 255, 255, alpha),
        stroke_width=2,
        stroke_fill=(0, 90, 70, alpha),
    )
    badge = badge.resize(
        (round(badge.width * scale), round(badge.height * scale)),
        Image.Resampling.LANCZOS,
    )
    glow = badge.filter(ImageFilter.GaussianBlur(12))
    x = anchor[0] - badge.width // 2
    y = anchor[1] - badge.height // 2 - round((1 - progress) * 18)
    canvas = frame.convert("RGBA")
    canvas.alpha_composite(glow, (x, y))
    canvas.alpha_composite(badge, (x, y))
    return canvas.convert("RGB")


def add_particles(
    frame: Image.Image,
    center: tuple[int, int],
    progress: float,
    seed: int,
) -> Image.Image:
    if not 0 < progress < 1:
        return frame
    random.seed(seed)
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    colors = [(0, 255, 174), (255, 215, 55), (255, 68, 170), (55, 195, 255)]
    for index in range(20):
        angle = random.uniform(0, math.tau)
        distance = progress * random.uniform(28, 88)
        x = center[0] + math.cos(angle) * distance
        y = center[1] + math.sin(angle) * distance - progress * 12
        radius = random.uniform(2, 5) * (1 - progress * 0.55)
        alpha = round(240 * (1 - progress))
        color = colors[index % len(colors)]
        draw.ellipse(
            (x - radius, y - radius, x + radius, y + radius),
            fill=(*color, alpha),
        )
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def add_counter(frame: Image.Image, found: int) -> Image.Image:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(
        (452, 52, 562, 96),
        radius=14,
        fill=(7, 11, 22, 218),
        outline=(0, 220, 255, 210),
        width=2,
    )
    draw.text(
        (507, 74),
        f"{found}/5",
        font=font(22),
        anchor="mm",
        fill=(255, 255, 255, 255),
    )
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def interpolate_path(
    tiles: list[tuple[int, int, int, int]], amount: float
) -> tuple[float, float]:
    amount = max(0.0, min(len(tiles) - 0.001, amount))
    index = min(len(tiles) - 1, int(amount))
    next_index = min(len(tiles) - 1, index + 1)
    local = amount - index
    a = tile_center(tiles[index])
    b = tile_center(tiles[next_index])
    return (a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local)


def build_frames() -> list[Image.Image]:
    source = fit_source()
    frames: list[Image.Image] = []

    for index in range(FRAME_COUNT):
        frame = source.copy()
        found = 0

        # 0–24: korisnik prelazi preko riječi FILMOVI.
        if 6 <= index < 25:
            amount = (index - 6) / 18 * len(FILMOVI)
            frame = add_selected_tiles(frame, FILMOVI, amount, False)
            frame = add_cursor(
                frame,
                interpolate_path(FILMOVI, amount),
                (1 + math.sin(index * 0.8)) / 2,
            )
        elif 25 <= index:
            frame = add_selected_tiles(frame, FILMOVI, len(FILMOVI), True)
            found = 1

        if 24 <= index < 38:
            pop = (index - 24) / 5 if index < 29 else max(0, (38 - index) / 9)
            frame = add_success_badge(frame, "+1 RIJEČ!", pop, (300, 245))
            frame = add_particles(frame, (300, 176), (index - 24) / 14, 101)

        # 36–55: drugi gameplay potez preko riječi NAUKA.
        if 37 <= index < 56:
            amount = (index - 37) / 18 * len(NAUKA)
            frame = add_selected_tiles(frame, NAUKA, amount, False)
            frame = add_cursor(
                frame,
                interpolate_path(NAUKA, amount),
                (1 + math.sin(index * 0.8)) / 2,
            )
        elif 56 <= index:
            frame = add_selected_tiles(frame, NAUKA, len(NAUKA), True)
            found = 2

        if 55 <= index < 69:
            pop = (index - 55) / 5 if index < 60 else max(0, (69 - index) / 9)
            frame = add_success_badge(frame, "COMBO +2!", pop, (300, 365))
            frame = add_particles(frame, (286, 318), (index - 55) / 14, 202)

        frame = add_counter(frame, found)
        frame = ImageEnhance.Contrast(frame).enhance(1.015)
        frames.append(frame)

    return frames


def main() -> None:
    frames = build_frames()
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
