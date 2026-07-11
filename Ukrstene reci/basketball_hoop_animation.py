import bpy
import math
from pathlib import Path
from mathutils import Vector


BASE_DIR = Path(__file__).resolve().parent
ASSET_DIR = BASE_DIR / "assets"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def find_asset(stem):
    for ext in [".glb", ".gltf", ".fbx", ".obj", ".blend"]:
        path = ASSET_DIR / f"{stem}{ext}"
        if path.exists():
            return path
    return None


def import_asset(path, name):
    before = set(bpy.context.scene.objects)

    if path.suffix.lower() in [".glb", ".gltf"]:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif path.suffix.lower() == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
    elif path.suffix.lower() == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=str(path))
        else:
            bpy.ops.import_scene.obj(filepath=str(path))
    elif path.suffix.lower() == ".blend":
        with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
            data_to.objects = data_from.objects
        for obj in data_to.objects:
            if obj:
                bpy.context.collection.objects.link(obj)
    else:
        raise ValueError(f"Unsupported model format: {path.suffix}")

    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for obj in imported:
        obj.parent = root
    root.name = name
    return root, imported


def normalize_imported_group(root, objects, target_location, target_size):
    meshes = [obj for obj in objects if hasattr(obj, "bound_box") and obj.type == "MESH"]
    if not meshes:
        root.location = target_location
        return root

    corners = []
    for obj in meshes:
        corners.extend([obj.matrix_world @ Vector(corner) for corner in obj.bound_box])
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    center = (min_v + max_v) * 0.5
    size = max((max_v - min_v).x, (max_v - min_v).y, (max_v - min_v).z)
    if size > 0:
        root.scale = (target_size / size, target_size / size, target_size / size)
    root.location = Vector(target_location) - center * root.scale.x
    return root


def make_mat(name, color, roughness=0.45, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if len(color) == 4 and color[3] < 1:
        bsdf.inputs["Alpha"].default_value = color[3]
        mat.blend_method = "BLEND"
        if hasattr(mat, "use_screen_refraction"):
            mat.use_screen_refraction = True
    return mat


def add_cube(name, loc, dims, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def add_court_line(name, points, mat, width=0.018):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    poly = curve.splines.new("POLY")
    poly.points.add(len(points) - 1)
    for point, co in zip(poly.points, points):
        point.co = (co[0], co[1], co[2], 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_arc_line(name, center, radius, start_deg, end_deg, mat, width=0.018, steps=72):
    points = []
    for i in range(steps + 1):
        t = i / steps
        ang = math.radians(start_deg + (end_deg - start_deg) * t)
        points.append((center[0] + radius * math.cos(ang), center[1] + radius * math.sin(ang), center[2]))
    return add_court_line(name, points, mat, width)


def set_key(obj, frame, loc=None, rot=None, scale=None):
    bpy.context.scene.frame_set(frame)
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert(data_path="location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert(data_path="scale", frame=frame)


def create_ball(mat_orange, mat_black, mat_highlight):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.28, location=(-3.0, 0, 2.7))
    ball = bpy.context.object
    ball.name = "Animated Basketball"
    ball.data.materials.append(mat_orange)

    # Basketball grooves: three torus bands around the ball.
    grooves = []
    for name, rot in [
        ("Groove horizontal", (math.pi / 2, 0, 0)),
        ("Groove vertical A", (0, math.pi / 2, 0)),
        ("Groove vertical B", (math.pi / 2, 0, math.pi / 2)),
    ]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.282,
            minor_radius=0.0075,
            major_segments=96,
            minor_segments=8,
            location=ball.location,
            rotation=rot,
        )
        groove = bpy.context.object
        groove.name = name
        groove.data.materials.append(mat_black)
        groove.parent = ball
        grooves.append(groove)

    # Curved seam diagonals for a more recognizable ball.
    for side in [-1, 1]:
        curve = bpy.data.curves.new(f"Curved seam {side}", "CURVE")
        curve.dimensions = "3D"
        curve.resolution_u = 2
        curve.bevel_depth = 0.006
        curve.bevel_resolution = 2
        poly = curve.splines.new("POLY")
        poly.points.add(48)
        for i, point in enumerate(poly.points):
            t = -1.05 + 2.1 * (i / 48)
            x = 0.16 * math.sin(t * math.pi) * side
            z = 0.24 * math.cos(t * 0.85)
            y = t * 0.11
            point.co = (x, y, z, 1)
        obj = bpy.data.objects.new(f"Curved seam {side}", curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mat_black)
        obj.parent = ball

    # Small pebbled dimples so the ball does not look like a plain orange sphere.
    for ring in [-0.18, -0.09, 0.0, 0.09, 0.18]:
        count = 14 if abs(ring) < 0.01 else 11
        ring_radius = math.sqrt(max(0.0, 0.25**2 - ring**2))
        for i in range(count):
            a = 2 * math.pi * i / count + ring * 3
            bpy.ops.mesh.primitive_uv_sphere_add(
                segments=8,
                ring_count=4,
                radius=0.012,
                location=(ring_radius * math.cos(a), ring_radius * math.sin(a), ring),
            )
            dot = bpy.context.object
            dot.name = "Basketball leather dot"
            dot.data.materials.append(mat_highlight)
            dot.parent = ball

    return ball


def create_hoop(mat_metal, mat_red, mat_glass, mat_blue, mat_white):
    # Backboard.
    board = add_cube("Blue glass backboard", (0, 0.42, 2.82), (2.25, 0.08, 1.35), mat_glass)

    # Colored border and shooter square.
    add_cube("Backboard top blue border", (0, 0.355, 3.51), (2.34, 0.03, 0.045), mat_blue)
    add_cube("Backboard bottom blue border", (0, 0.355, 2.13), (2.34, 0.03, 0.045), mat_blue)
    add_cube("Backboard left blue border", (-1.15, 0.355, 2.82), (0.045, 0.03, 1.38), mat_blue)
    add_cube("Backboard right blue border", (1.15, 0.355, 2.82), (0.045, 0.03, 1.38), mat_blue)

    # Target square.
    add_cube("Backboard target square red", (0, 0.355, 2.78), (0.74, 0.024, 0.055), mat_red)
    add_cube("Backboard target square red side L", (-0.36, 0.35, 2.58), (0.055, 0.024, 0.44), mat_red)
    add_cube("Backboard target square red side R", (0.36, 0.35, 2.58), (0.055, 0.024, 0.44), mat_red)
    add_cube("Backboard target square red bottom", (0, 0.35, 2.36), (0.74, 0.024, 0.055), mat_red)

    # Rim.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.43,
        minor_radius=0.025,
        major_segments=128,
        minor_segments=14,
        location=(0, 0, 2.45),
    )
    rim = bpy.context.object
    rim.name = "Basketball Rim"
    rim.data.materials.append(mat_red)

    # Support.
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.62, location=(0, 0.25, 2.45), rotation=(math.pi / 2, 0, 0))
    support = bpy.context.object
    support.name = "Rim support"
    support.data.materials.append(mat_metal)

    # Triangular brace below the rim, like a real wall-mounted hoop.
    for side in [-1, 1]:
        brace = make_net_strand(
            f"Rim triangular brace {side}",
            [(0.18 * side, 0.22, 2.42), (0.38 * side, 0.06, 2.18), (0.0, 0.34, 2.18)],
            mat_metal,
        )
        brace.data.bevel_depth = 0.018

    # Small hooks around the underside of the ring where the net attaches.
    for i in range(24):
        a = 2 * math.pi * i / 24
        x = 0.43 * math.cos(a)
        y = 0.43 * math.sin(a)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.026, location=(x, y, 2.405))
        hook = bpy.context.object
        hook.name = "Net rim hook"
        hook.data.materials.append(mat_metal)

    add_cube("Backboard wall bracket", (0, 0.61, 2.82), (0.32, 0.32, 0.18), mat_metal)
    add_cube("Backboard vertical pole", (0, 0.88, 1.55), (0.13, 0.13, 2.45), mat_metal)

    return rim


def make_net_strand(name, points, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = 0.007
    curve.bevel_resolution = 2
    poly = curve.splines.new("POLY")
    poly.points.add(len(points) - 1)
    for p, co in zip(poly.points, points):
        p.co = (co[0], co[1], co[2], 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def create_animated_net(mat_net):
    strands = []
    ring_count = 24
    levels = [
        (2.405, 0.43, 0.0),
        (2.28, 0.39, 0.5),
        (2.12, 0.34, 0.0),
        (1.96, 0.29, 0.5),
        (1.80, 0.23, 0.0),
    ]

    def net_point(level_index, slot):
        z, radius, offset = levels[level_index]
        angle = 2 * math.pi * (slot + offset) / ring_count
        return (radius * math.cos(angle), radius * math.sin(angle), z)

    # Top hanging cords from rim hooks.
    for i in range(ring_count):
        strands.append(make_net_strand(f"Net hanger {i + 1:02d}", [net_point(0, i), net_point(1, i)], mat_net))

    # Diamond lacing: alternating diagonal cords make a net that reads like real woven nylon.
    for level in range(len(levels) - 1):
        for i in range(ring_count):
            strands.append(make_net_strand(f"Net diamond A {level}-{i:02d}", [net_point(level, i), net_point(level + 1, i)], mat_net))
            strands.append(make_net_strand(f"Net diamond B {level}-{i:02d}", [net_point(level, i), net_point(level + 1, i - 1)], mat_net))

    # Bottom loose loop.
    bottom_points = [net_point(len(levels) - 1, i) for i in range(ring_count)]
    bottom_points.append(bottom_points[0])
    bottom_loop = make_net_strand("Net loose bottom loop", bottom_points, mat_net)
    bottom_loop.data.bevel_depth = 0.009
    strands.append(bottom_loop)

    # Animate a visible "swish": the lower net stretches down and opens as the ball passes.
    for obj in strands:
        base_points = [Vector((p.co.x, p.co.y, p.co.z)) for p in obj.data.splines[0].points]
        for frame, strength in [(1, 0.0), (34, 0.0), (45, 0.55), (58, 0.28), (72, 0.0), (95, 0.08), (120, 0.0)]:
            bpy.context.scene.frame_set(frame)
            for p, base in zip(obj.data.splines[0].points, base_points):
                radial = Vector((base.x, base.y, 0))
                if radial.length > 0:
                    radial.normalize()
                depth = max(0, 2.45 - base.z)
                wave = math.sin((base.z - 1.8) * 10 + frame * 0.22)
                moved = base + radial * strength * depth * 0.28 + Vector((0, 0, -strength * depth * 0.48 + wave * strength * 0.025))
                p.co = (moved.x, moved.y, moved.z, 1)
                p.keyframe_insert("co", frame=frame)

    return strands


def create_floor(mat_floor, mat_dark_wood, mat_line, mat_blue, mat_red):
    floor = add_cube("Court parquet", (0, 0, -0.025), (8.8, 5.4, 0.05), mat_floor)

    # Simple court plank lines.
    for x in [i * 0.35 - 4.2 for i in range(25)]:
        add_cube("Parquet seam length", (x, 0, 0.003), (0.012, 5.4, 0.006), mat_dark_wood)
    for y in [i * 0.45 - 2.25 for i in range(11)]:
        add_cube("Parquet seam width", (0, y, 0.004), (8.8, 0.01, 0.006), mat_dark_wood)

    # Painted court markings.
    z = 0.035
    add_court_line("Baseline", [(-4.25, -2.55, z), (4.25, -2.55, z), (4.25, 2.55, z), (-4.25, 2.55, z), (-4.25, -2.55, z)], mat_line)
    add_court_line("Center line", [(0, -2.55, z), (0, 2.55, z)], mat_line)
    add_arc_line("Center circle", (0, 0, z), 0.75, 0, 360, mat_line)

    add_cube("Painted key blue", (0, 0.08, 0.002), (1.45, 1.68, 0.012), mat_blue)
    add_court_line("Key border", [(-0.73, -0.76, z + 0.01), (0.73, -0.76, z + 0.01), (0.73, 0.92, z + 0.01), (-0.73, 0.92, z + 0.01), (-0.73, -0.76, z + 0.01)], mat_line)
    add_arc_line("Free throw semicircle", (0, -0.76, z + 0.012), 0.73, 180, 360, mat_line)
    add_arc_line("Three point arc", (0, 0, z + 0.014), 2.45, 205, 335, mat_line)

    add_cube("Red sponsor paint", (-2.7, 1.8, 0.004), (1.2, 0.36, 0.012), mat_red)
    add_cube("Red sponsor paint 2", (2.7, 1.8, 0.004), (1.2, 0.36, 0.012), mat_red)
    return floor


def create_arena_background(mat_wall, mat_dark, mat_blue, mat_red, mat_white, mat_yellow):
    add_cube("Arena back wall", (0, 2.78, 1.75), (9.6, 0.12, 3.55), mat_wall)
    add_cube("Arena side wall left", (-4.78, 0, 1.35), (0.12, 5.6, 2.7), mat_dark)
    add_cube("Arena side wall right", (4.78, 0, 1.35), (0.12, 5.6, 2.7), mat_dark)

    # Bleachers behind the basket.
    for row in range(4):
        y = 3.02 + row * 0.34
        z = 0.28 + row * 0.22
        add_cube(f"Bleacher row {row + 1}", (0, y, z), (8.2, 0.22, 0.16), mat_blue if row % 2 == 0 else mat_red)
        add_cube(f"Bleacher step {row + 1}", (0, y - 0.12, z - 0.08), (8.2, 0.04, 0.08), mat_dark)

    # Scoreboard and wall lights.
    add_cube("Scoreboard black panel", (0, 2.68, 3.25), (1.55, 0.05, 0.54), mat_dark)
    add_cube("Scoreboard HOME", (-0.38, 2.64, 3.32), (0.42, 0.025, 0.12), mat_red)
    add_cube("Scoreboard GUEST", (0.38, 2.64, 3.32), (0.42, 0.025, 0.12), mat_blue)
    add_cube("Scoreboard time strip", (0, 2.63, 3.15), (0.65, 0.025, 0.1), mat_yellow)

    font_curve = bpy.data.curves.new("Score text", "FONT")
    font_curve.body = "HOME 24   GUEST 21"
    font_curve.align_x = "CENTER"
    font_curve.align_y = "CENTER"
    font_curve.size = 0.11
    text = bpy.data.objects.new("Scoreboard text", font_curve)
    bpy.context.collection.objects.link(text)
    text.location = (-0.02, 2.615, 3.24)
    text.rotation_euler = (math.radians(90), 0, 0)
    text.data.materials.append(mat_white)

    for x in [-3.2, -1.6, 1.6, 3.2]:
        add_cube("Wall light panel", (x, 2.62, 3.62), (0.75, 0.03, 0.08), mat_yellow)


def load_external_court_or_fallback(mat_floor, mat_dark_wood, mat_white, mat_blue, mat_red):
    court_path = find_asset("court")
    if court_path:
        root, objects = import_asset(court_path, "Imported basketball court")
        normalize_imported_group(root, objects, (0, 0, 0), 8.6)
        print(f"Loaded court model: {court_path}")
        return root

    print("No assets/court model found. Using generated fallback court.")
    return create_floor(mat_floor, mat_dark_wood, mat_white, mat_blue, mat_red)


def load_external_ball_or_fallback(mat_orange, mat_black, mat_ball_highlight):
    ball_path = find_asset("basketball")
    if ball_path:
        root, objects = import_asset(ball_path, "Imported animated basketball")
        normalize_imported_group(root, objects, (-3.0, -0.12, 2.85), 0.56)
        print(f"Loaded basketball model: {ball_path}")
        return root

    print("No assets/basketball model found. Using generated fallback basketball.")
    return create_ball(mat_orange, mat_black, mat_ball_highlight)


def animate_ball(ball):
    path = [
        (1, (-3.0, -0.12, 2.85), (0, 0, 0)),
        (22, (-1.65, -0.08, 2.78), (3.2, 0.8, -1.0)),
        (38, (-0.48, -0.04, 2.62), (6.2, 1.6, -2.2)),
        (48, (0.02, 0.00, 2.54), (8.0, 2.0, -3.0)),
        (62, (0.18, 0.02, 1.72), (11.0, 2.7, -4.4)),
        (78, (0.35, 0.04, 0.29), (14.0, 3.4, -5.8)),
        (92, (0.65, 0.06, 1.05), (17.3, 4.0, -7.3)),
        (108, (0.95, 0.08, 0.29), (20.0, 4.6, -8.4)),
        (121, (1.18, 0.1, 0.68), (22.5, 5.0, -9.2)),
        (136, (1.42, 0.12, 0.29), (25.0, 5.4, -10.0)),
        (148, (1.6, 0.13, 0.47), (27.0, 5.7, -10.6)),
        (162, (1.78, 0.14, 0.29), (29.0, 6.0, -11.0)),
    ]
    for frame, loc, rot in path:
        set_key(ball, frame, Vector(loc), rot)

    action = ball.animation_data.action if ball.animation_data else None
    if action and hasattr(action, "fcurves"):
        for fc in action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"


def setup_camera_and_light():
    bpy.ops.object.light_add(type="AREA", location=(-1.8, -3.2, 5.0))
    light = bpy.context.object
    light.name = "Large softbox"
    light.data.energy = 850
    light.data.size = 4.8

    for x in [-2.6, 2.6]:
        bpy.ops.object.light_add(type="AREA", location=(x, 0.6, 4.2))
        court_light = bpy.context.object
        court_light.name = "Arena ceiling light"
        court_light.data.energy = 300
        court_light.data.size = 2.0

    bpy.ops.object.camera_add(location=(-3.55, -4.65, 2.45), rotation=(math.radians(67), 0, math.radians(-38)))
    cam = bpy.context.object
    bpy.context.scene.camera = cam

    # Aim camera at the hoop.
    target = Vector((0.08, 0.18, 1.75))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 29


def main():
    clear_scene()

    mat_orange = make_mat("Basketball orange leather", (1.0, 0.39, 0.055, 1), roughness=0.7)
    mat_ball_highlight = make_mat("Basketball leather dimples", (0.72, 0.19, 0.025, 1), roughness=0.82)
    mat_black = make_mat("Black rubber seams", (0.02, 0.015, 0.012, 1), roughness=0.75)
    mat_red = make_mat("Rim red paint", (0.9, 0.05, 0.03, 1), roughness=0.35)
    mat_metal = make_mat("Dark metal", (0.08, 0.08, 0.08, 1), roughness=0.28, metallic=0.45)
    mat_glass = make_mat("Light blue glass backboard", (0.55, 0.82, 1.0, 0.48), roughness=0.12)
    mat_blue = make_mat("Court blue paint", (0.02, 0.18, 0.65, 1), roughness=0.46)
    mat_white = make_mat("Court white lines", (0.96, 0.96, 0.9, 1), roughness=0.45)
    mat_wall = make_mat("Arena gray wall", (0.25, 0.27, 0.3, 1), roughness=0.7)
    mat_dark = make_mat("Arena dark panels", (0.035, 0.04, 0.05, 1), roughness=0.55)
    mat_yellow = make_mat("Warm arena lights", (1.0, 0.78, 0.28, 1), roughness=0.25)
    mat_net = make_mat("White nylon net", (0.96, 0.94, 0.88, 1), roughness=0.8)
    mat_floor = make_mat("Warm parquet", (0.72, 0.38, 0.12, 1), roughness=0.55)
    mat_dark_wood = make_mat("Dark parquet seams", (0.22, 0.11, 0.035, 1), roughness=0.7)

    load_external_court_or_fallback(mat_floor, mat_dark_wood, mat_white, mat_blue, mat_red)
    create_arena_background(mat_wall, mat_dark, mat_blue, mat_red, mat_white, mat_yellow)
    create_hoop(mat_metal, mat_red, mat_glass, mat_blue, mat_white)
    create_animated_net(mat_net)
    ball = load_external_ball_or_fallback(mat_orange, mat_black, mat_ball_highlight)
    animate_ball(ball)
    setup_camera_and_light()

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 162
    scene.frame_set(1)
    scene.render.fps = 24
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080

    # Better viewport/render defaults.
    scene.eevee.taa_render_samples = 64
    scene.world.color = (0.03, 0.035, 0.04)

    print("Basketball hoop animation is ready. Press Space to preview, or render the animation.")


if __name__ == "__main__":
    main()
