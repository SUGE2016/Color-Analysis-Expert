import cv2
import numpy as np
import os
import pandas as pd

# ==== 设置路径 ====
mask_path = 'edge_masks/3.png'  # 你的掩膜图像，白色为出界区域
color_folder = 'lj2_aligned_colored_images/'  # 涂色图像文件夹
output_folder = 'lj2_butterfly_color_outside_highlighted/'
os.makedirs(output_folder, exist_ok=True)
# ==== 加载掩膜 ====
mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

# 掩膜调整
# 二值化掩膜
_, mask = cv2.threshold(mask, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

dx = 1
dy = -1

# 创建平移矩阵，将掩膜右移 `dx`，下移 `dy`
translation_matrix = np.float32([[1, 0, dx], [0, 1, dy]])

# 进行仿射变换（平移）
height, width = mask.shape
mask = cv2.warpAffine(mask, translation_matrix, (width, height), borderValue=0)



_, mask_bin = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)  # 白色区域为出界敏感区
mask_bool = mask_bin == 255
mask_area = np.sum(mask_bool)

# ==== 遍历涂色图像 ====
for filename in os.listdir(color_folder):
    if not filename.lower().endswith(('.jpg', '.png', '.jpeg')):
        continue

    img_path = os.path.join(color_folder, filename)
    img = cv2.imread(img_path)
    if img is None or img.shape[:2] != mask.shape:
        print(f'图像尺寸不一致或无法读取：{filename}')
        continue

    # ==== 处理图像 ====
    img_hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation = img_hsv[:, :, 1]
    value = img_hsv[:, :, 2]

    # 判断在掩膜区域里是否“有颜色”（饱和度和明度足够高）
    colored_mask_area = (saturation > 30) & (value > 50) & mask_bool
    out_of_bounds_count = np.sum(colored_mask_area)
    out_of_bounds_ratio = out_of_bounds_count / mask_area if mask_area else 0

    # ==== 输出结果 ====
    print(f"{filename} 出界像素: {out_of_bounds_count}, 出界比例: {out_of_bounds_ratio:.2%}")

    # ==== 可视化红色高亮 ====
    highlight_img = img.copy()
    highlight_img[colored_mask_area] = [0, 0, 255]  # 红色高亮出界区域

    # 保存图像
    out_path = os.path.join(output_folder, filename)
    cv2.imwrite(out_path, highlight_img)
