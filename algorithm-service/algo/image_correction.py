import cv2
import numpy as np
import os

def imread_unicode(image_path):
    """ 读取支持中文路径的图片 """
    image = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        print(f"❌ [错误] 无法读取图片: {image_path}")
    return image

def detect_points_model(image_path):
    """ 自动检测图像的四个角点 """
    # print(f"🔍 处理图片: {image_path}")
    image = imread_unicode(image_path)

    if image is None:
        print(f"❌ 读取失败: {image_path}")
        return None

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # **方法：寻找黑色矩形框**
    # 使用灰度图像来找到黑色区域（亮度较低的区域）
    # 通过阈值处理提取出黑色区域
    _, binary = cv2.threshold(blurred, 80, 255, cv2.THRESH_BINARY_INV)  # 80为黑色阈值，可以根据需要调整

    # 对二值化图像进行形态学操作，清理噪声
    kernel = np.ones((5, 5), np.uint8)
    cleaned_binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # 寻找黑色区域的轮廓
    contours, _ = cv2.findContours(cleaned_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print(f"❌ [错误] 没找到有效轮廓: {image_path}")
        return None

    points = []

    # 遍历轮廓，筛选出可能的矩形定位点
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 4:  # 矩形轮廓
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = float(w) / h
            area = cv2.contourArea(contour)
            if 0.5 <= aspect_ratio <= 2 and area > 100:  # 面积过滤
                points.append((x + w // 2, y + h // 2))  # 使用矩形中心作为点

    # 检查是否找到4个点
    if len(points) == 4:
        # 根据图像的逻辑位置排序 (左上、右上、右下、左下)
        points = sorted(points, key=lambda p: (p[1], p[0]))  # 按 y 排序，y 相同按 x 排序
        top_points = sorted(points[:2], key=lambda p: p[0])  # 上方两个点按 x 排序
        bottom_points = sorted(points[2:], key=lambda p: p[0])  # 下方两个点按 x 排序
        ordered_points = top_points + bottom_points
        # print(f"✅ [成功] 角点坐标: {ordered_points}")
    else:
        print(f"❌ [错误] 检测到 {len(points)} 个点，可能错误。请检查图像或调整参数。")
        return None

    return np.array(ordered_points, dtype="float32")



def detect_points(image_path):
    """ 自动检测图像的四个角点 """
    # print(f"🔍 处理图片: {image_path}")
    image = imread_unicode(image_path)

    if image is None:
        print(f"❌ 读取失败: {image_path}")
        return None
    # 获取图像的高度和宽度
    image_h, image_w = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # **方法：寻找黑色矩形框**
    # 使用灰度图像来找到黑色区域（亮度较低的区域）
    # 通过阈值处理提取出黑色区域
    _, binary = cv2.threshold(blurred, 100, 255, cv2.THRESH_BINARY_INV)  # 80为黑色阈值，可以根据需要调整

    # 对二值化图像进行形态学操作，清理噪声
    kernel = np.ones((5, 5), np.uint8)
    cleaned_binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    # 寻找黑色区域的轮廓
    contours, _ = cv2.findContours(cleaned_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print(f"❌ [错误] 没找到有效轮廓: {image_path}")
        return None

    points = []


    cv2.imshow("Original", image)  # 原图

    cv2.imshow("Gray", gray)       # 灰度图

    cv2.imshow("Blurred", blurred) # 高斯模糊后的图

    cv2.imshow("Binary", binary)   # 二值化后的图

    cv2.imshow("Cleaned Binary", cleaned_binary)  # 形态学处理后的图

    # cv2.waitKey(0)
    # cv2.destroyAllWindows()

    # 遍历轮廓，筛选出可能的矩形定位点
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 4:  # 矩形轮廓
            x, y, w, h = cv2.boundingRect(approx)
            print(x, y, w, h)
            aspect_ratio = float(w) / h
            area = cv2.contourArea(contour)
            print(area)
            if 0.5 <= aspect_ratio <= 2 and area > 100:  # 面积过滤
                center_x, center_y = x + w // 2, y + h // 2
                print(center_x, center_y)
                # **步骤 4️⃣：按四个区域筛选**
                if 0 <= center_x <= 280 and 0 <= center_y <= 500:  # 左上角
                    points.append((center_x, center_y))
                    print('左上角:', center_x, center_y)
                elif 0 <= center_x <= 280 and 1200 <= center_y <= image_h:  # 左下角
                    points.append((center_x, center_y))
                    print('左下角:', center_x, center_y)
                elif 1700 <= center_x <= image_w and 0 <= center_y <= 500:  # 右上角
                    points.append((center_x, center_y))
                    print('右上角:', center_x, center_y)
                elif 1700 <= center_x <= image_w and 1200 <= center_y <= image_h:  # 右下角
                    points.append((center_x, center_y))
                    print('右下角:', center_x, center_y)

    if len(points) == 4:
        # **步骤 5️⃣：排序角点**
        points = sorted(points, key=lambda p: (p[1], p[0]))  # 先按 y 排序，y 相同按 x 排序
        top_points = sorted(points[:2], key=lambda p: p[0])  # 上方两个点按 x 排序
        bottom_points = sorted(points[2:], key=lambda p: p[0])  # 下方两个点按 x 排序
        ordered_points = np.array(top_points + bottom_points, dtype="float32")

        print(f"✅ 角点坐标: {ordered_points}")
        return ordered_points
    if len(points) == 3:
        print(image_path)
        print(f"⚠️ 检测到3个角点，尝试推算第四个角点")
        ordered_points = guess_fourth_point(points, image_w, image_h)
    else:
        print(image_path)
        print(f"❌ [错误] 角点检测失败，找到 {len(points)} 个点")
        return None

    return np.array(ordered_points, dtype="float32")


def guess_fourth_point(points, image_w, image_h):
    """根据三个点推测第四个角点"""
    if len(points) != 3:
        return "错误：需要三个点来推测第四个点"

    # 初始化角点
    top_left = None
    bottom_left = None
    top_right = None
    bottom_right = None

    # 先分类：确定哪些是已知的角点
    for center_x, center_y in points:
        if 0 <= center_x <= 280 and 0 <= center_y <= 500:  # 左上角
            top_left = (center_x, center_y)
        elif 0 <= center_x <= 280 and 1200 <= center_y <= image_h:  # 左下角
            bottom_left = (center_x, center_y)
        elif 1700 <= center_x <= image_w and 0 <= center_y <= 500:  # 右上角
            top_right = (center_x, center_y)
        elif 1700 <= center_x <= image_w and 1200 <= center_y <= image_h:  # 右下角
            bottom_right = (center_x, center_y)

    # 找出缺失的角点，并利用向量公式计算
    if top_left is None:
        # 缺少左上角，计算公式：左上 = 右上 + 左下 - 右下
        top_left = (top_right[0] + bottom_left[0] - bottom_right[0],
                    top_right[1] + bottom_left[1] - bottom_right[1])
    elif top_right is None:
        # 缺少右上角，计算公式：右上 = 左上 + 右下 - 左下
        top_right = (top_left[0] + bottom_right[0] - bottom_left[0],
                     top_left[1] + bottom_right[1] - bottom_left[1])
    elif bottom_left is None:
        # 缺少左下角，计算公式：左下 = 左上 + 右下 - 右上
        bottom_left = (top_left[0] + bottom_right[0] - top_right[0],
                       top_left[1] + bottom_right[1] - top_right[1])
    elif bottom_right is None:
        # 缺少右下角，计算公式：右下 = 右上 + 左下 - 左上
        bottom_right = (top_right[0] + bottom_left[0] - top_left[0],
                        top_right[1] + bottom_left[1] - top_left[1])

    # 结果四个角点
    result = [top_left, top_right, bottom_left, bottom_right]

    # 确保坐标在图像范围内
    result = [(min(max(0, x), image_w), min(max(0, y), image_h)) for x, y in result]

    print("四个角点:", result)
    return result



def align_image(model_image_path, colored_image_path, output_folder):
    """ 进行透视变换 """
    # 使用 detect_points_model 检测模板图像的角点
    template_points = detect_points_model(model_image_path)
    # 使用 detect_points 检测涂色图像的角点
    image_points = detect_points(colored_image_path)

    if template_points is None or image_points is None:
        print(f"⚠️ [警告] 无法对齐: {colored_image_path}")
        return

    def order_points(pts):
        """ 根据角点的坐标顺序进行排序 """
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]  # 左上角
        rect[2] = pts[np.argmax(s)]  # 右下角
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # 右上角
        rect[3] = pts[np.argmax(diff)]  # 左下角
        return rect

    template_points = order_points(template_points)
    image_points = order_points(image_points)

    # 计算透视变换矩阵
    M = cv2.getPerspectiveTransform(image_points, template_points)
    template_image = imread_unicode(model_image_path)
    h, w = template_image.shape[:2]

    # 透视变换
    aligned_image = cv2.warpPerspective(imread_unicode(colored_image_path), M, (w, h))

    # 保存对齐后的图像
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    output_path = os.path.join(output_folder, os.path.basename(colored_image_path))
    cv2.imwrite(output_path, aligned_image)
    # print(f"✅ [成功] 已保存对齐图片: {output_path}")



def find_images_recursive(folder):
    """ 递归查找所有图片 """
    image_paths = []
    for root, _, files in os.walk(folder):
        for file in files:
            if file.lower().endswith((".jpg", ".png", ".jpeg")):
                full_path = os.path.join(root, file)
                image_paths.append(full_path)
    return image_paths


def process_folder(model_image_path, input_folder, output_folder):
    """ 处理整个文件夹的涂色图像 """
    image_paths = find_images_recursive(input_folder)

    if not image_paths:
        print("❌ [错误] 输入文件夹没有找到图片")
        return

    # print(f"📂 找到 {len(image_paths)} 张图片")
    for idx, colored_image_path in enumerate(image_paths, 1):
        # print(f"🔹 [{idx}/{len(image_paths)}] 处理: {colored_image_path}")
        align_image(model_image_path, colored_image_path, output_folder)



# model_image_path = "model_image.jpg"  # 你的标准模板图像
# input_folder = "lj2_image"  # 存放小朋友涂色图像的文件夹
# # output_folder = "aligned_colored_images"  # 结果输出文件夹
# output_folder = "lj2_aligned_colored_images"
# process_folder(model_image_path, input_folder, output_folder)

def main():
   
    model_image_path = "model_image.jpg"
    input_folder = "lj2_image"
    output_folder = "lj2_aligned_colored_images"

    process_folder(model_image_path, input_folder, output_folder)


if __name__ == "__main__":
    main()