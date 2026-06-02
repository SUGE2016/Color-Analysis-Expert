import os
import json
import numpy as np
import cv2
import csv


# 定义函数：计算区域的灰度值
def calculate_grayscale(image_path, mask_path):
    # 加载彩色图像
    image = cv2.imread(image_path)
    if image is None:
        print(f"无法加载图像: {image_path}")
        return None

    # 加载掩膜图像（假设是白色掩膜，值为255表示区域）
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        print(f"无法加载掩膜图像: {mask_path}")
        return None

    # 确保掩膜图像与彩色图像大小一致
    if image.shape[:2] != mask.shape:
        print(f"图像和掩膜的尺寸不匹配: {image_path} 和 {mask_path}")
        return None

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


    # 使用掩膜提取图像中的对应区域
    masked_image = cv2.bitwise_and(image, image, mask=mask)

    # 将图像转换为灰度图
    gray_image = cv2.cvtColor(masked_image, cv2.COLOR_BGR2GRAY)

    # 获取灰度值矩阵（每个像素的灰度值）
    gray_values = gray_image[mask == 255].flatten()  # 只提取掩膜区域的灰度值
    return gray_values


# 定义函数：处理 JSON 文件和图像文件夹
def process_json_and_images(json_file, image_folder):
    # 读取 JSON 数据
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 获取 test 文件夹中的所有图像文件
    image_files = [f for f in os.listdir(image_folder) if f.endswith('.jpg') or f.endswith('.png')]

    # 打开 CSV 文件并写入表头
    with open('lj2_edge_grayscale_values.csv', mode='w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['image_name', 'region_id', 'region_alias', 'gray_values']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()  # 写入表头

        # 遍历 test 文件夹中的每一张图像
        for image_file in image_files:
            image_path = os.path.join(image_folder, image_file)

            # 遍历 JSON 中的 regions
            for region in data['regions']:
                region_id = region['id']
                region_alias = region['alias']
                resource = region['resource']  # 资源路径（白色掩膜图像）

                # 获取掩膜图像的绝对路径
                mask_path = resource  # 假设掩膜图像路径是完整的

                # 计算灰度值
                gray_values = calculate_grayscale(image_path, mask_path)

                if gray_values is not None:
                    # 将灰度值数组转为字符串以便保存
                    gray_values_str = json.dumps(gray_values.tolist())  # 转为字符串

                    # 将每个图像和区域的灰度值数组写入 CSV 文件
                    writer.writerow({
                        'image_name': image_file,
                        'region_id': region_id,
                        'region_alias': region_alias,
                        'gray_values': gray_values_str
                    })

    print("灰度值计算完毕，结果保存在 'lj2_edge_grayscale_values.csv' 文件中。")


# 主函数
if __name__ == "__main__":
    # 输入参数：JSON 文件路径和图像文件夹路径
    # json_file = 'butterfly.json'  # 假设 JSON 文件名
    json_file = 'edge.json'
    image_folder = 'lj2_aligned_colored_images'  # 图像文件夹路径

    # 调用处理函数
    process_json_and_images(json_file, image_folder)
