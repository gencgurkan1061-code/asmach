"""Generate local evaluation-only OCR rasters with Pillow's FreeType renderer.

This is not OCR model training. System font files are read locally and are never
copied into fixtures, installation packages, or shared as redistributable assets.
The labels below are fixed before the OCR evaluation; do not tune this set to
make a failing recognizer appear successful.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont, __version__ as pillow_version, features


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "ocr-freetype-evaluation"
FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
FONTS = {
    "Arial": "arial.ttf",
    "Arial Italic": "ariali.ttf",
    "Times New Roman": "times.ttf",
    "Courier New": "cour.ttf",
}
CASES = [
    {"id": "ft-arial-length-clean", "font": "Arial", "text": "12.75", "expected": {"type": "Uzunluk", "nominalValue": 12.75}},
    {"id": "ft-times-length-tracked", "font": "Times New Roman", "text": "83.125", "tracking": 5, "expected": {"type": "Uzunluk", "nominalValue": 83.125}},
    {"id": "ft-courier-diameter-symmetric", "font": "Courier New", "text": "Ø18.6 ±0.02", "tracking": 3, "expected": {"type": "Çap", "nominalValue": 18.6, "lowerTolerance": -0.02, "upperTolerance": 0.02}},
    {"id": "ft-arial-italic-radius-blur", "font": "Arial Italic", "text": "R8 ±0.15", "quality": "blur", "expected": {"type": "Yarıçap", "nominalValue": 8, "lowerTolerance": -0.15, "upperTolerance": 0.15}},
    {"id": "ft-times-diameter-stacked", "font": "Times New Roman", "layout": "stacked", "text": "Ø32.8", "upper": "0", "lower": "-0.08", "tracking": 2, "expected": {"type": "Çap", "nominalValue": 32.8, "lowerTolerance": -0.08, "upperTolerance": 0}},
    {"id": "ft-courier-length-stacked-small", "font": "Courier New", "layout": "stacked", "text": "16", "upper": "+0.25", "lower": "0", "quality": "small", "expected": {"type": "Uzunluk", "nominalValue": 16, "lowerTolerance": 0, "upperTolerance": 0.25}},
    {"id": "ft-arial-limits-small", "font": "Arial", "layout": "limits", "text": "0.413", "lower": "0.405", "quality": "small", "expected": {"type": "Uzunluk", "nominalValue": 0.409, "lowerTolerance": -0.004, "upperTolerance": 0.004, "lowerLimit": 0.405, "upperLimit": 0.413}},
    {"id": "ft-times-diameter-limits", "font": "Times New Roman", "layout": "limits", "prefix": "Ø", "text": "0.252", "lower": "0.248", "tracking": 3, "expected": {"type": "Çap", "nominalValue": 0.25, "lowerTolerance": -0.002, "upperTolerance": 0.002, "lowerLimit": 0.248, "upperLimit": 0.252}},
    {"id": "ft-courier-metric-thread", "font": "Courier New", "text": "M12x1.25-6H", "tracking": 2, "expected": {"type": "Diş", "nominalValue": 12, "threadPitch": 1.25, "threadClass": "6H"}},
    {"id": "ft-arial-npt-thread", "font": "Arial", "text": "1/8-27 NPT", "expected": {"type": "Diş", "nominalValue": 0.125, "threadPitch": "27 TPI", "threadClass": "NPT", "unit": "in"}},
    {"id": "ft-times-npt-thread-tracked", "font": "Times New Roman", "text": "1/4-18 NPT", "tracking": 3, "expected": {"type": "Diş", "nominalValue": 0.25, "threadPitch": "18 TPI", "threadClass": "NPT", "unit": "in"}},
    {"id": "ft-arial-surface-ra-blur", "font": "Arial", "text": "Ra 1.6", "quality": "blur", "expected": {"type": "Yüzey", "nominalValue": 1.6, "specialDesignator": "Ra"}},
    {"id": "ft-courier-surface-rz-small", "font": "Courier New", "text": "Rz 6.3", "quality": "small", "expected": {"type": "Yüzey", "nominalValue": 6.3, "specialDesignator": "Rz"}},
    {"id": "ft-times-angle-tracked", "font": "Times New Roman", "text": "30° ±0.25°", "tracking": 3, "expected": {"type": "Açı", "nominalValue": 30, "lowerTolerance": -0.25, "upperTolerance": 0.25}},
    {"id": "ft-arial-chamfer-blur", "font": "Arial", "text": "1 x 45°", "quality": "blur", "expected": {"type": "Pah", "nominalValue": 1, "chamferAngle": 45}},
    {"id": "ft-courier-labeled-limits", "font": "Courier New", "text": "4.2 MAX 4.0 MIN", "tracking": 2, "expected": {"type": "Uzunluk", "nominalValue": 4.1, "lowerTolerance": -0.1, "upperTolerance": 0.1, "lowerLimit": 4, "upperLimit": 4.2}},
]


def render(case):
    image = Image.new("RGB", (1300, 170 if case.get("layout") in ("stacked", "limits") else 108), "white")
    drawing = ImageDraw.Draw(image)
    font_file = FONT_DIR / FONTS[case["font"]]

    def draw(text, x, baseline, size=42):
        font = ImageFont.truetype(str(font_file), size)
        for char in text:
            drawing.text((x, baseline), char, font=font, fill="#111111", anchor="ls")
            x += font.getlength(char) + case.get("tracking", 0)
        return x

    if case.get("layout") == "stacked":
        end = draw(case["text"], 22, 98)
        end = max(draw(case["upper"], end + 18, 62, 27), draw(case["lower"], end + 18, 139, 27))
    elif case.get("layout") == "limits":
        start = draw(case["prefix"], 22, 101) + 8 if case.get("prefix") else 22
        end = max(draw(case["text"], start, 64), draw(case["lower"], start, 141))
    else:
        end = draw(case["text"], 22, 75)
    image = image.crop((0, 0, math.ceil(end + 24), image.height))
    if case.get("quality") == "blur":
        image = image.filter(ImageFilter.GaussianBlur(radius=0.65))
    elif case.get("quality") == "small":
        image = image.resize((round(image.width * 0.57), round(image.height * 0.57)), Image.Resampling.LANCZOS)
    return image


def main():
    missing = [str(FONT_DIR / name) for name in FONTS.values() if not (FONT_DIR / name).is_file()]
    if missing:
        raise SystemExit("Required local system fonts unavailable: " + ", ".join(missing))
    if not features.check_module("freetype2"):
        raise SystemExit("Pillow FreeType support is required.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for case in CASES:
        image = render(case)
        filename = case["id"] + ".png"
        image.save(OUTPUT / filename)
        entries.append({**case, "quality": case.get("quality", "clean"), "tracking": case.get("tracking", 0),
                        "file": filename, "width": image.width, "height": image.height,
                        "fontFile": FONTS[case["font"]], "sha256": hashlib.sha256((OUTPUT / filename).read_bytes()).hexdigest()})
    manifest = {"schemaVersion": 1, "purpose": "evaluation-only", "training": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "renderer": {"library": "Pillow", "version": pillow_version, "freetypeVersion": features.version_module("freetype2")},
                "notes": ["Synthetic local evaluation raster set; not a real customer drawing benchmark.",
                          "No font binaries are copied or redistributed.",
                          "Labels fixed before OCR evaluation; no engine tuning against these results in this task.",
                          "Limit-only nominal is the arithmetic midpoint, not a drawing-specified nominal.",
                          "NPT nominal values designate nominal pipe size, not outside diameter; pitch values are TPI.",
                          "Fixture schema correction after initial evaluation: NPT threadPitch labels are stored as '27 TPI'/'18 TPI', not unitless numbers. Images, measurements and recognizer were not changed."],
                "cases": entries}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"count": len(entries), "directory": str(OUTPUT), "purpose": manifest["purpose"], "renderer": manifest["renderer"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
