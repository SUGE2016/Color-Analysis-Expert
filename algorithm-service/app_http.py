from flask import Flask, request, send_file, jsonify
from algo import canny, image_correction, all_hsv, entropy_region, main_color, main_color_number, edge_color
import numpy as np
import cv2
import io
import json
from PIL import Image
import tempfile
import os
from shapely.geometry import Polygon

app = Flask(__name__)


def _json_from_form(field_name, default_value):
    raw = request.form.get(field_name)
    if not raw:
        return default_value
    try:
        return json.loads(raw)
    except Exception:
        return default_value


@app.route('/canny', methods=['POST'])
def canny_api():
    if 'image' not in request.files:
        return 'missing image file', 400
    file = request.files['image']
    cfg = _json_from_form('config', {})
    img = Image.open(file.stream).convert('RGB')
    img_np = np.array(img)[:, :, ::-1]
    regions, metadata = canny.detect_regions(img_np, cfg)
    return jsonify({'regions': regions, 'metadata': metadata})


@app.route('/image/correction/points', methods=['POST'])
def detect_points_api():
    if 'image' not in request.files:
        return 'missing image file', 400
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    try:
        request.files['image'].save(tmp.name)
        points = image_correction.detect_points(tmp.name)
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
    if points is None:
        return jsonify({'error': 'cannot detect points'}), 400
    return jsonify({'points': points.tolist()})


@app.route('/image/correction/align', methods=['POST'])
def align_image_api():
    if 'model' not in request.files or 'image' not in request.files:
        return 'need both model and image files', 400
    model_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    image_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    out_dir = tempfile.mkdtemp()
    try:
        request.files['model'].save(model_tmp.name)
        request.files['image'].save(image_tmp.name)
        aligned_path = image_correction.align_image(model_tmp.name, image_tmp.name, out_dir)
        if not aligned_path or not os.path.exists(aligned_path):
            return jsonify({'error': 'alignment failed: cannot detect corner points or write output image'}), 422
        return send_file(aligned_path, mimetype='image/png')
    finally:
        for path in [model_tmp.name, image_tmp.name]:
            if os.path.exists(path):
                os.unlink(path)


@app.route('/hsv/process_image', methods=['POST'])
def hsv_process_api():
    if 'image' not in request.files or 'mask' not in request.files:
        return 'need image and mask files', 400
    img_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    mask_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    try:
        request.files['image'].save(img_tmp.name)
        request.files['mask'].save(mask_tmp.name)
        img = cv2.imread(img_tmp.name)
        result_img, _ = all_hsv.process_image(img, mask_tmp.name)
        buf = cv2.imencode('.png', result_img)[1].tobytes()
        return send_file(io.BytesIO(buf), mimetype='image/png')
    finally:
        for path in [img_tmp.name, mask_tmp.name]:
            if os.path.exists(path):
                os.unlink(path)


@app.route('/pipeline/run', methods=['POST'])
def run_pipeline_api():
    payload = request.get_json(silent=True) or {}
    dataset_dir = payload.get('datasetDir')
    workspace_dir = payload.get('workspaceDir')
    steps = payload.get('steps', [])
    model_image_path = payload.get('modelImagePath')
    butterfly_json = payload.get('butterflyJsonPath')
    edge_json = payload.get('edgeJsonPath')
    cancel_file = payload.get('cancelFile')

    if not dataset_dir or not workspace_dir:
        return jsonify({'error': 'datasetDir and workspaceDir are required'}), 400

    os.makedirs(workspace_dir, exist_ok=True)
    corrected_dir = os.path.join(workspace_dir, 'aligned')

    output = {
        'workspaceDir': workspace_dir,
        'correctedDir': corrected_dir,
        'files': {}
    }

    def cancelled():
        if cancel_file and os.path.exists(cancel_file):
            output['cancelled'] = True
            return True
        return False

    if cancelled():
        return jsonify(output)

    if 'correction' in steps:
        if not model_image_path:
            return jsonify({'error': 'modelImagePath is required for correction'}), 400
        image_correction.process_folder(model_image_path, dataset_dir, corrected_dir)
        if cancelled():
            return jsonify(output)

    hsv_input_dir = corrected_dir if os.path.exists(corrected_dir) and os.listdir(corrected_dir) else dataset_dir

    if 'hsv' in steps:
        if not butterfly_json:
            return jsonify({'error': 'butterflyJsonPath is required for hsv'}), 400
        hsv_csv = os.path.join(workspace_dir, 'all_hsv_results.csv')
        all_hsv.process_images_HSV(butterfly_json, hsv_input_dir, hsv_csv)
        output['files']['hsvCsv'] = hsv_csv
        if cancelled():
            return jsonify(output)

    if 'edge_hsv' in steps and edge_json:
        edge_hsv_csv = os.path.join(workspace_dir, 'all_edge_hsv_results.csv')
        all_hsv.process_images_HSV(edge_json, hsv_input_dir, edge_hsv_csv)
        output['files']['edgeHsvCsv'] = edge_hsv_csv
        if cancelled():
            return jsonify(output)

    if 'entropy' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'entropy requires hsv step first'}), 400
        entropy_csv = os.path.join(workspace_dir, 'image_entropy_region_results.csv')
        entropy_region.process_entropy_csv(input_csv, entropy_csv)
        output['files']['entropyCsv'] = entropy_csv
        if cancelled():
            return jsonify(output)

    if 'main_color' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'main_color requires hsv step first'}), 400
        main_color_csv = os.path.join(workspace_dir, 'main_color.csv')
        main_color.process_csv(input_csv, main_color_csv)
        output['files']['mainColorCsv'] = main_color_csv
        if cancelled():
            return jsonify(output)

    if 'main_color_number' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'main_color_number requires hsv step first'}), 400
        main_color_number_csv = os.path.join(workspace_dir, 'main_color_number.csv')
        main_color_number.process_csv(input_csv, main_color_number_csv)
        output['files']['mainColorNumberCsv'] = main_color_number_csv
        if cancelled():
            return jsonify(output)

    if 'edge_color' in steps:
        input_csv = output['files'].get('edgeHsvCsv')
        if not input_csv:
            return jsonify({'error': 'edge_color requires edge_hsv step first'}), 400
        edge_color_csv = os.path.join(workspace_dir, 'edge_main_color.csv')
        edge_color.process_csv(input_csv, edge_color_csv)
        output['files']['edgeColorCsv'] = edge_color_csv
        if cancelled():
            return jsonify(output)

    return jsonify(output)


@app.route('/polygon/merge', methods=['POST'])
def merge_polygons_api():
    """使用 Shapely 进行多边形合并"""
    try:
        payload = request.get_json(silent=True) or {}
        polygons = payload.get('polygons', [])

        if not polygons or len(polygons) < 2:
            return jsonify({'error': 'at least 2 polygons required'}), 400

        # 将前端格式转换为 Shapely Polygon
        shapely_polygons = []
        for poly in polygons:
            # 前端格式: [{x: 0.5, y: 0.3}, ...]
            coords = [(p['x'], p['y']) for p in poly]
            # 确保多边形闭合
            if coords and coords[0] != coords[-1]:
                coords.append(coords[0])
            shapely_polygons.append(Polygon(coords))

        # 使用 Shapely 进行合并
        merged = shapely_polygons[0]
        for poly in shapely_polygons[1:]:
            merged = merged.union(poly)

        # 将结果转换回前端格式
        if merged.geom_type == 'Polygon':
            result_coords = list(merged.exterior.coords)
            # 移除闭合点
            if result_coords and result_coords[0] == result_coords[-1]:
                result_coords = result_coords[:-1]
            result = [{'x': x, 'y': y} for x, y in result_coords]
        elif merged.geom_type == 'MultiPolygon':
            # 如果结果是多边形集合，取最大的一个
            largest_poly = max(merged.geoms, key=lambda p: p.area)
            result_coords = list(largest_poly.exterior.coords)
            if result_coords and result_coords[0] == result_coords[-1]:
                result_coords = result_coords[:-1]
            result = [{'x': x, 'y': y} for x, y in result_coords]
        else:
            return jsonify({'error': f'unsupported geometry type: {merged.geom_type}'}), 400

        return jsonify({'polygon': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
