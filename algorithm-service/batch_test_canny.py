import cv2
import numpy as np
import json
import os
from algo.canny import detect_regions

# 输入目录
input_dir = 'lj2_image'
# 输出目录
output_dir = 'batch_canny_output'

# 创建输出目录
os.makedirs(output_dir, exist_ok=True)

# 获取所有图片文件
image_files = [f for f in os.listdir(input_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]

print(f"📁 找到 {len(image_files)} 张图片")
print(f"📂 输出目录: {output_dir}\n")

# 批量处理
results = []
config = {}  # 使用默认配置

for i, filename in enumerate(image_files, 1):
    image_path = os.path.join(input_dir, filename)
    img = cv2.imread(image_path)
    
    if img is None:
        print(f"❌ [{i}/{len(image_files)}] 无法读取: {filename}")
        continue
    
    print(f"🔄 [{i}/{len(image_files)}] 处理: {filename}")
    
    try:
        # 调用 detect_regions 函数
        regions, metadata = detect_regions(img, config)
        
        # 保存结果
        result = {
            'filename': filename,
            'metadata': metadata,
            'region_count': len(regions),
            'regions': regions
        }
        results.append(result)
        
        # 生成可视化
        if len(regions) > 0:
            vis_img = img.copy()
            h, w = img.shape[:2]
            
            for region in regions:
                polygon = region.get('polygon', [])
                color_hex = region.get('color', '#1890ff')
                
                # 将十六进制颜色转换为 BGR
                color_hex = color_hex.lstrip('#')
                color_bgr = tuple(int(color_hex[i:i+2], 16) for i in (4, 2, 0))
                
                # 将归一化坐标转换为像素坐标
                points_pixel = []
                for p in polygon:
                    x = int(p['x'] * w)
                    y = int(p['y'] * h)
                    points_pixel.append((x, y))
                
                # 绘制多边形
                points_pixel = np.array(points_pixel, np.int32)
                cv2.polylines(vis_img, [points_pixel], True, color_bgr, 3)
                
                # 绘制区域标签
                if len(points_pixel) > 0:
                    center = np.mean(points_pixel, axis=0).astype(int)
                    cv2.putText(vis_img, region.get('name', ''), tuple(center), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, color_bgr, 2)
            
            # 保存可视化结果
            vis_filename = f"vis_{filename}"
            vis_path = os.path.join(output_dir, vis_filename)
            cv2.imwrite(vis_path, vis_img)
        
        print(f"   ✅ 检测到 {len(regions)} 个区域")
        
    except Exception as e:
        print(f"   ❌ 处理失败: {e}")
        results.append({
            'filename': filename,
            'error': str(e),
            'region_count': 0,
            'regions': []
        })

# 保存汇总结果
summary = {
    'total_images': len(image_files),
    'processed_count': len(results),
    'results': results
}

summary_path = os.path.join(output_dir, 'batch_summary.json')
with open(summary_path, 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)

print(f"\n💾 汇总结果已保存到: {summary_path}")
print(f"🖼️  可视化结果已保存到: {output_dir}/")

# 统计信息
total_regions = sum(r['region_count'] for r in results)
avg_regions = total_regions / len(results) if results else 0

print(f"\n📊 统计信息:")
print(f"   总图片数: {len(image_files)}")
print(f"   处理成功: {len(results)}")
print(f"   检测到的总区域数: {total_regions}")
print(f"   平均每张图片的区域数: {avg_regions:.2f}")

print(f"\n✅ 批量测试完成！")
