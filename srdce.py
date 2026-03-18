import math

import bpy
from mathutils import Vector


# -----------------------------
# Scene reset and utilities
# -----------------------------
def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for datablock in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for block in list(datablock):
            if block.users == 0:
                datablock.remove(block)


def new_collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
    if parent is None:
        if col.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(col)
    else:
        if col.name not in parent.children:
            parent.children.link(col)
    return col


def move_to_collection(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def smooth(obj):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True


def add_bevel(obj, width=0.02, segments=2):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"


def make_principled_mat(
    name,
    base=(0.8, 0.8, 0.8, 1.0),
    metallic=0.0,
    roughness=0.5,
    emission=(0, 0, 0, 1),
    emission_strength=0.0,
):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Emission Color"].default_value = emission
    bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def set_material(obj, mat):
    if obj.type == "MESH":
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
    elif obj.type == "CURVE":
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)


def add_pipe(name, points, radius, col, mat):
    curve_data = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 24
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 8

    spline = curve_data.splines.new(type="BEZIER")
    spline.bezier_points.add(len(points) - 1)

    for i, p in enumerate(points):
        bp = spline.bezier_points[i]
        bp.co = Vector(p)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"

    obj = bpy.data.objects.new(name, curve_data)
    col.objects.link(obj)
    set_material(obj, mat)
    return obj


def add_area_light(name, location, rotation, power, size, color, col):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = power
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    col.objects.link(obj)
    return obj


# -----------------------------
# Build scene
# -----------------------------
reset_scene()
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

world = scene.world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.02, 0.025, 0.03, 1.0)
bg.inputs[1].default_value = 0.8

# Collections
root_col = new_collection("SCENE_MECH_HEART")
room_col = new_collection("GEO_ROOM", root_col)
asset_col = new_collection("GEO_ASSET_HEART", root_col)
conn_col = new_collection("GEO_CONNECTORS", root_col)
light_col = new_collection("LIGHTS", root_col)
cam_col = new_collection("CAMERAS", root_col)

# Materials
mat_wall = make_principled_mat("M_Wall", base=(0.17, 0.18, 0.20, 1), metallic=0.0, roughness=0.85)
mat_floor = make_principled_mat("M_Floor", base=(0.11, 0.12, 0.13, 1), metallic=0.0, roughness=0.65)
mat_metal = make_principled_mat("M_Metal", base=(0.55, 0.58, 0.62, 1), metallic=1.0, roughness=0.28)
mat_dark_metal = make_principled_mat("M_DarkMetal", base=(0.22, 0.24, 0.27, 1), metallic=1.0, roughness=0.36)
mat_core = make_principled_mat(
    "M_Core",
    base=(0.08, 0.10, 0.12, 1),
    metallic=0.2,
    roughness=0.18,
    emission=(0.95, 0.15, 0.12, 1),
    emission_strength=4.0,
)
mat_pipe = make_principled_mat("M_Pipe", base=(0.38, 0.41, 0.45, 1), metallic=1.0, roughness=0.22)

# Room geometry (simple, precise)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.05), scale=(5.5, 4.0, 0.05))
floor = bpy.context.active_object
floor.name = "Room_Floor"
move_to_collection(floor, room_col)
set_material(floor, mat_floor)
add_bevel(floor, width=0.01, segments=2)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -4.0, 2.0), scale=(5.5, 0.08, 2.0))
wall_back = bpy.context.active_object
wall_back.name = "Room_Wall_Back"
move_to_collection(wall_back, room_col)
set_material(wall_back, mat_wall)

bpy.ops.mesh.primitive_cube_add(size=1, location=(-5.5, 0, 2.0), scale=(0.08, 4.0, 2.0))
wall_left = bpy.context.active_object
wall_left.name = "Room_Wall_Left"
move_to_collection(wall_left, room_col)
set_material(wall_left, mat_wall)

bpy.ops.mesh.primitive_cube_add(size=1, location=(5.5, 0, 2.0), scale=(0.08, 4.0, 2.0))
wall_right = bpy.context.active_object
wall_right.name = "Room_Wall_Right"
move_to_collection(wall_right, room_col)
set_material(wall_right, mat_wall)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 4.0), scale=(5.5, 4.0, 0.08))
ceiling = bpy.context.active_object
ceiling.name = "Room_Ceiling"
move_to_collection(ceiling, room_col)
set_material(ceiling, mat_wall)

# Asset root
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 1.35))
asset_root = bpy.context.active_object
asset_root.name = "ASSET_MechanicalHeart"
move_to_collection(asset_root, asset_col)

# Heart body
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(-0.42, 0, 1.48), segments=48, ring_count=24)
lobe_l = bpy.context.active_object
lobe_l.name = "Heart_Lobe_L"
lobe_l.scale = (0.88, 0.65, 1.05)
lobe_l.parent = asset_root
move_to_collection(lobe_l, asset_col)
set_material(lobe_l, mat_metal)
smooth(lobe_l)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(0.42, 0, 1.48), segments=48, ring_count=24)
lobe_r = bpy.context.active_object
lobe_r.name = "Heart_Lobe_R"
lobe_r.scale = (0.88, 0.65, 1.05)
lobe_r.parent = asset_root
move_to_collection(lobe_r, asset_col)
set_material(lobe_r, mat_metal)
smooth(lobe_r)

bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.9, location=(0, 0, 1.05), vertices=48)
core_chamber = bpy.context.active_object
core_chamber.name = "Heart_CoreChamber"
core_chamber.parent = asset_root
move_to_collection(core_chamber, asset_col)
set_material(core_chamber, mat_core)
smooth(core_chamber)

bpy.ops.mesh.primitive_torus_add(
    location=(0, 0, 1.35), major_radius=1.08, minor_radius=0.06, major_segments=64, minor_segments=20
)
ring = bpy.context.active_object
ring.name = "Heart_SupportRing"
ring.parent = asset_root
move_to_collection(ring, asset_col)
set_material(ring, mat_dark_metal)
smooth(ring)

# Struts
strut_points = [(-0.95, -0.7), (0.95, -0.7), (-0.95, 0.7), (0.95, 0.7)]
for i, (x, y) in enumerate(strut_points, 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=1.35, location=(x, y, 0.68), vertices=24)
    s = bpy.context.active_object
    s.name = f"Heart_Strut_{i:02d}"
    s.parent = asset_root
    move_to_collection(s, asset_col)
    set_material(s, mat_dark_metal)

# Pipes to interior
pipe_specs = [
    ("Pipe_A", [(-0.25, 0.1, 2.1), (-1.2, -1.8, 2.7), (-4.8, -3.6, 2.4)], 0.055),
    ("Pipe_B", [(0.25, 0.1, 2.1), (1.3, -1.6, 2.8), (4.8, -3.6, 2.5)], 0.055),
    ("Pipe_C", [(-0.45, -0.1, 1.2), (-2.1, 1.5, 1.0), (-5.0, 3.2, 1.4)], 0.065),
    ("Pipe_D", [(0.45, -0.1, 1.2), (2.1, 1.4, 1.0), (5.0, 3.2, 1.5)], 0.065),
    ("Pipe_E", [(0.0, 0.0, 0.85), (0.0, -2.0, 0.5), (0.0, -3.7, 0.25)], 0.050),
]
for name, points, rad in pipe_specs:
    add_pipe(name, points, rad, conn_col, mat_pipe)

# Simple endpoint ports
port_locations = [(-4.8, -3.6, 2.4), (4.8, -3.6, 2.5), (-5.0, 3.2, 1.4), (5.0, 3.2, 1.5), (0.0, -3.7, 0.25)]
for i, loc in enumerate(port_locations, 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.11, depth=0.18, location=loc, vertices=24)
    p = bpy.context.active_object
    p.name = f"Port_{i:02d}"
    p.rotation_euler = (math.radians(90), 0, 0)
    move_to_collection(p, conn_col)
    set_material(p, mat_dark_metal)

# Lights (professional simple 3-point + practical top)
add_area_light(
    "Key_Light",
    location=(3.6, -3.8, 3.2),
    rotation=(math.radians(62), 0, math.radians(35)),
    power=1400,
    size=2.0,
    color=(1.0, 0.97, 0.92),
    col=light_col,
)
add_area_light(
    "Fill_Light",
    location=(-3.4, 2.2, 2.1),
    rotation=(math.radians(75), 0, math.radians(-145)),
    power=520,
    size=2.6,
    color=(0.78, 0.86, 1.0),
    col=light_col,
)
add_area_light(
    "Rim_Light",
    location=(0.0, 3.6, 2.6),
    rotation=(math.radians(100), 0, math.radians(180)),
    power=900,
    size=1.5,
    color=(0.85, 0.92, 1.0),
    col=light_col,
)
add_area_light(
    "Top_Practical",
    location=(0.0, 0.0, 3.85),
    rotation=(math.radians(180), 0, 0),
    power=320,
    size=1.2,
    color=(1.0, 0.96, 0.88),
    col=light_col,
)

# Camera + focus target
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 1.45))
focus = bpy.context.active_object
focus.name = "CAM_Focus_Heart"
move_to_collection(focus, cam_col)

cam_data = bpy.data.cameras.new("CAM_Main_Data")
cam_obj = bpy.data.objects.new("CAM_Main", cam_data)
cam_col.objects.link(cam_obj)
cam_obj.location = (5.2, -4.9, 2.35)
cam_data.lens = 38
cam_data.sensor_width = 36.0
cam_data.clip_start = 0.05
cam_data.clip_end = 200.0
cam_data.dof.use_dof = True
cam_data.dof.focus_object = focus
cam_data.dof.aperture_fstop = 3.2
cam_data.shift_x = 0.05
cam_data.shift_y = 0.02

track = cam_obj.constraints.new(type="TRACK_TO")
track.target = focus
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

scene.camera = cam_obj

# Mark asset root as asset (optional, if supported)
if hasattr(asset_root, "asset_mark"):
    asset_root.asset_mark()
    if asset_root.asset_data:
        asset_root.asset_data.description = "Mechanical heart core for indoor sci-fi interior."
        asset_root.asset_data.author = "Studio Pipeline"
        asset_root.asset_data.tags.new("mechanical")
        asset_root.asset_data.tags.new("heart")
        asset_root.asset_data.tags.new("indoor")
        asset_root.asset_data.tags.new("sci-fi")

print("Mechanical heart indoor scene created successfully.")
