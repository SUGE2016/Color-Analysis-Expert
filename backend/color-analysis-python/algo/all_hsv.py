import csv
import json
import os
import cv2
import numpy as np
import pandas as pd


# 加载 JSON 文件
def load_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)


# 读取文件夹中的所有图片
def load_images_from_folder(folder_path):
    images = []
    for filename in os.listdir(folder_path):
        img_path = os.path.join(folder_path, filename)
        if os.path.isfile(img_path) and filename.endswith(('.png', '.jpg', '.jpeg')):
            img = cv2.imread(img_path)
            images.append((filename, img))
    return images


# 获取掩膜区域
def get_regions_from_json(json_data):
    return json_data.get("regions", [])


def clean_mask(mask):
    """ 对掩膜进行清理，去除小噪点 """
    # **1. 形态学开运算：去掉细小毛躁的区域**
    kernel = np.ones((5, 5), np.uint8)
    mask_cleaned = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)

    # **2. 找轮廓**
    contours, _ = cv2.findContours(mask_cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # **3. 创建一个全黑的掩膜**
    final_mask = np.zeros_like(mask)

    # **4. 只保留较大的轮廓**
    min_contour_area = 100  # 这个值可以调整，去除小碎片
    for contour in contours:
        if cv2.contourArea(contour) > min_contour_area:
            cv2.drawContours(final_mask, [contour], -1, 255, thickness=cv2.FILLED)

    return final_mask


'''''''''
def apply_mask(image, region):
    # 读取掩膜图像
    mask_image_path = region['resource']
    mask_image = cv2.imread(mask_image_path, cv2.IMREAD_GRAYSCALE)
    if mask_image is None:
        raise ValueError(f"Cannot load mask image from {mask_image_path}")

    # 二值化掩膜
    _, mask = cv2.threshold(mask_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # **膨胀掩膜**
    kernel = np.ones((5, 5), np.uint8)
    dilated_mask = cv2.dilate(mask, kernel, iterations=1)

    # **去除毛躁噪声**
    final_mask = clean_mask(dilated_mask)

    # **应用掩膜**
    masked_image = cv2.bitwise_and(image, image, mask=final_mask)

    # **显示结果**
    cv2.imshow("Final Cleaned Mask", final_mask)
    cv2.imshow("Masked Image", masked_image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    return masked_image, final_mask


'''''''''


def apply_mask(image, region, dx=1, dy=-1):
    # 读取掩膜图像
    mask_image_path = region['resource']
    mask_image = cv2.imread(mask_image_path, cv2.IMREAD_GRAYSCALE)
    if mask_image is None:
        raise ValueError(f"Cannot load mask image from {mask_image_path}")

    # 二值化掩膜
    _, mask = cv2.threshold(mask_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 创建平移矩阵，将掩膜右移 `dx`，下移 `dy`
    translation_matrix = np.float32([[1, 0, dx], [0, 1, dy]])

    # 进行仿射变换（平移）
    height, width = mask.shape
    mask = cv2.warpAffine(mask, translation_matrix, (width, height), borderValue=0)

    # 膨胀掩膜
    kernel = np.ones((0, 0), np.uint8)
    dilated_mask = cv2.dilate(mask, kernel, iterations=1)

    # 计算掩膜的腐蚀区域
    erosion_kernel = np.ones((0, 0), np.uint8)  # 10×10 的腐蚀区域
    eroded_mask = cv2.erode(mask, erosion_kernel, iterations=1)  # 腐蚀

    # 计算膨胀+掩膜本身+腐蚀的综合区域
    mask_combined = cv2.bitwise_or(mask, dilated_mask)  # 膨胀+原始掩膜
    mask_combined = cv2.bitwise_or(mask_combined, eroded_mask)  # 再加上腐蚀区域

    # 仅在膨胀后覆盖的区域进行 Canny 边缘检测
    masked_image = cv2.bitwise_and(image, image, mask=dilated_mask)  # 只对膨胀区域操作
    edges = cv2.Canny(masked_image, 100, 200)  # Canny 边缘检测
    cv2.imwrite("Edges (On Dilated Masked Image).png", edges)

    # 仅去除掩膜综合区域内的边缘
    edges_near_mask = cv2.bitwise_and(edges, mask_combined)  # 仅保留掩膜相关区域的边缘
    cleaned_edges = cv2.subtract(edges, edges_near_mask)  # 只去除该区域内的边缘
    cv2.imwrite("Cleaned Edges.png", cleaned_edges)

    # 生成线条掩膜
    line_mask = np.zeros_like(mask)
    lines = cv2.HoughLinesP(cleaned_edges, 1, np.pi / 180, threshold=50, minLineLength=30, maxLineGap=10)
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(line_mask, (x1, y1), (x2, y2), 255, thickness=3)
    cv2.imwrite("Hough Line Mask.png", line_mask)

    # 用边缘检测结果更新掩膜
    refined_mask = cv2.bitwise_and(dilated_mask, cv2.bitwise_not(line_mask))
    cv2.imwrite("Refined Mask (After Edge Adjustment).png", refined_mask)

    # 最终应用新的掩膜
    final_masked_image = cv2.bitwise_and(image, image, mask=refined_mask)
    cv2.imwrite("Final Masked Image.png", final_masked_image)

    # cv2.waitKey(0)
    # cv2.destroyAllWindows()

    return final_masked_image, refined_mask


def process_image(image, mask_path):
    # **1. 读取掩膜**
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        raise ValueError(f"Cannot load mask image from {mask_path}")

    # **2. 二值化掩膜**
    _, mask = cv2.threshold(mask, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # **3. 计算掩膜的膨胀区域**
    dilation_kernel = np.ones((0, 0), np.uint8)  # 可调整膨胀大小
    dilated_mask = cv2.dilate(mask, dilation_kernel, iterations=1)  # 膨胀

    # **4. 计算掩膜的腐蚀区域**
    erosion_kernel = np.ones((0, 0), np.uint8)  # 10×10 的腐蚀区域
    eroded_mask = cv2.erode(mask, erosion_kernel, iterations=1)  # 腐蚀

    # **5. 计算膨胀+掩膜本身+腐蚀的综合区域**
    mask_combined = cv2.bitwise_or(mask, dilated_mask)  # 膨胀+原始掩膜
    mask_combined = cv2.bitwise_or(mask_combined, eroded_mask)  # 再加上腐蚀区域

    # **6. 仅在膨胀后覆盖的区域进行 Canny 边缘检测**
    masked_image = cv2.bitwise_and(image, image, mask=dilated_mask)  # 只对膨胀区域操作
    edges = cv2.Canny(masked_image, 100, 200)  # Canny 边缘检测
    cv2.imwrite("Edges (On Dilated Masked Image).png", edges)

    # **7. 仅去除掩膜综合区域内的边缘**
    edges_near_mask = cv2.bitwise_and(edges, mask_combined)  # 仅保留掩膜相关区域的边缘
    cleaned_edges = cv2.subtract(edges, edges_near_mask)  # 只去除该区域内的边缘
    cv2.imwrite("Cleaned Edges.png", cleaned_edges)

    # **8. 生成线条掩膜**
    line_mask = np.zeros_like(mask)
    lines = cv2.HoughLinesP(cleaned_edges, 1, np.pi / 180, threshold=50, minLineLength=30, maxLineGap=10)
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(line_mask, (x1, y1), (x2, y2), 255, thickness=3)
    cv2.imwrite("Hough Line Mask.png", line_mask)

    # **9. 用边缘检测结果更新掩膜**
    refined_mask = cv2.bitwise_and(dilated_mask, cv2.bitwise_not(line_mask))
    cv2.imwrite("Refined Mask (After Edge Adjustment).png", refined_mask)

    # **10. 最终应用新的掩膜**
    final_masked_image = cv2.bitwise_and(image, image, mask=refined_mask)
    cv2.imwrite("Final Masked Image.png", final_masked_image)

    # cv2.waitKey(0)
    # cv2.destroyAllWindows()

    return final_masked_image, refined_mask


def cosine_similarity(v1, v2):
    """
    计算两个向量 v1 和 v2 之间的余弦相似度。
    """
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0
    return dot_product / (norm_v1 * norm_v2)


def get_closest_color_by_cosine(hsv_pixel, COLOR_CLUSTERS_HSV):
    """
    根据 HSV 像素与颜色字典中的颜色进行余弦相似度匹配，返回最相似的颜色。
    """
    h, s, v = hsv_pixel

    closest_color = None
    highest_similarity = -1  # 余弦相似度的范围是 [-1, 1], 初始设为负值表示最小相似度

    for color, hsv_reference in COLOR_CLUSTERS_HSV.items():
        # 计算颜色之间的余弦相似度
        similarity = cosine_similarity(np.array([h, s, v]), np.array(hsv_reference))
        # print(h, s, v, similarity)
        if similarity > highest_similarity:
            highest_similarity = similarity
            closest_color = color

    return closest_color


def categorize_by_HSV(pixels, COLOR_CLUSTERS_HSV):
    """
    将每个像素根据余弦相似度与颜色字典中的颜色进行分类。
    """
    # 记录每种颜色的像素数量
    color_counts = {color: 0 for color in COLOR_CLUSTERS_HSV}

    # 遍历每个像素
    for pixel in pixels:
        # 获取 HSV 值
        h, s, v = pixel

        # 获取与当前像素最接近的颜色
        closest_color = get_closest_color_by_cosine((h, s, v), COLOR_CLUSTERS_HSV)

        # 更新颜色计数
        color_counts[closest_color] += 1

    return color_counts


def process_images_HSV(json_file, images_folder, raw_hsv_csv):
    json_data = load_json(json_file)
    regions = get_regions_from_json(json_data)
    images = load_images_from_folder(images_folder)

    raw_hsv_columns = ['image_name', 'region_id', 'region_alias', 'hsv_pixels']

    # 写表头，只写一次
    if not os.path.exists(raw_hsv_csv):
        with open(raw_hsv_csv, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=raw_hsv_columns)
            writer.writeheader()

    for image_name, image in images:
        print(f"Processing {image_name}")

        # 这张图的所有区域数据，逐条写入
        with open(raw_hsv_csv, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=raw_hsv_columns)

            for region in regions:
                masked_image, final_mask = apply_mask(image, region)

                hsv_image = cv2.cvtColor(masked_image, cv2.COLOR_BGR2HSV)
                masked_pixels = hsv_image[final_mask > 0]
                valid_pixel_count = masked_pixels.shape[0]

                if valid_pixel_count > 0:
                    hsv_array_str = str(masked_pixels.tolist())
                    writer.writerow({
                        'image_name': image_name,
                        'region_id': region['id'],
                        'region_alias': region['alias'],
                        'hsv_pixels': hsv_array_str
                    })


"""

def process_images_HSV(json_file, images_folder, raw_hsv_csv):
    json_data = load_json(json_file)
    regions = get_regions_from_json(json_data)
    images = load_images_from_folder(images_folder)


    color_columns = list(COLOR_CLUSTERS_HSV.keys())
    summary_columns = ['image_name', 'region_id', 'region_alias', 'valid_pixels'] + color_columns
    summary_results = pd.DataFrame(columns=summary_columns)

    # 保存原始HSV数组的表格
    raw_hsv_records = []

    for image_name, image in images:
        print(image_name)
        for region in regions:
            masked_image, final_mask = apply_mask(image, region)

            hsv_image = cv2.cvtColor(masked_image, cv2.COLOR_BGR2HSV)
            masked_pixels = hsv_image[final_mask > 0]  # N x 3
            valid_pixel_count = masked_pixels.shape[0]

            if valid_pixel_count > 0:

                # 保存原始HSV像素数组为字符串形式（整体作为一列）
                hsv_array_str = str(masked_pixels.tolist())
                raw_hsv_records.append({
                    'image_name': image_name,
                    'region_id': region['id'],
                    'region_alias': region['alias'],
                    'hsv_pixels': hsv_array_str
                })

    # 保存两个结果
    # summary_results.to_csv(output_csv, index=False)
    pd.DataFrame(raw_hsv_records).to_csv(raw_hsv_csv, index=False)

"""

COLOR_CLUSTERS_HSV = {
    "color1": [1, 175, 252],
    "color2": [15, 202, 253],
    "color3": [28, 198, 254],
    "color4": [36, 178, 206],
    "color5": [72, 151, 145],
    "color6": [101, 154, 192],
    "color7": [104, 161, 155],
    "color8": [108, 124, 136],
    "color9": [170, 123, 219],
    "color10": [15, 73, 130],
    "color11": [28, 19, 165],
    "color12": [54, 42, 97],
    "black": [0, 0, 0],
    "white": [0, 0, 255]
}

if __name__ == '__main__':
    json_file = 'butterfly.json'
    images_folder = 'lj2_aligned_colored_images'
    raw_hsv_csv = 'lj2_all_hsv_results.csv'
    process_images_HSV(json_file, images_folder, raw_hsv_csv)

    json_file = 'edge.json'
    images_folder = 'lj2_aligned_colored_images'
    raw_hsv_csv = 'lj2_all_edge_hsv_results.csv'
    process_images_HSV(json_file, images_folder, raw_hsv_csv)
