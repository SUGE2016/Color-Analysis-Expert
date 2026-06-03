from flask import Flask, request, send_file, jsonify
from algo import canny, image_correction, all_hsv, entropy_region, main_color, main_color_number, edge_color
import numpy as np
import cv2
import io
import json
from PIL import Image
import tempfile
import os

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
        image_correction.align_image(model_tmp.name, image_tmp.name, out_dir)
        aligned_path = os.path.join(out_dir, os.path.basename(image_tmp.name))
        if not os.path.exists(aligned_path):
            return jsonify({'error': 'alignment failed'}), 500
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

    if not dataset_dir or not workspace_dir:
        return jsonify({'error': 'datasetDir and workspaceDir are required'}), 400

    os.makedirs(workspace_dir, exist_ok=True)
    corrected_dir = os.path.join(workspace_dir, 'aligned')

    output = {
        'workspaceDir': workspace_dir,
        'correctedDir': corrected_dir,
        'files': {}
    }

    if 'correction' in steps:
        if not model_image_path:
            return jsonify({'error': 'modelImagePath is required for correction'}), 400
        image_correction.process_folder(model_image_path, dataset_dir, corrected_dir)

    hsv_input_dir = corrected_dir if os.path.exists(corrected_dir) and os.listdir(corrected_dir) else dataset_dir

    if 'hsv' in steps:
        if not butterfly_json:
            return jsonify({'error': 'butterflyJsonPath is required for hsv'}), 400
        hsv_csv = os.path.join(workspace_dir, 'all_hsv_results.csv')
        all_hsv.process_images_HSV(butterfly_json, hsv_input_dir, hsv_csv)
        output['files']['hsvCsv'] = hsv_csv

    if 'edge_hsv' in steps and edge_json:
        edge_hsv_csv = os.path.join(workspace_dir, 'all_edge_hsv_results.csv')
        all_hsv.process_images_HSV(edge_json, hsv_input_dir, edge_hsv_csv)
        output['files']['edgeHsvCsv'] = edge_hsv_csv

    if 'entropy' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'entropy requires hsv step first'}), 400
        entropy_csv = os.path.join(workspace_dir, 'image_entropy_region_results.csv')
        entropy_region.process_entropy_csv(input_csv, entropy_csv)
        output['files']['entropyCsv'] = entropy_csv

    if 'main_color' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'main_color requires hsv step first'}), 400
        main_color_csv = os.path.join(workspace_dir, 'main_color.csv')
        main_color.process_csv(input_csv, main_color_csv)
        output['files']['mainColorCsv'] = main_color_csv

    if 'main_color_number' in steps:
        input_csv = output['files'].get('hsvCsv')
        if not input_csv:
            return jsonify({'error': 'main_color_number requires hsv step first'}), 400
        main_color_number_csv = os.path.join(workspace_dir, 'main_color_number.csv')
        main_color_number.process_csv(input_csv, main_color_number_csv)
        output['files']['mainColorNumberCsv'] = main_color_number_csv

    if 'edge_color' in steps:
        input_csv = output['files'].get('edgeHsvCsv')
        if not input_csv:
            return jsonify({'error': 'edge_color requires edge_hsv step first'}), 400
        edge_color_csv = os.path.join(workspace_dir, 'edge_main_color.csv')
        edge_color.process_csv(input_csv, edge_color_csv)
        output['files']['edgeColorCsv'] = edge_color_csv

    return jsonify(output)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
