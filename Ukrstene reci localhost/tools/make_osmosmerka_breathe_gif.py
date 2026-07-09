from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps


SRC = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_slogan_blize.png")
OUT = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_dise.gif")
MASK_PREVIEW = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_maska_preview.png")


def build_title_mask(image):
    # Tight region around the big OSMOSMERKA title. This prevents the pencil,
    # board, badge, slogan, and star from entering the animation mask.
    roi = (18, 758, 1238, 1032)
    crop = image.crop(roi).convert("RGB")
    hsv = crop.convert("HSV")
    h, s, v = hsv.split()

    # Main letter fill is highly saturated and bright; highlights can be bright
    # with lower saturation, so combine both tests.
    saturated = s.point(lambda px: 255 if px > 68 else 0)
    bright = v.point(lambda px: 255 if px > 120 else 0)
    colorful_letters = ImageChops.multiply(saturated, bright)

    very_bright = v.point(lambda px: 255 if px > 190 else 0)
    not_dark = s.point(lambda px: 255 if px > 35 else 0)
    highlights = ImageChops.multiply(very_bright, not_dark)

    seed = ImageChops.lighter(colorful_letters, highlights)
    seed = seed.filter(ImageFilter.MedianFilter(3)).point(lambda px: 255 if px > 80 else 0)

    # Select only large letter components. This drops the long plaque outline,
    # pencil, badge rim, and tiny sparkles even if they are bright/neon.
    arr = np.array(seed, dtype=np.uint8) > 0
    hgt, wid = arr.shape
    seen = np.zeros_like(arr, dtype=bool)
    keep = np.zeros_like(arr, dtype=bool)

    for yy in range(hgt):
        xs = np.where(arr[yy] & ~seen[yy])[0]
        for start_x in xs:
            if seen[yy, start_x] or not arr[yy, start_x]:
                continue
            stack = [(yy, int(start_x))]
            seen[yy, start_x] = True
            pixels = []
            min_x = max_x = int(start_x)
            min_y = max_y = yy
            while stack:
                cy, cx = stack.pop()
                pixels.append((cy, cx))
                if cx < min_x:
                    min_x = cx
                elif cx > max_x:
                    max_x = cx
                if cy < min_y:
                    min_y = cy
                elif cy > max_y:
                    max_y = cy
                for ny in (cy - 1, cy, cy + 1):
                    if ny < 0 or ny >= hgt:
                        continue
                    for nx in (cx - 1, cx, cx + 1):
                        if nx < 0 or nx >= wid or seen[ny, nx] or not arr[ny, nx]:
                            continue
                        seen[ny, nx] = True
                        stack.append((ny, nx))

            area = len(pixels)
            bw = max_x - min_x + 1
            bh = max_y - min_y + 1
            aspect = bw / max(1, bh)
            # Big title letters are tall chunky components; outlines are thin
            # or extremely wide, and the removed side decorations are small.
            if area >= 1400 and bw >= 35 and bh >= 70 and aspect <= 2.4:
                for py, px in pixels:
                    keep[py, px] = True

    mask_crop = Image.fromarray((keep * 255).astype(np.uint8), "L")
    # Add back a controlled amount of each letter glow after component cleanup.
    mask_crop = mask_crop.filter(ImageFilter.MaxFilter(13))
    mask_crop = mask_crop.filter(ImageFilter.GaussianBlur(2.6))
    mask_crop = mask_crop.point(lambda px: min(255, int(px * 1.35)))

    mask = Image.new("L", image.size, 0)
    mask.paste(mask_crop, roi[:2])
    return mask


def make_preview(image, mask):
    overlay = Image.new("RGBA", image.size, (0, 255, 255, 0))
    overlay.putalpha(mask.point(lambda px: int(px * 0.55)))
    preview = Image.alpha_composite(image.convert("RGBA"), overlay)
    preview.save(MASK_PREVIEW)


def make_frame(base, title_rgba, bbox, t):
    # Breathing: subtle pulse outward, never below original size, so there is no
    # visible hole where the title used to be.
    pulse = (1 - math.cos(2 * math.pi * t)) / 2
    scale = 1.0 + 0.038 * pulse
    glow = 1.0 + 0.12 * pulse

    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))
    dx = (new_w - w) // 2
    dy = (new_h - h) // 2

    layer = title_rgba.crop(bbox)
    layer = ImageEnhance.Brightness(layer).enhance(glow)
    layer = layer.resize((new_w, new_h), Image.Resampling.LANCZOS)

    frame = base.copy()
    frame.alpha_composite(layer, (x1 - dx, y1 - dy))
    return frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=128)


def main():
    image = Image.open(SRC).convert("RGBA")
    mask = build_title_mask(image)
    make_preview(image, mask)

    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Title mask is empty.")
    pad = 16
    x1, y1, x2, y2 = bbox
    bbox = (
        max(0, x1 - pad),
        max(0, y1 - pad),
        min(image.width, x2 + pad),
        min(image.height, y2 + pad),
    )

    title_rgba = Image.new("RGBA", image.size, (0, 0, 0, 0))
    title_rgba.paste(image, (0, 0), mask)

    frames = []
    total = 36
    for i in range(total):
        frames.append(make_frame(image.copy(), title_rgba, bbox, i / total))

    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=45,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(OUT)
    print(MASK_PREVIEW)


if __name__ == "__main__":
    main()
