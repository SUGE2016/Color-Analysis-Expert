import csv
import json
import os
import pandas as pd
from collections import Counter

# 定义颜色范围（H: 色调，S: 饱和度，V: 明度）
COLOR_RANGES = {
    "red": {"H": (0, 8), "S": (51, 256), "V": (63.75, 256)},  # 红色区间 (0-15, 20+, 25+)
    "orange": {"H": (8, 23), "S": (100, 256), "V": (150, 256)},  # 橙色区间 (15-45, 20+, 35+)
    "yellow": {"H": (23, 30), "S": (51, 256), "V": (63.75, 256)},  # 黄色区间 (45-60, 20+, 25+)
    "green": {"H": (30, 82.5), "S": (51, 256), "V": (63.75, 256)},  # 绿色区间 (60-165, 20+, 25+)
    "blue": {"H": (82.5, 127.5), "S": (51, 256), "V": (63.75, 256)},  # 蓝色区间 (165-255, 20+, 25+)
    "purple": {"H": (127.5, 180), "S": (51, 256), "V": (63.75, 256)},  # 紫色区间 (255-360, 20+, 25+)
    "brown": {"H": (7.5, 22.5), "S": (20, 140), "V": (50, 150)},  # 棕色区间 (15-45, 20-50, 25-35)
    "gray": {"H": (0, 180), "S": (0, 51), "V": (63.75, 216.75)},  # 灰色区间 (任意, 0-20, 25-85)
    "black": {"H": (0, 180), "S": (0, 256), "V": (0, 63.75)},  # 黑色区间 (任意, 任意, 0-25)
    "white": {"H": (0, 180), "S": (0, 51), "V": (216.75, 256)},  # 白色区间 (任意, 0-20, 85+)

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
    input_file = 'lj2_all_edge_hsv_results.csv'
    output_file = 'lj2_edge_main_color.csv'
    process_csv(input_file, output_file, chunk_size=100)