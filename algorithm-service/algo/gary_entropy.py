import csv
import numpy as np
import math
import json
import sys

# 在导入 csv 模块后，设置字段大小限制
csv.field_size_limit(10**7)  # 设置一个合理的更大字段大小（避免 overflow）

# 计算灰度值的熵
def calculate_entropy(gray_values):
    # 计算灰度值的频率分布
    unique, counts = np.unique(gray_values, return_counts=True)
    probabilities = counts / len(gray_values)

    # 计算熵
    entropy = -np.sum(probabilities * np.log2(probabilities + np.finfo(float).eps))  # 加一个小的常数避免对数零值
    return entropy


# 读取 CSV 文件并计算每个区域的熵
def calculate_region_entropy(csv_file):
    entropy_results = []

    # 读取 CSV 文件
    with open(csv_file, mode='r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

        for row in reader:
            image_name = row['image_name']
            region_id = row['region_id']
            region_alias = row['region_alias']
            gray_values = json.loads(row['gray_values'])  # 转回数组

            # 计算该区域的熵
            entropy = calculate_entropy(np.array(gray_values))

            # 保存计算结果
            entropy_results.append({
                'image_name': image_name,
                'region_id': region_id,
                'region_alias': region_alias,
                'entropy': entropy
            })

    return entropy_results


# 将熵值保存到新的 CSV 文件
def save_entropy_to_csv(entropy_results, output_file):
    # 写入 CSV 文件
    with open(output_file, mode='w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['image_name', 'region_id', 'region_alias', 'entropy']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()  # 写入表头
        for result in entropy_results:
            writer.writerow(result)

    print(f"熵计算完毕，结果保存在 '{output_file}' 文件中。")


# 主函数
if __name__ == "__main__":
    # 输入文件路径
    csv_file = 'lj2_grayscale_values.csv'  # 之前保存灰度值的 CSV 文件
    output_file = 'lj2_gary_entropy_values.csv'  # 输出熵结果的文件

    # 计算每个区域的熵
    entropy_results = calculate_region_entropy(csv_file)

    # 保存熵结果到新的 CSV 文件
    save_entropy_to_csv(entropy_results, output_file)

    csv_file = 'lj2_edge_grayscale_values.csv'  # 之前保存灰度值的 CSV 文件
    output_file = 'lj2_edge_gary_entropy_values.csv'  # 输出熵结果的文件

    # 计算每个区域的熵
    entropy_results = calculate_region_entropy(csv_file)

    # 保存熵结果到新的 CSV 文件
    save_entropy_to_csv(entropy_results, output_file)