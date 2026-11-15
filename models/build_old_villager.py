"""Build a stylized old Vietnamese villager in Blender.

Run:
  "D:\\Blender 5.2\\blender.exe" --background --python build_old_villager.py -- <output_dir>

Outputs: old_villager.glb, old_villager.blend, old_villager_preview.png
"""
import bpy, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.dirname(__file__))
os.makedirs(OUT, exist_ok=True)

# ---------- reset scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(hexstr):
    """Hex sRGB -> linear RGBA for Blender materials."""
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


MATS = {}


def mat(name, hexcol, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(hexcol)
    bsdf.inputs["Roughness"].default_value = rough
    MATS[name] = m
    return m


mat("Skin", "#d9a27a", 0.6)
mat("Shirt", "#8a5a36", 0.85)
mat("Pants", "#4a3324", 0.85)
mat("White", "#f2efe8", 0.9)
mat("Eye", "#1b1410", 0.3)
mat("Button", "#2e2018", 0.5)
mat("Sandal", "#3a2a1c", 0.8)
mat("Wood", "#6b4a2b", 0.8)
mat("Scarf", "#2f5d50", 0.8)

parts = []


def finish(obj, m, smooth=True):
    obj.data.materials.append(MATS[m])
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    parts.append(obj)
    return obj


def sphere(m, loc, r, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r,
                                         location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cyl(m, loc, r, depth, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def cone(m, loc, r_bottom, r_top, depth, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r_bottom, radius2=r_top,
                                    depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


def torus(m, loc, R, r, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=48, minor_segments=16,
                                     location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return finish(o, m)


# Front of the character faces -Y. Feet at Z=0.

# ---------- legs ----------
for s in (-1, 1):
    x = 0.1 * s
    cone("Pants", (x, 0, 0.43), 0.085, 0.09, 0.46)          # rolled-up trousers
    torus("Pants", (x, 0, 0.21), 0.075, 0.022)               # rolled cuff
    cyl("Skin", (x, 0, 0.13), 0.048, 0.18)                  # shin
    sphere("Skin", (x, -0.04, 0.04), 0.055, (0.9, 1.6, 0.6))  # foot
    cyl("Sandal", (x, -0.04, 0.01), 0.07, 0.02, scale=(0.85, 1.55, 1))

# ---------- body ----------
cyl("Pants", (0, 0, 0.67), 0.19, 0.1)                       # hips
cone("Shirt", (0, 0, 0.86), 0.215, 0.17, 0.48)              # ao ba ba torso
sphere("Shirt", (0, 0, 1.08), 0.2, (1.05, 0.85, 0.42))      # rounded shoulders
cone("Shirt", (0, 0, 0.6), 0.23, 0.215, 0.06)               # shirt hem flare

# buttons down the front
for i, z in enumerate((1.02, 0.92, 0.82, 0.72)):
    t = (z - 0.62) / 0.48
    r = 0.215 + (0.17 - 0.215) * t
    sphere("Button", (0, -r - 0.004, z), 0.014)

# scarf (khan) around the neck
torus("Scarf", (0, 0, 1.13), 0.085, 0.03)

# ---------- arms ----------
for s in (-1, 1):
    th = -0.14 * s  # tilt so hands sit slightly outward
    cx, cz, L = 0.255 * s, 0.88, 0.4
    cone("Shirt", (cx, 0, cz), 0.06, 0.065, L, rot=(0, th, 0))  # sleeve
    sphere("Shirt", (cx + math.sin(th) * L / 2, 0, cz + math.cos(th) * L / 2), 0.068)  # shoulder
    bx = cx - math.sin(th) * L / 2
    bz = cz - math.cos(th) * L / 2
    cyl("Skin", (bx, 0, bz - 0.04), 0.04, 0.08, rot=(0, th, 0))  # wrist
    sphere("Skin", (bx + 0.005 * s, -0.01, bz - 0.1), 0.05, (0.85, 0.8, 1.1))  # hand

# walking stick in the right hand (+X side)
cyl("Wood", (0.29, -0.05, 0.36), 0.016, 0.72)
sphere("Wood", (0.29, -0.05, 0.73), 0.026)

# ---------- head ----------
cyl("Skin", (0, 0, 1.17), 0.055, 0.1)                       # neck
HZ = 1.34
sphere("Skin", (0, 0, HZ), 0.17, (1.0, 0.95, 1.08))         # head
for s in (-1, 1):
    sphere("Skin", (0.168 * s, 0.01, HZ - 0.01), 0.04, (0.5, 0.9, 1.1))  # ears
sphere("Skin", (0, -0.165, HZ - 0.03), 0.032, (1, 0.9, 1))  # nose

# eyes (gentle squint) + eyebrows
for s in (-1, 1):
    sphere("Eye", (0.058 * s, -0.148, HZ + 0.02), 0.02, (1, 0.6, 0.55))
    sphere("White", (0.065 * s, -0.142, HZ + 0.065), 0.028,
           (1.7, 0.7, 0.45), rot=(0, 0.25 * s, 0))

# white hair ring around the back and sides (bald on top)
sphere("White", (0, 0.035, HZ - 0.03), 0.165, (1.1, 1.0, 0.62))

# moustache
for s in (-1, 1):
    sphere("White", (0.045 * s, -0.162, HZ - 0.07), 0.03,
           (1.8, 0.7, 0.6), rot=(0, -0.45 * s, 0))

# long tapered goatee beard
sphere("White", (0, -0.11, HZ - 0.11), 0.095, (1.0, 0.6, 0.6))   # chin fluff
sphere("White", (0, -0.125, HZ - 0.2), 0.075, (0.85, 0.5, 1.3), rot=(-0.2, 0, 0))
sphere("White", (0, -0.14, HZ - 0.3), 0.04, (0.8, 0.6, 1.4), rot=(-0.25, 0, 0))  # tip

# ---------- join into one object ----------
bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
villager = bpy.context.object
villager.name = "OldVillager"
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# ---------- export GLB (character only) ----------
bpy.ops.object.select_all(action="DESELECT")
villager.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "old_villager.glb"),
                          export_format="GLB", use_selection=True)

# ---------- preview staging ----------
mat("Ground", "#c9a77c", 0.95)
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1.6, fill_type="NGON", location=(0, 0, 0))
ground = bpy.context.object
ground.data.materials.append(MATS["Ground"])

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

bpy.ops.object.empty_add(location=(0, 0, 0.8))
target = bpy.context.object
bpy.ops.object.camera_add(location=(1.25, -2.7, 1.25))
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
scene.render.resolution_x = 900
scene.render.resolution_y = 1200
scene.render.filepath = os.path.join(OUT, "old_villager_preview.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "old_villager.blend"))
print("DONE ->", OUT)
