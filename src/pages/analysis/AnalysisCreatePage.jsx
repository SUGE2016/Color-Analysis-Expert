import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Input, Button, Progress, Card, Typography, Checkbox, message, Tag, Steps,
  Upload, Space, Divider, Empty, Spin, Badge, Slider, Modal
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, UploadOutlined,
  CheckCircleOutlined, ReloadOutlined, DeleteOutlined,
  EditOutlined, DatabaseOutlined, BorderOutlined, ScanOutlined,
  PictureOutlined, SettingOutlined,
  FileImageOutlined, AimOutlined, BgColorsOutlined, FolderOpenOutlined,
  LayoutOutlined, AreaChartOutlined, AppstoreOutlined,
  ExperimentOutlined, PlayCircleOutlined, FileOutlined, CloseCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { colors, styles } from '../../components/common/constants';
import { pointInPolygon } from '../../utils/hitTest';
import { createTemporaryProjectId, isTemporaryProjectId } from '../../utils/incompleteProjects';
import { loadSelectedImage, resolveSelectedImage } from '../../utils/selectedImageLoader';
import { getProjectCreateErrorMessage } from '../../utils/projectCreateError';
import {
  findIncompleteSelection,
  normalizeAnalysisConfigV1,
  sanitizeAnalysisConfigV1,
} from '../../utils/analysisConfigV1';

// API imports
import { datasetApi } from '../../api/dataset';
import { templateApi } from '../../api/template';
import { analysisApi } from '../../api/analysis';
import { toolApi } from '../../api/tool';
import AuthenticatedImage from '../../components/dataset/AuthenticatedImage';

const { Title, Text } = Typography;

// ==================== 分析方法配置 ====================

// 分析方法类型
const ANALYSIS_METHODS = [
  { key: 'color_distribution', label: '颜色分布分析', description: '统计指定区域内各颜色的占比', icon: <BgColorsOutlined />, color: '#1890ff' },
  { key: 'boundary_check', label: '出界分析', description: 'V1.0 暂不支持', icon: <AimOutlined />, color: '#bfbfbf', disabled: true },
  { key: 'line_feature', label: '线条特征分析', description: 'V1.0暂不实现（如线条粗细、平滑度等）', icon: <EditOutlined />, color: '#bfbfbf', disabled: true },
];

// ==================== 主组件 ====================

const AnalysisCreatePage = () => {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  
  // 模板图片列表（需要在fetchTemplates之前声明）
  const [templateImages, setTemplateImages] = useState([]);

  // 矫正图片预览状态
  const [previewCorrectedImage, setPreviewCorrectedImage] = useState(null);

  // 区域多选和重命名状态
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingRegionId, setRenamingRegionId] = useState(null);
  const [newRegionName, setNewRegionName] = useState("");

  // 从URL参数或location state获取项目ID
  const projectId = urlProjectId || location.state?.projectId;
  const draftStorageIdRef = useRef(projectId || null);
  if (!draftStorageIdRef.current) draftStorageIdRef.current = createTemporaryProjectId();

  // 使用真实API获取数据集和模板列表
  // 数据集和模板的加载状态
  const [backendDatasets, setBackendDatasets] = useState([]);
  const [datasetPreviewImages, setDatasetPreviewImages] = useState({});
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [backendTemplates, setBackendTemplates] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const initialDataFetchStartedRef = useRef(false);
  const projectCreateInFlightRef = useRef(false);
  const projectSubmitInFlightRef = useRef(false);

  // 获取数据集
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const datasets = await datasetApi.getDatasets();
      setBackendDatasets(datasets || []);
      const previews = {};
      await Promise.all((datasets || []).map(async (dataset) => {
        try {
          const images = await datasetApi.getDatasetImages(dataset.id);
          if (images?.[0]?.id) previews[dataset.id] = images[0];
        } catch {
          previews[dataset.id] = null;
        }
      }));
      setDatasetPreviewImages(previews);
    } catch (error) {
      message.error('获取数据集失败');
      setBackendDatasets([]);
      setDatasetPreviewImages({});
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  // 获取模板
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const templates = await templateApi.getTemplates();
      const validTemplates = (templates || []).filter((template) => template.imageAvailable);
      setBackendTemplates(validTemplates);
      setTemplateImages(validTemplates.map(t => ({
        id: t.id,
        name: t.name,
        templateImageKey: t.templateImageKey,
        imageAvailable: true,
        regionsJson: t.regionsJson
      })));
    } catch (error) {
      message.error('获取模板失败');
      setBackendTemplates([]);
      setTemplateImages([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // 组件加载时获取数据
  useEffect(() => {
    if (initialDataFetchStartedRef.current) return;
    initialDataFetchStartedRef.current = true;
    fetchDatasets();
    fetchTemplates();
  }, [fetchDatasets, fetchTemplates]);

  // 步骤1: 数据集和模板选择
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [selectedTemplateImage, setSelectedTemplateImage] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [createdProjectId, setCreatedProjectId] = useState(
    projectId && !isTemporaryProjectId(projectId) ? projectId : null
  ); // 后端创建的项目ID

  // 步骤2: 图像矫正
  const [correctionProgress, setCorrectionProgress] = useState(0);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionComplete, setCorrectionComplete] = useState(false);
  const [correctedImages, setCorrectedImages] = useState([]);
  const correctionObjectUrlsRef = useRef(new Set());

  const clearCorrectionObjectUrls = useCallback(() => {
    correctionObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    correctionObjectUrlsRef.current.clear();
  }, []);

  const createCorrectionObjectUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    correctionObjectUrlsRef.current.add(url);
    return url;
  }, []);

  const restoreServerCorrections = useCallback(async (activeProjectId, datasets) => {
    clearCorrectionObjectUrls();
    const statuses = await analysisApi.getCorrections(activeProjectId);
    const restored = await Promise.all((statuses || []).map(async (item) => {
      const dataset = (datasets || []).find((entry) => entry.id === item.datasetId);
      let corrected = null;
      if (item.status === 'completed') {
        const blob = await analysisApi.getCorrectedImage(activeProjectId, item.imageId);
        corrected = createCorrectionObjectUrl(blob);
      }
      return {
        id: item.imageId,
        datasetId: item.datasetId,
        name: item.fileName || item.imageId,
        dataset: dataset?.name || item.datasetId,
        original: datasetApi.imageFileUrl(item.datasetId, item.imageId),
        corrected,
        status: item.status,
      };
    }));
    setCorrectedImages(restored);
    const complete = restored.length > 0 && restored.every((item) => item.status === 'completed');
    setCorrectionComplete(complete);
    setCorrectionProgress(complete ? 100 : 0);
    return restored;
  }, [clearCorrectionObjectUrls, createCorrectionObjectUrl]);

  useEffect(() => () => clearCorrectionObjectUrls(), [clearCorrectionObjectUrls]);

  // 步骤3: 边缘检测/区域定义
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [hover, setHover] = useState(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [edgeScale, setEdgeScale] = useState(0.5);
  const edgeCanvasRef = useRef(null);
  const edgeImgRef = useRef(null);
  const edgeContainerRef = useRef(null);
  const [edgeImgSize, setEdgeImgSize] = useState(null);

  // 计算CSS尺寸 - 参照 EdgeDetectionPage
  const cssSize = useMemo(() => {
    if (!edgeImgSize) return { w: 0, h: 0 };
    return { w: edgeImgSize.w * edgeScale, h: edgeImgSize.h * edgeScale };
  }, [edgeImgSize, edgeScale]);

  // 步骤4: 分析配置（按图片配置区域和方法）
  const [imageAnalysisConfig, setImageAnalysisConfig] = useState({});
  const [selectedImageForConfig, setSelectedImageForConfig] = useState(null);
  const [selectedRegionForConfig, setSelectedRegionForConfig] = useState(null);
  const step4CanvasRef = useRef(null);
  const [step4LoadedImage, setStep4LoadedImage] = useState(null);
  const [step4ImageLoading, setStep4ImageLoading] = useState(false);

  const totalSteps = 4;
  const stepTitles = ['选择数据集与模板', '图像矫正', '定义分析区域', '配置分析项'];
  const stepDescriptions = ['从分组中选择数据集并指定模板图片', '基于模板对所有图片进行几何矫正', '在模板上定义需要分析的区域', '为每张图片配置分析区域和分析方法'];

  // ==================== 步骤控制 ====================

  // 生成唯一ID
  // 保存项目到本地存储（用于中途退出后恢复）
  const saveProjectToStorage = useCallback(() => {
    const projectData = {
      id: createdProjectId || draftStorageIdRef.current,
      name: projectName,
      description: projectDescription,
      currentStep,
      selectedDatasets,
      selectedTemplateImage,
      correctionComplete,
      correctedImages,
      regions,
      imageAnalysisConfig,
      lastSaved: new Date().toISOString()
    };

    const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
    const existingIndex = savedProjects.findIndex(p => p.id === projectData.id);

    if (existingIndex >= 0) {
      savedProjects[existingIndex] = projectData;
    } else {
      savedProjects.push(projectData);
    }

    localStorage.setItem('incompleteAnalysisProjects', JSON.stringify(savedProjects));
    return projectData.id;
  }, [createdProjectId, projectName, projectDescription, currentStep, selectedDatasets, selectedTemplateImage, correctionComplete, correctedImages, regions, imageAnalysisConfig]);

  const persistedConfig = useMemo(() => ({
    analysisConfigVersion: 1,
    description: projectDescription,
    currentStep,
    correctionComplete,
    regions,
    imageAnalysisConfig,
  }), [projectDescription, currentStep, correctionComplete, regions, imageAnalysisConfig]);

  // localStorage 只作为断网兜底；后端 draft 是项目配置的真实来源。
  useEffect(() => {
    if (!createdProjectId || !projectName || !selectedTemplateImage || selectedDatasets.length === 0) return undefined;
    const timer = setTimeout(() => {
      analysisApi.updateProject(createdProjectId, {
        name: projectName,
        datasetIds: selectedDatasets.map((dataset) => dataset.id),
        templateId: selectedTemplateImage.id,
        config: persistedConfig,
      }).catch(() => saveProjectToStorage());
    }, 800);
    return () => clearTimeout(timer);
  }, [createdProjectId, projectName, selectedDatasets, selectedTemplateImage, persistedConfig, saveProjectToStorage]);

  // 从本地存储加载项目
  const loadProjectFromStorage = useCallback((id) => {
    const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
    const project = savedProjects.find(p => p.id === id);
    
    if (project) {
      draftStorageIdRef.current = project.id;
      setProjectName(project.name || '');
      setProjectDescription(project.description || '');
      setCurrentStep(project.currentStep || 0);
      setSelectedDatasets(project.selectedDatasets || []);
      setSelectedTemplateImage(project.selectedTemplateImage || null);
      setCorrectionComplete(false);
      setCorrectedImages([]);
      setRegions(project.regions || []);
      const sanitized = sanitizeAnalysisConfigV1(
        project.imageAnalysisConfig || {},
        null,
        (project.regions || []).map((region) => region.regionId)
      );
      setImageAnalysisConfig(sanitized.config);
      if (sanitized.changed) message.info('旧草稿中的 V1.0 不支持分析项已自动移除');
      setIsRestored(true);
      message.success('已恢复之前保存的进度');
    }
  }, []);

  // 编辑时以后端 draft 为准；仅在后端不可用时回退到 localStorage。
  useEffect(() => {
    if (!projectId || isRestored || backendDatasets.length === 0 || templateImages.length === 0) return;
    if (isTemporaryProjectId(projectId)) {
      loadProjectFromStorage(projectId);
      setIsRestored(true);
      return;
    }
    analysisApi.getProjectDetail(projectId).then(async (project) => {
      const config = typeof project.config === 'string' ? JSON.parse(project.config || '{}') : (project.config || {});
      const ids = project.datasetIds || (project.datasetId ? [project.datasetId] : []);
      const datasets = ids.map((id) => backendDatasets.find((dataset) => dataset.id === id)).filter(Boolean);
      const sanitized = sanitizeAnalysisConfigV1(
        config.imageAnalysisConfig || {},
        null,
        (config.regions || []).map((region) => region.regionId)
      );
      setProjectName(project.name || '');
      setProjectDescription(config.description || '');
      setCurrentStep(Math.min(config.currentStep || 0, totalSteps - 1));
      setSelectedDatasets(datasets);
      setSelectedTemplateImage(templateImages.find((template) => template.id === project.templateId) || null);
      setRegions(config.regions || []);
      setImageAnalysisConfig(sanitized.config);
      setCreatedProjectId(project.id);
      await restoreServerCorrections(project.id, datasets);
      setIsRestored(true);
      if (sanitized.changed) {
        message.info('旧草稿中的出界分析或未知方法已按 V1.0 自动移除');
        await analysisApi.updateProject(project.id, {
          name: project.name,
          datasetIds: ids,
          templateId: project.templateId,
          config: {
            ...config,
            analysisConfigVersion: 1,
            edgeAnalysisEnabled: undefined,
            imageAnalysisConfig: sanitized.config,
          },
        });
      }
      message.success('已从后端恢复项目草稿');
    }).catch(() => {
      loadProjectFromStorage(projectId);
      setIsRestored(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isRestored, backendDatasets, templateImages, restoreServerCorrections]);

  // 定期自动保存（每30秒）
  useEffect(() => {
    if (projectName && currentStep < 3) { // 只在未提交前自动保存
      const interval = setInterval(() => {
        saveProjectToStorage();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [projectName, currentStep, saveProjectToStorage]);

  const handleNext = async () => {
    if (currentStep === 0) {
      if (projectCreateInFlightRef.current) return;
      if (!projectName.trim()) { message.warning('请输入项目名称'); return; }
      if (selectedDatasets.length === 0) { message.warning('请至少选择一个数据集'); return; }
      if (!selectedTemplateImage) { message.warning('请选择模板图片'); return; }
      
      // 步骤1: 创建项目并提交数据集和模板信息到后端
      projectCreateInFlightRef.current = true;
      try {
        setLoading(true);
        
        // 1. 创建分析项目
        const project = createdProjectId
          ? await analysisApi.updateProject(createdProjectId, {
              name: projectName,
              datasetIds: selectedDatasets.map(d => d.id),
              templateId: selectedTemplateImage.id,
              config: { ...persistedConfig, currentStep: 1 },
            })
          : await analysisApi.createProject({
              name: projectName,
              datasetIds: selectedDatasets.map(d => d.id),
              templateId: selectedTemplateImage.id,
              config: { ...persistedConfig, currentStep: 1 },
            });
        
        const temporaryDraftId = draftStorageIdRef.current;
        setCreatedProjectId(project.id);
        draftStorageIdRef.current = project.id;
        if (temporaryDraftId !== project.id) {
          const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
          localStorage.setItem(
            'incompleteAnalysisProjects',
            JSON.stringify(savedProjects.filter((saved) => String(saved.id) !== String(temporaryDraftId)))
          );
        }
        message.success('项目创建成功，进入图像矫正步骤');
        
        // 2. 获取选中数据集的所有图片
        const allImages = [];
        for (const dataset of selectedDatasets) {
          const images = await datasetApi.getDatasetImages(dataset.id);
          allImages.push(...images.map(img => ({
            ...img,
            datasetId: dataset.id,
            datasetName: dataset.name
          })));
        }
        
        // 3. 准备矫正图片列表（步骤2使用）
        const imagesForCorrection = allImages.map((img, idx) => ({
          id: img.id,
          name: img.name,
          original: datasetApi.imageFileUrl(img.datasetId, img.id),
          corrected: null, // 等待后端返回
          dataset: img.datasetName,
          status: 'pending'
        }));
        
        setCorrectedImages(imagesForCorrection);
        
      } catch (error) {
        const errorMessage = getProjectCreateErrorMessage(error);
        if (error?.response?.status === 409) {
          message.warning(errorMessage);
        } else {
          message.error(errorMessage);
        }
        return;
      } finally {
        projectCreateInFlightRef.current = false;
        setLoading(false);
      }
    }
    if (currentStep === 1) {
      if (isCorrecting) { message.warning('图像矫正正在进行中，请稍候'); return; }
      if (!correctionComplete) { message.warning('请等待图像矫正完成'); return; }
    }
    if (currentStep === 2 && regions.length === 0) { message.warning('请至少定义一个分析区域'); return; }
    if (currentStep === 3) {
      const incomplete = findIncompleteSelection(imageAnalysisConfig);
      if (incomplete) {
        setSelectedImageForConfig(correctedImages.find((image) => image.id === incomplete.imageId) || null);
        setSelectedRegionForConfig(regions.find((region) => region.regionId === incomplete.regionId) || null);
        message.warning('已选择的区域必须选择“颜色分布分析”方法');
        return;
      }
      const normalized = normalizeAnalysisConfigV1(imageAnalysisConfig);
      if (Object.keys(normalized).length === 0) {
        message.warning('请至少为一张图片的一个区域配置颜色分布分析');
        return;
      }
    }

    if (currentStep < totalSteps - 1) {
      if (createdProjectId) {
        try {
          await analysisApi.updateProject(createdProjectId, {
            name: projectName,
            datasetIds: selectedDatasets.map((dataset) => dataset.id),
            templateId: selectedTemplateImage.id,
            config: { ...persistedConfig, currentStep: currentStep + 1 },
          });
        } catch {
          saveProjectToStorage();
          return;
        }
      }
      setCurrentStep(currentStep + 1);
      // 步骤切换时自动保存
      saveProjectToStorage();
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  const handleSubmit = async () => {
    if (projectSubmitInFlightRef.current) return;
    const incomplete = findIncompleteSelection(imageAnalysisConfig);
    if (incomplete) {
      setSelectedImageForConfig(correctedImages.find((image) => image.id === incomplete.imageId) || null);
      setSelectedRegionForConfig(regions.find((region) => region.regionId === incomplete.regionId) || null);
      message.warning('已选择的区域必须选择“颜色分布分析”方法');
      return;
    }
    const normalizedConfig = normalizeAnalysisConfigV1(imageAnalysisConfig);
    if (Object.keys(normalizedConfig).length === 0) {
      message.warning('请至少为一张图片的一个区域配置颜色分布分析');
      return;
    }
    projectSubmitInFlightRef.current = true;
    setLoading(true);
    
    try {
      const activeProjectId = createdProjectId || projectId;
      if (!activeProjectId) throw new Error('项目草稿尚未创建');
      await analysisApi.updateProject(activeProjectId, {
        name: projectName,
        datasetIds: selectedDatasets.map((dataset) => dataset.id),
        templateId: selectedTemplateImage.id,
        config: {
          ...persistedConfig,
          analysisConfigVersion: 1,
          currentStep: totalSteps,
          imageAnalysisConfig: normalizedConfig,
        },
      });
      await analysisApi.startAnalysis(activeProjectId);

      // 提交成功后清除本地存储中的临时项目
      const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
      const filtered = savedProjects.filter(p => p.id !== activeProjectId && p.id !== projectId);
      localStorage.setItem('incompleteAnalysisProjects', JSON.stringify(filtered));
      
      setLoading(false);
      message.success('分析项目创建成功，正在启动分析任务');
      navigate('/analysis');
    } catch (error) {
      const serverMessage = error?.response?.data?.message
        || error?.response?.data?.error
        || error?.message
        || '未知错误';
      message.error('提交失败：' + serverMessage);
      setLoading(false);
    } finally {
      projectSubmitInFlightRef.current = false;
    }
  };

  // ==================== 步骤1: 数据集和模板选择 ====================

  const handleDatasetToggle = (dataset, groupName) => {
    const datasetWithGroup = { ...dataset, group: groupName };
    const exists = selectedDatasets.find(d => d.id === dataset.id);
    if (exists) {
      setSelectedDatasets(selectedDatasets.filter(d => d.id !== dataset.id));
    } else {
      setSelectedDatasets([...selectedDatasets, datasetWithGroup]);
    }
    clearCorrectionObjectUrls();
    setCorrectedImages([]);
    setCorrectionComplete(false);
    setCorrectionProgress(0);
    setImageAnalysisConfig({});
    setSelectedImageForConfig(null);
    setSelectedRegionForConfig(null);
  };

  const handleTemplateSelect = (template) => {
    if (!template.imageAvailable) {
      message.warning('该模板照片不存在，请重新上传模板照片后再使用');
      return;
    }
    if (template.id !== selectedTemplateImage?.id) {
      clearCorrectionObjectUrls();
      setCorrectedImages([]);
      setCorrectionComplete(false);
      setCorrectionProgress(0);
      setRegions([]);
      setSelectedRegion(null);
      setImageAnalysisConfig({});
      setSelectedImageForConfig(null);
      setSelectedRegionForConfig(null);
    }
    setSelectedTemplateImage(template);
  };

  const handleUploadTemplate = async (file) => {
    try {
      const newTemplate = await templateApi.createTemplate({
        name: file.name.replace(/\.[^/.]+$/, ''),
        imageFile: file
      });
      await fetchTemplates();
      setSelectedTemplateImage(newTemplate);
      message.success('模板图片上传成功');
    } catch (error) {
      console.error('上传模板失败:', error);
      message.error(`上传失败: ${error.message || '未知错误'}`);
    }
    return false;
  };

  // ==================== 步骤2: 图像矫正 ====================

  const requestCorrectedImage = async (image) => {
    const activeProjectId = createdProjectId || projectId;
    if (!activeProjectId) throw new Error('项目草稿尚未创建');
    const result = await analysisApi.correctImage(activeProjectId, image.id);
    const correctedBlob = result instanceof Blob ? result : new Blob([result], { type: 'image/png' });
    if (correctedBlob.size === 0) throw new Error('校正接口返回了空图片');
    return correctedBlob;
  };

  const startBackendCorrection = async () => {
    setIsCorrecting(true);
    setCorrectionComplete(false);
    setCorrectionProgress(0);
    clearCorrectionObjectUrls();
    try {
      const images = [];
      for (const dataset of selectedDatasets) {
        const datasetImages = await datasetApi.getDatasetImages(dataset.id);
        images.push(...(datasetImages || []).map((image) => ({
          id: image.id,
          datasetId: dataset.id,
          name: image.fileName || image.name || image.id,
          dataset: dataset.name,
          original: datasetApi.imageFileUrl(dataset.id, image.id),
          corrected: null,
          status: 'pending',
        })));
      }
      if (images.length === 0) throw new Error('所选数据集中没有可校正的图片');
      if (!selectedTemplateImage?.imageAvailable) {
        throw new Error('该模板照片不存在，请重新上传模板照片后再使用');
      }

      setCorrectedImages(images);
      let failedCount = 0;

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        try {
          const correctedBlob = await requestCorrectedImage(image);
          const correctedUrl = createCorrectionObjectUrl(correctedBlob);
          setCorrectedImages((items) => items.map((item) => item.id === image.id
            ? { ...item, corrected: correctedUrl, correctedBlob, status: 'completed', error: null }
            : item));
        } catch (error) {
          failedCount += 1;
          const errorMessage = error.response?.status === 422
            ? '没有检测到角点，矫正失败'
            : (error.message || '矫正失败');
          setCorrectedImages((items) => items.map((item) => item.id === image.id
            ? { ...item, status: 'failed', error: errorMessage }
            : item));
          message.warning(`${image.name}: ${errorMessage}`);
        }
        setCorrectionProgress(Math.round(((index + 1) / images.length) * 100));
      }

      setCorrectionComplete(failedCount === 0);
      if (failedCount === 0) {
        message.success(`完成 ${images.length} 张图片的同步矫正`);
      } else {
        message.warning(`${images.length - failedCount}/${images.length} 张图片矫正成功，请重试失败图片`);
      }
    } catch (error) {
      setCorrectedImages([]);
      message.error('图像矫正失败：' + (error.message || '未知错误'));
    } finally {
      setIsCorrecting(false);
    }
  };

  const retryCorrection = async (img) => {
    setCorrectionComplete(false);
    setCorrectedImages((items) => items.map((item) => item.id === img.id
      ? { ...item, status: 'pending', error: null }
      : item));
    try {
      const correctedBlob = await requestCorrectedImage(img);
      const correctedUrl = createCorrectionObjectUrl(correctedBlob);
      setCorrectedImages((items) => {
        const next = items.map((item) => item.id === img.id
          ? { ...item, corrected: correctedUrl, correctedBlob, status: 'completed', error: null }
          : item);
        setCorrectionComplete(next.length > 0 && next.every((item) => item.status === 'completed'));
        return next;
      });
      message.success(`${img.name} 矫正成功`);
    } catch (error) {
      const errorMessage = error.response?.status === 422
        ? '没有检测到角点，矫正失败'
        : (error.message || '矫正失败');
      setCorrectedImages((items) => items.map((item) => item.id === img.id
        ? { ...item, status: 'failed', error: errorMessage }
        : item));
      message.error(`${img.name}: ${errorMessage}`);
    }
  };

  // 删除失败的图片
  const deleteFailedImage = (imageId) => {
    setCorrectedImages(prev => prev.filter(item => item.id !== imageId));
    message.success('已删除失败的图片');
  };

  // 保存所有矫正图片到本地
  const saveAllCorrectedImages = async () => {
    const completedImages = correctedImages.filter(img => img.status === 'completed' && img.corrected);
    
    if (completedImages.length === 0) {
      message.warning('没有已完成的矫正图片可保存');
      return;
    }

    try {
      for (const img of completedImages) {
        const blob = img.correctedBlob || await fetch(img.corrected).then((response) => response.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `corrected_${img.name}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      message.success(`已保存 ${completedImages.length} 张矫正图片到本地`);
    } catch (error) {
      message.error('保存图片失败：' + (error.message || '未知错误'));
    }
  };

  // ==================== 步骤3: 区域定义 ====================

  useEffect(() => {
    if (currentStep === 2 && selectedTemplateImage?.imageAvailable) {
      let objectUrl;
      let cancelled = false;
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        edgeImgRef.current = img;
        setEdgeImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        if (!cancelled) setEdgeImgSize(null);
      };
      templateApi.getTemplateImage(selectedTemplateImage.id)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        })
        .catch(() => {
          if (!cancelled) setEdgeImgSize(null);
        });
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
  }, [currentStep, selectedTemplateImage]);

  // 自动缩放模板图片以适应容器
  useEffect(() => {
    if (!edgeImgSize || !edgeContainerRef.current) return;
    const container = edgeContainerRef.current;
    const containerWidth = container.clientWidth - 48; // padding
    const containerHeight = container.clientHeight - 48;
    const scaleX = containerWidth / edgeImgSize.w;
    const scaleY = containerHeight / edgeImgSize.h;
    const autoScale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
    setEdgeScale(autoScale);
  }, [edgeImgSize]);

  // 坐标转换 - 参照 EdgeDetectionPage
  const canvasToNorm = useCallback((canvasX, canvasY) => {
    if (!edgeImgSize || !edgeCanvasRef.current) return { normX: 0, normY: 0 };
    const dpr = window.devicePixelRatio || 1;
    // Convert CSS pixels to actual canvas pixels, then to normalized coordinates
    const actualX = canvasX * dpr;
    const actualY = canvasY * dpr;
    const normX = clamp01(actualX / (edgeImgSize.w * edgeScale * dpr));
    const normY = clamp01(actualY / (edgeImgSize.h * edgeScale * dpr));
    return { normX, normY };
  }, [edgeImgSize, edgeScale]);

  // 碰撞检测 - 参照 EdgeDetectionPage
  const hitTest = useCallback((p) => {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (pointInPolygon(p, r.polygon)) return r.regionId;
    }
    return null;
  }, [regions]);

  // 获取区域颜色 - 参照 EdgeDetectionPage
  const getRegionColor = (regionId) => {
    const colors = {
      regionA: '#1890ff',
      regionB: '#52c41a',
      regionC: '#faad14',
      regionD: '#722ed1',
      regionE: '#eb2f96',
      regionF: '#fa541c',
    };
    return colors[regionId] || '#1890ff';
  };

  // 渲染画布 - 参照 EdgeDetectionPage
  const render = useCallback(() => {
    const canvas = edgeCanvasRef.current;
    const img = edgeImgRef.current;
    if (!canvas || !img || !edgeImgSize) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssSize.w * dpr);
    canvas.height = Math.round(cssSize.h * dpr);
    canvas.style.width = `${cssSize.w}px`;
    canvas.style.height = `${cssSize.h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize.w, cssSize.h);

    // 绘制原始图像
    if (showOriginal) {
      ctx.drawImage(img, 0, 0, cssSize.w, cssSize.h);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cssSize.w, cssSize.h);
    }

    // 绘制区域
    if (showRegions && regions.length > 0) {
      for (const r of regions) {
        const isSelected = selectedRegionIds.includes(r.regionId);
        const isHover = hover?.hit === r.regionId && !isSelected;
        const isMultiSelected = isMultiSelectMode && isSelected && selectedRegionIds.length > 1;

        const style = isMultiSelected
          ? { stroke: 'rgba(255,0,255,0.95)', fill: 'rgba(255,0,255,0.22)', lw: 3 }
          : isSelected
          ? { stroke: 'rgba(0,255,255,0.95)', fill: 'rgba(0,255,255,0.22)', lw: 3 }
          : isHover
          ? { stroke: 'rgba(255,120,0,0.95)', fill: 'rgba(255,120,0,0.16)', lw: 2.5 }
          : { stroke: r.color || 'rgba(24,144,255,0.8)', fill: `${r.color}20` || 'rgba(24,144,255,0.1)', lw: 2 };

        drawPolygon(ctx, r.polygon, edgeImgSize.w, edgeImgSize.h, edgeScale, style.stroke, style.fill, style.lw);

        // 绘制区域标签
        if (isSelected || isHover) {
          const center = getPolygonCenter(r.polygon);
          const x = center.x * edgeImgSize.w * edgeScale;
          const y = center.y * edgeImgSize.h * edgeScale;

          ctx.fillStyle = isMultiSelected ? 'rgba(255,0,255,0.95)' : (isSelected ? 'rgba(0,255,255,0.95)' : 'rgba(255,120,0,0.95)');
          ctx.font = 'bold 14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(r.name, x, y - 10);
        }
      }
    }

    // 绘制手绘中的多边形
    if (isDrawing && drawingPoints.length > 0) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawingPoints.forEach((p, i) => {
        const x = p.x * edgeImgSize.w * edgeScale;
        const y = p.y * edgeImgSize.h * edgeScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (drawingPoints.length > 2) {
        const first = drawingPoints[0];
        ctx.lineTo(first.x * edgeImgSize.w * edgeScale, first.y * edgeImgSize.h * edgeScale);
      }
      ctx.stroke();

      // 绘制顶点
      drawingPoints.forEach(p => {
        const x = p.x * edgeImgSize.w * edgeScale;
        const y = p.y * edgeImgSize.h * edgeScale;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
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
  }, [cssSize, drawingPoints, hover, edgeImgSize, isDrawing, regions, edgeScale, selectedRegionIds, isMultiSelectMode, showOriginal, showRegions]);

  useEffect(() => {
    render();
  }, [render]);

  // 鼠标事件处理 - 参照 EdgeDetectionPage
  const handleEdgeCanvasClick = (e) => {
    if (!edgeImgSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);

    if (isDrawing) {
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
        const hitRegion = hit ? regions.find(r => r.regionId === hit) : null;
        setSelectedRegion(hitRegion || null);
        setSelectedRegionIds(hit ? [hit] : []);
      }
    }
  };

  const handleMove = (e) => {
    if (!edgeImgSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);
    const hit = hitTest({ x: normX, y: normY });
    setHover({ canvasX, canvasY, normX, normY, hit });
  };

  const handleLeave = () => setHover(null);

  // 双击重命名处理
  const handleEdgeCanvasDoubleClick = (e) => {
    if (!edgeImgSize || isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const { normX, normY } = canvasToNorm(canvasX, canvasY);
    const hit = hitTest({ x: normX, y: normY });
    
    if (hit) {
      const region = regions.find(r => r.regionId === hit);
      if (region) {
        setRenamingRegionId(hit);
        setNewRegionName(region.name);
        setShowRenameModal(true);
      }
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

  // 合并选中的区域
  const mergeSelectedRegions = () => {
    if (selectedRegionIds.length < 2) {
      message.warning("请至少选择2个区域进行合并");
      return;
    }

    const selectedRegions = regions.filter(r => selectedRegionIds.includes(r.regionId));
    const polygons = selectedRegions.map(r => r.polygon);

    try {
      // 直接使用前端的凸包算法进行合并
      const mergedPolygon = computeConvexHull(polygons.flat());

      const mergedRegion = {
        regionId: `region-${Date.now()}`,
        name: `合并区域 ${regions.length + 1}`,
        polygon: mergedPolygon,
        color: '#1890ff'
      };

      // 删除原区域，添加合并后的区域
      setRegions(prev => [...prev.filter(r => !selectedRegionIds.includes(r.regionId)), mergedRegion]);
      setSelectedRegionIds([]);
      setIsMultiSelectMode(false);
      message.success("区域合并成功");
    } catch (error) {
      message.error("区域合并失败：" + (error.message || "未知错误"));
    }
  };

  // 凸包算法（备用）
  const computeConvexHull = (points) => {
    if (points.length < 3) return points;
    
    // 简单的凸包算法实现
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    
    upper.pop();
    lower.pop();
    return [...lower, ...upper];
  };

  // 自动检测区域 - 使用Canny边缘检测API
  const handleAutoDetectRegions = async () => {
    setIsDetecting(true);
    setRegions([]);
    
    try {
      // 获取模板图片并转换为FormData
      const formData = new FormData();
      const templateBlob = await templateApi.getTemplateImage(selectedTemplateImage.id);
      formData.append('file', templateBlob, 'template.png');
      
      // 调用Canny边缘检测API（不配置threshold参数）
      const result = await toolApi.cannyEdgeDetection(formData);
      
      // 使用API返回的区域数据或默认数据
      const detectedRegions = result.regions || [
        {
          regionId: 'region1',
          name: '区域1',
          polygon: [
            { x: 90 / 600, y: 80 / 400 },
            { x: 160 / 600, y: 60 / 400 },
            { x: 230 / 600, y: 100 / 400 },
            { x: 210 / 600, y: 160 / 400 },
            { x: 140 / 600, y: 170 / 400 },
            { x: 80 / 600, y: 130 / 400 },
          ],
          color: '#1890ff',
        },
        {
          regionId: 'region2',
          name: '区域2',
          polygon: [
            { x: 380 / 600, y: 70 / 400 },
            { x: 460 / 600, y: 70 / 400 },
            { x: 520 / 600, y: 120 / 400 },
            { x: 460 / 600, y: 170 / 400 },
            { x: 380 / 600, y: 170 / 400 },
            { x: 340 / 600, y: 120 / 400 },
          ],
          color: '#52c41a',
        },
        {
          regionId: 'region3',
          name: '区域3',
          polygon: [
            { x: 300 / 600, y: 230 / 400 },
            { x: 360 / 600, y: 300 / 400 },
            { x: 300 / 600, y: 360 / 400 },
            { x: 240 / 600, y: 300 / 400 },
          ],
          color: '#faad14',
        },
      ];
      
      setRegions(detectedRegions);
      message.success(`自动检测到 ${detectedRegions.length} 个区域`);
    } catch (error) {
      message.error('区域检测失败：' + (error.message || '未知错误'));
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleDrawing = () => {
    if (isDrawing) {
      if (drawingPoints.length >= 3) finishDrawing();
      else cancelDrawing();
    } else {
      setIsDrawing(true);
      setDrawingPoints([]);
    }
  };

  // 完成手绘区域 - 参照 EdgeDetectionPage (存储多边形)
  const finishDrawing = () => {
    if (drawingPoints.length >= 3) {
      const newRegionIndex = regions.length + 1;
      const newRegion = {
        regionId: `region${newRegionIndex}`,
        name: `区域${newRegionIndex}`,
        polygon: [...drawingPoints],
        color: getRegionColor(`region${newRegionIndex}`),
      };
      setRegions(prev => [...prev, newRegion]);
      message.success(`新区域 "区域${newRegionIndex}" 已添加`);
    }
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const handleDeleteRegion = (regionId) => {
    setRegions(prev => prev.filter(r => r.regionId !== regionId));
    setImageAnalysisConfig((previous) => Object.fromEntries(
      Object.entries(previous).map(([imageId, imageConfig]) => [
        imageId,
        Object.fromEntries(Object.entries(imageConfig).filter(([id]) => id !== regionId)),
      ])
    ));
    if (selectedRegion?.regionId === regionId) setSelectedRegion(null);
  };

  // ==================== 步骤4: 分析配置 ====================

  const handleImageSelectForConfig = (image) => {
    setSelectedImageForConfig(image);
    setSelectedRegionForConfig(null);
  };

  useEffect(() => {
    setStep4LoadedImage(null);
    if (!selectedImageForConfig?.id || !selectedImageForConfig?.corrected) {
      setStep4ImageLoading(false);
      return undefined;
    }
    setStep4ImageLoading(true);
    return loadSelectedImage({
      imageId: selectedImageForConfig.id,
      src: selectedImageForConfig.corrected,
      onLoad: (loaded) => {
        setStep4LoadedImage(loaded);
        setStep4ImageLoading(false);
      },
      onError: () => {
        setStep4LoadedImage(null);
        setStep4ImageLoading(false);
        message.error('配置图片加载失败，请重新选择或重新执行图像矫正');
      },
    });
  }, [selectedImageForConfig?.id, selectedImageForConfig?.corrected]);

  const toggleRegionForImage = (region) => {
    if (!selectedImageForConfig) return;

    setImageAnalysisConfig(prev => {
      const currentConfig = prev[selectedImageForConfig.id] || {};
      const hasRegion = currentConfig[region.regionId];

      if (hasRegion) {
        const { [region.regionId]: _, ...rest } = currentConfig;
        return { ...prev, [selectedImageForConfig.id]: rest };
      } else {
        return { ...prev, [selectedImageForConfig.id]: { ...currentConfig, [region.regionId]: [] } };
      }
    });
  };

  const toggleMethodForRegion = (regionId, methodKey) => {
    if (!selectedImageForConfig) return;
    if (methodKey !== 'color_distribution') {
      message.info('该分析方法在 V1.0 暂不支持');
      return;
    }

    setImageAnalysisConfig(prev => {
      const currentConfig = prev[selectedImageForConfig.id] || {};
      const currentMethods = currentConfig[regionId] || [];

      const newMethods = currentMethods.includes(methodKey)
        ? currentMethods.filter(m => m !== methodKey)
        : [...currentMethods, methodKey];

      return {
        ...prev,
        [selectedImageForConfig.id]: { ...currentConfig, [regionId]: newMethods }
      };
    });
  };

  // 全选/取消全选所有区域
  const toggleAllRegions = () => {
    if (!selectedImageForConfig) return;

    const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
    const allRegionIds = regions.map(r => r.regionId);
    const selectedRegionIds = Object.keys(imageConfig);
    const isAllSelected = allRegionIds.every(id => selectedRegionIds.includes(id));

    if (isAllSelected) {
      // 取消全选
      setImageAnalysisConfig(prev => ({
        ...prev,
        [selectedImageForConfig.id]: {}
      }));
    } else {
      // 全选所有区域
      const newConfig = {};
      regions.forEach(region => {
        newConfig[region.regionId] = imageConfig[region.regionId] || [];
      });
      setImageAnalysisConfig(prev => ({
        ...prev,
        [selectedImageForConfig.id]: newConfig
      }));
    }
  };

  // 全选/取消全选所有方法（针对当前选中区域）
  const toggleAllMethods = () => {
    if (!selectedImageForConfig || !selectedRegionForConfig) return;

    const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
    const regionMethods = imageConfig[selectedRegionForConfig.regionId] || [];
    const enabledMethods = ANALYSIS_METHODS.filter(m => !m.disabled);
    const isAllSelected = enabledMethods.every(m => regionMethods.includes(m.key));

    setImageAnalysisConfig(prev => {
      const currentConfig = prev[selectedImageForConfig.id] || {};
      const newMethods = isAllSelected
        ? []
        : enabledMethods.map(m => m.key);

      return {
        ...prev,
        [selectedImageForConfig.id]: { ...currentConfig, [selectedRegionForConfig.regionId]: newMethods }
      };
    });
  };

  const getImageConfigSummary = (imageId) => {
    const config = imageAnalysisConfig[imageId] || {};
    const regionCount = Object.keys(config).length;
    const methodCount = Object.values(config).reduce((sum, methods) => sum + methods.length, 0);
    return { regionCount, methodCount };
  };

  // 步骤4 Canvas渲染 - 在图片上叠加显示区域
  const renderStep4Canvas = useCallback(() => {
    const canvas = step4CanvasRef.current;
    const img = resolveSelectedImage(step4LoadedImage, selectedImageForConfig);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!img) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // 设置canvas尺寸为图片尺寸（限制最大尺寸）
    const maxWidth = 400;
    const maxHeight = 280;
    const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 绘制图片
    ctx.drawImage(img, 0, 0, width, height);

    // 绘制已选区域
    if (selectedImageForConfig && regions.length > 0) {
      const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
      const selectedRegionIds = Object.keys(imageConfig);

      regions.forEach(region => {
        const isSelected = selectedRegionIds.includes(region.regionId);
        const isHighlighted = selectedRegionForConfig?.regionId === region.regionId;

        if (isSelected) {
          const style = isHighlighted
            ? { stroke: 'rgba(0,255,255,0.95)', fill: 'rgba(0,255,255,0.25)', lw: 3 }
            : { stroke: region.color || 'rgba(24,144,255,0.8)', fill: `${region.color}40` || 'rgba(24,144,255,0.2)', lw: 2 };

          drawPolygon(ctx, region.polygon, width, height, 1, style.stroke, style.fill, style.lw);

          // 绘制区域名称
          const center = getPolygonCenter(region.polygon);
          ctx.fillStyle = isHighlighted ? 'rgba(0,255,255,1)' : (region.color || '#1890ff');
          ctx.font = 'bold 12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(region.name, center.x * width, center.y * height - 5);
        }
      });
    }
  }, [selectedImageForConfig, step4LoadedImage, regions, imageAnalysisConfig, selectedRegionForConfig]);

  useEffect(() => {
    renderStep4Canvas();
  }, [renderStep4Canvas]);

  const renderStep1 = () => (
    <div style={stepContainerStyle}>
      {/* 左侧: 项目信息 */}
      <div style={leftPanelStyle(280)}>
        <Card
          title={<SectionTitle icon={<ExperimentOutlined />} title="项目信息" />}
          styles={{ body: { padding: '20px', overflow: 'auto', maxHeight: 'calc(100vh - 380px)' } }}
          style={cardStyle}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <label style={labelStyle}>
                项目名称 <span style={{ color: colors.danger }}>*</span>
              </label>
              <Input
                placeholder="请输入项目名称"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                maxLength={50}
                size="large"
                style={{ borderRadius: 8 }}
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                {projectName.length}/50 字符
              </Text>
            </div>
            <div>
              <label style={labelStyle}>项目描述</label>
              <Input.TextArea
                placeholder="简要描述本次分析的目的..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
                style={{ borderRadius: 8, resize: 'none' }}
              />
            </div>
            
            {/* 已选摘要 */}
            <div style={{ background: colors.neutral, borderRadius: 8, padding: 16, marginTop: 8 }}>
              <Text strong style={{ fontSize: 13, color: colors.textPrimary }}>已选摘要</Text>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={summaryItemStyle}>
                  <DatabaseOutlined style={{ color: colors.primary }} />
                  <Text style={{ fontSize: 13 }}>数据集: {selectedDatasets.length} 个</Text>
                </div>
                <div style={summaryItemStyle}>
                  <FileImageOutlined style={{ color: colors.success }} />
                  <Text style={{ fontSize: 13 }}>图片: {selectedDatasets.reduce((sum, ds) => sum + (ds.imageCount ?? ds.fileCount ?? 0), 0)} 张</Text>
                </div>
                <div style={summaryItemStyle}>
                  <LayoutOutlined style={{ color: colors.warning }} />
                  <Text style={{ fontSize: 13 }}>
                    模板: {selectedTemplateImage ? selectedTemplateImage.name : '未选择'}
                  </Text>
                </div>
              </div>
            </div>
          </Space>
        </Card>
      </div>

      {/* 中间: 数据集选择 */}
      <div style={centerPanelStyle}>
        <Card 
          title={<SectionTitle icon={<FolderOpenOutlined />} title="选择数据集" />}
          extra={
            <Badge count={selectedDatasets.length} style={{ backgroundColor: colors.primary }}>
              <Text type="secondary" style={{ fontSize: 13 }}>已选择</Text>
            </Badge>
          }
          loading={datasetsLoading}
          styles={{ body: { padding: '20px', overflow: 'auto' } }}
          style={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {backendDatasets.length === 0 ? (
              <Empty description="暂无数据集" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              backendDatasets.map(dataset => {
                const isSelected = selectedDatasets.find(d => d.id === dataset.id);
                return (
                  <div
                    key={dataset.id}
                    onClick={() => handleDatasetToggle(dataset, dataset.groupName || '默认分组')}
                    style={{
                      ...datasetItemStyle,
                      backgroundColor: isSelected ? colors.primaryLight : colors.white,
                      borderColor: isSelected ? colors.primary : colors.neutralDark,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Checkbox checked={!!isSelected} />
                      {datasetPreviewImages[dataset.id]?.id ? (
                        <AuthenticatedImage
                          datasetId={dataset.id}
                          imageId={datasetPreviewImages[dataset.id].id}
                          alt={dataset.name}
                          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: colors.neutralLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileImageOutlined style={{ fontSize: 28, color: colors.textTertiary }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 14, fontWeight: 500, display: 'block' }}>{dataset.name}</Text>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dataset.imageCount ?? dataset.fileCount ?? 0} 张图片
                          </Text>
                        </div>
                        <div>
                          <Tag color="blue" style={{ fontSize: 11, marginTop: 4 }}>
                            {dataset.year ?? dataset.academicYear ?? '未分类'}
                          </Tag>
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircleOutlined style={{ color: colors.success, fontSize: 18 }} />}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* 右侧: 模板选择 */}
      <div style={rightPanelStyle(320)}>
        <Card 
          title={<SectionTitle icon={<PictureOutlined />} title="选择模板" />}
          extra={
            <Upload beforeUpload={handleUploadTemplate} showUploadList={false} accept="image/*">
              <Button icon={<UploadOutlined />} size="small" type="primary">上传</Button>
            </Upload>
          }
          styles={{ body: { padding: '20px', overflow: 'auto', maxHeight: 'calc(100vh - 380px)' } }}
          style={{ ...cardStyle, height: '100%' }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            选择或上传一张模板图片用于分析
          </Text>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {templateImages.map(template => {
              const isSelected = selectedTemplateImage?.id === template.id;
              return (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    ...templateCardStyle,
                    borderColor: isSelected ? colors.primary : 'transparent',
                    backgroundColor: isSelected ? colors.primaryLight : colors.white,
                    boxShadow: isSelected ? `0 0 0 2px ${colors.primary}` : styles.shadow.sm,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                >
                  {template.imageAvailable ? (
                    <AuthenticatedImage
                      url={templateApi.getTemplateImageUrl(template.id)}
                      alt={template.name}
                      style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 6 }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  {!template.imageAvailable && (
                    <div style={{ width: 72, height: 72, borderRadius: 6, background: colors.neutralLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileOutlined style={{ fontSize: 28, color: colors.textTertiary }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 14 }}>{template.name}</Text>
                      {isSelected && <Badge color={colors.success} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </Space>
          
          {selectedTemplateImage && (
            <div style={{ marginTop: 20, padding: 16, background: colors.neutral, borderRadius: 8 }}>
              <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>已选模板预览</Text>
              {selectedTemplateImage.imageAvailable ? (
                <AuthenticatedImage
                  url={templateApi.getTemplateImageUrl(selectedTemplateImage.id)}
                  alt={selectedTemplateImage.name}
                  style={{ width: '100%', height: 140, objectFit: 'contain', borderRadius: 6 }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              {!selectedTemplateImage.imageAvailable && (
                <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.neutralLight, borderRadius: 6 }}>
                  <FileOutlined style={{ fontSize: 48, color: colors.textTertiary }} />
                </div>
              )}
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <Text strong style={{ fontSize: 13 }}>{selectedTemplateImage.name}</Text>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={stepContainerStyle}>
      {/* 左侧: 矫正控制面板 */}
      <div style={leftPanelStyle(340)}>
        <Card
          title={<SectionTitle icon={<ExperimentOutlined />} title="矫正控制" />}
          styles={{ body: { padding: '24px' } }}
          style={{ ...cardStyle, height: 'auto' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 进度圆环 */}
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress 
                type="circle" 
                percent={correctionProgress} 
                status={correctionComplete ? 'success' : 'active'} 
                strokeColor={colors.primary} 
                width={120}
                strokeWidth={8}
              />
              <div style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary }}>
                  {isCorrecting ? '后端处理中...' : correctionComplete ? '矫正完成' : '等待开始'}
                </Text>
              </div>
            </div>

            {/* 数据摘要 */}
            <div style={{ background: colors.neutral, borderRadius: 10, padding: 20 }}>
              <Text strong style={{ fontSize: 14, marginBottom: 16, display: 'block' }}>待处理数据</Text>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={infoRowStyle}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>数据集数</Text>
                  <Text strong style={{ fontSize: 14 }}>{selectedDatasets.length}</Text>
                </div>
                <div style={infoRowStyle}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>图片总数</Text>
                  <Text strong style={{ fontSize: 14 }}>
                    {selectedDatasets.reduce((sum, ds) => sum + (ds.imageCount ?? ds.fileCount ?? 0), 0)}
                  </Text>
                </div>
                <div style={infoRowStyle}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>模板</Text>
                  <Text strong style={{ fontSize: 14 }} ellipsis>
                    {selectedTemplateImage?.name || '-'}
                  </Text>
                </div>
              </Space>
            </div>

            {/* 操作按钮 */}
            {!correctionComplete && !isCorrecting && (
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />} 
                onClick={startBackendCorrection} 
                block 
                size="large"
                style={{ height: 44, borderRadius: 8 }}
              >
                开始后端矫正
              </Button>
            )}

            {isCorrecting && (
              <Button disabled block size="large" style={{ height: 44, borderRadius: 8 }}>
                <Spin size="small" style={{ marginRight: 8 }} />
                后端处理中...
              </Button>
            )}

            {correctionComplete && (
              <>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={saveAllCorrectedImages}
                  block
                  size="large"
                  style={{ height: 44, borderRadius: 8 }}
                >
                  保存所有矫正图片
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => { setCorrectionComplete(false); startBackendCorrection(); }}
                  block
                  size="large"
                  style={{ height: 44, borderRadius: 8 }}
                >
                  重新矫正
                </Button>
              </>
            )}
          </Space>
        </Card>
      </div>

      {/* 右侧: 图片预览网格 */}
      <div style={mainPanelStyle}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SectionTitle icon={<FileImageOutlined />} title="矫正效果预览" />
              <Badge 
                count={`${correctedImages.filter(img => img.status === 'completed').length}/${correctedImages.length}`}
                style={{ backgroundColor: colors.success }}
              />
            </div>
          }
          styles={{ body: { padding: '20px', overflow: 'auto' } }}
          style={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {correctedImages.length === 0 ? (
            <Empty description="正在准备图片..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {correctedImages.map((img, idx) => (
                <div
                  key={img.id}
                  style={{
                    ...imagePreviewCardStyle,
                    opacity: img.status === 'completed' ? 1 : 0.6,
                    borderColor: img.status === 'completed' ? colors.success : colors.neutralDark,
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    {img.corrected ? (
                      <img
                        src={img.corrected}
                        alt={img.name}
                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}
                        onClick={() => setPreviewCorrectedImage(img)}
                      />
                    ) : img.status === 'failed' && img.original ? (
                      <AuthenticatedImage
                        datasetId={img.datasetId}
                        imageId={img.id}
                        url={img.original}
                        alt={img.name}
                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '8px 8px 0 0', opacity: 0.6 }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.neutralLight }}>
                        <FileImageOutlined style={{ fontSize: 32, color: colors.textTertiary }} />
                      </div>
                    )}
                    <div style={imageStatusOverlayStyle(img.status === 'completed')}>
                      {img.status === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#fff', fontSize: 20 }} />
                      ) : img.status === 'failed' ? (
                        <CloseCircleOutlined style={{ color: '#fff', fontSize: 20 }} />
                      ) : (
                        <Spin size="small" />
                      )}
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: 500 }} ellipsis>{img.name}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag size="small" style={{ fontSize: 11 }}>{img.dataset}</Tag>
                      {img.status === 'failed' && (
                        <Tag size="small" color="error" style={{ fontSize: 11 }}>{img.error || '矫正失败'}</Tag>
                      )}
                    </div>
                    {correctionComplete && img.status === 'failed' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <Button 
                          size="small" 
                          type="primary" 
                          onClick={() => retryCorrection(img)}
                          style={{ flex: 1 }}
                        >
                          重试
                        </Button>
                        <Button 
                          size="small" 
                          danger 
                          onClick={() => deleteFailedImage(img.id)}
                          style={{ flex: 1 }}
                        >
                          删除
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 矫正图片预览Modal */}
      <Modal
        open={!!previewCorrectedImage}
        title={previewCorrectedImage?.name}
        footer={null}
        width="80%"
        centered
        onCancel={() => setPreviewCorrectedImage(null)}
        destroyOnClose
      >
        {previewCorrectedImage?.corrected && (
          <img
            src={previewCorrectedImage.corrected}
            alt={previewCorrectedImage.name}
            style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}
      </Modal>
    </div>
  );

  const renderStep3 = () => (
    <div style={stepContainerStyle}>
      {/* 左侧: 工具面板 */}
      <div style={leftPanelStyle(280)}>
        <Card
          title={<SectionTitle icon={<SettingOutlined />} title="区域工具" />}
          styles={{ body: { padding: '20px', overflow: 'auto' } }}
          style={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button 
              type="primary" 
              icon={<ScanOutlined />} 
              onClick={handleAutoDetectRegions} 
              loading={isDetecting} 
              block 
              disabled={!edgeImgSize}
              size="large"
              style={{ height: 44, borderRadius: 8 }}
            >
              自动检测区域
            </Button>
            
            <Button 
              icon={<EditOutlined />} 
              onClick={toggleDrawing} 
              type={isDrawing ? 'primary' : 'default'} 
              block 
              disabled={!edgeImgSize}
              size="large"
              style={{ height: 44, borderRadius: 8 }}
            >
              {isDrawing ? '完成绘制' : '手动绘制'}
            </Button>
            
            {isDrawing && (
              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Button size="middle" onClick={finishDrawing} type="primary">确认</Button>
                <Button size="middle" danger onClick={cancelDrawing}>取消</Button>
              </Space>
            )}
            
            <Button 
              icon={<DeleteOutlined />} 
              onClick={() => {
                if (selectedRegionIds.length > 0) {
                  setRegions(prev => prev.filter(r => !selectedRegionIds.includes(r.regionId)));
                  setSelectedRegionIds([]);
                  setSelectedRegion(null);
                  message.success("区域已删除");
                } else if (selectedRegion) {
                  handleDeleteRegion(selectedRegion.regionId);
                }
              }} 
              disabled={!selectedRegion && selectedRegionIds.length === 0} 
              danger 
              block 
              size="large"
              style={{ height: 44, borderRadius: 8 }}
            >
              删除选中
            </Button>

            <Button 
              icon={<LayoutOutlined />} 
              onClick={() => setIsMultiSelectMode(!isMultiSelectMode)} 
              type={isMultiSelectMode ? 'primary' : 'default'} 
              block 
              size="large"
              style={{ height: 44, borderRadius: 8 }}
            >
              {isMultiSelectMode ? '退出多选' : '多选模式'}
            </Button>

            {isMultiSelectMode && selectedRegionIds.length >= 2 && (
              <Button 
                icon={<AppstoreOutlined />} 
                onClick={mergeSelectedRegions} 
                type="primary" 
                block 
                size="large"
                style={{ height: 44, borderRadius: 8 }}
              >
                合并选中区域
              </Button>
            )}

            <Divider style={{ margin: '16px 0' }} />

            <div style={{ background: colors.neutral, borderRadius: 8, padding: 16 }}>
              <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>图片缩放</Text>
              <div style={{ padding: '0 8px' }}>
                <Slider
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={edgeScale}
                  onChange={setEdgeScale}
                  tooltip={{ formatter: (value) => `${Math.round(value * 100)}%` }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>20%</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{Math.round(edgeScale * 100)}%</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>200%</Text>
                </div>
              </div>
            </div>

            <div style={{ background: colors.neutral, borderRadius: 8, padding: 16, marginTop: 12 }}>
              <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>显示选项</Text>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Checkbox 
                  checked={showOriginal} 
                  onChange={(e) => setShowOriginal(e.target.checked)}
                  style={{ fontSize: 13 }}
                >
                  显示原图
                </Checkbox>
                <Checkbox 
                  checked={showRegions} 
                  onChange={(e) => setShowRegions(e.target.checked)}
                  style={{ fontSize: 13 }}
                >
                  显示区域
                </Checkbox>
              </Space>
            </div>

            <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                基于模板 "{selectedTemplateImage?.name || '-'}" 定义分析区域
              </Text>
            </div>
          </Space>
        </Card>
      </div>

      {/* 中间: Canvas画布 */}
      <div style={centerPanelStyle}>
        <Card 
          title={<SectionTitle icon={<AppstoreOutlined />} title="模板区域定义" />}
          styles={{ body: { padding: '24px',display: 'flex', overflow: 'auto', justifyContent: 'center', alignItems: 'center' } }}
          style={{ ...cardStyle, height: '100%' }}
        >
          {!edgeImgSize ? (
            <Empty description="正在加载模板..." image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Spin />
            </Empty>
          ) : (
            <div ref={edgeContainerRef} style={{ position: 'relative', overflow: 'auto', width: '100%', height: '100%' }}>
              <canvas
                ref={edgeCanvasRef}
                onClick={handleEdgeCanvasClick}
                onDoubleClick={handleEdgeCanvasDoubleClick}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                style={{
                  cursor: isDrawing ? 'crosshair' : 'pointer',
                  borderRadius: 12,
                  boxShadow: styles.shadow.lg,
                }}
              />
              {isDrawing && (
                <div style={drawingHintStyle}>
                  点击画布绘制区域，至少3个点形成闭合区域
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* 右侧: 区域列表 */}
      <div style={rightPanelStyle(300)}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SectionTitle icon={<LayoutOutlined />} title="已定义区域" />
              <Badge count={regions.length} style={{ backgroundColor: colors.primary }} />
            </div>
          }
          styles={{ body: { padding: '16px', overflow: 'auto' } }}
          style={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {regions.length === 0 ? (
            <Empty description="暂无区域" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Text type="secondary" style={{ fontSize: 12 }}>点击"自动检测"或手动绘制</Text>
            </Empty>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              {regions.map((region, index) => (
                <div
                  key={region.regionId}
                  onClick={() => setSelectedRegion(region)}
                  style={{
                    ...regionListItemStyle,
                    borderColor: selectedRegion?.regionId === region.regionId ? colors.primary : colors.neutralDark,
                    backgroundColor: selectedRegion?.regionId === region.regionId ? colors.primaryLight : colors.white,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: selectedRegion?.regionId === region.regionId ? colors.primary : (region.color || colors.success),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 14 }}>{region.name}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          顶点数: {region.polygon?.length || 0}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="text" 
                    danger 
                    size="small" 
                    icon={<DeleteOutlined />} 
                    onClick={(e) => { e.stopPropagation(); handleDeleteRegion(region.regionId); }}
                  />
                </div>
              ))}
            </Space>
          )}
        </Card>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div style={stepContainerStyle}>
      {/* 左侧: 图片列表 */}
      <div style={leftPanelStyle(300)}>
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SectionTitle icon={<FileImageOutlined />} title="图片列表" />
              <Badge count={correctedImages.length} style={{ backgroundColor: colors.primary }} />
            </div>
          }
          styles={{ body: { padding: '12px', overflow: 'auto' } }}
          style={{ ...cardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {correctedImages.map(img => {
              const isSelected = selectedImageForConfig?.id === img.id;
              const summary = getImageConfigSummary(img.id);
              const isConfigured = summary.regionCount > 0;

              return (
                <div
                  key={img.id}
                  onClick={() => handleImageSelectForConfig(img)}
                  style={{
                    ...imageConfigItemStyle,
                    borderColor: isSelected ? colors.primary : isConfigured ? colors.success : colors.neutralDark,
                    backgroundColor: isSelected ? colors.primaryLight : colors.white,
                  }}
                >
                  {img.corrected ? (
                    <img
                      src={img.corrected}
                      alt={img.name}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <FileImageOutlined style={{ fontSize: 28, color: colors.textTertiary, width: 56 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: 500 }} ellipsis>{img.name}</Text>
                    <div style={{ marginTop: 4 }}>
                      {isConfigured ? (
                        <Tag size="small" color="success" style={{ fontSize: 11 }}>
                          {summary.regionCount}区域 {summary.methodCount}方法
                        </Tag>
                      ) : (
                        <Tag size="small" style={{ fontSize: 11 }}>未配置</Tag>
                      )}
                    </div>
                  </div>
                  {isSelected && <Badge color={colors.primary} />}
                </div>
              );
            })}
          </Space>
        </Card>
      </div>

      {/* 中间: 图片预览 + 区域配置 */}
      <div style={centerPanelStyle}>
        <Card 
          title={
            selectedImageForConfig ? 
              <SectionTitle icon={<AreaChartOutlined />} title={`配置: ${selectedImageForConfig.name}`} /> :
              <SectionTitle icon={<AreaChartOutlined />} title="选择图片进行配置" />
          }
          styles={{ body: { padding: '24px', overflow: 'auto', maxHeight: 'calc(100vh - 360px)' } }}
          style={{ ...cardStyle, height: '100%' }}
        >
          {!selectedImageForConfig ? (
            <Empty description="请从左侧选择一张图片进行配置" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Text type="secondary" style={{ fontSize: 13 }}>点击左侧图片列表中的项目</Text>
            </Empty>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 图片预览 - 带区域叠加 */}
              <div style={{ textAlign: 'center', padding: 20, background: colors.neutral, borderRadius: 12 }}>
                {step4ImageLoading && (
                  <div style={{ padding: 32 }}><Spin tip="正在加载当前图片" /></div>
                )}
                <canvas
                  ref={step4CanvasRef}
                  style={{
                    display: step4ImageLoading || step4LoadedImage?.imageId !== selectedImageForConfig.id ? 'none' : 'inline-block',
                    maxWidth: '100%',
                    maxHeight: 220,
                    borderRadius: 8,
                    boxShadow: styles.shadow.md,
                  }}
                />
              </div>

              {/* 区域选择 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 14 }}>选择分析区域</Text>
                  {regions.length > 0 && (
                    <Button size="small" onClick={toggleAllRegions}>
                      {(() => {
                        const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
                        const allRegionIds = regions.map(r => r.regionId);
                        const selectedRegionIds = Object.keys(imageConfig);
                        const isAllSelected = allRegionIds.every(id => selectedRegionIds.includes(id));
                        return isAllSelected ? '取消全选' : '全选区域';
                      })()}
                    </Button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {regions.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 13 }}>步骤3未定义区域</Text>
                  ) : (
                    regions.map(region => {
                      const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
                      const isSelected = !!imageConfig[region.regionId];

                      return (
                        <div
                          key={region.regionId}
                          onClick={() => toggleRegionForImage(region)}
                          style={{
                            ...regionTagStyle,
                            backgroundColor: isSelected ? colors.primary : colors.white,
                            color: isSelected ? '#fff' : colors.textPrimary,
                            borderColor: isSelected ? colors.primary : colors.neutralDark,
                          }}
                        >
                          <BorderOutlined />
                          <span>{region.name}</span>
                          {isSelected && <CheckCircleOutlined style={{ fontSize: 12 }} />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 当前配置预览 */}
              {Object.keys(imageAnalysisConfig[selectedImageForConfig.id] || {}).length > 0 && (
                <div style={{ maxHeight: 280, overflow: 'auto', padding: '0 4px' }}>
                  <Text strong style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>当前配置</Text>
                  <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    {Object.entries(imageAnalysisConfig[selectedImageForConfig.id] || {}).map(([regionId, methods]) => {
                      const region = regions.find(r => r.regionId === regionId);
                      return (
                        <div key={regionId} style={{ 
                          padding: 16, 
                          background: colors.neutral, 
                          borderRadius: 10,
                          borderLeft: `4px solid ${colors.primary}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <BorderOutlined style={{ color: colors.primary }} />
                            <Text strong style={{ fontSize: 14 }}>{region?.name || '未知区域'}</Text>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {methods.length === 0 ? (
                              <Text type="secondary" style={{ fontSize: 12 }}>未选择分析方法</Text>
                            ) : (
                              methods.map(methodKey => {
                                const method = ANALYSIS_METHODS.find(m => m.key === methodKey);
                                return (
                                  <Tag key={methodKey} size="small" color="blue" style={{ fontSize: 11 }}>
                                    {method?.label}
                                  </Tag>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Space>
                </div>
              )}
            </Space>
          )}
        </Card>
      </div>

      {/* 右侧: 分析方法选择 */}
      <div style={rightPanelStyle(340)}>
        <Card 
          title={
            selectedRegionForConfig ? 
              <SectionTitle icon={<ExperimentOutlined />} title={`方法: ${selectedRegionForConfig.name}`} /> :
              <SectionTitle icon={<ExperimentOutlined />} title="选择分析方法" />
          }
          styles={{ body: { padding: '20px', overflow: 'auto', maxHeight: 'calc(100vh - 360px)' } }}
          style={{ ...cardStyle, height: '100%' }}
        >
          {!selectedImageForConfig ? (
            <Empty description="请先选择图片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : !selectedRegionForConfig ? (
            <Empty description="请点击下方已选区域来配置分析方法" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Text type="secondary" style={{ fontSize: 12 }}>选择区域后即可配置分析方法</Text>
            </Empty>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>点击选择或取消分析方法</Text>
                {selectedRegionForConfig && (
                  <Button size="small" onClick={toggleAllMethods}>
                    {(() => {
                      const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
                      const regionMethods = imageConfig[selectedRegionForConfig.regionId] || [];
                      const enabledMethods = ANALYSIS_METHODS.filter(m => !m.disabled);
                      const isAllSelected = enabledMethods.every(m => regionMethods.includes(m.key));
                      return isAllSelected ? '取消全选' : '全选方法';
                    })()}
                  </Button>
                )}
              </div>
              {ANALYSIS_METHODS.map(method => {
                const imageConfig = imageAnalysisConfig[selectedImageForConfig.id] || {};
                const regionMethods = imageConfig[selectedRegionForConfig.regionId] || [];
                const isSelected = regionMethods.includes(method.key);

                return (
                  <div
                    key={method.key}
                    onClick={() => !method.disabled && toggleMethodForRegion(selectedRegionForConfig.regionId, method.key)}
                    style={{
                      ...methodCardStyle,
                      opacity: method.disabled ? 0.5 : 1,
                      cursor: method.disabled ? 'not-allowed' : 'pointer',
                      borderColor: isSelected ? colors.primary : colors.neutralDark,
                      backgroundColor: isSelected ? colors.primaryLight : colors.white,
                    }}
                  >
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 10, 
                      background: method.color, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 18,
                    }}>
                      {method.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 14 }}>{method.label}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{method.description}</Text>
                      </div>
                    </div>
                    {isSelected && <CheckCircleOutlined style={{ color: colors.success, fontSize: 20 }} />}
                  </div>
                );
              })}
            </Space>
          )}

          {/* 已选区域列表 */}
          {selectedImageForConfig && (
            <div style={{ marginTop: 16, maxHeight: 200, overflow: 'auto', padding: '0 4px' }}>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>已选区域（点击切换）</Text>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {Object.keys(imageAnalysisConfig[selectedImageForConfig.id] || {}).map(regionId => {
                  const region = regions.find(r => r.regionId === regionId);
                  const methods = imageAnalysisConfig[selectedImageForConfig.id][regionId] || [];
                  const isActive = selectedRegionForConfig?.regionId === regionId;

                  return (
                    <div
                      key={regionId}
                      onClick={() => setSelectedRegionForConfig(region)}
                      style={{
                        ...activeRegionItemStyle,
                        borderColor: isActive ? colors.primary : colors.neutralDark,
                        backgroundColor: isActive ? colors.primaryLight : colors.white,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BorderOutlined style={{ color: isActive ? colors.primary : colors.textSecondary }} />
                        <Text style={{ fontSize: 13 }}>{region?.name}</Text>
                      </div>
                      <Tag size="small" color={methods.length > 0 ? 'success' : 'warning'} style={{ fontSize: 10 }}>
                        {methods.length}方法
                      </Tag>
                    </div>
                  );
                })}
              </Space>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  // ==================== 主渲染 ====================

  return (
    <div style={pageContainerStyle}>
      {/* 页面头部 */}
      <div style={pageHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/analysis')}
          >
            返回列表
          </Button>
          <Title level={3} style={{ margin: 0, fontWeight: 600, color: colors.textPrimary }}>
            创建新的分析项目
          </Title>
        </div>
      </div>

      {/* 流程步骤 */}
      <Card style={stepsCardStyle}>
        <Steps
          current={currentStep}
          direction="horizontal"
          size="small"
          items={stepTitles.map((title, index) => ({
            title: <span style={{ fontSize: 14, fontWeight: currentStep === index ? 600 : 400 }}>{title}</span>,
            description: <span style={{ fontSize: 12, color: '#888' }}>{stepDescriptions[index]}</span>,
            status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
          }))}
        />
      </Card>

      {/* 步骤内容区 */}
      <Card style={contentCardStyle} styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '24px' } }}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </Card>

      {/* 底部导航 */}
      <div style={footerStyle}>
        {currentStep > 0 && (
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handlePrev} 
            size="large"
            style={{ minWidth: 120, height: 44, borderRadius: 8 }}
          >
            上一步
          </Button>
        )}
        <Button 
          type="primary" 
          icon={currentStep === totalSteps - 1 ? <CheckCircleOutlined /> : <ArrowRightOutlined />} 
          onClick={handleNext} 
          loading={loading} 
          size="large" 
          style={{ minWidth: 160, height: 44, borderRadius: 8, backgroundColor: colors.primary }}
        >
          {currentStep === totalSteps - 1 ? '提交分析任务' : '下一步'}
        </Button>
      </div>

      {/* 区域重命名Modal */}
      <Modal
        open={showRenameModal}
        title="重命名区域"
        onOk={confirmRename}
        onCancel={cancelRename}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          value={newRegionName}
          onChange={(e) => setNewRegionName(e.target.value)}
          placeholder="请输入新的区域名称"
          onPressEnter={confirmRename}
          autoFocus
        />
      </Modal>
    </div>
  );
};

// ==================== 样式定义 ====================

const pageContainerStyle = {
  width: '100%',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#f8fafc',
};

const pageHeaderStyle = {
  padding: '20px 32px',
  background: '#fff',
  borderBottom: '1px solid #e2e8f0',
  flexShrink: 0,
};

const stepsCardStyle = {
  margin: '16px 24px',
  padding: '20px 32px',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  flexShrink: 0,
};

const contentCardStyle = {
  margin: '0 24px 16px 24px',
  flex: 1,
  minHeight: 0,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  overflow: 'visible',
  display: 'flex',
  flexDirection: 'column',
};

const footerStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: 16,
  padding: '16px 24px',
  flexShrink: 0,
};

const stepContainerStyle = {
  display: 'flex',
  gap: 20,
  height: '100%',
  padding: 4,
  overflow: 'visible',
};

const leftPanelStyle = (width) => ({
  width,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
});

const centerPanelStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const rightPanelStyle = (width) => ({
  width,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
});

const mainPanelStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const cardStyle = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  border: '1px solid #e8e8e8',
  transition: 'box-shadow 0.2s ease',
};

const SectionTitle = ({ icon, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ color: colors.primary, fontSize: 16 }}>{icon}</span>
    <span style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>{title}</span>
  </div>
);

const labelStyle = {
  display: 'block',
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 500,
  color: colors.textPrimary,
};

const summaryItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
};

const datasetItemStyle = {
  padding: '14px 16px',
  borderRadius: 10,
  cursor: 'pointer',
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
};

const templateCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px',
  borderRadius: 10,
  cursor: 'pointer',
  border: '2px solid',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
};

const infoRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const imagePreviewCardStyle = {
  borderRadius: 10,
  border: '1px solid',
  overflow: 'hidden',
  background: colors.white,
  transition: 'all 0.2s ease',
};

const imageStatusOverlayStyle = (completed) => ({
  position: 'absolute',
  top: 8,
  right: 8,
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: completed ? colors.success : colors.warning,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
});

const drawingHintStyle = {
  position: 'absolute',
  bottom: -40,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 20,
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const regionListItemStyle = {
  padding: '14px 16px',
  borderRadius: 10,
  cursor: 'pointer',
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'all 0.2s ease',
};

const imageConfigItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 10,
  cursor: 'pointer',
  border: '1px solid',
  transition: 'all 0.2s ease',
};

const regionTagStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 20,
  cursor: 'pointer',
  border: '1px solid',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all 0.2s ease',
};

const methodCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: 14,
  borderRadius: 10,
  border: '1px solid',
  transition: 'all 0.2s ease',
};

const activeRegionItemStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderRadius: 8,
  cursor: 'pointer',
  border: '1px solid',
  transition: 'all 0.2s ease',
};

// ==================== 工具函数 (参照 EdgeDetectionPage) ====================

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
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
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
  ctx.fillStyle = 'rgba(24,144,255,0.8)';
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

export default AnalysisCreatePage;

