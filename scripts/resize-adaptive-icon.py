"""Regenerate assets/adaptive-icon-foreground.png from assets/adaptive-icon.png
at a given size. Tweak TARGET_FILL and rerun, then `npx expo prebuild --platform
android --clean` to see the result.

TARGET_FILL = fraction of the safe-zone circle (66% of the canvas) the logo's
bounding-box diagonal should fill. 1.0 = touching the edge (risk of clipping
on aggressive masks), ~0.8-0.85 is a safe comfortable size.
"""
import math
from PIL import Image

TARGET_FILL = 0.83

SRC = "assets/adaptive-icon.png"
OUT = "assets/adaptive-icon-foreground.png"
CANVAS = 1024
SAFE_DIAMETER = CANVAS * 0.66

im = Image.open(SRC).convert("RGBA")
logo = im.crop(im.getchannel("A").getbbox())

target_diag = SAFE_DIAMETER * TARGET_FILL
scale = target_diag / math.hypot(*logo.size)
new_size = (round(logo.width * scale), round(logo.height * scale))
logo = logo.resize(new_size, Image.LANCZOS)

canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
canvas.paste(logo, ((CANVAS - new_size[0]) // 2, (CANVAS - new_size[1]) // 2), logo)
canvas.save(OUT)
print(f"wrote {OUT} at TARGET_FILL={TARGET_FILL}")
