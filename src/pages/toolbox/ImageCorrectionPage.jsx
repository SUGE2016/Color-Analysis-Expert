import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined,
  UploadOutlined, DownloadOutlined, UndoOutlined,
  FileImageOutlined, PlusOutlined, CheckCircleOutlined
} from "@ant-design/icons";
import { Button, Card, Space, Radio, Typography, message, Upload, Slider, Row, Col, Tag, Modal, List, Form, Input, Empty } from "antd";
import { SearchOutlined, FileOutlined } from "@ant-design/icons";
import { templateApi } from "../../api/template";
import { toolApi } from "../../api/tool";
import AuthenticatedImage from "../../components/dataset/AuthenticatedImage";

const { Title, Text } = Typography;

// 矫正模式
const CORRECTION_MODES = {
  PERSPECTIVE: "perspective", // 透视矫正
  ROTATE: "rotate",           // 旋转矫正
  SCALE: "scale",             // 缩放矫正
  FREE: "free"                // 自由变换
};

// 默认参考点配置
const DEFAULT_REFERENCE_POINTS = {
  [CORRECTION_MODES.PERSPECTIVE]: [
    { x: 0.1, y: 0.1, id: "tl", label: "左上" },
    { x: 0.9, y: 0.1, id: "tr", label: "右上" },
    { x: 0.9, y: 0.9, id: "br", label: "右下" },
    { x: 0.1, y: 0.9, id: "bl", label: "左下" }
  ],
  [CORRECTION_MODES.ROTATE]: [
    { x: 0.5, y: 0.1, id: "center", label: "旋转中心" }
  ],
  [CORRECTION_MODES.SCALE]: [
    { x: 0.5, y: 0.5, id: "center", label: "缩放中心" }
  ],
  [CORRECTION_MODES.FREE]: [
    { x: 0.1, y: 0.1, id: "p1", label: "点1" },
    { x: 0.5, y: 0.2, id: "p2", label: "点2" },
    { x: 0.8, y: 0.5, id: "p3", label: "点3" },
    { x: 0.4, y: 0.8, id: "p4", label: "点4" }
  ]
};

export default function ImageCorrectionPage() {
  const navigate = useNavigate();
  
  // 状态和引用
  const [scale, setScale] = useState(1.0);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(CORRECTION_MODES.PERSPECTIVE);
  const [referencePoints, setReferencePoints] = useState(DEFAULT_REFERENCE_POINTS[CORRECTION_MODES.PERSPECTIVE]);
  const [isCorrected, setIsCorrected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPointId, setDragPointId] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  
  // 模板自动矫正相关状态
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [templateSearchValue, setTemplateSearchValue] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isAutoCorrecting, setIsAutoCorrecting] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const sourceCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const uploadedFileRef = useRef(null);
  const [imgSize, setImgSize] = useState(null);
  const containerRef = useRef(null);

  // 处理图片上传
  const handleImageUpload = (file) => {
    uploadedFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
        setHasUploadedImage(true);
        setIsCorrected(false);
        message.success("图片上传成功");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    return false;
  };

  // 渲染源图像画布（带参考点）
  const renderSourceCanvas = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize) return;

    const dpr = window.devicePixelRatio || 1;

    // 获取容器尺寸
    const container = canvas.parentElement;
    const containerWidth = container ? container.clientWidth - 32 : 300; // 减去padding
    const containerHeight = container ? container.clientHeight - 32 : 200;

    // 计算自适应缩放比例
    const scaleX = containerWidth / imgSize.w;
    const scaleY = containerHeight / imgSize.h;
    const autoScale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

    // 使用用户设置的缩放或自动缩放
    const finalScale = scale * autoScale;
    const cssW = imgSize.w * finalScale;
    const cssH = imgSize.h * finalScale;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // 绘制原始图像
    ctx.drawImage(img, 0, 0, cssW, cssH);

    // 绘制网格辅助线
    drawGrid(ctx, cssW, cssH);

    // 绘制参考点
    referencePoints.forEach(point => {
      const x = point.x * cssW;
      const y = point.y * cssH;
      drawReferencePoint(ctx, x, y, point.id === dragPointId, point.label);
    });

    // 绘制连线（透视模式）
    if (correctionMode === CORRECTION_MODES.PERSPECTIVE && referencePoints.length === 4) {
      drawPerspectiveLines(ctx, referencePoints, cssW, cssH);
    }
  }, [imgSize, scale, referencePoints, dragPointId, correctionMode]);

  // 绘制参考点
  const drawReferencePoint = (ctx, x, y, isActive, label) => {
    ctx.save();
    
    // 外圈
    ctx.beginPath();
    ctx.arc(x, y, isActive ? 12 : 8, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "#52c41a" : "#1890ff";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 内圈
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    
    // 标签
    if (label) {
      ctx.fillStyle = "#1890ff";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, x, y - 15);
    }
    
    ctx.restore();
  };

  // 绘制网格
  const drawGrid = (ctx, w, h) => {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    const gridSize = Math.min(w, h) / 10;
    
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    ctx.restore();
  };

  // 绘制透视连线
  const drawPerspectiveLines = (ctx, points, w, h) => {
    ctx.save();
    ctx.strokeStyle = "rgba(24,144,255,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const tl = points.find(p => p.id === "tl");
    const tr = points.find(p => p.id === "tr");
    const br = points.find(p => p.id === "br");
    const bl = points.find(p => p.id === "bl");
    
    if (tl && tr && br && bl) {
      ctx.beginPath();
      ctx.moveTo(tl.x * w, tl.y * h);
      ctx.lineTo(tr.x * w, tr.y * h);
      ctx.lineTo(br.x * w, br.y * h);
      ctx.lineTo(bl.x * w, bl.y * h);
      ctx.closePath();
      ctx.stroke();
      
      // 填充半透明区域
      ctx.fillStyle = "rgba(24,144,255,0.1)";
      ctx.fill();
    }
    
    ctx.restore();
  };

  // 渲染矫正后的图像
  const renderCorrectedImage = useCallback(() => {
    const canvas = resultCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize) return;

    const dpr = window.devicePixelRatio || 1;

    // 获取容器尺寸
    const container = canvas.parentElement;
    const containerWidth = container ? container.clientWidth - 32 : 600;
    const containerHeight = container ? container.clientHeight - 32 : 400;

    // 计算自适应缩放比例
    const scaleX = containerWidth / imgSize.w;
    const scaleY = containerHeight / imgSize.h;
    const autoScale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

    // 使用用户设置的缩放或自动缩放
    const finalScale = scale * autoScale;
    const cssW = imgSize.w * finalScale;
    const cssH = imgSize.h * finalScale;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.save();

    // 应用变换
    const centerX = cssW / 2;
    const centerY = cssH / 2;
    
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);
    
    // 如果是透视矫正，应用透视变换
    if (correctionMode === CORRECTION_MODES.PERSPECTIVE && isCorrected) {
      applyPerspectiveTransform(ctx, img, referencePoints, cssW, cssH);
    } else {
      ctx.drawImage(img, 0, 0, cssW, cssH);
    }
    
    ctx.restore();
  }, [imgSize, scale, rotation, zoom, correctionMode, referencePoints, isCorrected]);

  // 应用透视变换（简化版）
  const applyPerspectiveTransform = (ctx, img, points, w, h) => {
    // 简化的透视变换实现
    // 实际应用中可能需要更复杂的矩阵计算
    const tl = points.find(p => p.id === "tl");
    const tr = points.find(p => p.id === "tr");
    const br = points.find(p => p.id === "br");
    const bl = points.find(p => p.id === "bl");
    
    if (!tl || !tr || !br || !bl) {
      ctx.drawImage(img, 0, 0, w, h);
      return;
    }

    // 绘制变换后的图像（这里使用简单的裁剪+缩放作为演示）
    const srcX = Math.min(tl.x, tr.x, bl.x, br.x) * img.naturalWidth;
    const srcY = Math.min(tl.y, tr.y, bl.y, br.y) * img.naturalHeight;
    const srcW = Math.max(tl.x, tr.x, bl.x, br.x) * img.naturalWidth - srcX;
    const srcH = Math.max(tl.y, tr.y, bl.y, br.y) * img.naturalHeight - srcY;
    
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
  };

  useEffect(() => {
    renderSourceCanvas();
  }, [renderSourceCanvas]);

  useEffect(() => {
    if (isCorrected) {
      renderCorrectedImage();
    }
  }, [isCorrected, renderCorrectedImage]);

  // 切换矫正模式
  const handleModeChange = (mode) => {
    setCorrectionMode(mode);
    setReferencePoints(DEFAULT_REFERENCE_POINTS[mode]);
    setIsCorrected(false);
    setRotation(0);
    setZoom(1);
  };

  // 鼠标事件处理
  const handleMouseDown = (e) => {
    if (!hasUploadedImage) return;
    
    const rect = sourceCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const normX = x / imgSize.w;
    const normY = y / imgSize.h;
    
    // 查找最近的参考点
    let nearestPoint = null;
    let minDistance = Infinity;
    
    referencePoints.forEach(point => {
      const dx = point.x - normX;
      const dy = point.y - normY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 0.05 && distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    });
    
    if (nearestPoint) {
      setIsDragging(true);
      setDragPointId(nearestPoint.id);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragPointId) return;
    
    const rect = sourceCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const normX = Math.max(0, Math.min(1, x / imgSize.w));
    const normY = Math.max(0, Math.min(1, y / imgSize.h));
    
    setReferencePoints(prev => prev.map(p => 
      p.id === dragPointId ? { ...p, x: normX, y: normY } : p
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragPointId(null);
  };

  // 应用矫正
  const applyCorrection = () => {
    if (!hasUploadedImage) {
      message.warning("请先上传图片");
      return;
    }
    setIsCorrected(true);
    message.success("矫正已应用");
  };

  // 重置所有调整
  const resetCorrection = () => {
    setReferencePoints(DEFAULT_REFERENCE_POINTS[correctionMode]);
    setRotation(0);
    setZoom(1);
    setIsCorrected(false);
    message.success("已重置");
  };

  // 清除上传的图片
  const resetImage = () => {
    setHasUploadedImage(false);
    setImgSize(null);
    imgRef.current = null;
    uploadedFileRef.current = null;
    setIsCorrected(false);
    setReferencePoints(DEFAULT_REFERENCE_POINTS[correctionMode]);
    setRotation(0);
    setZoom(1);
    message.success("图片已清除");
  };

  // 下载矫正后的图像
  const downloadCorrectedImage = () => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !isCorrected) {
      message.warning("请先应用矫正");
      return;
    }
    
    const link = document.createElement("a");
    link.download = `corrected-image-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    message.success("图像已下载");
  };

  // ==================== 模板管理功能 ====================  
  
  // 获取模板列表
  const fetchTemplates = async () => {
    setTemplateLoading(true);
    try {
      const response = await templateApi.getTemplates();
      const templateList = Array.isArray(response) ? response : (response?.data || []);
      setTemplates(templateList);
      setFilteredTemplates(templateList);
    } catch (error) {
      message.error('获取模板列表失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  // 模板筛选逻辑
  useEffect(() => {
    let result = [...templates];
    
    // 搜索筛选
    if (templateSearchValue) {
      const keyword = templateSearchValue.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(keyword)
      );
    }
    
    setFilteredTemplates(result);
  }, [templates, templateSearchValue]);
  
  // 打开模板选择弹窗
  const openTemplateModal = () => {
    if (!hasUploadedImage) {
      message.warning("请先上传图片");
      return;
    }
    setTemplateModalVisible(true);
    setSelectedTemplate(null);
    fetchTemplates();
  };

  // 关闭模板选择弹窗
  const closeTemplateModal = () => {
    setTemplateModalVisible(false);
    setSelectedTemplate(null);
    setTemplateSearchValue('');
  };

  // 选择现有模板
  const handleSelectTemplate = (template) => {
    if (!template.imageAvailable) {
      message.warning('该模板照片不存在，请重新上传模板照片后再使用');
      return;
    }
    setSelectedTemplate(template);
  };

  // 上传新模板弹窗
  const openUploadModal = () => {
    setUploadModalVisible(true);
    uploadForm.resetFields();
  };
  
  // 上传新模板
  const handleUploadTemplate = async (values) => {
    setUploading(true);

    try {
      const imageFile = values.templateImage?.[0]?.originFileObj;
      if (!imageFile) {
        throw new Error('请选择模板图片');
      }

      // 调用后端API创建模板
      const newTemplate = await templateApi.createTemplate({
        name: values.name,
        imageFile: imageFile
      });

      // 刷新模板列表
      await fetchTemplates();

      setUploading(false);
      setUploadModalVisible(false);
      uploadForm.resetFields();
      message.success('模板上传成功');

      // 自动选择新上传的模板
      setSelectedTemplate(newTemplate);
    } catch (error) {
      console.error('上传模板失败:', error);
      message.error(`上传失败: ${error.message || '未知错误'}`);
      setUploading(false);
    }
  };

  // 根据模板自动矫正
  const handleAutoCorrectWithTemplate = async () => {
    if (!selectedTemplate) {
      message.warning("请选择或上传一个模板");
      return;
    }

    if (!selectedTemplate.imageAvailable) {
      message.warning('该模板照片不存在，请重新上传模板照片后再使用');
      return;
    }

    if (!uploadedFileRef.current) {
      message.warning("请先上传需要矫正的图片");
      return;
    }

    setIsAutoCorrecting(true);
    setTemplateModalVisible(false);

    try {
      // 构建FormData，包含模板图片和待矫正图片
      const formData = new FormData();

      // 从后端获取模板图片
      const templateImageBlob = await templateApi.getTemplateImage(selectedTemplate.id);
      if (!templateImageBlob) {
        throw new Error('模板图片不存在');
      }
      formData.append('model', templateImageBlob, 'template.png');

      // 添加待矫正图片
      formData.append('image', uploadedFileRef.current, uploadedFileRef.current.name);

      // 调用后端API进行图像矫正
      const response = await toolApi.alignImage(formData);
      if (!(response instanceof Blob) || response.size === 0 || response.type.includes('application/json') || response.type.startsWith('text/')) {
        const errorText = response instanceof Blob ? await response.text() : '';
        throw new Error(errorText || '矫正失败，未返回图片数据');
      }

      // 将返回的图片数据显示在结果画布上
      const canvas = resultCanvasRef.current;
      if (canvas && response) {
        const dpr = window.devicePixelRatio || 1;

        // 创建Image对象加载返回的图片
        const correctedImg = new Image();
        correctedImg.onload = () => {
          const cssW = correctedImg.width;
          const cssH = correctedImg.height;

          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssW, cssH);
            ctx.drawImage(correctedImg, 0, 0, cssW, cssH);
          }

          setIsCorrected(true);
          setIsAutoCorrecting(false);
          message.success(`自动矫正完成！使用模板: ${selectedTemplate.name}`);
        };
        correctedImg.onerror = () => {
          setIsAutoCorrecting(false);
          message.error('矫正后的图片加载失败');
        };

        // response是Blob或ArrayBuffer，转换为URL
        const blob = response instanceof Blob ? response : new Blob([response]);
        correctedImg.src = URL.createObjectURL(blob);
      } else {
        setIsAutoCorrecting(false);
        message.error('矫正失败，未返回图片数据');
      }
    } catch (error) {
      console.error('自动矫正失败:', error);
      setIsAutoCorrecting(false);
      message.error(`自动矫正失败: ${error.message || '未知错误'}`);
    }
  };

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
          <Title level={4} style={{ margin: 0, color: "#fff" }}>图像矫正工具</Title>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={downloadCorrectedImage}
            disabled={!isCorrected}
          >
            下载矫正结果
          </Button>
        </Space>
      </div>

      <div style={styles.body}>
        {/* 左侧控制面板 */}
        <div style={styles.sidebar}>
          <Card title="源图像" size="small" style={{ marginBottom: 16 }}>
            {!hasUploadedImage ? (
              <Upload.Dragger
                accept="image/*"
                beforeUpload={handleImageUpload}
                showUploadList={false}
                style={{ height: 200 }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽上传图片</p>
                <p className="ant-upload-hint">支持 JPG、PNG 格式</p>
              </Upload.Dragger>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: 200, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <canvas
                  ref={sourceCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    cursor: isDragging ? "grabbing" : "grab",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
                <Button
                  type="primary"
                  danger
                  size="small"
                  onClick={resetImage}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                >
                  清除
                </Button>
              </div>
            )}
          </Card>

          <Card title="矫正模式" size="small" style={{ marginBottom: 16 }}>
            <Radio.Group 
              value={correctionMode}
              onChange={(e) => handleModeChange(e.target.value)}
              style={{ width: "100%" }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Radio.Button value={CORRECTION_MODES.PERSPECTIVE} style={{ width: "100%", textAlign: "center" }}>
                  透视矫正
                </Radio.Button>
                <Radio.Button value={CORRECTION_MODES.ROTATE} style={{ width: "100%", textAlign: "center" }}>
                  旋转矫正
                </Radio.Button>
                <Radio.Button value={CORRECTION_MODES.SCALE} style={{ width: "100%", textAlign: "center" }}>
                  缩放矫正
                </Radio.Button>
                <Radio.Button value={CORRECTION_MODES.FREE} style={{ width: "100%", textAlign: "center" }}>
                  自由变换
                </Radio.Button>
              </Space>
            </Radio.Group>
          </Card>

          {correctionMode === CORRECTION_MODES.ROTATE && (
            <Card title="旋转角度" size="small" style={{ marginBottom: 16 }}>
              <Slider
                min={-180}
                max={180}
                value={rotation}
                onChange={setRotation}
                marks={{ 0: "0°", 90: "90°", [-90]: "-90°", 180: "180°", [-180]: "-180°" }}
              />
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <Tag color="blue">{rotation}°</Tag>
              </div>
            </Card>
          )}

          {correctionMode === CORRECTION_MODES.SCALE && (
            <Card title="缩放比例" size="small" style={{ marginBottom: 16 }}>
              <Slider
                min={0.1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={setZoom}
                marks={{ 1: "1x", 2: "2x", 0.5: "0.5x" }}
              />
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <Tag color="blue">{zoom.toFixed(1)}x</Tag>
              </div>
            </Card>
          )}

          <Card title="智能矫正" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button 
                type="primary"
                icon={<FileImageOutlined />}
                onClick={openTemplateModal}
                disabled={!hasUploadedImage || isAutoCorrecting}
                loading={isAutoCorrecting}
                block
              >
                根据模板自动矫正
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                选择或上传模板，自动匹配并矫正图像
              </Text>
            </Space>
          </Card>

          <Card title="操作" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button 
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={applyCorrection}
                disabled={!hasUploadedImage}
                block
              >
                应用矫正
              </Button>
              <Button 
                icon={<UndoOutlined />}
                onClick={resetCorrection}
                disabled={!hasUploadedImage}
                block
              >
                重置
              </Button>
            </Space>
          </Card>

          <Card title="提示" size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                <li>拖拽蓝色参考点调整位置</li>
                <li>绿色表示选中状态</li>
                <li>点击'应用矫正'预览效果</li>
              </ul>
            </Text>
          </Card>
        </div>

        {/* 主内容区 */}
        <div style={styles.main} ref={containerRef}>
          <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
            {/* 矫正后的图像 */}
            <Col span={24} style={{ height: "100%" }}>
              <Card
                title={
                  <Space>
                    <span>矫正效果</span>
                    <Tag color={isCorrected ? "green" : "default"}>{isCorrected ? "预览" : "等待矫正"}</Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<ZoomOutOutlined />}
                      onClick={() => setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)))}
                      disabled={!hasUploadedImage}
                      size="small"
                    />
                    <Text>缩放: {scale.toFixed(2)}x</Text>
                    <Button
                      icon={<ZoomInOutlined />}
                      onClick={() => setScale(s => Math.min(4, +(s + 0.1).toFixed(2)))}
                      disabled={!hasUploadedImage}
                      size="small"
                    />
                  </Space>
                }
                style={{ height: "100%" }}
                bodyStyle={{ height: "calc(100% - 57px)", overflow: "auto", display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                {!hasUploadedImage ? (
                  <div style={styles.emptyState}>
                    <UploadOutlined style={{ fontSize: 48, color: "#ccc" }} />
                    <Text type="secondary" style={{ marginTop: 16 }}>
                      请先上传图片
                    </Text>
                  </div>
                ) : !isCorrected ? (
                  <div style={styles.emptyState}>
                    <FileImageOutlined style={{ fontSize: 48, color: "#ccc" }} />
                    <Text type="secondary" style={{ marginTop: 16 }}>
                      请先进行图像矫正
                    </Text>
                  </div>
                ) : (
                  <canvas
                    ref={resultCanvasRef}
                    style={{
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* 参考点信息面板 */}
          <Card size="small" style={{ marginTop: 16 }}>
            <Row gutter={24}>
              <Col span={8}>
                <Text type="secondary">
                  <b>图像尺寸:</b> {imgSize ? `${imgSize.w}×${imgSize.h}` : "未上传"}
                </Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">
                  <b>矫正模式:</b> {{
                    [CORRECTION_MODES.PERSPECTIVE]: "透视矫正",
                    [CORRECTION_MODES.ROTATE]: "旋转矫正",
                    [CORRECTION_MODES.SCALE]: "缩放矫正",
                    [CORRECTION_MODES.FREE]: "自由变换"
                  }[correctionMode]}
                </Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">
                  <b>参考点数量:</b> {referencePoints.length}
                </Text>
              </Col>
            </Row>
          </Card>
        </div>
      </div>

      {/* 模板选择弹窗 */}
      <Modal
        title="选择模板"
        open={templateModalVisible}
        onCancel={closeTemplateModal}
        footer={[
          <Button key="cancel" onClick={closeTemplateModal}>
            取消
          </Button>,
          <Button 
            key="upload" 
            icon={<PlusOutlined />}
            onClick={openUploadModal}
          >
            上传新模板
          </Button>,
          <Button 
            key="ok" 
            type="primary" 
            onClick={handleAutoCorrectWithTemplate}
            disabled={!selectedTemplate}
            loading={isAutoCorrecting}
          >
            开始自动矫正
          </Button>
        ]}
        width={900}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {/* 搜索栏 */}
          <Input
            placeholder="搜索模板名称..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={templateSearchValue}
            onChange={(e) => setTemplateSearchValue(e.target.value)}
            style={{ width: '100%' }}
            allowClear
          />

          {/* 模板列表 */}
          <div style={{ minHeight: 300 }}>
            {filteredTemplates.length === 0 ? (
              <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openUploadModal}>
                  上传新模板
                </Button>
              </Empty>
            ) : (
              <List
                grid={{ gutter: 16, column: 4 }}
                dataSource={filteredTemplates}
                loading={templateLoading}
                renderItem={(template) => (
                  <List.Item>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => handleSelectTemplate(template)}
                      style={{
                        border: selectedTemplate?.id === template.id ? "2px solid #1890ff" : "1px solid #d9d9d9",
                        background: selectedTemplate?.id === template.id ? "#e6f7ff" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div style={{
                          width: '100%',
                          height: 100,
                          background: '#f5f5f5',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          marginBottom: 8
                        }}>
                          {template.imageAvailable ? (
                            <AuthenticatedImage
                              url={templateApi.getTemplateImageUrl(template.id)}
                              alt={template.name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <FileOutlined
                            style={{
                              fontSize: 32,
                              color: '#bfbfbf',
                              display: template.imageAvailable ? 'none' : 'block'
                            }}
                          />
                        </div>
                        <Text strong style={{ fontSize: 12, display: "block" }} ellipsis={{ tooltip: template.name }}>
                          {template.name}
                        </Text>
                        {!template.imageAvailable && (
                          <Text type="secondary" style={{ fontSize: 11 }}>照片缺失</Text>
                        )}
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </div>

          {/* 已选模板信息 */}
          {selectedTemplate && (
            <div style={{ 
              padding: "12px 16px", 
              background: "#f6ffed", 
              border: "1px solid #b7eb8f",
              borderRadius: 6 
            }}>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>
                  已选择模板: <strong>{selectedTemplate.name}</strong>
                </Text>
              </Space>
            </div>
          )}
        </Space>
      </Modal>

      {/* 模板上传弹窗 */}
      <Modal
        title="上传新模板"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={handleUploadTemplate}
          style={{ padding: '16px 0' }}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：精细动作能力分析模板" />
          </Form.Item>
          
          <Form.Item
            name="templateImage"
            label="模板照片"
            rules={[{ required: true, message: '请上传模板照片' }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload.Dragger
              accept=".jpg,.jpeg,.png,.webp"
              maxCount={1}
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽模板照片到此处上传</p>
              <p className="ant-upload-hint">
                支持 .jpg, .jpeg, .png, .webp 格式的图片文件
              </p>
            </Upload.Dragger>
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setUploadModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={uploading}
              >
                上传
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
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
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
};
