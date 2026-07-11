from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "ukrstene-logo-v2.png"
OUTPUT = ROOT / "public" / "ukrstene-reci-pokret.gif"

SIZE = 520
FPS = 12
FRAME_COUNT = 48
FRAME_MS = round(1000 / FPS)

# Koordinate su na finalnom 520x520 logotipu.
WORDS = [
    ("HRANA", (84, 131, 121, 285), 0.00, (255, 116, 25)),
    ("FILMOVI", (113, 130, 337, 167), 0.15, (211, 53, 255)),
    ("SPORT", (234, 40, 272, 226), 0.30, (33, 137, 255)),
    ("GEOGRAFIJA", (331, 70, 366, 317), 0.45, (143, 225, 41)),
    ("NAUKA", (173, 250, 336, 286), 0.60, (0, 225, 230)),
]


def square(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    edge = min(image.size)
    x = (image.width - edge) // 2
    y = (image.height - edge) // 2
    return image.crop((x, y, x + edge, y + edge)).resize(
        (SIZE, SIZE), Image.Resampling.LANCZOS
    )


def soft_rect_mask(size: tuple[int, int], inset: int = 1) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (inset, inset, size[0] - inset - 1, size[1] - inset - 1),
        radius=7,
        fill=255,
    )
    return mask.filter(ImageFilter.GaussianBlur(1.2))


def make_resting_background(source: Image.Image) -> Image.Image:
    base = source.convert("RGBA")
    shade = Image.new("RGBA", base.size, (5, 5, 12, 0))
    shade_alpha = Image.new("L", base.size, 0)
    draw = ImageDraw.Draw(shade_alpha)
    for _, box, _, _ in WORDS:
        draw.rounded_rectangle(box, radius=7, fill=188)
    shade.putalpha(shade_alpha.filter(ImageFilter.GaussianBlur(2)))
    return Image.alpha_composite(base, shade).convert("RGB")


def word_layer(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    crop.putalpha(soft_rect_mask(crop.size))
    return crop


def add_word(
    frame: Image.Image,
    word: Image.Image,
    box: tuple[int, int, int, int],
    offset: int,
    pulse: float,
    color: tuple[int, int, int],
) -> Image.Image:
    canvas = frame.convert("RGBA")
    x, y = box[0], box[1] + offset

    shadow = Image.new("RGBA", word.size, (0, 0, 0, 0))
    shadow.putalpha(word.getchannel("A").point(lambda value: round(value * 0.62)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(shadow, (x, y + 7))

    glow = Image.new("RGBA", word.size, (*color, 0))
    glow.putalpha(
        word.getchannel("A").point(
            lambda value: round(value * (0.18 + pulse * 0.28))
        )
    )
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(glow, (x, y))

    bright = ImageEnhance.Brightness(word).enhance(1.0 + pulse * 0.12)
    canvas.alpha_composite(bright, (x, y))
    return canvas.convert("RGB")


def add_floor_glow(frame: Image.Image, progress: float) -> Image.Image:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    alpha = round(24 + 18 * (1 + math.sin(progress * math.tau)) / 2)
    draw.ellipse((92, 270, 430, 330), fill=(75, 50, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(28))
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def build_frames() -> list[Image.Image]:
    source = square(Image.open(SOURCE))
    resting = make_resting_background(source)
    layers = [(word_layer(source, box), box, phase, color) for _, box, phase, color in WORDS]
    frames = []

    for index in range(FRAME_COUNT):
        progress = index / FRAME_COUNT
        frame = add_floor_glow(resting.copy(), progress)

        for word, box, phase, color in layers:
            wave = math.sin((progress + phase) * math.tau)
            # Svaka reč lebdi nezavisno: 9 px gore, 9 px dolje.
            offset = round(-wave * 9)
            pulse = (wave + 1) / 2
            frame = add_word(frame, word, box, offset, pulse, color)

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
