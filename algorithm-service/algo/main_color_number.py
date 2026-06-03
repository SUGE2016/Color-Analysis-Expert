import csv
import json
import os
import pandas as pd
from collections import Counter

# 定义颜色范围（H: 色调，S: 饱和度，V: 明度）
COLOR_RANGES = {
    "red": {"H": (0, 5), "S": (160, 200), "V": (245, 255)},
    "orange": {"H": (10, 18), "S": (220, 235), "V": (250, 255)},
    "lemon_yellow": {"H": (20, 30), "S": (220, 235), "V": (250, 255)},
    "yellow_green": {"H": (35, 40), "S": (210, 230), "V": (170, 195)},
    "green": {"H": (72, 76), "S": (210, 220), "V": (100, 120)},
    "blue": {"H": (95, 100), "S": (150, 180), "V": (180, 200)},
    "dark_blue": {"H": (100, 105), "S": (180, 220), "V": (160, 175)},  # 藏青
    "blue_purple": {"H": (105, 115), "S": (130, 140), "V": (85, 110)},
    "purple": {"H": (160, 175), "S": (160, 180), "V": (180, 190)},
    "brown": {"H": (10, 15), "S": (90, 120), "V": (85, 130)},
    "gray_white": {"H": (0, 180), "S": (0, 10), "V": (100, 120)},
    "black": {"H": (0, 180), "S": (0, 80), "V": (0, 60)},
}







def classify_pixel(hsv_pixel):
    h, s, v = hsv_pixel
    for color, ranges in COLOR_RANGES.items():
        h_range, s_range, v_range = ranges["H"], ranges["S"], ranges["V"]
        if (h_range[0] <= h < h_range[1]) and (s_range[0] <= s < s_range[1]) and (v_range[0] <= v < v_range[1]):
            return color
    return "uncategorized"


def process_csv(input_file, output_file, chunk_size=1000):
    # 确保输出目录存在
    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 初始化CSV文件和表头
    header_written = False
    fieldnames = ["image_name", "region_id", "region_alias", "valid_pixels"] + list(COLOR_RANGES.keys()) + [
        "uncategorized"]

    # 分块读取CSV文件
    for chunk in pd.read_csv(input_file, chunksize=chunk_size):
        rows_to_write = []

        for _, row in chunk.iterrows():
            try:
                image_name = row['image_name']
                region_id = row['region_id']
                region_alias = row['region_alias']
                hsv_pixels = json.loads(row['hsv_pixels'])

                # 分类并统计颜色
                classifications = [classify_pixel(pixel) for pixel in hsv_pixels]
                color_counts = Counter(classifications)
                valid_pixels = len(hsv_pixels)  # 计算有效像素总数

                # 准备输出行数据
                row_data = {
                    "image_name": image_name,
                    "region_id": region_id,
                    "region_alias": region_alias,
                    "valid_pixels": valid_pixels,  # 添加有效像素数
                }

                # 为所有颜色添加计数
                for color in fieldnames[4:]:  # 跳过前四个固定字段
                    row_data[color] = color_counts.get(color, 0)

                rows_to_write.append(row_data)

            except Exception as e:
                print(f"处理区域 {row.get('region_id', '未知')} 时出错: {e}")

        # 写入CSV文件（追加模式）
        with open(output_file, 'a', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not header_written:
                writer.writeheader()
                header_written = True
            writer.writerows(rows_to_write)


if __name__ == '__main__':
    input_file = 'lj2_all_hsv_results.csv'
    output_file = 'lj2_main_color_number.csv'
    process_csv(input_file, output_file, chunk_size=1000)