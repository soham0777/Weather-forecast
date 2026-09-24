"""Builds SmartNest_Colab.ipynb: the tested modules are embedded with %%writefile so the notebook
runs stand-alone in Google Colab and always matches the code the tests ran against.

    python make_notebook.py
"""
import nbformat as nbf

MODULES = ["smartnest_vision.py", "smartnest_synthetic.py", "smartnest_cad.py", "smartnest_nesting.py"]
nb = nbf.v4.new_notebook()
cells = []
md = lambda s: cells.append(nbf.v4.new_markdown_cell(s.strip()))
code = lambda s: cells.append(nbf.v4.new_code_cell(s.strip()))

md("""
# Bansali SmartNest - SEE. MEASURE. OPTIMIZE. CUT.
**Camera -> measured material map -> nested parts -> validated cutting DXF**, in the operator's five clicks:

| Click | Step | What the software does |
|---|---|---|
| 1 | **SCAN BED** | capture the bed, map pixels to machine millimetres (homography + lens model) |
| 2 | **CONFIRM MATERIAL** | detect the sheet, every existing cut-out and edge notch; show a quality score; allow corrections |
| 3 | **ADD JOB** | read the part DXF, reject open / self-intersecting contours, count quantities |
| 4 | **OPTIMIZE** | nest the parts into the *remaining* material (No-Fit-Polygon kernel + evolutionary search) |
| 5 | **EXPORT** | write the DXF in machine mm, read it back, compare, and only then release it |

`CAPTURE_MODE = 'demo'` uses synthetic beds whose true geometry is known, so the notebook reports measured errors
instead of "looks right". Measured on those scenes: sheet area within about 0.05 %, circle diameters within 0.6 mm,
median edge error 0.1 mm at 1.8 mm/px. **These numbers are from simulation - validate on real Bansali machine
images before trusting the vision stage in production.**

**Where to run:** Google Colab (colab.research.google.com -> File -> Upload notebook -> Runtime -> Run all) supports
everything, including the live webcam and click-the-corners widgets. VS Code / local Jupyter (pick a Python 3.10+
kernel) runs the full pipeline in `demo` mode and with your own images; the webcam and click widgets are Colab-only.
""")
code("""
#@title Step 0 - install (about 30 s)
%pip install -q "shapely>=2.1" ezdxf opencv-python matplotlib
""")
for m in MODULES:
    with open(m) as f:
        src = f.read()
    code(f"%%writefile {m}\n{src}")        # cell magic must be the first line
code("""
import json, math, base64, os
import cv2, numpy as np, matplotlib.pyplot as plt
import smartnest_vision as sv, smartnest_synthetic as ss, smartnest_cad as cad, smartnest_nesting as sn
try:
    from google.colab.output import eval_js
    from google.colab import files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

def show(img, title='', w=15):
    plt.figure(figsize=(w, w * img.shape[0] / img.shape[1]))
    plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)); plt.title(title); plt.axis('off'); plt.show()
print('SmartNest modules loaded. OpenCV', cv2.__version__)
""")
md("## Click 1 - SCAN BED")
code("""
#@title Acquire the bed image
CAPTURE_MODE = 'demo'  # @param ['webcam', 'upload', 'demo']
DEMO_SCENE = 'mixed_holes'  # @param ['fresh_sheet', 'four_circles', 'mixed_holes', 'irregular_remnant', 'dark_steel', 'lens_distortion', 'small_bed']
BED_WIDTH_MM = 1500   # @param {type:"number"}
BED_HEIGHT_MM = 950   # @param {type:"number"}
CAMERA_NAME = ''  # @param {type:"string"}
# Leave CAMERA_NAME empty: the external webcam is chosen automatically (and remembered).
# Only type part of a name (e.g. 'LAPCARE') if the automatic choice is ever wrong.

import os, base64, cv2, numpy as np
try:
    from google.colab.output import eval_js
    from google.colab import files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False
try:
    import smartnest_vision as sv, smartnest_synthetic as ss
except ImportError:
    raise SystemExit('The SmartNest modules are not in this runtime yet. Use Runtime -> Run all '
                     '(or run every cell above this one once), then run this cell again.')
if 'show' not in globals():
    import matplotlib.pyplot as plt
    def show(img, title='', w=15):
        plt.figure(figsize=(w, w * img.shape[0] / img.shape[1]))
        plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)); plt.title(title); plt.axis('off'); plt.show()

CAMERA_MEMORY = 'smartnest_camera.txt'

def capture_from_browser_webcam(camera_name='', quality=0.92):
    # Browsers open the DEFAULT camera (the laptop's own) unless a device is chosen explicitly.
    # Choice order: CAMERA_NAME > camera used last time > known external webcam brand >
    # the most recently connected camera that does not look built-in.
    if not camera_name and os.path.exists(CAMERA_MEMORY):
        camera_name = open(CAMERA_MEMORY).read().split(' (')[0]
    want = ''.join(ch for ch in camera_name if ch.isalnum() or ch in ' -_.')
    js = '''
    (async () => {
      const WANT = 'CAMNAME'.toLowerCase().trim();
      const builtIn = /integrated|built-?in|internal|facetime|front|truevision|easycamera|hd webcam|uvc webcam|ir camera|infrared|hello|virtual/i;
      const external = /lapcare|logitech|c9[0-9][0-9]|c270|c310|c505|c615|brio|lifecam|razer|elgato|zebronics|frontech|iball|a4tech|quantum|creative|usb camera|usb video|external/i;
      const box = document.createElement('div');
      box.style.cssText = 'background:#0f172a;padding:16px;border-radius:10px;border:2px solid #00e5ff;max-width:760px;color:#f8fafc;font-family:monospace';
      box.innerHTML = '<h3 style="margin:0 0 8px;color:#00e5ff">LIVE OVERHEAD CAMERA</h3>' +
        '<p style="margin:0 0 10px;color:#94a3b8">Check that all 4 bed corners (or the markers) are visible, then capture. Wrong camera? Pick another below.</p>';
      const sel = document.createElement('select');
      sel.style.cssText = 'width:100%;padding:8px;font-size:14px;margin-bottom:8px;background:#1e293b;color:#f8fafc;border:1px solid #00e5ff;border-radius:6px';
      const video = document.createElement('video'); video.style.width = '100%'; video.setAttribute('playsinline', ''); video.muted = true;
      const info = document.createElement('div'); info.style.cssText = 'color:#f59e0b;margin:6px 0';
      const btn = document.createElement('button'); btn.textContent = 'CAPTURE BED IMAGE';
      btn.style.cssText = 'margin-top:6px;background:#00e5ff;border:0;padding:10px 20px;font-weight:bold;border-radius:6px;cursor:pointer';
      box.append(sel, video, info, btn); document.body.appendChild(box);
      const videoInputs = async () => (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      let cams = await videoInputs();
      if (!cams.some(c => c.label)) {          // names are hidden until camera permission is granted (first run only)
        info.textContent = 'Allow camera access in the browser prompt...';
        const probe = await navigator.mediaDevices.getUserMedia({video: true});
        probe.getTracks().forEach(t => t.stop());
        cams = await videoInputs();
      }
      const fill = list => { sel.innerHTML = ''; list.forEach((c, i) => { const o = document.createElement('option');
        o.value = c.deviceId; o.text = c.label || ('Camera ' + (i + 1)); sel.appendChild(o); }); };
      fill(cams);
      // +2 known external webcam, -1 sounds built-in; ties go to the most recently connected camera
      const score = c => (external.test(c.label) ? 2 : 0) - (builtIn.test(c.label) ? 1 : 0);
      const best = list => list.reduce((a, c) => (score(c) >= score(a) ? c : a));
      let saved = null; try { saved = localStorage.getItem('smartnest_camera'); } catch (e) {}
      const pick = (WANT && cams.find(c => c.label.toLowerCase().includes(WANT)))
                || cams.find(c => c.deviceId === saved)
                || best(cams);
      sel.value = pick.deviceId;
      let stream = null;
      async function start(id) {
        btn.disabled = true; btn.style.opacity = 0.4; info.textContent = 'Opening camera...';
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        const s = await navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: id}, width: {ideal: 1920}, height: {ideal: 1080}}});
        video.srcObject = s; await video.play(); stream = s;
        try { localStorage.setItem('smartnest_camera', id); } catch (e) {}
        const n = sel.options.length;
        info.textContent = 'Using: ' + sel.options[sel.selectedIndex].text + '  (' + video.videoWidth + ' x ' + video.videoHeight + ' px)' +
          (n === 1 ? '  - only ONE camera found: if the external webcam is plugged in, re-plug it (it switches automatically)' : '  - ' + n + ' cameras found');
        btn.disabled = false; btn.style.opacity = 1;
      }
      const fail = e => { info.textContent = 'Cannot open this camera (' + e.message + '). Close other apps using it (Camera, Teams, WhatsApp) or pick another.'; };
      sel.onchange = () => start(sel.value).catch(fail);
      navigator.mediaDevices.ondevicechange = async () => {  // webcam plugged in / unplugged while the preview is open
        const before = new Set([...sel.options].map(o => o.value));
        const curId = stream ? stream.getVideoTracks()[0].getSettings().deviceId : sel.value;
        const now = await videoInputs();
        if (!now.length) { info.textContent = 'No camera connected.'; return; }
        fill(now);
        const cur = now.find(c => c.deviceId === curId);
        const added = now.filter(c => !before.has(c.deviceId));
        const cand = added.length ? best(added) : null;
        if (cand && (!cur || score(cand) >= score(cur))) { sel.value = cand.deviceId; start(cand.deviceId).catch(fail); }
        else if (!cur) { sel.value = best(now).deviceId; start(sel.value).catch(fail); }
        else { sel.value = cur.deviceId; }
      };
      await start(sel.value).catch(fail);
      return new Promise(res => { btn.onclick = () => {
        if (!stream || !video.videoWidth) { info.textContent = 'No live picture yet - pick a working camera.'; return; }
        const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        const label = sel.options[sel.selectedIndex].text;
        navigator.mediaDevices.ondevicechange = null;
        stream.getTracks().forEach(t => t.stop()); box.remove();
        res({image: c.toDataURL('image/jpeg', QUALITY), label: label, width: c.width, height: c.height}); }; });
    })()'''.replace('QUALITY', str(quality)).replace('CAMNAME', want)
    r = eval_js(js)
    open(CAMERA_MEMORY, 'w').write(r['label'])
    print(f"Captured from: {r['label']}  ({r['width']} x {r['height']} px)")
    return cv2.imdecode(np.frombuffer(base64.b64decode(r['image'].split(',')[1]), np.uint8), cv2.IMREAD_COLOR)

scene = None
if CAPTURE_MODE == 'webcam' and IN_COLAB:
    raw_image = capture_from_browser_webcam(CAMERA_NAME)
elif CAPTURE_MODE == 'upload' and IN_COLAB:
    up = files.upload(); raw_image = cv2.imread(list(up)[0])
else:
    if CAPTURE_MODE != 'demo':
        print(f"'{CAPTURE_MODE}' needs Google Colab - using the demo scene instead.")
    scene = ss.make_scene(DEMO_SCENE)
    raw_image = scene.image
    BED_WIDTH_MM, BED_HEIGHT_MM = scene.bed_w, scene.bed_h
    print('Demo scene:', scene.description)
if raw_image is None:
    raise SystemExit('No camera image.')
show(raw_image, f'Acquired image {raw_image.shape[1]} x {raw_image.shape[0]} px')
""")
code("""
#@title Calibrate pixels -> machine millimetres
CALIBRATION_MODE = 'aruco'  # @param ['click_corners', 'aruco', 'load_file', 'demo_truth']
CALIBRATION_FILE = 'calibration.json'  # @param {type:"string"}
USE_EMPTY_BED_REFERENCE = False  # @param {type:"boolean"}

def click_bed_corners(image):
    h, w = image.shape[:2]; dw = min(960, w); dh = int(h * dw / w)
    b64 = base64.b64encode(cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])[1]).decode()
    js = f'''
    (async () => {{
      const box = document.createElement('div');
      box.style.cssText = 'background:#0f172a;padding:14px;border-radius:10px;border:2px solid #00e5ff;max-width:{dw + 30}px;color:#f8fafc;font-family:sans-serif';
      box.innerHTML = '<b style="color:#00e5ff">CLICK THE 4 BED CORNERS: TOP-LEFT, TOP-RIGHT, BOTTOM-RIGHT, BOTTOM-LEFT</b><div id="st" style="color:#f59e0b;margin:6px 0">Click 1 of 4</div>';
      const cv = document.createElement('canvas'); cv.width = {dw}; cv.height = {dh}; cv.style.cssText = 'width:100%;cursor:crosshair';
      const ok = document.createElement('button'); ok.textContent = 'CONFIRM CORNERS'; ok.style.display = 'none';
      const rs = document.createElement('button'); rs.textContent = 'Reset';
      box.appendChild(cv); box.appendChild(rs); box.appendChild(ok); document.body.appendChild(box);
      const ctx = cv.getContext('2d'); const img = new Image(); img.src = 'data:image/jpeg;base64,{b64}';
      await new Promise(r => img.onload = r); let pts = [];
      const draw = () => {{ ctx.drawImage(img, 0, 0, {dw}, {dh}); ctx.strokeStyle = '#00e5ff'; ctx.beginPath();
        pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (pts.length == 4) ctx.closePath(); ctx.stroke();
        pts.forEach(p => {{ ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); }}); }};
      draw();
      cv.onclick = e => {{ if (pts.length >= 4) return; const r = cv.getBoundingClientRect();
        pts.push([(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]); draw();
        document.getElementById('st').textContent = pts.length < 4 ? 'Click ' + (pts.length + 1) + ' of 4' : 'Done - confirm';
        if (pts.length == 4) ok.style.display = 'inline-block'; }};
      rs.onclick = () => {{ pts = []; ok.style.display = 'none'; draw(); }};
      return new Promise(res => ok.onclick = () => {{ box.remove(); res(pts.map(p => [p[0] * {w} / {dw}, p[1] * {h} / {dh}])); }});
    }})()'''
    return np.array(eval_js(js), dtype=np.float64)

size = (raw_image.shape[1], raw_image.shape[0])
K = D = None
if scene is not None and scene.hint.get('needs_lens_model'):
    K, D = scene.camera.K, scene.camera.dist        # demo: the lens model a chessboard calibration would give
if CALIBRATION_MODE == 'load_file' and os.path.exists(CALIBRATION_FILE):
    calib = sv.BedCalibration.load(CALIBRATION_FILE)
elif CALIBRATION_MODE == 'aruco' and (scene is None or scene.markers_mm):
    layout = scene.markers_mm if scene is not None else sv.aruco_layout(
        {0: (-110, 150), 1: (-110, BED_HEIGHT_MM - 150), 2: (BED_WIDTH_MM + 110, 150), 3: (BED_WIDTH_MM + 110, BED_HEIGHT_MM - 150)}, 90)
    calib = sv.calibrate_from_aruco(raw_image, layout, BED_WIDTH_MM, BED_HEIGHT_MM, camera_matrix=K, dist_coeffs=D)
elif CALIBRATION_MODE == 'click_corners' and IN_COLAB:
    clicks = click_bed_corners(raw_image)
    gray = cv2.cvtColor(raw_image, cv2.COLOR_BGR2GRAY)
    clicks, shift, snapped = sv.refine_corners(gray, clicks)
    calib = sv.calibrate_bed(clicks, BED_WIDTH_MM, BED_HEIGHT_MM, size, camera_matrix=K, dist_coeffs=D)
else:
    calib = sv.calibrate_bed(scene.corners_px, BED_WIDTH_MM, BED_HEIGHT_MM, size, camera_matrix=K, dist_coeffs=D, source='demo truth')
calib.save(CALIBRATION_FILE)
rect = sv.Rectifier(calib)
reference = scene.empty_bed if (scene is not None and (USE_EMPTY_BED_REFERENCE or scene.hint.get('needs_reference'))) else None
print(f"Calibration: {calib.source}, {calib.n_points} points, residual "
      + (f"{calib.rms_mm:.2f} mm" if calib.rms_mm is not None else "unknown (4 points)")
      + f", ortho scale {rect.s} mm/px")
for w in calib.warnings: print('  !', w)
""")
md("## Click 2 - DETECT / CONFIRM MATERIAL")
code("""
#@title Detect sheet, existing cut-outs and usable material
MATERIAL_POLARITY = 'bright'  # @param ['bright', 'dark']
cfg_v = sv.VisionConfig(polarity=MATERIAL_POLARITY)
try:
    scan = sv.scan_sheet(raw_image, calib, cfg_v, reference_image=reference, rectifier=rect)
except sv.VisionError as e:
    raise SystemExit(f'SCAN FAILED: {e}')
show(sv.draw_blueprint(scan, rect), 'Measured material map (green = sheet, red = existing cut-outs, orange = edge notches)')
d = scan.to_dict(include_geometry=False)
print(f"Bed            {scan.bed_w_mm:.0f} x {scan.bed_h_mm:.0f} mm")
print(f"Sheet          {d['sheet']['length_mm']} x {d['sheet']['width_mm']} mm  (angle {d['sheet']['angle_deg']} deg)")
print(f"Sheet area     {scan.sheet_area_mm2 / 1e6:.4f} m2")
print(f"Cut-outs       {len(scan.cutouts)}  (removed {scan.removed_area_mm2 / 1e6:.4f} m2), edge notches {len(scan.edge_notches)}")
print(f"Available      {scan.available_area_mm2 / 1e6:.4f} m2")
print(f"Quality score  {scan.confidence:.2f}  -> {'CONFIRM / ADJUST' if scan.needs_confirmation else 'OK'}")
for w in scan.warnings: print('  !', w)
for c in scan.cutouts:
    extra = f"D{c['diameter_mm']:.1f}" if c['type'] == 'circle' else (f"{c['length_mm']:.1f} x {c['width_mm']:.1f}" if c['type'] == 'rectangle' else '')
    print(f"  {c['id']}  {c['type']:9s} at ({c['centroid_mm'][0]:.1f}, {c['centroid_mm'][1]:.1f}) mm  {extra}  area {c['area_mm2']:.0f} mm2")
if scene is not None:
    iou = scan.material.intersection(scene.material).area / scan.material.union(scene.material).area
    print(f"\\nDEMO ground truth: usable area error {100 * (scan.available_area_mm2 / scene.material.area - 1):+.3f} %, "
          f"IoU {iou:.4f}, cut-outs {len(scan.cutouts)}/{len(scene.holes)}")
""")
code("""
#@title (Optional) Adjust: remove a false cut-out / add a missed one, then re-run this cell
REMOVE_CUTOUT_IDS = ''  # @param {type:"string"}
ADD_CIRCLE_CUTOUTS = ''  # @param {type:"string"}
# e.g. REMOVE_CUTOUT_IDS = 'cutout_003'   ADD_CIRCLE_CUTOUTS = '[[900, 500, 40]]'  (x_mm, y_mm, radius_mm)
if REMOVE_CUTOUT_IDS.strip() or ADD_CIRCLE_CUTOUTS.strip():
    adds = [{'center': [x, y], 'radius': r} for x, y, r in (json.loads(ADD_CIRCLE_CUTOUTS) if ADD_CIRCLE_CUTOUTS.strip() else [])]
    scan = sv.apply_corrections(scan, cfg_v, remove_ids=[s.strip() for s in REMOVE_CUTOUT_IDS.split(',') if s.strip()], add_cutouts_mm=adds)
    show(sv.draw_blueprint(scan, rect), 'Corrected material map')
    print(f"Available after correction: {scan.available_area_mm2 / 1e6:.4f} m2")
else:
    print('No corrections.')
""")
md("## Click 3 - ADD JOB")
code("""
#@title Load the part DXF
JOB_SOURCE = 'sample'  # @param ['sample', 'upload']
QUANTITIES = '{"A": 12, "B": 10, "C": 8, "D": 14}'  # @param {type:"string"}
if JOB_SOURCE == 'upload' and IN_COLAB:
    up = files.upload(); name = list(up)[0]
    job_path = cad.safe_filename(name); open(job_path, 'wb').write(up[name])
else:
    job_path = cad.make_sample_job_dxf('sample_job.dxf')
parts, report = cad.read_dxf_parts(job_path)
for e in report.errors: print('ERROR:', e)
for w in report.warnings: print('warning:', w)
for p in parts:
    p.quantity = int(json.loads(QUANTITIES or '{}').get(p.name, p.quantity))
print(f"File {report.file} ({report.units}) - {len(parts)} part types, {sum(p.quantity for p in parts)} parts required")
for p in parts:
    s = p.summary(); print(f"  Part {s['name']}  x{p.quantity:<3d} {s['bbox_mm'][0]:.1f} x {s['bbox_mm'][1]:.1f} mm  area {s['area_mm2']:.0f} mm2  holes {s['holes']}")
""")
md("## Click 4 - OPTIMIZE")
code("""
#@title Nest into the measured material
KERF_MM = 0.3  # @param {type:"number"}
CLEARANCE_MM = 3.0  # @param {type:"number"}
EDGE_MARGIN_MM = 5.0  # @param {type:"number"}
MEASUREMENT_UNCERTAINTY_MM = 3.0  # @param {type:"number"}
ROTATION_STEP_DEG = 90  # @param [15, 30, 45, 90]
MAX_OPTIMIZATION_TIME_SECONDS = 30  # @param {type:"number"}
cfg_n = sn.NestConfig(kerf_mm=KERF_MM, clearance_mm=CLEARANCE_MM, edge_margin_mm=EDGE_MARGIN_MM,
                      measurement_uncertainty_mm=MEASUREMENT_UNCERTAINTY_MM, rotation_step_deg=float(ROTATION_STEP_DEG),
                      max_time_s=float(MAX_OPTIMIZATION_TIME_SECONDS))
last = {'stage': None}
def progress(stage, info):
    if stage != last['stage']:
        print('->', stage); last['stage'] = stage
    elif 'placed' in info:
        print(f"   improved: {info['placed']}/{info['required']} placed after {info['evaluations']} layouts")
material_cad = sn.material_to_cad(scan.material, scan.bed_h_mm)
result = sn.nest(parts, material_cad, scan.bed_w_mm, scan.bed_h_mm, cfg_n, progress, scan_problems=sv.validate_scan(scan))
show(sn.draw_layout(sv.draw_blueprint(scan, rect, show_hud=False), rect, result, scan.bed_h_mm), 'Where the laser will cut (blue = new parts)')
r = result.to_dict(); m = result.metrics
print(result.message)
print(f"Parts placed      {r['placed_parts']} / {r['required_parts']}   {r['unplaced_by_part'] or ''}")
print(f"Utilization       {r['utilization_percent']:.1f} %   waste {r['waste_percent']:.1f} %")
print(f"Reusable remnant  {m['reusable_remnant_mm2'] / 1e6:.3f} m2   scrap {m['scrap_area_mm2'] / 1e6:.3f} m2")
print(f"Cutting distance  {m['cutting_distance_mm'] / 1000:.2f} m   pierces {m['pierces']}   rapid travel ~{m['travel_distance_mm'] / 1000:.1f} m")
print(f"Search            {result.evaluations} layouts in {result.time_s:.1f} s")
for n in result.notes: print('  note:', n)
print('Checks:'); [print(f"  {'PASS' if ok else 'FAIL'}  {k}: {msg}") for k, (ok, msg) in result.checks.items()]
""")
md("## Click 5 - EXPORT CUTTING FILE")
code("""
#@title Export (only if every check passes)
if not result.export_enabled:
    print('EXPORT DISABLED:'); [print('  ', f) for f in result.failed_checks()]
else:
    info = sn.export_cutting_file(result, parts, 'smartnest_cut.dxf')
    sv.export_dxf(scan, 'smartnest_material_map.dxf')
    json.dump({'scan': scan.to_dict(), 'nest': result.to_dict()}, open('smartnest_job.json', 'w'), indent=1)
    cad.export_layout_svg(result, material_cad, (scan.bed_w_mm, scan.bed_h_mm), 'smartnest_preview.svg')
    print(f"Cutting DXF written and re-validated: {info['parts']} parts, {info['true_curve_entities']} true arcs/circles, "
          f"difference {info['validation']['symmetric_difference_mm2']:.2f} mm2 -> smartnest_cut.dxf")
    if IN_COLAB:
        for f in ('smartnest_cut.dxf', 'smartnest_material_map.dxf', 'smartnest_job.json', 'smartnest_preview.svg'):
            files.download(f)
""")
nb["cells"] = cells
nb["metadata"] = {"colab": {"provenance": []}, "kernelspec": {"name": "python3", "display_name": "Python 3"},
                  "language_info": {"name": "python"}}
nbf.write(nb, "SmartNest_Colab.ipynb")
print("wrote SmartNest_Colab.ipynb with", len(cells), "cells")
