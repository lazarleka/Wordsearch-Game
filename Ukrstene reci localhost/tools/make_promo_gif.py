from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "ukrstene-logo.png"
OUTPUT = ROOT / "public" / "ukrstene-promo-v2.gif"

SIZE = 520
FPS = 12
FRAME_COUNT = 48
FRAME_MS = round(1000 / FPS)


def cover_square(image: Image.Image, size: int) -> Image.Image:
    image = image.convert("RGB")
    edge = min(image.size)
    left = (image.width - edge) // 2
    top = (image.height - edge) // 2
    return image.crop((left, top, left + edge, top + edge)).resize(
        (size, size), Image.Resampling.LANCZOS
    )


def add_scaled(base: Image.Image, image: Image.Image, scale: float) -> None:
    edge = max(1, round(SIZE * scale))
    scaled = image.resize((edge, edge), Image.Resampling.LANCZOS)
    base.paste(scaled, ((SIZE - edge) // 2, (SIZE - edge) // 2))


def gaussian_beat(progress: float, center: float, width: float) -> float:
    distance = min(abs(progress - center), 1 - abs(progress - center))
    return math.exp(-((distance / width) ** 2))


def paste_pulsing_crop(
    frame: Image.Image,
    source: Image.Image,
    box: tuple[int, int, int, int],
    scale: float,
    lift: int = 0,
    glow_strength: int = 0,
) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    width, height = crop.size
    feather = Image.new("L", crop.size, 0)
    ImageDraw.Draw(feather).rounded_rectangle(
        (8, 6, width - 8, height - 6),
        radius=18,
        fill=255,
    )
    crop.putalpha(feather.filter(ImageFilter.GaussianBlur(8)))
    scaled = crop.resize(
        (round(width * scale), round(height * scale)),
        Image.Resampling.LANCZOS,
    )
    center_x = (box[0] + box[2]) // 2
    center_y = (box[1] + box[3]) // 2 - lift
    position = (center_x - scaled.width // 2, center_y - scaled.height // 2)

    canvas = frame.convert("RGBA")
    if glow_strength:
        glow = scaled.filter(ImageFilter.GaussianBlur(14))
        glow.putalpha(glow.getchannel("A").point(lambda value: value * glow_strength // 255))
        canvas.alpha_composite(glow, (position[0], position[1] + 4))
    canvas.alpha_composite(scaled, position)
    return canvas.convert("RGB")


def add_impact_rays(frame: Image.Image, strength: float) -> Image.Image:
    if strength < 0.04:
        return frame
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    center = (SIZE // 2, round(SIZE * 0.72))
    colors = [(255, 75, 110), (115, 80, 255), (0, 217, 176), (255, 200, 69)]
    for index in range(18):
        angle = (index / 18) * math.tau + 0.08
        inner = 165 + (index % 3) * 8
        outer = inner + 55 + 65 * strength
        x1 = center[0] + math.cos(angle) * inner
        y1 = center[1] + math.sin(angle) * inner
        x2 = center[0] + math.cos(angle) * outer
        y2 = center[1] + math.sin(angle) * outer
        color = colors[index % len(colors)]
        draw.line((x1, y1, x2, y2), fill=(*color, round(150 * strength)), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(1.2))
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def add_color_kick(
    frame: Image.Image,
    source: Image.Image,
    box: tuple[int, int, int, int],
    strength: float,
) -> Image.Image:
    if strength < 0.08:
        return frame
    crop = source.crop(box).convert("RGBA")
    alpha = crop.convert("L").point(
        lambda value: round(max(0, value - 32) * 0.32 * strength)
    )
    red = Image.new("RGBA", crop.size, (255, 30, 95, 0))
    cyan = Image.new("RGBA", crop.size, (0, 220, 255, 0))
    red.putalpha(alpha)
    cyan.putalpha(alpha)
    canvas = frame.convert("RGBA")
    canvas.alpha_composite(red, (box[0] - round(7 * strength), box[1]))
    canvas.alpha_composite(cyan, (box[0] + round(7 * strength), box[1]))
    return canvas.convert("RGB")


def make_sparkles(seed: int = 23) -> list[tuple[int, int, int, float]]:
    random.seed(seed)
    sparkles = []
    for _ in range(18):
        angle = random.uniform(0, math.tau)
        radius = random.uniform(SIZE * 0.32, SIZE * 0.47)
        x = round(SIZE / 2 + math.cos(angle) * radius)
        y = round(SIZE / 2 + math.sin(angle) * radius)
        sparkles.append((x, y, random.randint(2, 5), random.random()))
    return sparkles


def draw_sparkles(frame: Image.Image, progress: float, sparkles) -> Image.Image:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    colors = [(255, 200, 69), (0, 217, 176), (255, 75, 110), (100, 150, 255)]

    for index, (x, y, radius, phase) in enumerate(sparkles):
        pulse = max(0.0, math.sin((progress + phase) * math.tau * 2))
        if pulse < 0.35:
            continue
        r = radius * (0.55 + pulse)
        alpha = round(185 * pulse)
        color = colors[index % len(colors)]
        draw.line((x - r * 2, y, x + r * 2, y), fill=(*color, alpha), width=1)
        draw.line((x, y - r * 2, x, y + r * 2), fill=(*color, alpha), width=1)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*color, alpha))

    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def add_shine(frame: Image.Image, progress: float) -> Image.Image:
    shine = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shine)
    center = -180 + progress * (SIZE + 360)
    points = [
        (center - 85, 0),
        (center + 5, 0),
        (center + 190, SIZE),
        (center + 100, SIZE),
    ]
    draw.polygon(points, fill=(255, 255, 255, 42))
    shine = shine.filter(ImageFilter.GaussianBlur(18))
    return Image.alpha_composite(frame.convert("RGBA"), shine).convert("RGB")


def build_frames() -> list[Image.Image]:
    source = cover_square(Image.open(SOURCE), SIZE)
    sparkles = make_sparkles()
    frames = []
    title_box = (18, 296, 510, 474)
    reci_box = (116, 382, 420, 466)

    for index in range(FRAME_COUNT):
        progress = index / FRAME_COUNT
        beat_one = gaussian_beat(progress, 0.18, 0.085)
        beat_two = gaussian_beat(progress, 0.57, 0.11)
        impact = max(beat_one, beat_two * 0.82)
        breathing = (1 - math.cos(progress * math.tau)) / 2
        scale = 0.955 + breathing * 0.018 + impact * 0.016

        background = source.filter(ImageFilter.GaussianBlur(24))
        background = ImageEnhance.Brightness(background).enhance(0.22 + impact * 0.09)

        glow = source.resize((SIZE - 26, SIZE - 26), Image.Resampling.LANCZOS)
        glow = glow.filter(ImageFilter.GaussianBlur(20))
        glow = ImageEnhance.Brightness(glow).enhance(0.7 + breathing * 0.2 + impact * 0.7)
        background.paste(glow, (13, 13), Image.new("L", glow.size, round(85 + impact * 90)))

        frame = background.copy()
        add_scaled(frame, source, scale)
        frame = add_impact_rays(frame, impact)

        title_scale = 1 + impact * 0.085
        title_lift = round(impact * 5)
        frame = add_color_kick(frame, source, title_box, impact)
        frame = paste_pulsing_crop(
            frame,
            source,
            title_box,
            title_scale,
            lift=title_lift,
            glow_strength=round(70 + impact * 130),
        )

        # Drugi, kraći udar za pločice REČI — kao arcade "combo" efekat.
        reci_wave = gaussian_beat(progress, 0.31, 0.075) + gaussian_beat(progress, 0.70, 0.08)
        frame = paste_pulsing_crop(
            frame,
            source,
            reci_box,
            1 + min(1, reci_wave) * 0.075,
            lift=round(min(1, reci_wave) * 7),
            glow_strength=round(80 + min(1, reci_wave) * 150),
        )

        frame = ImageEnhance.Color(frame).enhance(1.05 + impact * 0.18)
        frame = ImageEnhance.Contrast(frame).enhance(1.04 + impact * 0.1)
        frame = add_shine(frame, progress)
        frame = draw_sparkles(frame, progress, sparkles)

        if impact > 0.65:
            flash = Image.new("RGBA", frame.size, (255, 255, 255, round((impact - 0.65) * 70)))
            frame = Image.alpha_composite(frame.convert("RGBA"), flash).convert("RGB")
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
