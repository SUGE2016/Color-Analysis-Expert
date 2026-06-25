import os


# Step 1: 图像校正
print("Step 1: 图像校正")
os.system("python image_correction.py")

# Step 2: 掩膜区域 HSV 提取
print("Step 2: 掩膜区域 HSV 提取")
os.system("python all_hsv.py")

# Step 3.1: HSV 熵计算
print("Step 3.1: HSV 熵计算")
os.system("python entropy_region.py")

# Step 3.2: 灰度值提取与熵计算
print("Step 3.2: 灰度值提取与熵计算")
os.system("python image_gary_values.py")
os.system("python gary_entropy.py")

# Step 3.3: 色彩分类与统计
print("Step 3.3: 色彩分类与统计")
os.system("python main_color.py")
os.system("python main_color_number.py")
os.system("python edge_color.py")

# Step 4: 出界比例分析
print("Step 4: 出界比例分析")
os.system("python color_outside_lines.py")

# # Step 5: 文件重命名（可选）
# print("Step 5: 文件重命名（可选）")
# os.system("python rename.py")

print("Kiang!")