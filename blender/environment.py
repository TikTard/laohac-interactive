"""Village environment: bamboo, houses, village gate, banyan tree, well, haystack, fence, props, gift items."""
import math, random
from lib import *


# ------------------------------------------------------------------ bamboo clump
def build_bamboo(out, name, seed, n=11):
    reset()
    rnd = random.Random(seed)
    mat("Culm", "#86a33e", 0.6)
    mat("Node", "#5f7a2a", 0.6)
    mat("Leaf1", "#4f8a34", 0.9)
    mat("Leaf2", "#6fa544", 0.9)
    mat("Leaf3", "#3d6e2a", 0.9)
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.05, 0.45)
        base = Vector((math.cos(a) * rr, math.sin(a) * rr, 0))
        h = rnd.uniform(4.5, 7.0)
        lean = rnd.uniform(0.04, 0.16)
        out_dir = Vector((math.cos(a), math.sin(a), 0))
        mid = base + out_dir * h * 0.55 * lean + Vector((0, 0, h * 0.55))
        top = mid + out_dir * h * 0.45 * (lean * 2.6) + Vector((0, 0, h * 0.43))
        r = rnd.uniform(0.04, 0.06)
        limb("Culm", base, mid, r, r * 0.85, caps=False, seg=8)
        limb("Culm", mid, top, r * 0.85, r * 0.4, caps=False, seg=8)
        for k in range(1, 9):
            t = k / 9
            p = base.lerp(mid, t) if t < 1 else mid
            d = (mid - base).normalized() * 0.02
            limb("Node", p - d, p + d, r * 1.12, caps=False, seg=8)
        # foliage sprays along the upper culm
        for k in range(5):
            t = 0.25 + k * 0.18
            p = mid.lerp(top, min(t, 1.0))
            side = out_dir * rnd.uniform(0.2, 0.55) + Vector((rnd.uniform(-.3, .3), rnd.uniform(-.3, .3), 0))
            blob(rnd.choice(["Leaf1", "Leaf2", "Leaf3"]), p + side, rnd.uniform(0.35, 0.6),
                 (1.0, 1.0, 0.55), rot=(0, 0, rnd.uniform(0, 3)))
    finalize(name)
    export(f"{out}/{name}.glb")


# ------------------------------------------------------------------ houses
def build_house(out, name, style):
    reset()
    thatch = style == "thatch"
    mat("Wall", "#b48b5c" if thatch else "#d8cdb9", 0.95)
    mat("WallBase", "#8e7a62" if thatch else "#9a8f80", 0.95)
    mat("Wood", "#5b3f28", 0.8)
    mat("Dark", "#22170f", 0.95)
    mat("Roof", "#b08f55" if thatch else "#9c4a2e", 0.95)
    mat("Ridge", "#86683a" if thatch else "#6e2f1c", 0.9)
    mat("BambooBar", "#a08a4e", 0.7)
    mat("Stone", "#8e8173", 0.95)
    mat("Jar", "#7a4e30", 0.6)

    W, D, H = 4.6, 3.0, 2.0
    # walls
    box("Wall", (0, D / 2, H / 2), (W, 0.2, H))                    # back
    for s in (-1, 1):
        box("Wall", (s * W / 2, 0, H / 2), (0.2, D, H))           # sides
    box("Stone", (0, -0.4, 0.1), (W + 0.4, D + 2.2, 0.2))           # foundation / porch floor
    # front wall with door + 2 windows
    fy = -D / 2
    box("Wall", (-1.75, fy, H / 2), (1.1, 0.2, H))
    box("Wall", (1.75, fy, H / 2), (1.1, 0.2, H))
    box("Wall", (-0.85, fy, 0.45), (0.7, 0.2, 0.9))
    box("Wall", (0.85, fy, 0.45), (0.7, 0.2, 0.9))
    box("Wall", (0, fy, 1.9), (2.4, 0.2, 0.2))
    box("Wall", (-0.85, fy, 1.65), (0.7, 0.2, 0.3))
    box("Wall", (0.85, fy, 1.65), (0.7, 0.2, 0.3))
    box("Dark", (0, fy + 0.05, 0.95), (1.0, 0.1, 1.7))              # door opening
    for s in (-1, 1):
        box("Dark", (0.85 * s, fy + 0.05, 1.2), (0.7, 0.1, 0.6))    # window opening
        for k in range(5):
            cyl("BambooBar", (0.85 * s - 0.28 + k * 0.14, fy - 0.03, 1.2), 0.02, 0.6, seg=6)
    box("WallBase", (0, D / 2, 0.15), (W + 0.02, 0.22, 0.3))
    # porch posts
    for x in (-2.2, -0.75, 0.75, 2.2):
        cyl("Wood", (x, -D / 2 - 1.0, 1.15), 0.07, 2.3, seg=8)
        cyl("Stone", (x, -D / 2 - 1.0, 0.22), 0.11, 0.06, seg=8)
    box("Wood", (0, -D / 2 - 1.0, 2.28), (4.8, 0.14, 0.14))           # beam
    # roof
    ov = 0.6
    y0, y1 = -D / 2 - 1.0 - ov, D / 2 + ov
    if thatch:
        hip_roof("Roof", -W / 2 - ov, W / 2 + ov, y0, y1, 2.0, 4.1, 1.4, thickness=0.3)
        cyl("Ridge", (0, (y0 + y1) / 2, 4.15), 0.13, W + 2 * ov - 2.8 + 0.3, rot=(0, math.pi / 2, 0), seg=10)
    else:
        hip_roof("Roof", -W / 2 - ov, W / 2 + ov, y0, y1, 2.1, 3.8, 0.0, thickness=0.12)
        # gable ends
        yc = (y0 + y1) / 2
        for s in (-1, 1):
            mesh("Wall", [(s * W / 2, -D / 2, H), (s * W / 2, D / 2, H), (s * W / 2, yc, 3.7)], [(0, 1, 2)])
        box("Ridge", (0, yc, 3.85), (W + 2 * ov + 0.2, 0.25, 0.18))
        for s in (-1, 1):
            cone("Ridge", (s * (W / 2 + ov + 0.15), yc, 3.98), 0.1, 0.0, 0.35, rot=(0, -0.5 * s, 0), seg=8)
        # tile lines
        for k in range(12):
            x = -W / 2 - ov + 0.3 + k * (W + 2 * ov - 0.6) / 11
            box("Ridge", (x, y0 + 0.9, 2.55), (0.05, 2.2, 0.05), rot=(-0.54, 0, 0))
    # water jar
    sphere("Jar", (W / 2 + 0.2, -D / 2 - 1.3, 0.55), 0.35, (1, 1, 1.1))
    cyl("Jar", (W / 2 + 0.2, -D / 2 - 1.3, 0.92), 0.2, 0.08)
    finalize(name)
    export(f"{out}/{name}.glb")


# ------------------------------------------------------------------ village gate (cổng làng)
def build_gate(out):
    reset()
    mat("Plaster", "#cfc3a8", 0.95)
    mat("PlasterDark", "#9d917a", 0.95)
    mat("Moss", "#6f7b4a", 0.95)
    mat("Tile", "#8d3f2a", 0.85)
    mat("TileDark", "#6b2c1c", 0.85)
    mat("PlaqueFrame", "#5b3a22", 0.7)
    mat("Plaque", "#e8dcb8", 0.8)

    group("Main")
    # arch wall with opening (boolean)
    wall = box("Plaster", (0, 0, 1.75), (2.6, 0.6, 3.5))
    cut1 = box("Plaster", (0, 0, 0.75), (2.2, 1.0, 1.6))
    boolean_cut(wall, cut1)
    cut2 = cyl("Plaster", (0, 0, 1.5), 1.1, 1.0, rot=(math.pi / 2, 0, 0), seg=32)
    boolean_cut(wall, cut2)
    box("PlasterDark", (0, 0, 3.45), (2.7, 0.7, 0.12))
    # pillars
    for s in (-1, 1):
        x = 1.65 * s
        box("Plaster", (x, 0, 2.1), (0.75, 0.75, 4.2))
        box("PlasterDark", (x, 0, 0.25), (0.85, 0.85, 0.5))
        box("Moss", (x, -0.38, 0.6), (0.6, 0.02, 0.3))
        box("PlasterDark", (x, 0, 4.25), (0.9, 0.9, 0.12))
        hip_roof("Tile", x - 0.55, x + 0.55, -0.55, 0.55, 4.3, 4.75, 0.5, thickness=0.08)
        sphere("PlasterDark", (x, 0, 4.85), 0.12)
        # side walls
        box("Plaster", (2.9 * s, 0, 0.85), (1.8, 0.35, 1.7))
        box("PlasterDark", (2.9 * s, 0, 1.75), (1.9, 0.45, 0.1))
        box("PlasterDark", (2.9 * s, 0, 0.12), (1.82, 0.37, 0.24))
    # two-tier roof
    hip_roof("Tile", -1.95, 1.95, -0.95, 0.95, 3.5, 4.2, 0.8, thickness=0.1)
    box("TileDark", (0, 0, 4.25), (2.5, 0.2, 0.15))
    hip_roof("Tile", -1.2, 1.2, -0.65, 0.65, 4.35, 4.85, 0.5, thickness=0.08)
    box("TileDark", (0, 0, 4.9), (1.6, 0.16, 0.12))
    sphere("TileDark", (0, 0, 5.02), 0.12)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cone("TileDark", (1.95 * sx, 0.95 * sy, 3.58), 0.07, 0.0, 0.4,
                 rot=(0.6 * sy, -0.6 * sx, 0), seg=8)
        cone("TileDark", (sx * 1.25, 0, 4.98), 0.06, 0.0, 0.3, rot=(0, -0.7 * sx, 0), seg=8)
    box("PlaqueFrame", (0, -0.32, 2.95), (1.75, 0.04, 0.55))

    group("Plaque")
    plane("Plaque", (0, -0.345, 2.95), (1.6, 0.42), rot=(math.pi / 2, 0, 0))
    finalize("Gate", {"Plaque": ((0, -0.345, 2.95), None)})
    export(f"{out}/gate.glb")


# ------------------------------------------------------------------ banyan tree (cây đa)
def build_banyan(out):
    reset()
    rnd = random.Random(7)
    mat("Bark", "#5e4a3a", 0.95)
    mat("BarkLight", "#7a6450", 0.95)
    mat("Leaf1", "#3f6b2c", 0.9)
    mat("Leaf2", "#4f7d35", 0.9)
    mat("Leaf3", "#335a24", 0.9)
    cone("Bark", (0, 0, 1.6), 0.75, 0.45, 3.2, seg=12)
    for k in range(5):
        a = k * 1.3
        limb("BarkLight", (math.cos(a) * 0.5, math.sin(a) * 0.5, 0), (math.cos(a) * 0.25, math.sin(a) * 0.25, 2.6), 0.22, 0.12, seg=8)
        sphere("Bark", (math.cos(a) * 0.75, math.sin(a) * 0.75, 0.1), 0.3, (1.4, 1, 0.5))
    tips = []
    for k in range(7):
        a = k * math.tau / 7 + rnd.uniform(-.2, .2)
        tip = Vector((math.cos(a) * rnd.uniform(2.0, 3.2), math.sin(a) * rnd.uniform(2.0, 3.2), rnd.uniform(4.0, 5.2)))
        limb("Bark", (0, 0, 2.8), tip, 0.2, 0.08, seg=8)
        tips.append(tip)
        for j in range(3):
            p = Vector((0, 0, 2.8)).lerp(tip, 0.4 + j * 0.25)
            limb("BarkLight", p, (p.x, p.y, rnd.uniform(0.0, 1.5)), 0.025, 0.015, caps=False, seg=6)
    for k in range(26):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.5, 3.6)
        blob(rnd.choice(["Leaf1", "Leaf2", "Leaf3"]),
             (math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(4.3, 6.6) - rr * 0.25),
             rnd.uniform(1.1, 1.7), (1.0, 1.0, 0.7), rot=(0, 0, rnd.uniform(0, 3)))
    finalize("Banyan")
    export(f"{out}/banyan.glb")


# ------------------------------------------------------------------ small structures
def build_well(out):
    reset()
    mat("Laterite", "#9a5b3c", 0.95)
    mat("LateriteDark", "#7a4430", 0.95)
    mat("Water", "#1f3a44", 0.2)
    mat("Wood", "#6b4a2b", 0.8)
    mat("Rope", "#c9b07a", 0.9)
    for s in (-1, 1):
        box("Laterite", (s * 0.6, 0, 0.35), (0.2, 1.4, 0.7))
        box("Laterite", (0, s * 0.6, 0.35), (1.0, 0.2, 0.7))
    box("LateriteDark", (0, 0, 0.72), (1.45, 1.45, 0.06))
    box("Water", (0, 0, 0.45), (1.0, 1.0, 0.02))
    cyl("Wood", (0.95, -0.4, 0.15), 0.14, 0.3, seg=10)        # bucket
    torus("Rope", (0.95, -0.4, 0.3), 0.14, 0.012)
    limb("Wood", (-0.75, 0.75, 0), (-0.75, 0.75, 2.0), 0.05, caps=False, seg=8)
    limb("Wood", (-0.75, 0.75, 1.9), (0.4, 0.2, 1.4), 0.03, caps=False, seg=6)
    limb("Rope", (0.4, 0.2, 1.4), (0.2, 0.1, 0.75), 0.008, caps=False, seg=4)
    finalize("Well")
    export(f"{out}/well.glb")


def build_haystack(out):
    reset()
    mat("Straw", "#d1b26a", 0.95)
    mat("StrawDark", "#b0904e", 0.95)
    mat("Wood", "#6b4a2b", 0.8)
    cyl("Wood", (0, 0, 1.5), 0.04, 3.0, seg=6)
    sphere("Straw", (0, 0, 0.9), 1.0, (1, 1, 0.95), seg=14, rings=8, smooth=False)
    cone("StrawDark", (0, 0, 1.9), 0.75, 0.05, 1.0, seg=14, smooth=False)
    cyl("StrawDark", (0, 0, 0.12), 0.95, 0.25, seg=14, smooth=False)
    finalize("Haystack")
    export(f"{out}/haystack.glb")


def build_fence(out):
    reset()
    mat("Bamboo", "#a99a5a", 0.7)
    mat("BambooDark", "#7d6f3c", 0.7)
    L = 3.0
    for k in range(16):
        x = -L / 2 + k * L / 15
        h = 1.0 + (0.08 if k % 2 else 0)
        cyl("Bamboo" if k % 3 else "BambooDark", (x, 0, h / 2), 0.035, h, seg=6)
    for z in (0.3, 0.75):
        limb("BambooDark", (-L / 2 - 0.05, -0.05, z), (L / 2 + 0.05, -0.05, z), 0.025, caps=False, seg=6)
    finalize("Fence")
    export(f"{out}/fence.glb")


def build_props(out):
    """One file, several named props as separate nodes."""
    reset()
    mat("Jar", "#7a4e30", 0.6)
    mat("Basket", "#a5824c", 0.9)
    mat("Straw", "#d1b26a", 0.95)
    mat("Stone", "#8e8173", 0.95)
    mat("Grass", "#6f9a3e", 0.95)
    mat("Flower", "#e9c54a", 0.8)
    spec = {}
    group("Chum"); spec["Chum"] = ((0, 0, 0), None)
    sphere("Jar", (0, 0, 0.45), 0.32, (1, 1, 1.15))
    cyl("Jar", (0, 0, 0.82), 0.18, 0.08)
    group("Thung"); spec["Thung"] = ((2, 0, 0), None)
    cyl("Basket", (2, 0, 0.12), 0.32, 0.24)
    torus("Basket", (2, 0, 0.24), 0.32, 0.03)
    group("Rock"); spec["Rock"] = ((4, 0, 0), None)
    blob("Stone", (4, 0, 0.12), 0.3, (1.3, 1, 0.6))
    group("GrassTuft"); spec["GrassTuft"] = ((6, 0, 0), None)
    for k in range(7):
        a = k * 0.9
        cone("Grass", (6 + math.cos(a) * 0.08, math.sin(a) * 0.08, 0.15), 0.04, 0.0, 0.3,
             rot=(math.cos(a) * 0.4, math.sin(a) * 0.4, 0), seg=4, smooth=False)
    group("Flowers"); spec["Flowers"] = ((8, 0, 0), None)
    for k in range(5):
        a = k * 1.25
        p = (8 + math.cos(a) * 0.15, math.sin(a) * 0.15, 0)
        limb("Grass", p, (p[0], p[1], 0.25), 0.01, caps=False, seg=4)
        sphere("Flower", (p[0], p[1], 0.27), 0.04, seg=8, rings=6)
    finalize("Props", spec)
    export(f"{out}/props.glb")


def build_items(out):
    """Gift items dropped into the bowl / given to the dog."""
    reset()
    mat("Gold", "#d8b23a", 0.35, 0.8)
    mat("Hole", "#5a4512", 0.6)
    mat("Khoai", "#7a3b4f", 0.7)
    mat("Banana", "#f0cf45", 0.6)
    mat("BananaTip", "#4a3a1a", 0.6)
    mat("Sack", "#d8c9a3", 0.95)
    mat("Tie", "#8a6d3c", 0.9)
    mat("Bone", "#f1ece0", 0.7)
    mat("Leaf", "#3e7a3a", 0.8)
    mat("String", "#e3d7a8", 0.8)
    spec = {}
    group("Coin"); spec["Coin"] = ((0, 0, 0), None)
    cyl("Gold", (0, 0, 0.005), 0.05, 0.01, seg=20)
    box("Hole", (0, 0, 0.005), (0.022, 0.022, 0.012))
    group("Khoai"); spec["Khoai"] = ((1, 0, 0), None)
    sphere("Khoai", (1, 0, 0.04), 0.045, (1.8, 1, 0.9), rot=(0, 0, 0.3))
    sphere("Khoai", (1.05, 0.06, 0.035), 0.04, (1.6, 1, 0.85), rot=(0, 0, -0.5))
    group("Chuoi"); spec["Chuoi"] = ((2, 0, 0), None)
    for k in range(4):
        a = -0.45 + k * 0.3
        sphere("Banana", (2 + math.sin(a) * 0.08, math.cos(a) * 0.08 - 0.04, 0.035), 0.03, (0.9, 3.0, 0.9), rot=(0, 0, -a))
    sphere("BananaTip", (2, -0.05, 0.035), 0.022)
    group("Gao"); spec["Gao"] = ((3, 0, 0), None)
    sphere("Sack", (3, 0, 0.13), 0.13, (1, 0.9, 1.1), seg=14)
    cone("Sack", (3, 0, 0.29), 0.04, 0.08, 0.08, seg=10)
    torus("Tie", (3, 0, 0.27), 0.045, 0.012)
    group("Xuong"); spec["Xuong"] = ((4, 0, 0), None)
    limb("Bone", (3.92, 0, 0.025), (4.08, 0, 0.025), 0.016, caps=False)
    for x in (3.92, 4.08):
        for dy in (-0.018, 0.018):
            sphere("Bone", (x, dy, 0.025), 0.022)
    group("BanhChung"); spec["BanhChung"] = ((5, 0, 0), None)
    box("Leaf", (5, 0, 0.04), (0.14, 0.14, 0.08))
    box("String", (5, 0, 0.04), (0.145, 0.012, 0.085))
    box("String", (5, 0, 0.04), (0.012, 0.145, 0.085))
    finalize("Items", spec)
    export(f"{out}/items.glb")


def build_all(out):
    build_bamboo(out, "bamboo_a", 1)
    build_bamboo(out, "bamboo_b", 2, n=8)
    build_house(out, "house_thatch", "thatch")
    build_house(out, "house_tile", "tile")
    build_gate(out)
    build_banyan(out)
    build_well(out)
    build_haystack(out)
    build_fence(out)
    build_props(out)
    build_items(out)
