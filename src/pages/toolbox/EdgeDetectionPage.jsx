import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined,
  ScanOutlined, EditOutlined, ClearOutlined, DownloadOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { Button, Card, Space, Tag, Typography, message, Row, Col, Upload, Modal, Input, Select } from "antd";
import { pointInPolygon } from "../../utils/hitTest";
import { toolApi } from "../../api/tool";
import testImage from "../../assets/test-image.svg";

const { Title, Text } = Typography;

// 模拟区域数据 - 初始为空，等待后端返回
const initialRegions = [];

export default function EdgeDetectionPage() {
  const navigate = useNavigate();
  
  // 状态和引用
  const [scale, setScale] = useState(1.0);
  const [regions, setRegions] = useState(initialRegions); // 初始为空，等待后端返回
  const [selectedRegionIds, setSelectedRegionIds] = useState([]); // 改为数组支持多选
  const [isDetecting, setIsDetecting] = useState(false);
  const [hover, setHover] = useState(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  
  // 重命名相关状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingRegionId, setRenamingRegionId] = useState(null);
  const [newRegionName, setNewRegionName] = useState("");
  
  // 多选和合并相关状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [mergeAlgorithm, setMergeAlgorithm] = useState("simple"); // simple | convex | union
  
  // 撤销相关状态
  const [history, setHistory] = useState([]); // 历史记录栈
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);

  // 初始加载默认测试图像
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setHasUploadedImage(true);
    };
    img.src = null;
  }, []);

  // 自动缩放图片以适应容器
  useEffect(() => {
    if (!imgSize || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32; // padding
    const containerHeight = container.clientHeight - 32;
    const scaleX = containerWidth / imgSize.w;
    const scaleY = containerHeight / imgSize.h;
    const autoScale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
    setScale(autoScale);
  }, [imgSize]);

  // 计算CSS尺寸
  const cssSize = useMemo(() => {
    if (!imgSize) return { w: 0, h: 0 };
    return { w: imgSize.w * scale, h: imgSize.h * scale };
  }, [imgSize, scale]);

  // 碰撞检测
  const hitTest = useCallback((p) => {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (pointInPolygon(p, r.polygon)) return r.regionId;
    }
    return null;
  }, [regions]);

  // 双击重命名处理
  const handleDoubleClick = (regionId) => {
    const region = regions.find(r => r.regionId === regionId);
    if (region) {
      setRenamingRegionId(regionId);
      setNewRegionName(region.name);
      setShowRenameModal(true);
    }
  };

  // 确认重命名
  const confirmRename = () => {
    if (renamingRegionId && newRegionName.trim()) {
      setRegions(prev => prev.map(r => 
        r.regionId === renamingRegionId 
          ? { ...r, name: newRegionName.trim() }
          : r
      ));
      message.success("区域重命名成功");
      setShowRenameModal(false);
      setRenamingRegionId(null);
      setNewRegionName("");
    }
  };

  // 取消重命名
  const cancelRename = () => {
    setShowRenameModal(false);
    setRenamingRegionId(null);
    setNewRegionName("");
  };

  // 坐标转换
  const canvasToNorm = useCallback((canvasX, canvasY) => {
    if (!imgSize) return { normX: 0, normY: 0 };
    const imgX = canvasX / scale;
    const imgY = canvasY / scale;
    const normX = clamp01(imgX / imgSize.w);
    const normY = clamp01(imgY / imgSize.h);
    return { normX, normY };
  }, [imgSize, scale]);

  // 自动检测边缘 - 调用后端API
  const performEdgeDetection = useCallback(async () => {
    if (!hasUploadedImage || !imgRef.current) {
      message.warning("请先上传图片");
      return;
    }
    
    setIsDetecting(true);
    setRegions([]); // 清空现有区域
    
    try {
      // 将 Canvas 上的图片转换为 Blob
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      // 构建 FormData
      const formData = new FormData();
      formData.append('file', blob, 'image.png');
      
      // 调用后端 API
      const result = await toolApi.cannyEdgeDetection(formData);
      
      // 处理后端返回的区域数据
      const backendRegions = result.regions || [];
      
      setRegions(backendRegions);
      message.success(`边缘检测完成，发现 ${backendRegions.length} 个区域`);
    } catch (error) {
      console.error('边缘检测失败:', error);
      message.error('边缘检测失败：' + (error.message || '未知错误'));
    } finally {
      setIsDetecting(false);
    }
  }, [hasUploadedImage]);

  // 获取区域颜色（用于手绘区域）
  const getRegionColor = (regionId) => {
    const colors = {
      regionA: "#1890ff",
      regionB: "#52c41a", 
      regionC: "#faad14"
    };
    return colors[regionId] || "#1890ff";
  };

  // 渲染画布
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssSize.w * dpr);
    canvas.height = Math.round(cssSize.h * dpr);
    canvas.style.width = `${cssSize.w}px`;
    canvas.style.height = `${cssSize.h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize.w, cssSize.h);

    // 绘制原始图像
    if (showOriginal) {
      ctx.drawImage(img, 0, 0, cssSize.w, cssSize.h);
    } else {
      // 绘制白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cssSize.w, cssSize.h);
    }

    // 绘制区域
    if (showRegions && regions.length > 0) {
      for (const r of regions) {
        const isSelected = selectedRegionIds.includes(r.regionId);
        const isHover = hover?.hit === r.regionId && !isSelected;
        const isMultiSelected = isMultiSelectMode && isSelected && selectedRegionIds.length > 1;

        const style = isMultiSelected
          ? { stroke: "rgba(255,0,255,0.95)", fill: "rgba(255,0,255,0.22)", lw: 3 }
          : isSelected
          ? { stroke: "rgba(0,255,255,0.95)", fill: "rgba(0,255,255,0.22)", lw: 3 }
          : isHover
          ? { stroke: "rgba(255,120,0,0.95)", fill: "rgba(255,120,0,0.16)", lw: 2.5 }
          : { stroke: r.color || "rgba(24,144,255,0.8)", fill: `${r.color}20` || "rgba(24,144,255,0.1)", lw: 2 };

        drawPolygon(ctx, r.polygon, imgSize.w, imgSize.h, scale, style.stroke, style.fill, style.lw);
        
        // 绘制区域标签
        if (isSelected || isHover) {
          const center = getPolygonCenter(r.polygon);
          const x = center.x * imgSize.w * scale;
          const y = center.y * imgSize.h * scale;
          
          ctx.fillStyle = isMultiSelected ? "rgba(255,0,255,0.95)" : (isSelected ? "rgba(0,255,255,0.95)" : "rgba(255,120,0,0.95)");
          ctx.font = "bold 14px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(r.name, x, y - 10);
        }
      }
    }

    // 绘制手绘中的多边形
    if (isDrawing && drawingPoints.length > 0) {
      ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawingPoints.forEach((p, i) => {
        const x = p.x * imgSize.w * scale;
        const y = p.y * imgSize.h * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (drawingPoints.length > 2) {
        const first = drawingPoints[0];
        ctx.lineTo(first.x * imgSize.w * scale, first.y * imgSize.h * scale);
      }
      ctx.stroke();
      
      // 绘制顶点
      drawingPoints.forEach(p => {
        const x = p.x * imgSize.w * scale;
        const y = p.y * imgSize.h * scale;
        ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 绘制悬停十字线
    if (hover) {
      drawCrosshair(ctx, hover.canvasX, hover.canvasY, cssSize.w, cssSize.h);
      drawDot(ctx, hover.canvasX, hover.canvasY);
    }
  }, [cssSize, drawingPoints, hover, imgSize, isDrawing, regions, scale, selectedRegionIds, isMultiSelectMode, showOriginal, showRegions]);

  useEffect(() => {
    render();
  }, [render]);

  // 鼠标事件处理
  const handleClick = (e) => {
    if (!imgSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);
    
    if (isDrawing) {
      // 添加手绘点
      setDrawingPoints(prev => [...prev, { x: normX, y: normY }]);
    } else {
      const hit = hitTest({ x: normX, y: normY });
      
      if (isMultiSelectMode) {
        // 多选模式：切换选中状态
        if (hit) {
          setSelectedRegionIds(prev => {
            if (prev.includes(hit)) {
              return prev.filter(id => id !== hit);
            } else {
              return [...prev, hit];
            }
          });
        } else {
          // 点击空白处清空选择
          setSelectedRegionIds([]);
        }
      } else {
        // 单选模式：只选中一个
        setSelectedRegionIds(hit ? [hit] : []);
      }
    }
  };

  // 双击事件处理
  const handleCanvasDoubleClick = (e) => {
    if (!imgSize || isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);
    const hit = hitTest({ x: normX, y: normY });
    
    if (hit) {
      handleDoubleClick(hit);
    }
  };

  const handleMove = (e) => {
    if (!imgSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);
    const hit = hitTest({ x: normX, y: normY });
    setHover({ canvasX, canvasY, normX, normY, hit });
  };

  const handleLeave = () => setHover(null);

  // 完成手绘区域
  const finishDrawing = () => {
    if (drawingPoints.length >= 3) {
      const regionNames = ["区域 A", "区域 B", "区域 C", "区域 D", "区域 E", "区域 F"];
      const availableName = regionNames.find(name => !regions.some(r => r.name === name)) || `区域 ${regions.length + 1}`;
      
      const newRegion = {
        regionId: `region-${Date.now()}`,
        name: availableName,
        polygon: [...drawingPoints],
        color: getRegionColor(`region${String.fromCharCode(65 + regions.length)}`)
      };
      setRegions(prev => [...prev, newRegion]);
      message.success(`新区域 "${availableName}" 已添加`);
    }
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  // 清除手绘
  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  // 删除选中区域
  const deleteSelectedRegion = () => {
    if (selectedRegionIds.length > 0) {
      setRegions(prev => prev.filter(r => !selectedRegionIds.includes(r.regionId)));
      setSelectedRegionIds([]);
      message.success("区域已删除");
    }
  };

  // 多边形合并算法（几何合并）
  const mergePolygons = async (polygons, algorithm) => {
    if (polygons.length === 0) return [];
    if (polygons.length === 1) return polygons[0];

    // 使用改进的几何合并算法
    return await mergePolygonsUnion(polygons);
  };

  // 几何合并算法：调用后端 API 进行精确合并
  const mergePolygonsUnion = async (polygons) => {
    if (polygons.length === 0) return [];
    if (polygons.length === 1) return polygons[0];

    try {
      const response = await toolApi.mergePolygons(polygons);
      if (response.data && response.data.polygon) {
        return response.data.polygon;
      }
      // 如果后端失败，回退到凸包
      const allPoints = polygons.flatMap(p => p);
      return computeConvexHull(allPoints);
    } catch (e) {
      console.error("Backend merge failed, falling back to convex hull", e);
      // 如果调用失败，使用凸包作为后备
      const allPoints = polygons.flatMap(p => p);
      return computeConvexHull(allPoints);
    }
  };


  // 凸包算法 (Monotone Chain)
  const computeConvexHull = (points) => {
    if (points.length <= 2) return points;
    
    // 按 x 坐标排序，x 相同按 y 排序
    const sorted = [...points].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });
    
    // 叉积计算
    const crossProduct = (o, a, b) => {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };
    
    // 构建下凸包
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    
    // 构建上凸包
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    
    // 合并（去掉重复的起点和终点）
    upper.pop();
    lower.pop();
    return [...lower, ...upper];
  };

  // 合并选中区域
  const mergeSelectedRegions = async () => {
    if (selectedRegionIds.length < 2) {
      message.warning("请至少选择两个区域进行合并");
      return;
    }

    // 保存当前状态到历史记录
    setHistory(prev => [...prev, regions]);

    const selectedRegions = regions.filter(r => selectedRegionIds.includes(r.regionId));
    const mergedPolygon = await mergePolygons(selectedRegions.map(r => r.polygon), mergeAlgorithm);

    // 自动生成名称
    const existingMergeCount = regions.filter(r => r.name.startsWith("合并区域")).length;
    const newName = `合并区域 ${existingMergeCount + 1}`;

    // 计算合并后的颜色（使用第一个选中区域的颜色）
    const mergedColor = selectedRegions[0].color || "#1890ff";

    const newRegion = {
      regionId: `region-${Date.now()}`,
      name: newName,
      polygon: mergedPolygon,
      color: mergedColor
    };

    // 删除原区域，添加新区域
    setRegions(prev => [
      ...prev.filter(r => !selectedRegionIds.includes(r.regionId)),
      newRegion
    ]);

    setSelectedRegionIds([]);
    message.success(`已合并 ${selectedRegionIds.length} 个区域为 "${newName}"`);
  };

  // 撤销操作
  const undoMerge = () => {
    if (history.length === 0) {
      message.warning("没有可撤销的操作");
      return;
    }
    
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRegions(previousState);
    setSelectedRegionIds([]);
    message.success("已撤销合并操作");
  };

  // 处理图片上传
  const handleImageUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
        setHasUploadedImage(true);
        setRegions([]); // 上传新图片后清空区域
        message.success("图片上传成功，请点击'自动检测边缘'识别区域");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  // 导出结果
  const exportResults = () => {
    const data = {
      regions: regions,
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `edge-detection-result-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success("导出成功");
  };

  // 获取选中区域
  const selectedRegion = useMemo(() => {
    if (selectedRegionIds.length === 0) return null;
    return regions.find((r) => r.regionId === selectedRegionIds[0]) || null;
  }, [regions, selectedRegionIds]);

  const dpr = window.devicePixelRatio || 1;

  return (
    <div style={styles.page}>
      {/* 顶部导航栏 */}
      <div style={styles.topbar}>
        <Space size="middle">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate("/toolbox")}
          >
            返回工具箱
          </Button>
          <Title level={4} style={{ margin: 0, color: "#fff" }}>边缘检测与区域选择</Title>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={exportResults}
            disabled={regions.length === 0}
          >
            导出结果
          </Button>
        </Space>
      </div>

      <div style={styles.body}>
        {/* 左侧控制面板 */}
        <div style={styles.sidebar}>
          <Card title="图像上传" size="small" style={{ marginBottom: 16 }}>
            <Upload.Dragger
              accept="image/*"
              beforeUpload={handleImageUpload}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传图片</p>
              <p className="ant-upload-hint">支持 JPG、PNG、SVG 格式</p>
            </Upload.Dragger>
          </Card>

          <Card title="检测控制" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button 
                type="primary"
                icon={<ScanOutlined />}
                onClick={performEdgeDetection}
                loading={isDetecting}
                disabled={!hasUploadedImage}
                block
              >
                自动检测边缘
              </Button>
              <Button 
                icon={<EditOutlined />}
                onClick={() => setIsDrawing(!isDrawing)}
                type={isDrawing ? "primary" : "default"}
                disabled={!hasUploadedImage}
                block
              >
                {isDrawing ? "完成绘制" : "手动划定区域"}
              </Button>
              {isDrawing && (
                <Space style={{ width: "100%", justifyContent: "center" }}>
                  <Button size="small" onClick={finishDrawing}>确认</Button>
                  <Button size="small" danger onClick={cancelDrawing}>取消</Button>
                </Space>
              )}
              <Button 
                icon={<ClearOutlined />}
                onClick={deleteSelectedRegion}
                disabled={selectedRegionIds.length === 0}
                danger
                block
              >
                删除选中区域
              </Button>
            </Space>
          </Card>

          <Card title="多选与合并" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button 
                onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                type={isMultiSelectMode ? "primary" : "default"}
                block
              >
                {isMultiSelectMode ? "退出多选模式" : "进入多选模式"}
              </Button>
              {selectedRegionIds.length > 1 && (
                <Button 
                  type="primary"
                  onClick={mergeSelectedRegions}
                  block
                >
                  合并选中区域 ({selectedRegionIds.length})
                </Button>
              )}
              {history.length > 0 && (
                <Button 
                  onClick={undoMerge}
                  block
                >
                  撤销合并 ({history.length})
                </Button>
              )}
            </Space>
          </Card>

          <Card title="显示选项" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical">
              <Tag.CheckableTag 
                checked={showOriginal}
                onChange={setShowOriginal}
              >
                显示原图
              </Tag.CheckableTag>
              <Tag.CheckableTag 
                checked={showRegions}
                onChange={setShowRegions}
              >
                显示区域
              </Tag.CheckableTag>
            </Space>
          </Card>
        </div>

        {/* 主内容区 */}
        <div style={styles.main}>
          <Card 
            title="图像预览" 
            extra={
              <Space>
                <Button 
                  icon={<ZoomOutOutlined />}
                  onClick={() => setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)))}
                  disabled={!hasUploadedImage}
                />
                <Text>缩放: {scale.toFixed(2)}x</Text>
                <Button 
                  icon={<ZoomInOutlined />}
                  onClick={() => setScale(s => Math.min(4, +(s + 0.1).toFixed(2)))}
                  disabled={!hasUploadedImage}
                />
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <div ref={containerRef} style={styles.canvasContainer}>
              {!hasUploadedImage ? (
                <div style={styles.emptyState}>
                  <UploadOutlined style={{ fontSize: 48, color: "#ccc" }} />
                  <Text type="secondary" style={{ marginTop: 16 }}>
                    请先上传图片
                  </Text>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  onClick={handleClick}
                  onDoubleClick={handleCanvasDoubleClick}
                  onMouseMove={handleMove}
                  onMouseLeave={handleLeave}
                  style={{ 
                    cursor: isDrawing ? "crosshair" : "pointer",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                  }}
                />
              )}
            </div>
          </Card>

          {/* 区域列表 - 移到图像预览下方 */}
          <Card 
            title={`区域列表 (${regions.length} 个区域)`} 
            size="small"
            style={{ marginBottom: 16 }}
          >
            {regions.length === 0 ? (
              <Text type="secondary">暂无区域，请点击'自动检测边缘'或手动划定区域</Text>
            ) : (
              <Row gutter={[8, 8]}>
                {regions.map((r) => {
                  const isSelected = selectedRegionIds.includes(r.regionId);
                  const isMultiSelected = isMultiSelectMode && isSelected && selectedRegionIds.length > 1;
                  return (
                    <Col span={8} key={r.regionId}>
                      <Button
                        size="small"
                        type={isMultiSelected ? "default" : (isSelected ? "primary" : "default")}
                        onClick={() => {
                          if (isMultiSelectMode) {
                            setSelectedRegionIds(prev => {
                              if (prev.includes(r.regionId)) {
                                return prev.filter(id => id !== r.regionId);
                              } else {
                                return [...prev, r.regionId];
                              }
                            });
                          } else {
                            setSelectedRegionIds([r.regionId]);
                          }
                        }}
                        onDoubleClick={() => handleDoubleClick(r.regionId)}
                        style={{ 
                          width: "100%",
                          borderLeft: `4px solid ${r.color || "#1890ff"}`,
                          backgroundColor: isMultiSelected ? "rgba(255,0,255,0.1)" : undefined
                        }}
                      >
                        {r.name}
                      </Button>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Card>

          {/* 调试信息面板 */}
          <Card size="small" style={{ marginTop: 16 }}>
            <Row gutter={24}>
              <Col span={6}>
                <Text type="secondary">
                  <b>图像尺寸:</b> {imgSize ? `${imgSize.w}×${imgSize.h}` : "加载中..."}
                </Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">
                  <b>DPR:</b> {dpr}
                </Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">
                  <b>悬停:</b> {hover ? `(${hover.normX.toFixed(3)}, ${hover.normY.toFixed(3)})` : "无"}
                </Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">
                  <b>选中:</b> {selectedRegion ? selectedRegion.name : "无"}
                </Text>
              </Col>
            </Row>
          </Card>
        </div>
      </div>

      {/* 重命名对话框 */}
      <Modal
        title="重命名区域"
        open={showRenameModal}
        onOk={confirmRename}
        onCancel={cancelRename}
        okText="确认"
        cancelText="取消"
      >
        <Input
          value={newRegionName}
          onChange={(e) => setNewRegionName(e.target.value)}
          placeholder="请输入新名称"
          onPressEnter={confirmRename}
          maxLength={50}
        />
      </Modal>
    </div>
  );
}

// 工具函数
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function drawPolygon(ctx, polygon, imgW, imgH, scale, strokeStyle, fillStyle, lineWidth) {
  if (!polygon || polygon.length < 2) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const x = p.x * imgW * scale;
    const y = p.y * imgH * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(24,144,255,0.8)";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getPolygonCenter(polygon) {
  if (!polygon || polygon.length === 0) return { x: 0, y: 0 };
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f5f7fb",
  },
  topbar: {
    height: 64,
    background: "linear-gradient(90deg, #1890ff 0%, #36cfcf 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  body: { 
    flex: 1, 
    display: "flex", 
    minHeight: 0,
    padding: 16,
    gap: 16,
  },
  sidebar: {
    width: 280,
    overflow: "auto",
  },
  main: { 
    flex: 1, 
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  },
  canvasContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 400,
    background: "#fafafa",
    borderRadius: 8,
    padding: 16,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
};
