import cv2
import numpy as np
import json
from algo.canny import detect_regions

# 读取测试图片
image_path = 'Original.png'
img = cv2.imread(image_path)

if img is None:
    print(f"❌ 无法读取图片: {image_path}")
    exit(1)

print(f"✅ 成功读取图片: {image_path}")
print(f"   图片尺寸: {img.shape[:2]} (高x宽)")

# 调用 detect_regions 函数
config = {}  # 使用默认配置
regions, metadata = detect_regions(img, config)

# 输出结果
print(f"\n📊 检测结果:")
print(f"   元数据: {json.dumps(metadata, indent=2, ensure_ascii=False)}")
print(f"   检测到区域数量: {len(regions)}")

if len(regions) > 0:
    print(f"\n📍 区域详情:")
    for i, region in enumerate(regions):
        print(f"\n   区域 {i+1}:")
        print(f"     regionId: {region.get('regionId')}")
        print(f"     name: {region.get('name')}")
        print(f"     color: {region.get('color')}")
        print(f"     顶点数量: {len(region.get('polygon', []))}")
        print(f"     边界框: {region.get('bounding_box')}")
        
        # 检查坐标是否在 0.0-1.0 范围内
        polygon = region.get('polygon', [])
        if polygon:
            x_coords = [p['x'] for p in polygon]
            y_coords = [p['y'] for p in polygon]
            print(f"     X坐标范围: {min(x_coords):.6f} - {max(x_coords):.6f}")
            print(f"     Y坐标范围: {min(y_coords):.6f} - {max(y_coords):.6f}")
            
            # 验证归一化坐标
            if all(0 <= x <= 1 for x in x_coords) and all(0 <= y <= 1 for y in y_coords):
                print(f"     ✅ 坐标归一化正确")
            else:
                print(f"     ❌ 坐标归一化错误！超出 [0,1] 范围")

# 保存结果到 JSON 文件
output = {
    "metadata": metadata,
    "regions": regions
}

with open('simple_test_result.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\n💾 结果已保存到: simple_test_result.json")

# 可视化结果（可选）
if len(regions) > 0:
    # 在原图上绘制检测到的区域
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
    
    cv2.imwrite('simple_test_visualization.png', vis_img)
    print(f"🖼️  可视化结果已保存到: simple_test_visualization.png")
    
print(f"\n✅ 测试完成！")
