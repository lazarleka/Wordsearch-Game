from __future__ import annotations

import math
import random
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\User\OneDrive\Desktop\Gemini_Generated_Image_sp9me2sp9me2sp9m.png")
OUT_MP4 = ROOT / "public" / "ukrstene-reci-promo-15s.mp4"
OUT_PREVIEW = ROOT / "public" / "ukrstene-reci-promo-15s-preview.jpg"

SIZE = 1080
FPS = 24
DURATION = 15.0
FRAMES = int(FPS * DURATION)

FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_REG = Path(r"C:\Windows\Fonts\arial.ttf")
VIGNETTES: dict[float, Image.Image] = {}


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size=size)


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def cover_crop(base: Image.Image, zoom: float, cx: float = 0.5, cy: float = 0.5) -> Image.Image:
    w, h = base.size
    crop = int(min(w, h) / zoom)
    x = int(cx * w - crop / 2)
    y = int(cy * h - crop / 2)
    x = max(0, min(w - crop, x))
    y = max(0, min(h - crop, y))
    return base.crop((x, y, x + crop, y + crop)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def add_vignette(im: Image.Image, amount: float = 0.45) -> Image.Image:
    key = round(amount, 3)
    overlay = VIGNETTES.get(key)
    if overlay is None:
        yy, xx = np.mgrid[0:SIZE, 0:SIZE]
        cx = cy = SIZE / 2
        max_d = math.sqrt(cx * cx + cy * cy)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max_d
        alpha = (255 * amount * np.clip((d - 0.48) / 0.52, 0, 1)).astype(np.uint8)
        rgba = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
        rgba[..., 3] = alpha
        overlay = Image.fromarray(rgba, "RGBA")
        VIGNETTES[key] = overlay
    out = im.convert("RGBA")
    out.alpha_composite(overlay)
    return out


def glow_text(
    im: Image.Image,
    text: str,
    xy: tuple[int, int],
    size: int,
    fill=(255, 255, 255, 255),
    glow=(255, 65, 235, 210),
    anchor: str = "mm",
    stroke: int = 2,
) -> None:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(size, True)
    d.text(xy, text, font=f, anchor=anchor, fill=glow, stroke_width=stroke + 5, stroke_fill=glow)
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(9)))
    d = ImageDraw.Draw(im)
    d.text(xy, text, font=f, anchor=anchor, fill=fill, stroke_width=stroke, stroke_fill=(5, 5, 10, 230))


def rounded_panel(im: Image.Image, box: tuple[int, int, int, int], alpha: int = 155) -> None:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=28, fill=(5, 5, 14, alpha), outline=(120, 235, 255, 145), width=3)
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1)))


FILMOVI_BOXES = [
    (228, 276, 285, 333),
    (292, 276, 348, 333),
    (356, 276, 412, 333),
    (420, 276, 476, 333),
    (484, 276, 540, 333),
    (548, 276, 604, 333),
    (612, 276, 668, 333),
]


def transform_box(box, zoom, cx, cy):
    src = 1024
    crop = src / zoom
    x0 = cx * src - crop / 2
    y0 = cy * src - crop / 2
    x0 = max(0, min(src - crop, x0))
    y0 = max(0, min(src - crop, y0))
    scale = SIZE / crop
    return tuple(int((v - (x0 if i % 2 == 0 else y0)) * scale) for i, v in enumerate(box))


def filmovi_highlight(im: Image.Image, p: float, zoom: float, cx: float, cy: float) -> None:
    boxes = [transform_box(b, zoom, cx, cy) for b in FILMOVI_BOXES]
    word = (boxes[0][0] - 8, boxes[0][1] - 8, boxes[-1][2] + 8, boxes[-1][3] + 8)
    x = word[0] + (word[2] - word[0]) * p

    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    d.rounded_rectangle((word[0], word[1], max(word[0], x), word[3]), radius=18, fill=(170, 30, 255, 55))
    for r, a in [(42, 25), (28, 45), (14, 100), (6, 210)]:
        d.rounded_rectangle((x - r, word[1] - 12, x + r, word[3] + 12), radius=24, fill=(250, 70, 255, a))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(4)))
    d = ImageDraw.Draw(im, "RGBA")
    for b in boxes:
        d.rounded_rectangle(b, radius=10, outline=(255, 105, 255, 210), width=3)
    if p >= 0.96:
        d.rounded_rectangle(word, radius=18, outline=(255, 80, 255, 240), width=5)


def sparkles(im: Image.Image, seed: int, progress: float, region: tuple[int, int, int, int]) -> None:
    rng = random.Random(seed)
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(30):
        t = (progress - rng.random() * 0.75) / 0.55
        if not 0 <= t <= 1:
            continue
        x = rng.uniform(region[0], region[2])
        y = rng.uniform(region[1], region[3]) - t * rng.uniform(10, 34)
        s = rng.uniform(2, 6) * math.sin(math.pi * t)
        a = int(240 * math.sin(math.pi * t))
        color = rng.choice([(255, 220, 80, a), (255, 70, 245, a), (60, 230, 255, a)])
        d.line((x - s, y, x + s, y), fill=color, width=2)
        d.line((x, y - s, x, y + s), fill=color, width=2)
    im.alpha_composite(layer)


def frame_at(base: Image.Image, t: float) -> Image.Image:
    im: Image.Image

    if t < 2.2:
        p = ease(t / 2.2)
        im = cover_crop(base, 1.20 - 0.12 * p, 0.50, 0.63)
        im = add_vignette(im, 0.38)
        glow_text(im, "BRZA, ŠARENA I ZABAVNA", (SIZE // 2, 94), 46, glow=(255, 90, 40, 210))
        glow_text(im, "UKRŠTENE REČI", (SIZE // 2, 995), 54, glow=(90, 210, 255, 210))

    elif t < 5.0:
        p = (t - 2.2) / 2.8
        im = cover_crop(base, 1.58 + 0.08 * math.sin(p * math.pi), 0.50, 0.33)
        im = add_vignette(im, 0.42)
        rounded_panel(im, (120, 840, 960, 1018), 145)
        glow_text(im, "IZABERI SVOJU TEMU", (SIZE // 2, 895), 56, glow=(255, 170, 35, 220))
        topics = ["HRANA", "FILMOVI", "SPORT", "GEOGRAFIJA", "NAUKA"]
        for i, topic in enumerate(topics):
            a = ease(min(1, max(0, p * 5 - i * 0.6)))
            if a > 0:
                y = 956
                x = 145 + i * 198
                glow_text(im, topic, (x, y), 24 + int(4 * a), fill=(255, 255, 255, int(245 * a)), glow=(95, 240, 255, int(180 * a)))

    elif t < 8.2:
        p = ease_out((t - 5.0) / 3.2)
        zoom = 2.18
        cx = 0.45
        cy = 0.30
        im = cover_crop(base, zoom, cx, cy)
        im = add_vignette(im, 0.35)
        filmovi_highlight(im, p, zoom, cx, cy)
        rounded_panel(im, (160, 880, 920, 1010), 145)
        glow_text(im, "PRONAĐI RIJEČ", (SIZE // 2, 932), 54, glow=(230, 50, 255, 230))
        glow_text(im, "FILMOVI", (SIZE // 2, 988), 38, glow=(230, 50, 255, 230))

    elif t < 11.2:
        p = ease((t - 8.2) / 3.0)
        im = cover_crop(base, 1.75 + 0.05 * math.sin(p * math.tau), 0.76, 0.50)
        im = add_vignette(im, 0.40)
        sparkles(im, 2026, p, (645, 290, 1010, 740))
        rounded_panel(im, (90, 780, 990, 1015), 155)
        glow_text(im, "IGRAJ PROTIV", (SIZE // 2, 860), 62, glow=(255, 190, 35, 230))
        glow_text(im, "PRIJATELJA", (SIZE // 2, 935), 62, glow=(40, 230, 255, 230))

    elif t < 13.2:
        p = ease((t - 11.2) / 2.0)
        im = cover_crop(base, 1.20 - 0.05 * p, 0.50, 0.58)
        im = add_vignette(im, 0.50)
        sparkles(im, 77, p, (140, 140, 940, 900))
        rounded_panel(im, (90, 80, 990, 245), 155)
        glow_text(im, "POKAŽI SVOJE ZNANJE!", (SIZE // 2, 160), 58, glow=(30, 235, 255, 230))

    else:
        p = (t - 13.2) / 1.8
        breath = (math.sin(p * math.tau - math.pi / 2) + 1) / 2
        im = cover_crop(base, 1.05 + 0.045 * breath, 0.50, 0.57)
        im = ImageEnhance.Brightness(im).enhance(1.02 + 0.05 * breath)
        im = add_vignette(im, 0.36)
        rounded_panel(im, (125, 865, 955, 1018), 165)
        glow_text(im, "ZAIGRAJ ODMAH", (SIZE // 2, 935), 64, glow=(255, 70, 245, 240))

    return im.convert("RGB")


def make_preview(thumbs: list[Image.Image]) -> None:
    thumbs = []
    for thumb in thumbs:
        thumb.thumbnail((220, 220), Image.Resampling.LANCZOS)
    sheet = Image.new("RGB", (220 * len(thumbs), 220), (10, 10, 16))
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, (i * 220, 0))
    sheet.save(OUT_PREVIEW, quality=92)


def main() -> None:
    OUT_MP4.parent.mkdir(parents=True, exist_ok=True)
    base = Image.open(SOURCE).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    preview_indices = {0, 48, 96, 144, 196, 252, 316, FRAMES - 1}
    preview_frames: list[Image.Image] = []

    writer = imageio.get_writer(
        OUT_MP4,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=1,
    )
    try:
        for i in range(FRAMES):
            frame = frame_at(base, i / FPS)
            if i in preview_indices:
                preview_frames.append(frame.copy())
            writer.append_data(np.asarray(frame))
    finally:
        writer.close()

    thumbs = []
    for frame in preview_frames:
        thumb = frame.copy()
        thumb.thumbnail((220, 220), Image.Resampling.LANCZOS)
        thumbs.append(thumb)
    sheet = Image.new("RGB", (220 * len(thumbs), 220), (10, 10, 16))
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, (i * 220, 0))
    sheet.save(OUT_PREVIEW, quality=92)

    print(OUT_MP4)
    print(OUT_PREVIEW)


if __name__ == "__main__":
    main()
