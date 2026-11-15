"""Characters: Lão Hạc (sitting, begging), Cậu Vàng (sitting dog), villagers (walkable)."""
import math, random
from lib import *


# =====================================================================  LÃO HẠC
def build_lao_hac(out):
    reset()
    mat("Skin", "#b9825a", 0.6)
    mat("Shirt", "#7a5636", 0.9)
    mat("Patch1", "#5c6b4a", 0.9)
    mat("Patch2", "#a07f58", 0.9)
    mat("Pants", "#3d2f25", 0.9)
    mat("Hair", "#d6d1c7", 0.95)
    mat("Eye", "#1b1410", 0.3)
    mat("Bamboo", "#b8a060", 0.6)
    mat("BambooNode", "#8a7440", 0.6)
    mat("MatStraw", "#cfa955", 0.9)
    mat("MatRed", "#a8452e", 0.9)
    mat("Bowl", "#6e5a46", 0.8)
    mat("BowlIn", "#3a2e24", 0.9)

    HIP = (0, 0, 0.16)

    # ---------------- Lower body: crossed legs + straw mat + pipe
    group("Lower")
    for i in range(8):
        x = -0.5 + 0.0625 + i * 0.125
        box("MatStraw" if i % 2 == 0 else "MatRed", (x, -0.1, 0.01), (0.125, 0.95, 0.02))
    sphere("Pants", (0, 0.0, 0.14), 0.16, (1.05, 0.95, 0.6))
    for s in (-1, 1):
        limb("Pants", (0.08 * s, -0.02, 0.12), (0.25 * s, -0.2, 0.1), 0.068)
        sphere("Pants", (0.25 * s, -0.2, 0.1), 0.078)  # rolled cuff at knee
    limb("Skin", (0.25, -0.22, 0.09), (-0.07, -0.31, 0.07), 0.04)    # right shin under
    limb("Skin", (-0.25, -0.22, 0.1), (0.07, -0.27, 0.12), 0.04)     # left shin over
    sphere("Skin", (-0.11, -0.31, 0.06), 0.045, (1.5, 0.85, 0.65))
    sphere("Skin", (0.11, -0.27, 0.11), 0.045, (1.5, 0.85, 0.65))
    # điếu cày lying on the mat
    a, b = Vector((0.42, 0.12, 0.05)), Vector((0.36, -0.5, 0.05))
    limb("Bamboo", a, b, 0.03, caps=False)
    for t in (0.15, 0.5, 0.85):
        p = a.lerp(b, t)
        d = (b - a).normalized() * 0.008
        limb("BambooNode", p - d, p + d, 0.034, caps=False)
    limb("Bamboo", a.lerp(b, 0.75), a.lerp(b, 0.75) + Vector((0.09, 0, 0.06)), 0.009, caps=False)
    cyl("BambooNode", a.lerp(b, 0.75) + Vector((0.1, 0, 0.07)), 0.017, 0.035)

    # ---------------- Begging bowl (separate node, items get dropped into it)
    group("Bowl")
    BOWL = (0, -0.52, 0.02)
    cone("Bowl", (0, -0.52, 0.055), 0.055, 0.11, 0.07, seg=20)
    cyl("BowlIn", (0, -0.52, 0.088), 0.098, 0.004, seg=20)
    box("BowlIn", (0.05, -0.62, 0.06), (0.004, 0.02, 0.05), rot=(0, 0.3, 0.6))  # crack

    # ---------------- Upper body (built upright, then hunched)
    group("Upper")
    cone("Shirt", (0, 0, 0.4), 0.18, 0.145, 0.46)
    sphere("Shirt", (0, 0, 0.6), 0.17, (1.05, 0.85, 0.4))
    cone("Shirt", (0, 0, 0.19), 0.195, 0.18, 0.06)
    for a_ in (-2.4, -1.2, -0.4, 0.9, 2.0):
        cone("Shirt", (math.cos(a_) * 0.19, math.sin(a_) * 0.19, 0.145), 0.03, 0.0, 0.07,
             rot=(math.pi, 0, 0), scale=(1.4, 0.6, 1))
    box("Patch1", (0.07, -0.168, 0.32), (0.07, 0.01, 0.065), rot=(0.08, 0, 0.1))
    box("Patch2", (-0.1, -0.162, 0.49), (0.055, 0.01, 0.055), rot=(0.08, 0, -0.15))
    cone("Skin", (0, -0.12, 0.58), 0.05, 0.02, 0.12, rot=(math.pi + 0.15, 0, 0), scale=(1, 0.4, 1))

    group("Head")
    cyl("Skin", (0, 0, 0.68), 0.045, 0.12)
    HZ = 0.83
    sphere("Skin", (0, 0, HZ), 0.155, (0.95, 0.95, 1.12), seg=24, rings=14)
    for s in (-1, 1):
        sphere("Skin", (0.15 * s, 0.01, HZ - 0.01), 0.038, (0.5, 0.9, 1.15))
        sphere("Skin", (0.075 * s, -0.115, HZ - 0.07), 0.04, (1, 0.6, 0.7))
        sphere("Eye", (0.052 * s, -0.138, HZ + 0.02), 0.018, (1, 0.6, 0.5))
        sphere("Hair", (0.06 * s, -0.132, HZ + 0.062), 0.026, (1.6, 0.6, 0.45), rot=(0, 0.35 * s, 0))
    sphere("Skin", (0, -0.155, HZ - 0.02), 0.03, (0.9, 0.9, 1.15))
    tufts = [(0, .35, .07), (30, .4, .065), (-30, .4, .065), (65, .55, .06), (-65, .55, .06),
             (100, .6, .065), (-100, .6, .065), (140, .55, .07), (-140, .55, .07), (180, .5, .075),
             (160, .85, .06), (-160, .85, .06), (120, .95, .055), (-120, .95, .055),
             (90, 1.0, .05), (-90, 1.0, .05), (180, 1.05, .06), (15, .15, .055), (-20, .2, .05)]
    for az_deg, pol, r in tufts:
        az = math.radians(az_deg + 90)
        x = math.cos(az) * math.sin(pol) * 0.1425
        y = -math.sin(az) * math.sin(pol) * 0.1425
        z = HZ + math.cos(pol) * 0.168
        sphere("Hair", (x, y + 0.01, z), r, (1.2, 1.0, 0.75), rot=(math.cos(az) * .4, math.sin(az) * .4, az))

    group("Beard")
    for s in (-1, 1):
        sphere("Hair", (0.04 * s, -0.152, HZ - 0.075), 0.026, (1.6, 0.6, 0.5), rot=(0, -0.55 * s, 0))
    for x, y, z, r, sz, rx in [(0, -.12, HZ - .13, .06, 1.2, -.2), (-.045, -.11, HZ - .15, .035, 1.5, -.1),
                               (.045, -.11, HZ - .15, .035, 1.5, -.1), (.01, -.13, HZ - .22, .035, 1.6, -.3),
                               (-.02, -.13, HZ - .25, .025, 1.6, -.2), (.075, -.08, HZ - .12, .03, 1.4, 0),
                               (-.075, -.08, HZ - .12, .03, 1.4, 0)]:
        sphere("Hair", (x, y, z), r, (1.0, 0.7, sz), rot=(rx, 0, 0))

    HUNCH = 0.3
    M = rot_about(HIP, HUNCH, "X")
    transform_groups(["Upper", "Head", "Beard"], M)
    neck = M @ Vector((0, 0, 0.63))
    jaw = M @ Vector((0, -0.11, HZ - 0.06))

    # ---------------- Arms, built in final (hunched) pose, hands resting on knees
    sh_z = (M @ Vector((0, 0, 0.6))).z
    sh_y = (M @ Vector((0, 0, 0.6))).y
    shoulders = {}
    for s, gname in ((-1, "ArmL"), (1, "ArmR")):
        group(gname)
        sh = Vector((0.205 * s, sh_y, sh_z))
        elbow = Vector((0.25 * s, sh_y - 0.08, sh_z - 0.22))
        wrist = Vector((0.25 * s, -0.27, 0.22))
        sphere("Shirt", sh, 0.058)
        limb("Shirt", sh, elbow, 0.05, 0.047)
        limb("Shirt", elbow, wrist, 0.047, 0.04)
        sphere("Skin", (0.25 * s, -0.29, 0.18), 0.045, (0.9, 1.1, 0.8))
        shoulders[gname] = tuple(sh)

    finalize("LaoHac", {
        "Lower": ((0, 0, 0), None),
        "Bowl": (BOWL, None),
        "Upper": (HIP, None),
        "Head": (tuple(neck), "Upper"),
        "Beard": (tuple(jaw), "Head"),
        "ArmL": (shoulders["ArmL"], "Upper"),
        "ArmR": (shoulders["ArmR"], "Upper"),
    })
    export(f"{out}/lao_hac.glb")


# =====================================================================  CẬU VÀNG
def build_cau_vang(out):
    reset()
    mat("Dog", "#c27a12", 0.85)
    mat("DogCream", "#ecc98a", 0.85)
    mat("DogDark", "#1e1612", 0.4)
    mat("Mouth", "#5a1f1f", 0.6)
    mat("Tongue", "#d9667a", 0.5)

    group("Body")
    sphere("Dog", (0, 0.06, 0.12), 0.12, (1.0, 1.15, 0.85))
    sphere("Dog", (0, -0.03, 0.25), 0.095, (0.9, 0.9, 1.45), rot=(0.3, 0, 0))
    sphere("DogCream", (0, -0.1, 0.25), 0.07, (0.7, 0.45, 1.25), rot=(0.3, 0, 0))
    for s in (-1, 1):
        cyl("Dog", (0.045 * s, -0.09, 0.1), 0.024, 0.2)
        sphere("DogCream", (0.045 * s, -0.11, 0.015), 0.03, (1, 1.4, 0.6))
        sphere("Dog", (0.095 * s, -0.01, 0.03), 0.04, (0.8, 1.8, 0.55))

    HD = 0.43
    group("Head")
    sphere("Dog", (0, -0.07, HD), 0.085, (1, 0.95, 0.95), seg=20, rings=12)
    sphere("DogCream", (0, -0.15, HD - 0.015), 0.045, (0.95, 1.3, 0.6))
    sphere("DogDark", (0, -0.205, HD + 0.0), 0.016, (1.2, 1, 0.9))
    sphere("Mouth", (0, -0.14, HD - 0.045), 0.03, (0.85, 1.3, 0.45))
    for s in (-1, 1):
        sphere("DogDark", (0.035 * s, -0.142, HD + 0.03), 0.013)
        cone("Dog", (0.05 * s, -0.06, HD + 0.08), 0.032, 0.004, 0.08, rot=(0, 0.3 * s, 0), scale=(1, 0.5, 1))
        cone("DogCream", (0.05 * s, -0.068, HD + 0.075), 0.018, 0.002, 0.05, rot=(0, 0.3 * s, 0), scale=(1, 0.4, 1))

    group("Jaw")
    sphere("DogCream", (0, -0.14, HD - 0.06), 0.034, (0.85, 1.35, 0.45))
    sphere("Tongue", (0, -0.15, HD - 0.05), 0.02, (0.8, 1.2, 0.35))

    group("Tail")
    for i, (x, y, z, r) in enumerate([(0.0, 0.17, 0.07, 0.035), (0.03, 0.21, 0.12, 0.03),
                                      (0.05, 0.21, 0.18, 0.025), (0.045, 0.18, 0.22, 0.02)]):
        sphere("Dog" if i < 3 else "DogCream", (x, y, z), r)

    finalize("CauVang", {
        "Body": ((0, 0, 0), None),
        "Head": ((0, -0.05, 0.34), "Body"),
        "Jaw": ((0, -0.1, HD - 0.04), "Head"),
        "Tail": ((0, 0.15, 0.07), "Body"),
    })
    export(f"{out}/cau_vang.glb")


# =====================================================================  VILLAGERS + NPCs
VILLAGERS = {
    "man_nonla":  dict(shirt="#6b4a33", pants="#2b2622", skin="#c08a62", hat="nonla", hair="short"),
    "woman_ganh": dict(shirt="#e8e1cf", pants="#1f1c1a", skin="#d9a27a", hat="nonla", hair="bun", carry="ganh"),
    "old_woman":  dict(shirt="#4a3a2c", pants="#1f1c1a", skin="#c79471", hat="khanmoqua", hair="none", stoop=0.18),
    "child":      dict(shirt="#3f6e8c", pants="#3a2e26", skin="#d9a27a", hat="none", hair="tuft", bighead=True, shorts=True),
    "young_man":  dict(shirt="#d6cdb8", pants="#2f2a26", skin="#c48c64", hat="khanvan", hair="short"),
    "girl":       dict(shirt="#8c3b2e", pants="#1f1c1a", skin="#e0ac86", hat="none", hair="braid", carry="basket"),
    # ---- story characters
    "quan_huyen": dict(shirt="#25356e", pants="#1a1a1a", skin="#e0b08a", hat="canhchuon", hair="short", robe=True,
                       belly=True, belt="#d4a93a", shoes=True, face="mandarin"),
    "linh_giao":  dict(shirt="#7a2a20", pants="#2a2420", skin="#b9825a", hat="nondau", hair="short", prop="spear",
                       belt="#d4a93a", cloth="#2b211a"),
    "linh_long":  dict(shirt="#7a2a20", pants="#2a2420", skin="#c08a62", hat="nondau", hair="short", prop="parasol",
                       belt="#d4a93a", cloth="#2b211a"),
    "ly_truong":  dict(shirt="#26262c", pants="#e6e0d0", skin="#d1a07a", hat="khanxep", hair="short", robe=True,
                       shoes=True, prop="ledger", face="mustache"),
    "binh_tu":    dict(shirt="#3a3632", pants="#24201c", skin="#a8744e", hat="headband", hair="short", stoop=0.22,
                       sack=True, face="stubble"),
    # ---- funny / poor villagers
    "cu_moi":     dict(shirt="#5f6b3a", pants="#3a2e26", skin="#c9905f", hat="none", hair="moi", shorts=True, torn=True,
                       face="grin", bigears=True, patch="#b5893f"),
    "chang_bim":  dict(shirt="#d8cfb8", pants="#2b2622", skin="#c48c64", hat="none", hair="bim", torn=True, face="grin",
                       patch="#6d8a9c"),
    "ong_rach":   dict(shirt="#6e5a44", pants="#3a3430", skin="#b88360", hat="none", hair="moi", stoop=0.15, torn=True,
                       face="stubble", bigears=True, patch="#a33a2a"),
    "co_bim":     dict(shirt="#a0522d", pants="#1f1c1a", skin="#e0ac86", hat="none", hair="sidebraid", face="cheeks",
                       torn=True, patch="#e0c060"),
    # ---- villagers with animals (the animal itself walks next to them in the game)
    "dat_trau":   dict(shirt="#4a5a3a", pants="#2b2622", skin="#b9825a", hat="nonla", hair="short", carry="rope", torn=True,
                       patch="#8a6a3a"),
    "om_heo":     dict(shirt="#7a4a2a", pants="#2b2622", skin="#c48c64", hat="khanvan", hair="short", carry="pig",
                       face="grin"),
    "chan_vit":   dict(shirt="#3f6e8c", pants="#3a2e26", skin="#d9a27a", hat="nonla", hair="moi", shorts=True, bighead=True,
                       prop="pole", torn=True, patch="#c9a24a"),
    "ong_giao":   dict(shirt="#2f2a28", pants="#efe9dc", skin="#d6a680", hat="khanxep", hair="short", robe=True,
                       shoes=True, glasses=True, prop="book"),
}


def build_villager(out, name, o):
    reset()
    mat("Skin", o["skin"], 0.6)
    mat("Shirt", o["shirt"], 0.9)
    mat("Pants", o["pants"], 0.9)
    mat("Hair", "#1c1714", 0.8)
    mat("Eye", "#1b1410", 0.3)
    mat("Hat", "#e6d3a0", 0.8)
    mat("Cloth", o.get("cloth", "#1f1b18"), 0.85)
    mat("Wood", "#7a5a36", 0.8)
    mat("Basket", "#a5824c", 0.9)
    mat("Veg", "#5f9a3a", 0.8)
    mat("Sandal", "#3a2a1c", 0.8)
    mat("Gold", o.get("belt", "#d4a93a"), 0.4, 0.6)
    mat("Red", "#b8322a", 0.7)
    mat("Metal", "#c9c9c9", 0.3, 0.8)
    mat("Paper", "#ece0bf", 0.9)
    mat("Sack", "#9c8a62", 0.95)
    mat("Patch", o.get("patch", "#8a7a5a"), 0.95)
    mat("Teeth", "#f6f1e4", 0.4)
    mat("Cheek", "#e8806e", 0.7)
    mat("Scalp", "#8f7766", 0.7)
    mat("Rope", "#b89a64", 0.95)
    mat("Bamboo", "#a99a5a", 0.8)
    mat("Pig", "#eeaaa0", 0.7)
    mat("PigDark", "#b8685f", 0.7)

    HIPZ, NECKZ = 0.66, 1.1
    hr = 0.19 if o.get("bighead") else 0.165
    HZ = NECKZ + 0.08 + hr
    robe = o.get("robe")

    for s, g in ((-1, "LegL"), (1, "LegR")):
        group(g)
        x = 0.09 * s
        if o.get("shorts"):
            limb("Pants", (x, 0, HIPZ), (x, 0, 0.42), 0.072, caps=False)
            limb("Skin", (x, 0, 0.44), (x, 0, 0.07), 0.045)
        elif o.get("torn") and s < 0:
            # one trouser leg ripped off above the knee, frayed
            limb("Pants", (x, 0, HIPZ), (x, 0, 0.36), 0.07, 0.066, caps=False)
            for k in range(7):
                a = k * math.tau / 7
                cone("Pants", (x + math.cos(a) * 0.062, math.sin(a) * 0.062, 0.35), 0.022, 0.0, 0.05 + (k % 3) * 0.025,
                     rot=(math.pi, 0, 0), seg=5)
            limb("Skin", (x, 0, 0.38), (x, 0, 0.07), 0.042)
        else:
            limb("Pants", (x, 0, HIPZ), (x, 0, 0.1), 0.07, 0.062, caps=False)
            limb("Skin" if not o.get("shoes") else "Pants", (x, 0, 0.12), (x, 0, 0.06), 0.042, caps=False)
            if o.get("torn"):
                box("Patch", (x, -0.066, 0.38), (0.085, 0.02, 0.09), rot=(0, 0.25, 0))   # knee patch
        if o.get("shoes"):
            sphere("Cloth", (x, -0.04, 0.04), 0.055, (0.95, 1.7, 0.6))
        else:
            sphere("Skin", (x, -0.04, 0.04), 0.05, (0.9, 1.6, 0.6))
            cyl("Sandal", (x, -0.04, 0.01), 0.065, 0.02, scale=(0.85, 1.55, 1))

    group("Body")
    cyl("Pants", (0, 0, HIPZ + 0.02), 0.17, 0.1)
    if robe:
        cone("Shirt", (0, 0, 0.58), 0.34, 0.19, 0.92)          # long áo thụng / áo the
        cone("Shirt", (0, 0, 0.14), 0.35, 0.34, 0.04)
    else:
        cone("Shirt", (0, 0, 0.86), 0.2, 0.165, 0.46)
        cone("Shirt", (0, 0, 0.62), 0.215, 0.2, 0.06)
    if o.get("torn") and not robe:
        box("Patch", (0.085, -0.178, 0.93), (0.1, 0.02, 0.1), rot=(0.1, 0.35, 0.25))     # patches
        box("Patch", (-0.06, 0.18, 0.8), (0.12, 0.02, 0.09), rot=(-0.1, -0.2, 0.15))
        sphere("Skin", (-0.085, -0.183, 0.76), 0.036, (1.0, 0.3, 0.8))                    # holes
        sphere("Skin", (0.16, -0.08, 0.98), 0.03, (0.3, 1.0, 0.9))
        for k in range(12):                                                               # ragged hem
            a = k * math.tau / 12
            cone("Shirt", (math.cos(a) * 0.205, math.sin(a) * 0.205, 0.6), 0.032, 0.0, 0.04 + ((k * 7) % 4) * 0.022,
                 rot=(math.pi, 0, 0), seg=5)
    if o.get("belly"):
        sphere("Shirt", (0, -0.06, 0.82), 0.22, (1.0, 0.95, 1.0))
    if o.get("belt"):
        torus("Gold", (0, 0, 0.8), 0.22 if o.get("belly") else (0.215 if robe else 0.19), 0.025,
              scale=(1, 1.15 if o.get("belly") else 1, 1))
    sphere("Shirt", (0, 0, 1.06), 0.19, (1.05, 0.85, 0.42))
    cyl("Skin", (0, 0, 1.12), 0.05, 0.1)
    if o.get("sack"):
        sphere("Sack", (0.04, 0.2, 0.98), 0.2, (1.0, 0.8, 1.25))
        torus("Wood", (0.04, 0.2, 1.2), 0.06, 0.012)
        limb("Wood", (0.15, -0.12, 1.08), (0.1, 0.12, 1.18), 0.008, caps=False)

    if o.get("carry") == "ganh":
        limb("Wood", (0.2, 0.75, 1.17), (0.2, -0.75, 1.17), 0.018, caps=False)
        for yy in (0.68, -0.68):
            for dx in (-0.1, 0.1):
                limb("Wood", (0.2, yy, 1.16), (0.2 + dx, yy, 0.55), 0.005, caps=False)
            cone("Basket", (0.2, yy, 0.47), 0.11, 0.15, 0.16)
            for k in range(5):
                a = k * 1.25
                sphere("Veg", (0.2 + math.cos(a) * 0.06, yy + math.sin(a) * 0.06, 0.57), 0.06, (1, 1, 0.6))

    if o.get("carry") == "pig":
        held_pig((0.0, -0.3, 0.86), 0.8)

    group("Head")
    sphere("Skin", (0, 0, HZ), hr, (1.0, 0.95, 1.08), seg=24, rings=14)
    for s in (-1, 1):
        sphere("Skin", (hr * s, 0.01, HZ - 0.01), 0.038, (0.5, 0.9, 1.1))
        sphere("Eye", (hr * 0.36 * s, -hr * 0.9, HZ + 0.02), 0.02, (1, 0.6, 0.8))
        brow_rot = (0, -0.3 * s, 0) if o.get("face") in ("mandarin", "stubble") else (0, 0, 0)
        sphere("Hair", (hr * 0.38 * s, -hr * 0.87, HZ + 0.065), 0.024, (1.5, 0.5, 0.4), rot=brow_rot)
    sphere("Skin", (0, -hr * 0.98, HZ - 0.02), 0.028)
    sphere("Eye", (0, -hr * 0.93, HZ - 0.075), 0.018, (1.4, 0.5, 0.35))  # mouth
    face = o.get("face")
    if face in ("mandarin", "mustache"):
        for s in (-1, 1):  # handlebar moustache
            sphere("Hair", (0.035 * s, -hr * 0.97, HZ - 0.045), 0.018, (2.2, 0.6, 0.5), rot=(0, 0.35 * s, 0))
            sphere("Hair", (0.075 * s, -hr * 0.9, HZ - 0.035), 0.012, (1.6, 0.6, 0.6), rot=(0, -0.7 * s, 0))
    if face == "mandarin":
        sphere("Hair", (0, -hr * 0.9, HZ - 0.13), 0.02, (0.8, 0.6, 1.8))
    if face == "grin":   # buck teeth + rosy cheeks
        sphere("Eye", (0, -hr * 0.93, HZ - 0.078), 0.03, (1.5, 0.5, 0.55))
        for s in (-1, 1):
            box("Teeth", (0.013 * s, -hr * 0.99, HZ - 0.078), (0.022, 0.012, 0.034))
    if face in ("grin", "cheeks"):
        for s in (-1, 1):
            sphere("Cheek", (hr * 0.58 * s, -hr * 0.78, HZ - 0.035), 0.032, (1, 0.45, 0.75))
    if o.get("bigears"):
        for s in (-1, 1):
            sphere("Skin", (hr * 1.08 * s, 0.01, HZ), 0.06, (0.45, 0.95, 1.25), rot=(0, 0, -0.25 * s))
    if face == "stubble":
        sphere("Hair", (0, -hr * 0.55, HZ - 0.09), hr * 0.62, (1.05, 0.7, 0.5))
        sphere("Skin", (0, -hr * 0.9, HZ - 0.06), 0.03, (1.4, 0.5, 0.5))
    if o.get("glasses"):
        for s in (-1, 1):
            torus("Eye", (hr * 0.36 * s, -hr * 0.97, HZ + 0.02), 0.032, 0.005, rot=(math.pi / 2, 0, 0), seg=16, minor=4)
        limb("Eye", (-0.03, -hr * 0.99, HZ + 0.025), (0.03, -hr * 0.99, HZ + 0.025), 0.004, caps=False, seg=4)

    hair = o.get("hair")
    if hair in ("short", "bun", "braid"):
        sphere("Hair", (0, 0.025, HZ + 0.03), hr * 1.04, (1.0, 0.98, 0.95), seg=20)
    if hair == "bun":
        sphere("Hair", (0, 0.16, HZ + 0.02), 0.07)
    if hair == "braid":
        for k in range(6):
            sphere("Hair", (0, 0.15 + k * 0.012, HZ - 0.05 - k * 0.07), 0.04 - k * 0.003)
    if hair in ("moi", "bim"):
        sphere("Scalp", (0, 0.03, HZ + 0.035), hr * 1.0, (1.0, 0.98, 0.95), seg=20)   # shaved head
    if hair == "moi":   # tóc moi: one silly tuft on the forehead
        for dx, ln, tilt in ((0, 0.13, -0.35), (-0.025, 0.1, -0.6), (0.025, 0.1, -0.1)):
            cone("Hair", (dx, -hr * 0.55, HZ + hr * 0.82), 0.026, 0.0, ln, rot=(tilt, dx * 6, 0), seg=6)
        sphere("Hair", (0, -hr * 0.55, HZ + hr * 0.8), 0.035, (1.2, 1, 0.6))
    if hair == "bim":   # one long braid hanging down the back
        sphere("Hair", (0, hr * 0.55, HZ + hr * 0.75), 0.05)
        for k in range(9):
            sphere("Hair", (0, hr * 0.85 + k * 0.012, HZ + hr * 0.45 - k * 0.075), 0.034 - k * 0.0015, (1, 1, 1.3))
        sphere("Red", (0, hr * 0.85 + 0.11, HZ + hr * 0.45 - 0.7), 0.03, (1.4, 1, 0.6))
    if hair == "sidebraid":   # girl: hair + one big braid over the shoulder with a red bow
        sphere("Hair", (0, 0.025, HZ + 0.03), hr * 1.04, (1.0, 0.98, 0.95), seg=20)
        for k in range(8):
            sphere("Hair", (hr * 0.85 + k * 0.006, -0.05 - k * 0.012, HZ - 0.06 - k * 0.07), 0.042 - k * 0.002, (1, 1, 1.25))
        for s in (-1, 1):
            sphere("Red", (hr * 0.85 + 0.05 + 0.04 * s, -0.16, HZ - 0.62), 0.035, (1.3, 0.5, 0.9), rot=(0, 0.6 * s, 0))
    if hair == "tuft":
        sphere("Hair", (0, -0.1, HZ + hr * 0.9), 0.05, (1, 1.2, 0.7))

    hat = o.get("hat")
    if hat == "nonla":
        cone("Hat", (0, 0, HZ + hr * 0.75), 0.32, 0.0, 0.2, seg=24)
        cyl("Cloth", (0, 0, HZ + hr * 0.62), hr * 0.95, 0.025)
    elif hat == "khanmoqua":
        sphere("Cloth", (0, 0.04, HZ + 0.07), 0.18, (1.06, 1.05, 0.8), seg=20)
        cone("Cloth", (0, -0.08, HZ + 0.19), 0.05, 0.0, 0.08, rot=(-0.6, 0, 0))
        cone("Cloth", (0, 0.1, HZ - 0.1), 0.12, 0.02, 0.18, rot=(0.3, 0, 0), scale=(1, 0.6, 1))
    elif hat in ("khanvan", "khanxep"):
        torus("Cloth", (0, 0.01, HZ + 0.08), hr * 0.97, 0.035, scale=(1, 1, 1.2))
        sphere("Cloth", (0, 0.02, HZ + 0.1), hr * 0.92, (1, 1, 0.55))
        if hat == "khanxep":
            torus("Cloth", (0, 0.01, HZ + 0.13), hr * 0.92, 0.03, scale=(1, 1, 1.2))
    elif hat == "canhchuon":  # mũ cánh chuồn of a mandarin
        cyl("Cloth", (0, 0.01, HZ + hr * 0.78), hr * 0.98, 0.14)
        torus("Gold", (0, 0.01, HZ + hr * 0.4), hr * 0.98, 0.014)
        box("Cloth", (0, 0.08, HZ + hr * 1.12), (hr * 1.7, 0.09, 0.14))
        for s in (-1, 1):
            limb("Cloth", (0.12 * s, 0.1, HZ + hr * 1.0), (0.26 * s, 0.1, HZ + hr * 1.1), 0.008, caps=False, seg=4)
            sphere("Cloth", (0.32 * s, 0.1, HZ + hr * 1.12), 0.08, (1.2, 0.12, 0.65))
            sphere("Gold", (0.32 * s, 0.11, HZ + hr * 1.12), 0.083, (1.05, 0.08, 0.5))
    elif hat == "nondau":  # nón dấu of a soldier
        cone("Cloth", (0, 0, HZ + hr * 0.82), 0.2, 0.05, 0.13, seg=20)
        cyl("Cloth", (0, 0, HZ + hr * 0.82 + 0.07), 0.05, 0.02)
        sphere("Red", (0, 0, HZ + hr * 0.82 + 0.1), 0.035)
        cone("Red", (0, 0, HZ + hr * 0.82 + 0.03), 0.07, 0.03, 0.08, seg=12)
    elif hat == "headband":
        torus("Red", (0, 0.0, HZ + 0.06), hr * 1.0, 0.018, rot=(0.15, 0, 0))
        sphere("Red", (0, hr * 0.98, HZ + 0.04), 0.03)
        for s in (-1, 1):
            cone("Red", (0.03 * s, hr * 1.05, HZ - 0.03), 0.02, 0.005, 0.12, rot=(0.4, 0.3 * s, 0), seg=6)

    SH = 1.05
    prop = o.get("prop")
    for s, g in ((-1, "ArmL"), (1, "ArmR")):
        group(g)
        sh = Vector((0.215 * s, 0, SH))
        sphere("Shirt", sh, 0.06)
        if g == "ArmR" and o.get("carry") == "ganh":
            elbow = Vector((0.27, -0.06, 0.86))
            hand = Vector((0.21, -0.03, 1.12))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Shirt", elbow, hand - Vector((0, 0, 0.05)), 0.05, 0.045)
            sphere("Skin", hand, 0.05)
        elif g == "ArmL" and o.get("carry") == "basket":
            elbow = Vector((-0.27, 0.0, 0.8))
            hand = Vector((-0.24, -0.15, 0.78))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Skin", elbow, hand, 0.04)
            sphere("Skin", hand, 0.05)
            cyl("Basket", (-0.3, -0.18, 0.74), 0.13, 0.12)
            for k in range(4):
                sphere("Veg", (-0.3 + math.cos(k * 1.6) * 0.06, -0.18 + math.sin(k * 1.6) * 0.06, 0.8), 0.05)
        elif g == "ArmR" and prop == "spear":
            hand = Vector((0.27, -0.1, 0.7))
            limb("Shirt", sh, hand + Vector((0, 0.03, 0.08)), 0.055, 0.05)
            sphere("Skin", hand, 0.05)
            limb("Wood", (0.27, -0.12, 0.04), (0.27, -0.12, 2.0), 0.015, caps=False, seg=6)
            cone("Metal", (0.27, -0.12, 2.1), 0.035, 0.0, 0.2, seg=8)
            sphere("Red", (0.27, -0.12, 1.98), 0.045, (1, 1, 0.8))
        elif g == "ArmR" and prop == "parasol":
            elbow = Vector((0.29, -0.12, 0.9))
            hand = Vector((0.2, -0.25, 1.18))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Shirt", elbow, hand, 0.05, 0.045)
            sphere("Skin", hand, 0.05)
            top = Vector((0.12, -0.55, 2.3))
            limb("Wood", Vector((0.21, -0.22, 0.75)), top, 0.016, caps=False, seg=6)
            cone("Red", top + Vector((0, 0, -0.02)), 0.62, 0.06, 0.26, seg=20)
            torus("Gold", top + Vector((0, 0, -0.15)), 0.6, 0.022, seg=24, minor=6)
            for k in range(12):
                a = k * math.tau / 12
                cone("Gold", top + Vector((math.cos(a) * 0.6, math.sin(a) * 0.6, -0.22)), 0.025, 0.0, 0.1,
                     rot=(math.pi, 0, 0), seg=6)
            sphere("Gold", top + Vector((0, 0, 0.14)), 0.04)
        elif g == "ArmL" and prop in ("ledger", "book"):
            elbow = Vector((-0.28, 0.0, 0.82))
            hand = Vector((-0.2, -0.2, 0.86))
            limb("Shirt", sh, elbow, 0.06 if robe else 0.055, 0.08 if robe else 0.05)
            limb("Shirt", elbow, hand, 0.075 if robe else 0.05, 0.06 if robe else 0.045)
            sphere("Skin", hand, 0.05)
            box("Cloth" if prop == "ledger" else "Red", (-0.17, -0.25, 0.92), (0.14, 0.04, 0.19))
            box("Paper", (-0.17, -0.25, 0.92), (0.13, 0.045, 0.17))
        elif o.get("carry") == "pig":
            # both arms hug the pig in front of the belly
            elbow = Vector((0.25 * s, -0.12, 0.84))
            hand = Vector((0.15 * s, -0.36, 0.9))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Shirt", elbow, hand, 0.05, 0.045)
            sphere("Skin", hand, 0.05)
        elif g == "ArmR" and o.get("carry") == "rope":
            elbow = Vector((0.27, -0.12, 0.86))
            hand = Vector((0.23, -0.32, 0.84))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Shirt", elbow, hand, 0.05, 0.045)
            sphere("Skin", hand, 0.05)
            torus("Rope", (0.26, -0.28, 0.74), 0.07, 0.012, rot=(0.3, 1.3, 0))   # coil of rope
            limb("Rope", (0.23, -0.34, 0.84), (0.24, -0.4, 0.78), 0.012, caps=False, seg=5)
        elif g == "ArmR" and prop == "pole":
            elbow = Vector((0.28, -0.08, 0.86))
            hand = Vector((0.26, -0.24, 0.92))
            limb("Shirt", sh, elbow, 0.055, 0.05)
            limb("Shirt", elbow, hand, 0.05, 0.045)
            sphere("Skin", hand, 0.05)
            limb("Bamboo", (0.27, 0.35, 0.55), (0.3, -1.25, 1.75), 0.016, caps=False, seg=6)
            cone("Red", (0.3, -1.22, 1.7), 0.06, 0.0, 0.2, rot=(1.0, 0, 0), scale=(1, 0.2, 1), seg=4)   # rag flag
        else:
            hand = Vector((0.25 * s, 0, 0.62))
            if robe:
                limb("Shirt", sh, hand + Vector((0, 0, 0.07)), 0.06, 0.1)  # wide sleeves
            else:
                limb("Shirt", sh, hand + Vector((0, 0, 0.07)), 0.055, 0.05)
            sphere("Skin", hand, 0.05, (0.85, 0.85, 1.1))

    stoop = o.get("stoop", 0)
    if stoop:
        M = rot_about((0, 0, HIPZ), stoop, "X")
        transform_groups(["Body", "Head", "ArmL", "ArmR"], M)
    Mv = rot_about((0, 0, HIPZ), stoop, "X")
    finalize(name, {
        "Body": ((0, 0, HIPZ), None),
        "Head": (tuple(Mv @ Vector((0, 0, NECKZ))), "Body"),
        "ArmL": (tuple(Mv @ Vector((-0.215, 0, SH))), "Body"),
        "ArmR": (tuple(Mv @ Vector((0.215, 0, SH))), "Body"),
        "LegL": ((-0.09, 0, HIPZ), None),
        "LegR": ((0.09, 0, HIPZ), None),
    })
    export(f"{out}/villager_{name}.glb")


# =====================================================================  CHICKENS
def held_pig(at, k=1.0):
    """A small pig lying sideways in someone's arms (Body group of the carrier). Head points to +x."""
    ox, oy, oz = at

    def P(x, y, z):  # pig local (forward = -y) turned so it faces +x
        return (ox - y * k, oy + x * k, oz + z * k)

    def S(sx, sy, sz):
        return (sy, sx, sz)
    sphere("Pig", P(0, 0, 0), 0.17 * k, S(0.95, 1.45, 0.9))
    sphere("Pig", P(0, -0.27, 0.04), 0.12 * k, S(1, 1.05, 0.95))
    sphere("PigDark", P(0, -0.4, 0.02), 0.06 * k, S(1.05, 0.55, 0.9))
    for s in (-1, 1):
        sphere("PigDark", P(0.022 * s, -0.43, 0.02), 0.012 * k)
        sphere("Eye", P(0.05 * s, -0.36, 0.08), 0.013 * k)
        sphere("Pig", P(0.07 * s, -0.24, 0.15), 0.045 * k, S(0.9, 0.35, 1.2))
        for yy in (-0.12, 0.13):
            limb("Pig", P(0.08 * s, yy, -0.08), P(0.1 * s, yy - 0.03, -0.2), 0.03 * k)
            sphere("PigDark", P(0.1 * s, yy - 0.03, -0.22), 0.025 * k)
    torus("PigDark", P(0, 0.26, 0.06), 0.03 * k, 0.008 * k, seg=12, minor=4)


def build_buffalo(out):
    """Con trâu: big grey water buffalo with crescent horns. Forward is -y; legs swing, head and tail move."""
    reset()
    mat("Buf", "#4d4b4e", 0.9)
    mat("BufLight", "#76716f", 0.9)
    mat("BufDark", "#262426", 0.7)
    mat("Horn", "#d9cdb2", 0.6)
    mat("Eye", "#120e0c", 0.3)
    mat("Rope", "#b89a64", 0.95)
    group("Body")
    sphere("Buf", (0, 0.05, 0.95), 0.4, (0.95, 1.7, 0.82))
    sphere("Buf", (0, -0.45, 1.02), 0.36, (1.0, 1.0, 0.95))       # shoulders
    sphere("Buf", (0, 0.55, 0.97), 0.33, (1.0, 1.0, 0.95))        # rump
    sphere("BufLight", (0, 0.0, 0.75), 0.3, (0.8, 1.6, 0.45))      # belly
    sphere("Buf", (0, -0.78, 1.03), 0.24, (0.95, 1.1, 1.0))        # neck
    LEGS = {"LegFL": (-0.2, -0.5), "LegFR": (0.2, -0.5), "LegBL": (-0.2, 0.55), "LegBR": (0.2, 0.55)}
    for g, (x, y) in LEGS.items():
        group(g)
        limb("Buf", (x, y, 0.85), (x, y + 0.02, 0.38), 0.1, 0.075)
        limb("Buf", (x, y + 0.02, 0.38), (x, y, 0.08), 0.065, 0.058)
        cyl("BufDark", (x, y - 0.01, 0.04), 0.068, 0.08)
    group("Head")
    sphere("Buf", (0, -1.02, 0.98), 0.2, (0.95, 1.35, 1.0), rot=(0.5, 0, 0))
    sphere("BufLight", (0, -1.22, 0.83), 0.13, (1.05, 0.95, 0.85))
    for s in (-1, 1):
        sphere("BufDark", (0.045 * s, -1.33, 0.82), 0.022)
        sphere("Eye", (0.13 * s, -1.08, 1.04), 0.024)
        cone("Buf", (0.2 * s, -0.95, 1.08), 0.05, 0.01, 0.16, rot=(0, math.pi / 2 * s, 0), scale=(1, 0.5, 1))   # ears
        pts = [(0.09 * s, -0.98, 1.15), (0.3 * s, -0.95, 1.17), (0.48 * s, -0.83, 1.24), (0.52 * s, -0.65, 1.36), (0.42 * s, -0.55, 1.47)]
        for i in range(len(pts) - 1):   # crescent horns
            limb("Horn", pts[i], pts[i + 1], 0.055 - i * 0.012, 0.055 - (i + 1) * 0.012)
    torus("Rope", (0, -1.33, 0.78), 0.035, 0.008, rot=(0, math.pi / 2, 0), seg=12, minor=4)   # nose ring
    group("Tail")
    limb("Buf", (0, 0.86, 1.08), (0, 0.97, 0.75), 0.03, 0.022)
    limb("Buf", (0, 0.97, 0.75), (0, 0.99, 0.48), 0.022, 0.018)
    sphere("BufDark", (0, 0.99, 0.42), 0.04, (1, 1, 1.6))
    spec = {"Body": ((0, 0, 0), None), "Head": ((0, -0.82, 1.05), "Body"), "Tail": ((0, 0.86, 1.08), "Body")}
    for g, (x, y) in LEGS.items():
        spec[g] = ((x, y, 0.85), None)
    finalize("Trau", spec)
    export(f"{out}/buffalo.glb")


def build_pig(out, name, body, dark, spots=False):
    reset()
    mat("Pig", body, 0.75)
    mat("PigDark", dark, 0.7)
    mat("Eye", "#120e0c", 0.3)
    group("Body")
    sphere("Pig", (0, 0.02, 0.3), 0.22, (1.0, 1.5, 0.9))
    sphere("Pig", (0, 0.02, 0.22), 0.2, (0.95, 1.35, 0.7))        # saggy belly
    if spots:
        for (x, y, z, r) in ((0.15, 0.1, 0.38, 0.09), (-0.12, -0.12, 0.42, 0.08), (0.05, 0.25, 0.4, 0.07)):
            sphere("PigDark", (x, y, z), r, (1, 1, 0.5))
    torus("PigDark", (0, 0.34, 0.38), 0.035, 0.009, rot=(math.pi / 2, 0, 0), seg=12, minor=4)   # curly tail
    LEGS = {"LegFL": (-0.11, -0.17), "LegFR": (0.11, -0.17), "LegBL": (-0.11, 0.2), "LegBR": (0.11, 0.2)}
    for g, (x, y) in LEGS.items():
        group(g)
        limb("Pig", (x, y, 0.2), (x, y, 0.03), 0.045, 0.035)
        cyl("PigDark", (x, y, 0.02), 0.036, 0.04)
    group("Head")
    sphere("Pig", (0, -0.37, 0.34), 0.15, (1, 1.05, 0.95))
    cyl("PigDark", (0, -0.52, 0.31), 0.065, 0.06, rot=(math.pi / 2, 0, 0))
    for s in (-1, 1):
        sphere("Eye", (0.025 * s, -0.555, 0.31), 0.012)
        sphere("Eye", (0.065 * s, -0.49, 0.39), 0.015)
        sphere("Pig", (0.1 * s, -0.33, 0.47), 0.05, (0.9, 0.35, 1.25), rot=(0.5, 0, 0.4 * s))   # floppy ears
    spec = {"Body": ((0, 0, 0), None), "Head": ((0, -0.28, 0.34), "Body")}
    for g, (x, y) in LEGS.items():
        spec[g] = ((x, y, 0.2), None)
    finalize(name, spec)
    export(f"{out}/{name}.glb")


def build_duck(out, name, body, head):
    reset()
    mat("Feather", body, 0.85)
    mat("HeadF", head, 0.6)
    mat("Bill", "#f0a02a", 0.6)
    mat("Eye", "#111111", 0.3)
    group("Body")
    sphere("Feather", (0, 0.02, 0.16), 0.11, (0.85, 1.35, 0.8))
    cone("Feather", (0, 0.15, 0.2), 0.05, 0.0, 0.1, rot=(-1.0, 0, 0), scale=(1, 0.5, 1), seg=8)   # tail
    for s in (-1, 1):
        sphere("Feather", (0.085 * s, 0.03, 0.18), 0.07, (0.35, 1.0, 0.6))                         # wings
        limb("Bill", (0.035 * s, 0.0, 0.08), (0.035 * s, -0.01, 0.01), 0.008, caps=False, seg=5)
        sphere("Bill", (0.035 * s, -0.035, 0.008), 0.03, (0.9, 1.2, 0.2))                           # webbed feet
    group("Head")
    limb("HeadF", (0, -0.1, 0.2), (0, -0.12, 0.3), 0.035, 0.03)
    sphere("HeadF", (0, -0.12, 0.33), 0.055, (0.95, 1.1, 1.0))
    sphere("Bill", (0, -0.19, 0.315), 0.035, (1.0, 1.5, 0.4))
    for s in (-1, 1):
        sphere("Eye", (0.035 * s, -0.15, 0.35), 0.008)
    finalize(name, {"Body": ((0, 0, 0), None), "Head": ((0, -0.1, 0.2), "Body")})
    export(f"{out}/{name}.glb")


def build_chicken(out, name, body, tail, rooster=False):
    reset()
    mat("Feather", body, 0.9)
    mat("Tail", tail, 0.8)
    mat("Comb", "#d1302a", 0.6)
    mat("Beak", "#e8b23a", 0.6)
    mat("Eye", "#111111", 0.3)
    group("Body")
    sphere("Feather", (0, 0.02, 0.2), 0.12, (0.9, 1.25, 0.95))
    for s in (-1, 1):
        sphere("Tail", (0.09 * s, 0.03, 0.21), 0.08, (0.35, 1.0, 0.7))
        limb("Beak", (0.04 * s, 0.0, 0.11), (0.04 * s, -0.01, 0.0), 0.009, caps=False, seg=5)
        for a in (-0.5, 0, 0.5):
            limb("Beak", (0.04 * s, -0.01, 0.005), (0.04 * s + math.sin(a) * 0.04, -0.01 - math.cos(a) * 0.04, 0.005),
                 0.006, caps=False, seg=4)
    n = 5 if rooster else 3
    for k in range(n):
        a = -0.5 + k * (1.0 / max(1, n - 1))
        cone("Tail", (math.sin(a) * 0.04, 0.17, 0.3 + (0.04 if rooster else 0)), 0.04, 0.0, 0.18 if rooster else 0.12,
             rot=(-0.7, a * 0.6, 0), scale=(0.4, 1, 1))
    group("Head")
    sphere("Feather", (0, -0.1, 0.32), 0.065, (0.9, 1.0, 1.4))
    sphere("Feather", (0, -0.13, 0.4), 0.055)
    for k in range(3 if rooster else 2):
        sphere("Comb", (0, -0.12 + k * 0.025, 0.46 - abs(k - 1) * 0.01), 0.022 if rooster else 0.016)
    cone("Beak", (0, -0.195, 0.4), 0.018, 0.0, 0.05, rot=(math.pi / 2, 0, 0), seg=8)
    sphere("Comb", (0, -0.17, 0.36), 0.015, (0.7, 0.7, 1.3))
    for s in (-1, 1):
        sphere("Eye", (0.035 * s, -0.16, 0.415), 0.009)
    finalize(name, {"Body": ((0, 0, 0), None), "Head": ((0, -0.09, 0.28), "Body")})
    export(f"{out}/{name}.glb")


# =====================================================================  CẬU VÀNG STANDING (dance)
def build_cau_vang_dance(out):
    """Cậu Vàng on his hind legs, with sunglasses + gold chain, for the hip-hop dance."""
    reset()
    mat("Dog", "#c27a12", 0.85)
    mat("DogCream", "#ecc98a", 0.85)
    mat("DogDark", "#1e1612", 0.4)
    mat("Mouth", "#5a1f1f", 0.6)
    mat("Tongue", "#d9667a", 0.5)
    mat("Shades", "#141414", 0.15, 0.3)
    mat("Gold", "#e8c041", 0.3, 0.9)
    mat("Cap", "#d23b30", 0.7)

    HIP = 0.2
    group("Body")
    sphere("Dog", (0, 0.0, 0.25), 0.11, (1.0, 0.95, 1.0))
    sphere("Dog", (0, 0.0, 0.42), 0.1, (0.95, 0.85, 1.35))
    sphere("DogCream", (0, -0.07, 0.42), 0.075, (0.75, 0.5, 1.2))
    for k in range(10):  # gold chain
        a = -1.2 + k * 0.27
        sphere("Gold", (math.sin(a) * 0.075, -math.cos(a) * 0.075 - 0.02, 0.56 - (1 - abs(a) / 1.2) * 0.07), 0.016)
    sphere("Gold", (0, -0.1, 0.47), 0.03, (1, 0.5, 1))

    HD = 0.68
    group("Head")
    sphere("Dog", (0, -0.02, HD), 0.085, (1, 0.95, 0.95), seg=20, rings=12)
    sphere("DogCream", (0, -0.1, HD - 0.015), 0.045, (0.95, 1.3, 0.6))
    sphere("DogDark", (0, -0.155, HD), 0.016, (1.2, 1, 0.9))
    sphere("Mouth", (0, -0.09, HD - 0.045), 0.03, (0.85, 1.3, 0.45))
    for s in (-1, 1):
        cone("Dog", (0.05 * s, -0.01, HD + 0.08), 0.032, 0.004, 0.08, rot=(0, 0.3 * s, 0), scale=(1, 0.5, 1))
        sphere("Shades", (0.036 * s, -0.09, HD + 0.03), 0.026, (1.2, 0.35, 0.8))
    box("Shades", (0, -0.1, HD + 0.04), (0.11, 0.01, 0.012))
    # backwards cap
    sphere("Cap", (0, 0.0, HD + 0.06), 0.075, (1, 1, 0.6))
    cyl("Cap", (0, 0.08, HD + 0.06), 0.05, 0.012, rot=(math.pi / 2 - 0.3, 0, 0), scale=(1.2, 1, 1))

    group("Jaw")
    sphere("DogCream", (0, -0.09, HD - 0.06), 0.034, (0.85, 1.35, 0.45))
    sphere("Tongue", (0, -0.1, HD - 0.05), 0.02, (0.8, 1.2, 0.35))

    for s, g in ((-1, "ArmL"), (1, "ArmR")):
        group(g)
        limb("Dog", (0.08 * s, -0.02, 0.5), (0.13 * s, -0.04, 0.33), 0.026)
        sphere("DogCream", (0.13 * s, -0.05, 0.31), 0.03)
    for s, g in ((-1, "LegL"), (1, "LegR")):
        group(g)
        limb("Dog", (0.07 * s, 0, HIP), (0.08 * s, 0.0, 0.05), 0.035)
        sphere("DogCream", (0.08 * s, -0.04, 0.025), 0.035, (1, 1.6, 0.6))

    group("Tail")
    for i, (x, y, z, r) in enumerate([(0.0, 0.1, 0.22, 0.03), (0.02, 0.15, 0.27, 0.027), (0.03, 0.17, 0.33, 0.022), (0.02, 0.15, 0.38, 0.018)]):
        sphere("Dog" if i < 3 else "DogCream", (x, y, z), r)

    finalize("CauVangDance", {
        "Body": ((0, 0, HIP), None),
        "Head": ((0, 0, 0.56), "Body"),
        "Jaw": ((0, -0.05, HD - 0.04), "Head"),
        "ArmL": ((-0.08, -0.02, 0.5), "Body"),
        "ArmR": ((0.08, -0.02, 0.5), "Body"),
        "LegL": ((-0.07, 0, HIP), None),
        "LegR": ((0.07, 0, HIP), None),
        "Tail": ((0, 0.09, 0.22), "Body"),
    })
    export(f"{out}/cau_vang_dance.glb")


def build_all(out):
    build_lao_hac(out)
    build_cau_vang(out)
    build_cau_vang_dance(out)
    for n, o in VILLAGERS.items():
        build_villager(out, n, o)
    build_chicken(out, "chicken_hen", "#efe6d2", "#c9b48a")
    build_chicken(out, "chicken_rooster", "#a2471e", "#1f2b24", rooster=True)
    build_buffalo(out)
    build_pig(out, "pig_pink", "#eeaaa0", "#b8685f")
    build_pig(out, "pig_spot", "#f1dcc8", "#2a2422", spots=True)
    build_duck(out, "duck_white", "#f4f1e8", "#f4f1e8")
    build_duck(out, "duck_brown", "#8b6b45", "#2f5a3a")
