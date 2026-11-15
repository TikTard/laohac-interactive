"""Build a stylized Lão Hạc (thin old farmer) and his dog Cậu Vàng in Blender.

Run:
  "D:\\Blender 5.2\\blender.exe" --background --python build_lao_hac.py -- <output_dir>

Outputs: lao_hac.glb, lao_hac.blend, lao_hac_preview.png
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.dirname(__file__))
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


MATS = {}


def mat(name, hexcol, rough=0.75):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(hexcol)
    bsdf.inputs["Roughness"].default_value = rough
    MATS[name] = m


mat("Skin", "#b9825a", 0.6)
mat("Shirt", "#7a5636", 0.9)
mat("Patch1", "#5c6b4a", 0.9)
mat("Patch2", "#a07f58", 0.9)
mat("Pants", "#3d2f25", 0.9)
mat("Hair", "#cfcac0", 0.95)
mat("Eye", "#1b1410", 0.3)
mat("Bamboo", "#b8a060", 0.6)
mat("BambooNode", "#8a7440", 0.6)
mat("Dog", "#c27a12", 0.85)
mat("DogCream", "#ecc98a", 0.85)
mat("DogDark", "#1e1612", 0.4)

parts = []


def finish(obj, m):
    obj.data.materials.append(MATS[m])
    for p in obj.data.polygons:
        p.use_smooth = True
    parts.append(obj)
    return obj


def sphere(m, loc, r, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cyl(m, loc, r, depth, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cone(m, loc, r_bottom, r_top, depth, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r_bottom, radius2=r_top, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def torus(m, loc, R, r, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=48, minor_segments=16, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cube(m, loc, size, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    o.data.materials.append(MATS[m])
    parts.append(o)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o


# =====================  LÃO HẠC  =====================
# Front faces -Y, feet at Z=0. Thin, slightly hunched.

# ---- legs (bare feet) ----
for s in (-1, 1):
    x = 0.085 * s
    cone("Pants", (x, 0, 0.45), 0.07, 0.078, 0.42)
    torus("Pants", (x, 0, 0.24), 0.062, 0.018)              # rolled cuff
    cyl("Skin", (x, 0, 0.13), 0.036, 0.22)                  # thin shin
    sphere("Skin", (x, -0.045, 0.03), 0.05, (0.9, 1.7, 0.6))  # bare foot

upper_start = len(parts)

# ---- torso: ragged shirt ----
cyl("Pants", (0, 0, 0.68), 0.155, 0.1)
cone("Shirt", (0, 0, 0.88), 0.18, 0.145, 0.46)
sphere("Shirt", (0, 0, 1.08), 0.17, (1.05, 0.85, 0.4))
cone("Shirt", (0, 0, 0.63), 0.195, 0.18, 0.06)
# torn hem flaps
for i, a in enumerate((-2.4, -1.2, -0.4, 0.9, 2.0)):
    r = 0.19
    cone("Shirt", (math.cos(a) * r, math.sin(a) * r, 0.585), 0.03, 0.0, 0.07,
         rot=(math.pi, 0, 0), scale=(1.4, 0.6, 1))
# patches
cube("Patch1", (0.07, -0.168, 0.8), 0.07, (1, 0.12, 0.9), rot=(0.08, 0, 0.1))
cube("Patch2", (-0.1, -0.165, 0.97), 0.055, (1, 0.12, 1), rot=(0.08, 0, -0.15))
# open collar showing skinny chest
cone("Skin", (0, -0.12, 1.06), 0.05, 0.02, 0.12, rot=(math.pi + 0.15, 0, 0), scale=(1, 0.4, 1))

# ---- arms (thin) ----
for s in (-1, 1):
    th = -0.12 * s
    cx, cz, L = 0.215 * s, 0.86, 0.36
    cone("Shirt", (cx, 0, cz + 0.02), 0.05, 0.055, L - 0.04, rot=(0, th, 0))
    sphere("Shirt", (cx + math.sin(th) * L / 2, 0, cz + math.cos(th) * L / 2), 0.058)
    bx = cx - math.sin(th) * L / 2
    bz = cz - math.cos(th) * L / 2
    cyl("Skin", (bx, 0, bz - 0.03), 0.032, 0.1, rot=(0, th, 0))
    sphere("Skin", (bx + 0.004 * s, -0.01, bz - 0.1), 0.045, (0.8, 0.8, 1.15))

# ---- head ----
cyl("Skin", (0, 0, 1.16), 0.045, 0.12)
HZ = 1.31
sphere("Skin", (0, 0, HZ), 0.155, (0.95, 0.95, 1.12))
for s in (-1, 1):
    sphere("Skin", (0.15 * s, 0.01, HZ - 0.01), 0.038, (0.5, 0.9, 1.15))       # ears
    sphere("Skin", (0.075 * s, -0.115, HZ - 0.07), 0.04, (1, 0.6, 0.7))         # cheekbones
sphere("Skin", (0, -0.155, HZ - 0.02), 0.03, (0.9, 0.9, 1.15))                 # nose

# sad eyes + drooping eyebrows
for s in (-1, 1):
    sphere("Eye", (0.052 * s, -0.138, HZ + 0.02), 0.018, (1, 0.6, 0.5))
    sphere("Hair", (0.06 * s, -0.132, HZ + 0.062), 0.026, (1.6, 0.6, 0.45), rot=(0, 0.35 * s, 0))

# messy grey hair: tufts around the top/back of the head
tufts = [
    (0, 0.35, 0.07), (30, 0.4, 0.065), (-30, 0.4, 0.065), (65, 0.55, 0.06), (-65, 0.55, 0.06),
    (100, 0.6, 0.065), (-100, 0.6, 0.065), (140, 0.55, 0.07), (-140, 0.55, 0.07), (180, 0.5, 0.075),
    (160, 0.85, 0.06), (-160, 0.85, 0.06), (120, 0.95, 0.055), (-120, 0.95, 0.055),
    (90, 1.0, 0.05), (-90, 1.0, 0.05), (180, 1.05, 0.06), (15, 0.15, 0.055), (-20, 0.2, 0.05),
]
for az_deg, pol, r in tufts:
    az = math.radians(az_deg + 90)  # az 0 = front (-Y)
    rad = 0.15
    x = math.cos(az) * math.sin(pol) * rad * 0.95
    y = -math.sin(az) * math.sin(pol) * rad * 0.95
    z = HZ + math.cos(pol) * rad * 1.12
    sphere("Hair", (x, y + 0.01, z), r, (1.2, 1.0, 0.75),
           rot=(math.cos(az) * 0.4, math.sin(az) * 0.4, az))

# scraggly beard + thin moustache
for s in (-1, 1):
    sphere("Hair", (0.04 * s, -0.152, HZ - 0.075), 0.026, (1.6, 0.6, 0.5), rot=(0, -0.55 * s, 0))
for x, y, z, r, sz, rx in [
    (0, -0.12, HZ - 0.13, 0.06, 1.2, -0.2),
    (-0.045, -0.11, HZ - 0.15, 0.035, 1.5, -0.1),
    (0.045, -0.11, HZ - 0.15, 0.035, 1.5, -0.1),
    (0.01, -0.13, HZ - 0.22, 0.035, 1.6, -0.3),
    (-0.02, -0.13, HZ - 0.25, 0.025, 1.6, -0.2),
    (0.075, -0.08, HZ - 0.12, 0.03, 1.4, 0),
    (-0.075, -0.08, HZ - 0.12, 0.03, 1.4, 0),
]:
    sphere("Hair", (x, y, z), r, (1.0, 0.7, sz), rot=(rx, 0, 0))

# ---- hunch: tilt upper body forward around the hips ----
pivot = Vector((0, 0, 0.66))
R = Matrix.Translation(pivot) @ Matrix.Rotation(0.3, 4, "X") @ Matrix.Translation(-pivot)
for o in parts[upper_start:]:
    o.matrix_world = R @ o.matrix_world

# ---- điếu cày (bamboo water pipe) resting by his right hand ----
PX, PY = 0.27, -0.07
cyl("Bamboo", (PX, PY, 0.42), 0.032, 0.8)
for z in (0.12, 0.38, 0.64):
    torus("BambooNode", (PX, PY, z), 0.032, 0.006)
cyl("Bamboo", (PX, PY - 0.05, 0.23), 0.009, 0.12, rot=(0.9, 0, 0))   # nõ (bowl stem)
cyl("BambooNode", (PX, PY - 0.1, 0.27), 0.017, 0.035, rot=(0.9, 0, 0))  # bowl

lao_hac = join(parts, "LaoHac")

# =====================  CẬU VÀNG (sitting dog)  =====================
parts = []
sphere("Dog", (0, 0.06, 0.12), 0.12, (1.0, 1.15, 0.85))                     # haunches
sphere("Dog", (0, -0.03, 0.25), 0.095, (0.9, 0.9, 1.45), rot=(0.3, 0, 0))   # chest
sphere("DogCream", (0, -0.1, 0.25), 0.07, (0.7, 0.45, 1.25), rot=(0.3, 0, 0))
for s in (-1, 1):
    cyl("Dog", (0.045 * s, -0.09, 0.1), 0.024, 0.2)                          # front legs
    sphere("DogCream", (0.045 * s, -0.11, 0.015), 0.03, (1, 1.4, 0.6))       # paws
    sphere("Dog", (0.095 * s, -0.01, 0.03), 0.04, (0.8, 1.8, 0.55))          # hind feet
HD = 0.43
sphere("Dog", (0, -0.07, HD), 0.085, (1, 0.95, 0.95))                        # head
sphere("DogCream", (0, -0.15, HD - 0.03), 0.045, (0.95, 1.3, 0.8))           # snout
sphere("DogDark", (0, -0.207, HD - 0.015), 0.016, (1.2, 1, 0.9))             # nose
for s in (-1, 1):
    sphere("DogDark", (0.035 * s, -0.142, HD + 0.025), 0.013)                # eyes
    cone("Dog", (0.05 * s, -0.06, HD + 0.08), 0.032, 0.004, 0.08,
         rot=(0, 0.3 * s, 0), scale=(1, 0.5, 1))                             # pointy ears
# curled tail
for i, (x, y, z, r) in enumerate([(0.0, 0.19, 0.08, 0.035), (0.04, 0.23, 0.13, 0.03),
                                  (0.06, 0.22, 0.19, 0.025), (0.05, 0.18, 0.23, 0.02)]):
    sphere("Dog" if i < 3 else "DogCream", (x, y, z), r)

dog = join(parts, "CauVang")
dog.location = (-0.42, -0.18, 0)
dog.rotation_euler = (0, 0, 0.45)

# ---------- export ----------
bpy.ops.object.select_all(action="DESELECT")
lao_hac.select_set(True)
dog.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "lao_hac.glb"), export_format="GLB", use_selection=True)

# ---------- preview staging ----------
mat("Ground", "#c9a77c", 0.95)
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1.8, fill_type="NGON", location=(0, 0, 0))
bpy.context.object.data.materials.append(MATS["Ground"])

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#e8dcc8")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

bpy.ops.object.light_add(type="SUN", location=(2, -2, 4))
sun = bpy.context.object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
bpy.ops.object.light_add(type="AREA", location=(-1.5, -1.8, 1.6))
fill = bpy.context.object
fill.data.energy = 120
fill.data.size = 2
fill.rotation_euler = (math.radians(65), 0, math.radians(-40))

bpy.ops.object.empty_add(location=(-0.12, 0, 0.68))
target = bpy.context.object
bpy.ops.object.camera_add(location=(1.1, -3.0, 1.25))
cam = bpy.context.object
cam.data.lens = 50
c = cam.constraints.new("TRACK_TO")
c.target = target
c.track_axis = "TRACK_NEGATIVE_Z"
c.up_axis = "UP_Y"
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 64
scene.render.resolution_x = 1000
scene.render.resolution_y = 1200
scene.render.filepath = os.path.join(OUT, "lao_hac_preview.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "lao_hac.blend"))
print("DONE ->", OUT)
