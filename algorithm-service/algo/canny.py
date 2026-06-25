import cv2
import numpy as np
from typing import List, Dict, Tuple


def filter_small_components(binary_mask, min_area):
    """过滤小连通区域"""
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

    # 配置参数
    black_v_max = config.get("black_v_max", 0)
    black_s_max = config.get("black_s_max", 0)
    black_rgb_max = config.get("black_rgb_max", 150)
    black_rgb_diff_max = config.get("black_rgb_diff_max", 55)
    
    very_dark_v_max = config.get("very_dark_v_max", 90)
    very_dark_rgb_max = config.get("very_dark_rgb_max", 110)
    very_dark_rgb_diff_max = config.get("very_dark_rgb_diff_max", 55)
    
    min_black_component_area = config.get("min_black_component_area", 20)
    close_kernel_size = config.get("close_kernel_size", 9)
    close_iterations = config.get("close_iterations", 1)
    dilate_kernel_size = config.get("dilate_kernel_size", 3)
    dilate_iterations = config.get("dilate_iterations", 2)

    # 低亮度 + 低饱和度
    hsv_black = (
        (V < black_v_max) &
        (S < black_s_max)
    )

    # RGB 三通道整体偏暗 + 差异小
    rgb_black = (
        (max_c < black_rgb_max) &
        (rgb_diff < black_rgb_diff_max)
    )

    strict_black = hsv_black & rgb_black

    # 极暗兜底
    very_dark_black = (
        (V < very_dark_v_max) &
        (max_c < very_dark_rgb_max) &
        (rgb_diff < very_dark_rgb_diff_max)
    )

    black_mask = (strict_black | very_dark_black).astype(np.uint8) * 255

    black_mask = filter_small_components(
        black_mask,
        min_black_component_area
    )

    # 闭运算补断口
    close_k = close_kernel_size
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
        iterations=close_iterations
    )

    # 轻微膨胀，让黑边成为 floodFill 的墙
    dilate_k = dilate_kernel_size
    if dilate_k % 2 == 0:
        dilate_k += 1

    dilate_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (dilate_k, dilate_k)
    )

    black_wall = cv2.dilate(
        black_clean,
        dilate_kernel,
        iterations=dilate_iterations
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
    """过滤闭合区域"""
    min_region_area = config.get("min_region_area", 100)
    remove_bottom_text = config.get("remove_bottom_text", True)
    bottom_text_y_ratio = config.get("bottom_text_y_ratio", 0.76)
    keep_largest_n_regions = config.get("keep_largest_n_regions", None)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        closed_mask,
        connectivity=8
    )

    components = []

    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]

        if area < min_region_area:
            continue

        if remove_bottom_text and y > int(img_h * bottom_text_y_ratio):
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

    if keep_largest_n_regions is not None:
        components = components[:keep_largest_n_regions]

    final_mask = np.zeros_like(closed_mask)

    for comp in components:
        final_mask[labels == comp["label"]] = 255

    return final_mask, components


def detect_regions(img: np.ndarray, config: dict) -> Tuple[List[Dict], Dict]:
    """
    使用黑色印刷边缘提取 + floodFill + findContours 提取闭合轮廓并近似为多边形。
    输出： (regions, metadata)
    regions: [{regionId, name, polygon:[{"x", "y"}, ...], color}...]
    均为归一化坐标 (0.0 - 1.0)
    """
    h, w = img.shape[:2]
    
    # 默认配置
    method_cfg = {
        # 黑色印刷边缘筛选参数
        "black_v_max": config.get("black_v_max", 0),
        "black_s_max": config.get("black_s_max", 0),
        "black_rgb_max": config.get("black_rgb_max", 150),
        "black_rgb_diff_max": config.get("black_rgb_diff_max", 55),
        "very_dark_v_max": config.get("very_dark_v_max", 90),
        "very_dark_rgb_max": config.get("very_dark_rgb_max", 110),
        "very_dark_rgb_diff_max": config.get("very_dark_rgb_diff_max", 55),
        "min_black_component_area": config.get("min_black_component_area", 20),
        "close_kernel_size": config.get("close_kernel_size", 7),
        "close_iterations": config.get("close_iterations", 1),
        "dilate_kernel_size": config.get("dilate_kernel_size", 3),
        "dilate_iterations": config.get("dilate_iterations", 2),
        # 闭合区域过滤参数
        "min_region_area": config.get("min_region_area", 100),
        "remove_bottom_text": config.get("remove_bottom_text", True),
        "bottom_text_y_ratio": config.get("bottom_text_y_ratio", 0.76),
        "keep_largest_n_regions": config.get("keep_largest_n_regions", None),
        # 多边形近似参数
        "approx_epsilon_ratio": config.get("approx_epsilon_ratio", 0.003),
    }

    # 1. 黑色印刷边缘提取
    black_raw, black_clean, black_wall = extract_black_print_edges(img, method_cfg)

    # 2. floodFill 提取闭合区域
    inverted, floodfilled, closed_raw = extract_closed_regions_by_floodfill(black_wall)

    # 3. 过滤闭合区域
    final_mask, components = filter_closed_regions(closed_raw, h, method_cfg)

    # 4. 提取轮廓并构建区域
    contours, _ = cv2.findContours(
        final_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    # 预定义颜色列表
    colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#fa541c', '#13c2c2', '#f5222d']

    regions = []
    idx = 0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < method_cfg["min_region_area"]:
            continue

        # 多边形近似
        epsilon = method_cfg["approx_epsilon_ratio"] * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        pts = approx.reshape(-1, 2)
        if pts.shape[0] < 3:
            continue

        # 归一化坐标
        points = []
        for (px, py) in pts:
            points.append({"x": round(float(px) / w, 6), "y": round(float(py) / h, 6)})

        # 计算边界框
        bx, by, bw, bh = cv2.boundingRect(approx)
        bbox = {
            "x": round(bx / w, 6),
            "y": round(by / h, 6),
            "w": round(bw / w, 6),
            "h": round(bh / h, 6)
        }

        regions.append({
            "regionId": f"region{idx + 1}",
            "name": f"区域{idx + 1}",
            "polygon": points,
            "color": colors[idx % len(colors)],
            "bounding_box": bbox
        })
        idx += 1

    metadata = {"original_width": w, "original_height": h}
    return regions, metadata
