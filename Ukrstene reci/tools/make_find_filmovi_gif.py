from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\User\OneDrive\Desktop\Gemini_Generated_Image_sp9me2sp9me2sp9m.png")
OUT_GIF = ROOT / "public" / "ukrstene-filmovi-gameplay.gif"
OUT_PREVIEW = ROOT / "public" / "ukrstene-filmovi-gameplay-preview.jpg"


FPS = 24
DURATION = 5.0
FRAMES = int(FPS * DURATION)
W = H = 1024

# Hand-tuned from the supplied 1024x1024 logo. These are the seven purple tiles
# that spell FILMOVI. We only animate over this band so all logo text stays intact.
LETTER_BOXES = [
    (228, 276, 285, 333),  # F
    (292, 276, 348, 333),  # I
    (356, 276, 412, 333),  # L
    (420, 276, 476, 333),  # M
    (484, 276, 540, 333),  # O
    (548, 276, 604, 333),  # V
    (612, 276, 668, 333),  # I
]
WORD_BOX = (
    LETTER_BOXES[0][0] - 4,
    LETTER_BOXES[0][1] - 4,
    LETTER_BOXES[-1][2] + 4,
    LETTER_BOXES[-1][3] + 4,
)


def ease_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def draw_rounded_outline(
    img: Image.Image,
    box: tuple[int, int, int, int],
    color: tuple[int, int, int, int],
    width: int,
    radius: int = 10,
) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    for i in range(width):
        draw.rounded_rectangle(
            (box[0] - i, box[1] - i, box[2] + i, box[3] + i),
            radius=radius + i,
            outline=color,
            width=1,
        )


def add_word_glow(frame: Image.Image, strength: float) -> None:
    if strength <= 0:
        return

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Soft outer glow around every tile and one continuous selection outline.
    for box in LETTER_BOXES:
        draw_rounded_outline(glow, box, (190, 45, 255, int(180 * strength)), 4, 9)
    draw_rounded_outline(glow, WORD_BOX, (230, 85, 255, int(170 * strength)), 5, 14)

    blur_big = glow.filter(ImageFilter.GaussianBlur(14))
    blur_small = glow.filter(ImageFilter.GaussianBlur(5))
    frame.alpha_composite(blur_big)
    frame.alpha_composite(blur_small)
    frame.alpha_composite(glow)


def add_sweep(frame: Image.Image, progress: float) -> None:
    x1, y1, x2, y2 = WORD_BOX
    sweep_x = x1 + (x2 - x1) * progress

    # Completed fill/selection trail.
    completed = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(completed, "RGBA")
    draw.rounded_rectangle(
        (x1, y1, max(x1, sweep_x), y2),
        radius=15,
        fill=(155, 30, 255, 42),
        outline=(240, 105, 255, 115),
        width=2,
    )
    frame.alpha_composite(completed)

    # Moving finger-like neon beam.
    beam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(beam, "RGBA")
    for r, alpha in [(42, 20), (28, 34), (16, 58), (7, 170)]:
        draw.rounded_rectangle(
            (sweep_x - r, y1 - 11, sweep_x + r, y2 + 11),
            radius=22,
            fill=(225, 72, 255, alpha),
        )
    beam = beam.filter(ImageFilter.GaussianBlur(3))
    frame.alpha_composite(beam)


def pop_active_tile(base: Image.Image, frame: Image.Image, sweep_progress: float) -> None:
    x1, _, x2, _ = WORD_BOX
    sweep_x = x1 + (x2 - x1) * sweep_progress

    for i, box in enumerate(LETTER_BOXES):
        bx1, by1, bx2, by2 = box
        center = (bx1 + bx2) / 2
        dist = abs(sweep_x - center)
        intensity = max(0.0, 1.0 - dist / 42.0)
        if intensity <= 0:
            continue

        # A very small crop zoom gives the "letter pops" feeling while preserving
        # the original artwork because the enlarged material is still the source logo.
        scale = 1.0 + 0.055 * ease_in_out(intensity)
        pad = 8
        crop_box = (
            max(0, bx1 - pad),
            max(0, by1 - pad),
            min(W, bx2 + pad),
            min(H, by2 + pad),
        )
        tile = base.crop(crop_box).convert("RGBA")
        nw = int(tile.width * scale)
        nh = int(tile.height * scale)
        tile = tile.resize((nw, nh), Image.Resampling.LANCZOS)

        px = int((crop_box[0] + crop_box[2]) / 2 - nw / 2)
        py = int((crop_box[1] + crop_box[3]) / 2 - nh / 2)

        tile = ImageEnhance.Brightness(tile).enhance(1.0 + 0.22 * intensity)
        tile = ImageEnhance.Contrast(tile).enhance(1.0 + 0.10 * intensity)

        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_rounded_outline(glow, (bx1, by1, bx2, by2), (255, 170, 255, int(170 * intensity)), 5, 9)
        frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8)))
        frame.alpha_composite(tile, (px, py))


def add_sparkles(frame: Image.Image, t: float) -> None:
    # Deterministic particles around FILMOVI during the confirmation beat.
    rng = random.Random(1248)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    x1, y1, x2, y2 = WORD_BOX

    for idx in range(24):
        birth = rng.random() * 0.55
        life = (t - birth) / 0.55
        if life < 0 or life > 1:
            continue

        px = rng.uniform(x1 - 16, x2 + 18)
        py = rng.choice([rng.uniform(y1 - 34, y1 + 2), rng.uniform(y2 - 2, y2 + 34)])
        drift = (life - 0.5) * rng.uniform(8, 22)
        size = rng.uniform(2.2, 4.8) * (1 - abs(life - 0.5) * 1.4)
        alpha = int(220 * math.sin(math.pi * life))
        if size <= 0 or alpha <= 0:
            continue

        color = rng.choice([(255, 220, 255, alpha), (248, 82, 255, alpha), (110, 225, 255, alpha)])
        x = px + drift
        y = py - life * rng.uniform(4, 14)
        draw.line((x - size, y, x + size, y), fill=color, width=2)
        draw.line((x, y - size, x, y + size), fill=color, width=2)

    frame.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.25)))


def add_board_pulse(frame: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return frame

    # Subtle whole-logo pulse: just a glow/brightness lift, not a geometry warp.
    lifted = ImageEnhance.Brightness(frame).enhance(1.0 + 0.045 * amount)
    glow = frame.filter(ImageFilter.GaussianBlur(8))
    glow.putalpha(int(30 * amount))
    lifted.alpha_composite(glow)
    return lifted


def make_frame(base: Image.Image, idx: int) -> Image.Image:
    seconds = idx / FPS
    frame = base.copy().convert("RGBA")

    # 0.45s pause, 2.25s smooth scan, then confirmation/hold.
    scan_start = 0.45
    scan_end = 2.70
    confirm_start = 2.72

    if seconds < scan_start:
        p = 0.0
        add_word_glow(frame, 0.18 + 0.04 * math.sin(seconds * math.tau * 2))
    elif seconds <= scan_end:
        raw = (seconds - scan_start) / (scan_end - scan_start)
        p = ease_out_cubic(raw)
        add_sweep(frame, p)
        pop_active_tile(base, frame, p)
        add_word_glow(frame, 0.30 + 0.45 * p)
    else:
        p = 1.0
        pulse_t = seconds - confirm_start
        flicker = 0.08 * math.sin(seconds * math.tau * 11)
        add_word_glow(frame, 0.92 + flicker)
        if pulse_t < 1.2:
            add_sparkles(frame, min(1.0, pulse_t / 1.2))
            pulse = math.sin(min(1.0, pulse_t / 0.8) * math.pi)
            frame = add_board_pulse(frame, max(0.0, pulse))

    # Persistent final neon selection line.
    if p >= 0.98:
        final = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(final, "RGBA")
        draw.rounded_rectangle(
            WORD_BOX,
            radius=14,
            outline=(250, 72, 255, 230),
            width=4,
        )
        draw.line(
            (WORD_BOX[0] + 10, WORD_BOX[3] + 9, WORD_BOX[2] - 10, WORD_BOX[3] + 9),
            fill=(255, 80, 255, 210),
            width=4,
        )
        frame.alpha_composite(final.filter(ImageFilter.GaussianBlur(2)))
        frame.alpha_composite(final)

    return frame.convert("RGB")


def make_preview(frames: list[Image.Image]) -> None:
    picks = [0, int(FRAMES * 0.18), int(FRAMES * 0.35), int(FRAMES * 0.52), int(FRAMES * 0.76), FRAMES - 1]
    thumbs = []
    for i in picks:
        im = frames[i].copy()
        im.thumbnail((240, 240), Image.Resampling.LANCZOS)
        thumbs.append(im)

    sheet = Image.new("RGB", (240 * len(thumbs), 240), (10, 10, 14))
    for i, im in enumerate(thumbs):
        sheet.paste(im, (i * 240, 0))
    sheet.save(OUT_PREVIEW, quality=92)


def main() -> None:
    OUT_GIF.parent.mkdir(parents=True, exist_ok=True)
    base = Image.open(SOURCE).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)

    frames = [make_frame(base, i) for i in range(FRAMES)]
    make_preview(frames)

    # Quantize with adaptive palette to keep the GIF reasonably sized but sharp.
    qframes = [
        f.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        for f in frames
    ]
    qframes[0].save(
        OUT_GIF,
        save_all=True,
        append_images=qframes[1:],
        duration=int(1000 / FPS),
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(OUT_GIF)
    print(OUT_PREVIEW)


if __name__ == "__main__":
    main()
