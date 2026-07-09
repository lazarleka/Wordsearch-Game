from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


SRC = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_slogan_blize.png")
OUT = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_olovka_i_tekst_disu.gif")
MASK_PREVIEW = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_olovka_i_tekst_maska.png")
MOTION_DIFF = Path(r"C:\Users\User\OneDrive\Desktop\grafika\Osmosmerka_olovka_i_tekst_motion_diff.png")


def components(mask_image, min_area, min_w, min_h, max_aspect):
    arr = np.array(mask_image, dtype=np.uint8) > 0
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
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
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
            if area >= min_area and bw >= min_w and bh >= min_h and aspect <= max_aspect:
                for py, px in pixels:
                    keep[py, px] = True

    return Image.fromarray((keep * 255).astype(np.uint8), "L")


def title_mask(image):
    # Include the full height of the title, including lower bevels, shadows,
    # and glow. Keep the bottom safely above the slogan banner.
    roi = (18, 742, 1238, 1080)
    crop = image.crop(roi).convert("RGB")
    h, s, v = crop.convert("HSV").split()
    colorful = ImageChops.multiply(
        s.point(lambda px: 255 if px > 68 else 0),
        v.point(lambda px: 255 if px > 120 else 0),
    )
    highlights = ImageChops.multiply(
        v.point(lambda px: 255 if px > 190 else 0),
        s.point(lambda px: 255 if px > 35 else 0),
    )
    seed = ImageChops.lighter(colorful, highlights)
    seed = seed.filter(ImageFilter.MedianFilter(3)).point(lambda px: 255 if px > 80 else 0)
    clean = components(seed, min_area=1400, min_w=35, min_h=70, max_aspect=2.4)
    # Grow enough to include bevel/rim/glow, but keep the gaps between letters
    # mostly outside the mask so the plaque does not breathe.
    clean = clean.filter(ImageFilter.MaxFilter(17))
    clean = clean.filter(ImageFilter.GaussianBlur(2.3))
    clean = clean.point(lambda px: min(255, int(px * 1.45)))
    out = Image.new("L", image.size, 0)
    out.paste(clean, roi[:2])
    return out


def pencil_mask(image):
    # Polygon tightly follows the pencil silhouette. It excludes the word-search
    # cells, badge, main title, and slogan before thresholding.
    poly = Image.new("L", image.size, 0)
    d = ImageDraw.Draw(poly)
    d.polygon(
        [
            (0, 470), (68, 426), (122, 434), (162, 485),
            (245, 755), (253, 821), (218, 846), (157, 760),
            (98, 667), (30, 625), (0, 575),
        ],
        fill=255,
    )
    crop = image.convert("RGB")
    h, s, v = crop.convert("HSV").split()
    visible = ImageChops.lighter(
        ImageChops.multiply(s.point(lambda px: 255 if px > 35 else 0), v.point(lambda px: 255 if px > 50 else 0)),
        v.point(lambda px: 255 if px > 145 else 0),
    )
    visible = ImageChops.multiply(visible, poly)
    # The pencil overlaps the left neon board frame. Remove the frame strips
    # from the mask so the board stays perfectly static.
    erase = Image.new("L", image.size, 0)
    ed = ImageDraw.Draw(erase)
    ed.rectangle((50, 410, 95, 470), fill=255)
    ed.rectangle((55, 590, 88, 760), fill=255)
    visible = ImageChops.subtract(visible, erase)
    visible = visible.filter(ImageFilter.MedianFilter(3))
    visible = visible.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.4))
    return visible.point(lambda px: min(255, int(px * 1.2)))


def make_preview(image, mask):
    overlay = Image.new("RGBA", image.size, (0, 255, 255, 0))
    overlay.putalpha(mask.point(lambda px: int(px * 0.55)))
    Image.alpha_composite(image.convert("RGBA"), overlay).save(MASK_PREVIEW)


def paste_breathing_layer(out, moving, bbox, t):
    pulse = (1 - math.cos(2 * math.pi * t)) / 2
    scale = 1.0 + 0.032 * pulse
    brightness = 1.0 + 0.10 * pulse

    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    nw, nh = int(round(w * scale)), int(round(h * scale))
    dx, dy = (nw - w) // 2, (nh - h) // 2

    layer = moving.crop(bbox)
    layer = ImageEnhance.Brightness(layer).enhance(brightness)
    layer = layer.resize((nw, nh), Image.Resampling.LANCZOS)
    out.alpha_composite(layer, (x1 - dx, y1 - dy))


def padded_bbox(mask, pad=18):
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Mask is empty.")
    x1, y1, x2, y2 = bbox
    return (max(0, x1 - pad), max(0, y1 - pad), min(mask.width, x2 + pad), min(mask.height, y2 + pad))


def main():
    image = Image.open(SRC).convert("RGBA")
    t_mask = title_mask(image)
    p_mask = pencil_mask(image)
    mask = ImageChops.lighter(t_mask, p_mask)
    make_preview(image, mask)

    title_bbox = padded_bbox(t_mask)
    pencil_bbox = padded_bbox(p_mask)

    title_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    title_layer.paste(image, (0, 0), t_mask)
    pencil_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pencil_layer.paste(image, (0, 0), p_mask)

    rgba_frames = []
    for i in range(36):
        t = i / 36
        out = image.copy()
        paste_breathing_layer(out, pencil_layer, pencil_bbox, t)
        paste_breathing_layer(out, title_layer, title_bbox, t)
        rgba_frames.append(out)

    f0 = rgba_frames[0].convert("RGB")
    f9 = rgba_frames[9].convert("RGB")
    diff = ImageChops.difference(f0, f9)
    ImageEnhance.Brightness(diff).enhance(8).save(MOTION_DIFF)

    palette = rgba_frames[0].convert("RGB").convert("P", palette=Image.Palette.ADAPTIVE, colors=128)
    frames = [frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE) for frame in rgba_frames]
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=45, loop=0, optimize=True, disposal=2)

    print(OUT)
    print(MASK_PREVIEW)
    print(MOTION_DIFF)


if __name__ == "__main__":
    main()
