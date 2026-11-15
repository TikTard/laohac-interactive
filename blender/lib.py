"""Shared helpers for building stylized low-poly assets in Blender (Z up, front = -Y).

Parts are collected into named *groups*. `finalize()` joins each group into one mesh,
moves its origin to a pivot point and parents it, so the game can animate e.g. a
head, an arm or a tail by rotating that node. Exported glTF converts to Y-up, front = +Z.
"""
import bpy, math, os
from mathutils import Vector, Matrix

MATS = {}
GROUPS = {}
_CUR = ["Main"]


# ---------------------------------------------------------------- scene / materials
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    GROUPS.clear()
    group("Main")


def srgb(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def mat(name, hexcol, rough=0.85, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = srgb(hexcol)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    MATS[name] = m
    return m


def group(name):
    _CUR[0] = name
    GROUPS.setdefault(name, [])


# ---------------------------------------------------------------- primitives
def _finish(o, m, smooth=True):
    o.data.materials.append(MATS[m])
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    GROUPS[_CUR[0]].append(o)
    return o


def sphere(m, loc, r, scale=(1, 1, 1), rot=(0, 0, 0), seg=16, rings=10, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return _finish(o, m, smooth)


def blob(m, loc, r, scale=(1, 1, 1), rot=(0, 0, 0), sub=1):
    """Faceted icosphere - stylized foliage."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return _finish(o, m, smooth=False)


def cyl(m, loc, r, depth, rot=(0, 0, 0), scale=(1, 1, 1), seg=16, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return _finish(o, m, smooth)


def cone(m, loc, r_bottom, r_top, depth, rot=(0, 0, 0), scale=(1, 1, 1), seg=16, smooth=True):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r_bottom, radius2=r_top, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return _finish(o, m, smooth)


def torus(m, loc, R, r, rot=(0, 0, 0), scale=(1, 1, 1), seg=24, minor=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=minor, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    return _finish(o, m)


def box(m, loc, size, rot=(0, 0, 0)):
    """Axis box; size = (sx, sy, sz) full dimensions."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    return _finish(o, m, smooth=False)


def plane(m, loc, size, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (size[0], size[1], 1)
    return _finish(o, m, smooth=False)


def limb(m, p0, p1, r, r1=None, caps=True, seg=12):
    """Cylinder (or tapered cone) from p0 to p1, with optional rounded ends."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    rot = d.to_track_quat("Z", "Y").to_euler()
    mid = (p0 + p1) / 2
    if r1 is None:
        o = cyl(m, mid, r, d.length, rot=rot, seg=seg)
    else:
        o = cone(m, mid, r, r1, d.length, rot=rot, seg=seg)
    if caps:
        sphere(m, p0, r, seg=seg, rings=8)
        sphere(m, p1, r if r1 is None else r1, seg=seg, rings=8)
    return o


def mesh(m, verts, faces, name="mesh", smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return _finish(o, m, smooth)


def solidify(o, thickness):
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thickness
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean_cut(target, cutter):
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for lst in GROUPS.values():
        if cutter in lst:
            lst.remove(cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)


def hip_roof(m, x0, x1, y0, y1, z_eave, z_ridge, ridge_inset, thickness=0.15):
    """Hip roof over rectangle [x0,x1]x[y0,y1]; ridge runs along X."""
    yc = (y0 + y1) / 2
    v = [(x0, y0, z_eave), (x1, y0, z_eave), (x1, y1, z_eave), (x0, y1, z_eave),
         (x0 + ridge_inset, yc, z_ridge), (x1 - ridge_inset, yc, z_ridge)]
    f = [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)]
    o = mesh(m, v, f, "roof")
    solidify(o, thickness)
    return o


def transform_groups(names, M):
    for n in names:
        for o in GROUPS.get(n, []):
            o.matrix_world = M @ o.matrix_world


def rot_about(pivot, angle, axis):
    p = Vector(pivot)
    return Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-p)


# ---------------------------------------------------------------- finalize / export
def _join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    return o


def finalize(root_name, spec=None, root_loc=(0, 0, 0)):
    """spec: {group: (pivot_xyz, parent_group_or_None)}. Returns the root empty."""
    spec = spec or {}
    bpy.ops.object.empty_add(location=root_loc)
    root = bpy.context.object
    root.name = root_name
    made = {}
    for gname, objs in GROUPS.items():
        if not objs:
            continue
        o = _join(objs, gname)
        pivot = spec.get(gname, ((0, 0, 0), None))[0]
        bpy.context.scene.cursor.location = pivot
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        made[gname] = o
    bpy.context.scene.cursor.location = (0, 0, 0)
    for gname, o in made.items():
        parent_name = spec.get(gname, (None, None))[1]
        parent = made.get(parent_name, root) if parent_name else root
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return root


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False,
                              export_yup=True, export_apply=True)
    print("EXPORTED", path)
