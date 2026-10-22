"""Build a social avatar from the NAOJUN site brand mark, no external assets."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "assets" / "brand" / "bluesky-avatar.png"
SIZE = 512
AA = 4
COBALT = (36, 69, 219)
PAPER = (244, 243, 236)


def cubic(a, b, c, d, steps=64):
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u**3*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t**3*d[0],
            u**3*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t**3*d[1],
        )


def build():
    scale = 12 * AA
    ox, oy = 64 * AA, 52 * AA
    point = lambda p: (round(ox + p[0] * scale), round(oy + p[1] * scale))
    first = [(3, 29), (3, 6)]
    first += list(cubic((3, 6), (3, 1), (12, 1), (12, 6)))
    first += [(12, 24)]
    first += list(cubic((12, 24), (12, 32), (29, 33), (29, 22)))
    first += [(29, 4)]
    second = [(20, 3), (20, 28)]

    canvas = Image.new("RGB", (SIZE * AA, SIZE * AA), COBALT)
    d = ImageDraw.Draw(canvas)
    stroke = round(3 * scale)
    for path in (first, second):
        pts = [point(p) for p in path]
        d.line(pts, fill=PAPER, width=stroke, joint="curve")
        for x, y in (pts[0], pts[-1]):
            r = stroke // 2
            d.ellipse((x-r, y-r, x+r, y+r), fill=PAPER)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
        TARGET, format="PNG", optimize=True
    )
    assert TARGET.stat().st_size < 1_000_000
    return TARGET


if __name__ == "__main__":
    path = build()
    print(f"Generated {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
