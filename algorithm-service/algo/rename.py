import os
import re

# 文件夹路径（替换为你自己的路径）
folder_path = "lj2_image"

# 遍历所有文件
for filename in os.listdir(folder_path):
    if filename.lower().endswith(('.jpg', '.png', '.jpeg')):
        # 使用正则匹配文件名：如 lj2_01_01_05.jpg
        match = re.match(r"(lj2_\d{2}_\d{2}_)(\d{2})(\.\w+)", filename)
        if match:
            prefix = match.group(1)     # lj2_01_01_
            last_num = int(match.group(2))  # 取出最后的数字部分，例如 05 → 5
            suffix = match.group(3)     # .jpg 等

            # 应用你的规则：(奇数+1)//2
            new_last_num = (last_num + 1) // 2
            new_filename = f"{prefix}{new_last_num:02d}{suffix}"

            # 重命名文件
            src = os.path.join(folder_path, filename)
            dst = os.path.join(folder_path, new_filename)
            os.rename(src, dst)
            print(f"✅ {filename} → {new_filename}")
