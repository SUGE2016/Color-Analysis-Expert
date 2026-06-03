import cv2
import numpy as np
from typing import List, Dict, Tuple


def detect_regions(img: np.ndarray, config: dict) -> Tuple[List[Dict], Dict]:
    """
    使用 Canny + findContours 提取闭合轮廓并近似为多边形。
    输出： (regions, metadata)
    regions: [{region_id, type:"polygon", points:[{"x", "y"}, ...], bounding_box:{"x","y","w","h"}}...]
    均为归一化坐标 (0.0 - 1.0)
    """
    h, w = img.shape[:2]
    method_cfg = {
        "threshold1": config.get("threshold1", 100),
        "threshold2": config.get("threshold2", 200),
        "gaussian_blur": config.get("gaussian_blur", 5),
        "min_area": config.get("min_area", 500)
    }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gb = method_cfg["gaussian_blur"]
    if gb % 2 == 0:
        gb += 1
    blur = cv2.GaussianBlur(gray, (gb, gb), 0)
    edges = cv2.Canny(blur, method_cfg["threshold1"], method_cfg["threshold2"])
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    idx = 0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < method_cfg["min_area"]:
            continue
        eps = 0.01 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, eps, True)
        pts = approx.reshape(-1, 2)
        if pts.shape[0] < 3:
            continue
        points = []
        for (px, py) in pts:
            points.append({"x": round(float(px) / w, 6), "y": round(float(py) / h, 6)})

        bx, by, bw, bh = cv2.boundingRect(approx)
        bbox = {
            "x": round(bx / w, 6),
            "y": round(by / h, 6),
            "w": round(bw / w, 6),
            "h": round(bh / h, 6)
        }
        regions.append({
            "region_id": f"r{idx:04d}",
            "type": "polygon",
            "points": points,
            "bounding_box": bbox
        })
        idx += 1

    metadata = {"original_width": w, "original_height": h}
    return regions, metadata
