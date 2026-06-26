import cv2
import numpy as np
import json
import os
import csv
from pathlib import Path


CONFIG = {
    # 输入图片文件夹
    "input_dir": "lj2_image",

    # 批量输出目录
    "output_dir": "batch_closed_regions_output",

    # 支持的图片格式
    "image_extensions": [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"],

    # 黑色印刷边缘筛选：严格过滤深蓝 / 深棕
    "black_v_max": 0,
    "black_s_max": 0,
    "black_rgb_max": 150,
    "black_rgb_diff_max": 55,

    # 极暗黑色兜底
    "very_dark_v_max": 90,
    "very_dark_rgb_max": 110,
    "very_dark_rgb_diff_max": 55,

    # 去小黑点
    "min_black_component_area": 20,

    # 补黑色边缘断口
    "close_kernel_size": 9,
    "close_iterations": 1,
    "dilate_kernel_size": 3,
    "dilate_iterations": 2,

    # 闭合区域过滤
    "min_region_area": 100,

    # 过滤底部文字
    "remove_bottom_text": True,
    "bottom_text_y_ratio": 0.76,

    # 是否只保留最大的 N 个闭合区域
    # None 表示保留所有闭合区域
    "keep_largest_n_regions": None,

    # polygon 近似精度
    "approx_epsilon_ratio": 0.003,

    # 可视化颜色 BGR
    "draw_color": (0, 0, 255),

    # debug_grid 每个小图宽度
    "debug_cell_width": 420
}


# =========================
# 基础工具函数
# =========================

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def imread_unicode(path):
    """
    支持中文路径读取图片。
    """
    path = str(path)
    data = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return img


def imwrite_unicode(path, img):
    """
    支持中文路径保存图片。
    """
    path = str(path)
    ext = os.path.splitext(path)[1]
    if ext == "":
        ext = ".png"
        path += ext

    success, encoded = cv2.imencode(ext, img)
    if success:
        encoded.tofile(path)
        return True
    return False


def save_img(output_dir, filename, img):
    path = os.path.join(output_dir, filename)
    imwrite_unicode(path, img)
    return path


def to_bgr(img):
    if len(img.shape) == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img.copy()


def add_title(img, title):
    out = img.copy()
    cv2.rectangle(out, (0, 0), (out.shape[1], 34), (0, 0, 0), -1)
    cv2.putText(
        out,
        title,
        (8, 24),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )
    return out


def make_debug_grid(images, titles, output_dir, name="debug_grid.png", cell_w=420):
    panels = []

    for img, title in zip(images, titles):
        panel = to_bgr(img)
        h, w = panel.shape[:2]
        scale = cell_w / w
        panel = cv2.resize(panel, (cell_w, int(h * scale)))
        panel = add_title(panel, title)
        panels.append(panel)

    while len(panels) < 6:
        panels.append(np.zeros_like(panels[0]))

    max_h = max(p.shape[0] for p in panels)

    padded = []
    for p in panels:
        h, w = p.shape[:2]
        if h < max_h:
            pad = np.zeros((max_h - h, w, 3), dtype=np.uint8)
            p = np.vstack([p, pad])
        padded.append(p)

    row1 = np.hstack(padded[:3])
    row2 = np.hstack(padded[3:6])
    grid = np.vstack([row1, row2])

    save_img(output_dir, name, grid)


# =========================
# 图像处理函数
# =========================

def filter_small_components(binary_mask, min_area):
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary_mask,
        connectivity=8
    )

    filtered = np.zeros_like(binary_mask)

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            filtered[labels == i] = 255

    return filtered


def extract_black_print_edges(img, config):
    """
    提取黑色印刷边缘，尽量排除深蓝、深棕等彩色深色区域。
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    b, g, r = cv2.split(img)

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    rgb_diff = max_c - min_c

    # 低亮度 + 低饱和度
    hsv_black = (
        (V < config["black_v_max"]) &
        (S < config["black_s_max"])
    )

    # RGB 三通道整体偏暗 + 差异小
    rgb_black = (
        (max_c < config["black_rgb_max"]) &
        (rgb_diff < config["black_rgb_diff_max"])
    )

    strict_black = hsv_black & rgb_black

    # 极暗兜底
    very_dark_black = (
        (V < config["very_dark_v_max"]) &
        (max_c < config["very_dark_rgb_max"]) &
        (rgb_diff < config["very_dark_rgb_diff_max"])
    )

    black_mask = (strict_black | very_dark_black).astype(np.uint8) * 255

    black_mask = filter_small_components(
        black_mask,
        config["min_black_component_area"]
    )

    # 闭运算补断口
    close_k = config["close_kernel_size"]
    if close_k % 2 == 0:
        close_k += 1

    close_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (close_k, close_k)
    )

    black_clean = cv2.morphologyEx(
        black_mask,
        cv2.MORPH_CLOSE,
        close_kernel,
        iterations=config["close_iterations"]
    )

    # 轻微膨胀，让黑边成为 floodFill 的墙
    dilate_k = config["dilate_kernel_size"]
    if dilate_k % 2 == 0:
        dilate_k += 1

    dilate_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (dilate_k, dilate_k)
    )

    black_wall = cv2.dilate(
        black_clean,
        dilate_kernel,
        iterations=config["dilate_iterations"]
    )

    return black_mask, black_clean, black_wall


def extract_closed_regions_by_floodfill(black_wall):
    """
    根据黑色印刷边缘提取闭合区域。
    """
    _, wall = cv2.threshold(black_wall, 127, 255, cv2.THRESH_BINARY)

    # 反相：边缘墙变黑，背景和闭合区域内部变白
    inverted = cv2.bitwise_not(wall)

    h, w = inverted.shape[:2]
    flood = inverted.copy()
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)

    # 从四条边 floodFill 外部背景
    for x in range(w):
        if flood[0, x] == 255:
            cv2.floodFill(flood, flood_mask, (x, 0), 128)
        if flood[h - 1, x] == 255:
            cv2.floodFill(flood, flood_mask, (x, h - 1), 128)

    for y in range(h):
        if flood[y, 0] == 255:
            cv2.floodFill(flood, flood_mask, (0, y), 128)
        if flood[y, w - 1] == 255:
            cv2.floodFill(flood, flood_mask, (w - 1, y), 128)

    # flood == 255：没有和外部背景连通，即被黑边圈出的闭合区域
    closed = np.where(flood == 255, 255, 0).astype(np.uint8)

    return inverted, flood, closed


def filter_closed_regions(closed_mask, img_h, config):
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        closed_mask,
        connectivity=8
    )

    components = []

    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]

        if area < config["min_region_area"]:
            continue

        if config["remove_bottom_text"] and y > int(img_h * config["bottom_text_y_ratio"]):
            continue

        components.append({
            "label": int(i),
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "area": int(area)
        })

    components = sorted(components, key=lambda c: c["area"], reverse=True)

    keep_n = config["keep_largest_n_regions"]
    if keep_n is not None:
        components = components[:keep_n]

    final_mask = np.zeros_like(closed_mask)

    for comp in components:
        final_mask[labels == comp["label"]] = 255

    return final_mask, components


def contour_to_region(contour, img_w, img_h, region_id, config):
    area = cv2.contourArea(contour)
    x, y, w, h = cv2.boundingRect(contour)

    epsilon = config["approx_epsilon_ratio"] * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)

    polygon = []

    for p in approx:
        px, py = p[0]
        polygon.append({
            "x": float(px / img_w),
            "y": float(py / img_h)
        })

    return {
        "regionId": f"closed_region_{region_id}",
        "name": f"黑边闭合区域_{region_id}",
        "area": float(area),
        "bounding_box": {
            "x": float(x / img_w),
            "y": float(y / img_h),
            "width": float(w / img_w),
            "height": float(h / img_h)
        },
        "polygon": polygon
    }


def build_regions(final_mask, img_w, img_h, config):
    contours, _ = cv2.findContours(
        final_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    regions = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < config["min_region_area"]:
            continue

        region = contour_to_region(
            contour,
            img_w,
            img_h,
            len(regions) + 1,
            config
        )

        if len(region["polygon"]) >= 3:
            regions.append(region)

    return regions, contours


def make_overlay(img, final_mask, contours, config):
    overlay = img.copy()

    color = np.array(config["draw_color"], dtype=np.uint8)
    mask_pixels = final_mask > 0

    overlay[mask_pixels] = (
        0.55 * overlay[mask_pixels] +
        0.45 * color
    ).astype(np.uint8)

    cv2.drawContours(
        overlay,
        contours,
        -1,
        config["draw_color"],
        3
    )

    return overlay


# =========================
# 单张图片处理
# =========================

def process_one_image(image_path, image_output_dir, config):
    ensure_dir(image_output_dir)

    img = imread_unicode(image_path)

    if img is None:
        print(f"❌ 无法读取图片: {image_path}")
        return {
            "image_path": str(image_path),
            "status": "failed",
            "reason": "read_error"
        }

    img_h, img_w = img.shape[:2]

    print(f"\n✅ 处理图片: {image_path}")
    print(f"   尺寸: {img_w} x {img_h}")

    # 1. 黑色印刷边缘
    black_raw, black_clean, black_wall = extract_black_print_edges(
        img,
        config
    )

    # 2. floodFill 闭合区域
    inverted, floodfilled, closed_raw = extract_closed_regions_by_floodfill(
        black_wall
    )

    # 3. 过滤闭合区域
    final_mask, components = filter_closed_regions(
        closed_raw,
        img_h,
        config
    )

    # 4. polygon / bbox
    regions, contours = build_regions(
        final_mask,
        img_w,
        img_h,
        config
    )

    # 5. 可视化
    overlay = make_overlay(
        img,
        final_mask,
        contours,
        config
    )

    # 6. 保存核心结果
    save_img(image_output_dir, "01_black_mask_raw.png", black_raw)
    save_img(image_output_dir, "02_black_edge_wall.png", black_wall)
    save_img(image_output_dir, "03_closed_regions_mask.png", final_mask)
    save_img(image_output_dir, "04_closed_regions_overlay.png", overlay)

    make_debug_grid(
        images=[
            img,
            black_raw,
            black_wall,
            floodfilled,
            closed_raw,
            overlay
        ],
        titles=[
            "Original",
            "Black mask raw",
            "Black edge wall",
            "FloodFill external bg",
            "Closed regions raw",
            "Final overlay"
        ],
        output_dir=image_output_dir,
        name="debug_grid.png",
        cell_w=config["debug_cell_width"]
    )

    # 7. 保存单图 JSON
    result = {
        "metadata": {
            "image_path": str(image_path),
            "image_name": Path(image_path).name,
            "image_width": img_w,
            "image_height": img_h,
            "method": "strict_black_print_edge_closed_region_floodfill",
            "num_components": len(components),
            "num_regions": len(regions),
            "config": config
        },
        "components": components,
        "regions": regions
    }

    json_path = os.path.join(image_output_dir, "closed_regions_result.json")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"💾 单图 JSON: {json_path}")
    print(f"📊 regions: {len(regions)}")

    return {
        "image_path": str(image_path),
        "image_name": Path(image_path).name,
        "output_dir": str(image_output_dir),
        "status": "success",
        "image_width": img_w,
        "image_height": img_h,
        "num_components": len(components),
        "num_regions": len(regions),
        "json_path": json_path
    }


# =========================
# 批量处理
# =========================

def list_images(input_dir, extensions):
    input_dir = Path(input_dir)

    image_paths = []

    for ext in extensions:
        image_paths.extend(input_dir.glob(f"*{ext}"))
        image_paths.extend(input_dir.glob(f"*{ext.upper()}"))

    image_paths = sorted(set(image_paths), key=lambda p: p.name)

    return image_paths


def save_batch_summary(summary_list, output_dir):
    json_path = os.path.join(output_dir, "batch_summary.json")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary_list, f, indent=2, ensure_ascii=False)

    csv_path = os.path.join(output_dir, "batch_summary.csv")

    fieldnames = [
        "image_name",
        "image_path",
        "status",
        "image_width",
        "image_height",
        "num_components",
        "num_regions",
        "output_dir",
        "json_path"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for item in summary_list:
            row = {key: item.get(key, "") for key in fieldnames}
            writer.writerow(row)

    print(f"\n💾 批量 summary JSON: {json_path}")
    print(f"💾 批量 summary CSV: {csv_path}")


def main():
    input_dir = CONFIG["input_dir"]
    output_dir = CONFIG["output_dir"]

    ensure_dir(output_dir)

    image_paths = list_images(
        input_dir,
        CONFIG["image_extensions"]
    )

    if len(image_paths) == 0:
        print(f"❌ 在文件夹中没有找到图片: {input_dir}")
        return

    print(f"✅ 找到图片数量: {len(image_paths)}")
    print(f"📂 输入目录: {input_dir}")
    print(f"📂 输出目录: {output_dir}")

    summary_list = []

    for idx, image_path in enumerate(image_paths, start=1):
        stem = Path(image_path).stem
        image_output_dir = os.path.join(output_dir, stem)

        print(f"\n==============================")
        print(f"[{idx}/{len(image_paths)}] {image_path.name}")
        print(f"==============================")

        try:
            summary = process_one_image(
                image_path=image_path,
                image_output_dir=image_output_dir,
                config=CONFIG
            )
        except Exception as e:
            print(f"❌ 处理失败: {image_path}")
            print(f"   错误: {repr(e)}")

            summary = {
                "image_path": str(image_path),
                "image_name": Path(image_path).name,
                "output_dir": str(image_output_dir),
                "status": "failed",
                "reason": repr(e)
            }

        summary_list.append(summary)

    save_batch_summary(summary_list, output_dir)

    success_count = sum(1 for x in summary_list if x.get("status") == "success")
    failed_count = len(summary_list) - success_count

    print("\n✅ 批量处理完成")
    print(f"   成功: {success_count}")
    print(f"   失败: {failed_count}")


if __name__ == "__main__":
    main()