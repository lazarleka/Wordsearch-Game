from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\User\OneDrive\Desktop\Gemini_Generated_Image_sp9me2sp9me2sp9m.png")
OUT_GIF = ROOT / "public" / "ukrstene-reci-breathing-j-fixed.gif"
OUT_PREVIEW = ROOT / "public" / "ukrstene-reci-breathing-j-fixed-preview.jpg"

W = H = 1024
FPS = 20
DURATION = 4.0
FRAMES = int(FPS * DURATION)

# Region that contains the foreground logo block and the left pencil.
# The board/game words stay static. The pencil is included in this same layer
# so it never tears away from the big "UKRŠTENE REČI" title.
FOREGROUND_BOX = (18, 350, 965, 1018)
# Keep the left side visually locked while the right side breathes outward.
LEFT_ANCHOR_X = FOREGROUND_BOX[0]
VERTICAL_ANCHOR_Y = 790


def make_foreground_mask() -> Image.Image:
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)

    # Pencil body and tip on the left.
    draw.polygon(
        [
            (18, 405),
            (128, 360),
            (188, 515),
            (214, 630),
            (158, 650),
            (78, 540),
        ],
        fill=255,
    )
    draw.ellipse((20, 355, 145, 485), fill=255)

    # Main black plaque and huge title.
    draw.rounded_rectangle((30, 615, 940, 850), radius=42, fill=255)
    draw.polygon([(35, 645), (885, 610), (960, 695), (920, 835), (55, 850)], fill=255)

    # "REČI" tile row.
    draw.rounded_rectangle((225, 760, 775, 925), radius=28, fill=255)

    # Bottom slogan strip and star.
    draw.rounded_rectangle((155, 910, 895, 1000), radius=32, fill=255)
    draw.polygon(
        [
            (512, 946),
            (526, 980),
            (564, 980),
            (532, 1002),
            (546, 1036),
            (512, 1015),
            (478, 1036),
            (492, 1002),
            (460, 980),
            (498, 980),
        ],
        fill=255,
    )

    # Small decorative strokes beside the title.
    draw.rounded_rectangle((145, 790, 225, 900), radius=22, fill=235)
    draw.rounded_rectangle((805, 790, 915, 900), radius=22, fill=235)

    # Do not animate the visible GEOGRAFIJA "J" tile, but do not cut into the
    # upper edge of the large "E" from UKRŠTENE. That lets the E breathe over J.
    draw.rounded_rectangle((645, 542, 740, 615), radius=12, fill=0)

    return mask


def remove_green_from_mask(base: Image.Image, mask: Image.Image) -> Image.Image:
    """Remove green board-letter pixels from the breathing layer.

    This keeps GEOGRAFIJA static, but still allows non-green foreground pixels
    from the big title/plaque to pass over those board letters naturally.
    """
    base_rgb = base.convert("RGB")
    out = mask.copy()
    pix = base_rgb.load()
    alpha = out.load()

    for y in range(H):
        for x in range(W):
            if alpha[x, y] == 0:
                continue
            r, g, b = pix[x, y]
            is_green = (
                g > 85
                and g > r * 1.22
                and g > b * 1.05
                and (g - r) > 28
                and (g - b) > -8
            )
            if is_green:
                alpha[x, y] = 0

    return out.filter(ImageFilter.GaussianBlur(7))


def crop_with_mask(base: Image.Image, mask: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    source = base.convert("RGBA")
    source.putalpha(mask)
    layer.alpha_composite(source)
    return layer


def scaled_layer(layer: Image.Image, scale: float) -> Image.Image:
    x1, y1, x2, y2 = FOREGROUND_BOX
    crop = layer.crop((x1, y1, x2, y2))
    nw = int(crop.width * scale)
    nh = int(crop.height * scale)
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    # Horizontal anchor is the left edge, so the left side does not drift.
    # Vertical anchor stays around the title center to keep the breathing natural.
    rel_y = (VERTICAL_ANCHOR_Y - y1) / crop.height
    px = LEFT_ANCHOR_X
    py = int(VERTICAL_ANCHOR_Y - rel_y * nh)

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(scaled, (px, py))
    return out


def make_glow(layer: Image.Image, amount: float) -> Image.Image:
    alpha = layer.getchannel("A")
    glow = Image.new("RGBA", (W, H), (255, 55, 240, 0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(11)).point(lambda p: int(p * 0.18 * amount)))

    blue = Image.new("RGBA", (W, H), (35, 190, 255, 0))
    blue.putalpha(alpha.filter(ImageFilter.GaussianBlur(18)).point(lambda p: int(p * 0.10 * amount)))

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(blue)
    out.alpha_composite(glow)
    return out


def make_frame(base: Image.Image, foreground: Image.Image, idx: int) -> Image.Image:
    phase = idx / FRAMES
    breath = (math.sin(phase * math.tau - math.pi / 2) + 1) / 2
    # Stronger breathing, still controlled enough to avoid rubbery distortion.
    scale = 1.0 + 0.055 * breath
    pulse = 0.62 + 0.48 * breath

    frame = base.convert("RGBA")
    moving = scaled_layer(foreground, scale)

    # Very small brightness pulse only on the breathing layer.
    moving_rgb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bright = ImageEnhance.Brightness(moving.convert("RGB")).enhance(1.0 + 0.065 * breath).convert("RGBA")
    bright.putalpha(moving.getchannel("A"))
    moving_rgb.alpha_composite(bright)

    frame.alpha_composite(make_glow(moving_rgb, pulse))
    frame.alpha_composite(moving_rgb)
    return frame.convert("RGB")


def make_preview(frames: list[Image.Image]) -> None:
    picks = [0, FRAMES // 6, FRAMES // 3, FRAMES // 2, 2 * FRAMES // 3, FRAMES - 1]
    sheet = Image.new("RGB", (240 * len(picks), 240), (10, 10, 14))
    for n, idx in enumerate(picks):
        im = frames[idx].copy()
        im.thumbnail((240, 240), Image.Resampling.LANCZOS)
        sheet.paste(im, (n * 240, 0))
    sheet.save(OUT_PREVIEW, quality=92)


def main() -> None:
    OUT_GIF.parent.mkdir(parents=True, exist_ok=True)
    base = Image.open(SOURCE).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    mask = remove_green_from_mask(base, make_foreground_mask())
    foreground = crop_with_mask(base, mask)

    frames = [make_frame(base, foreground, i) for i in range(FRAMES)]
    make_preview(frames)

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
