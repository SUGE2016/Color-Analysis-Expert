export const ANALYSIS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const BACKEND_STATUS_MAP = {
  created: ANALYSIS_STATUS.NOT_STARTED,
  draft: ANALYSIS_STATUS.NOT_STARTED,
  queued: ANALYSIS_STATUS.IN_PROGRESS,
  running: ANALYSIS_STATUS.IN_PROGRESS,
  completed: ANALYSIS_STATUS.COMPLETED,
  failed: ANALYSIS_STATUS.FAILED,
  cancelled: ANALYSIS_STATUS.FAILED,
};

function parseConfig(config) {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

export function mapBackendProject(project, datasetNameMap = {}, latestTask = null) {
  const status = BACKEND_STATUS_MAP[project.status] || ANALYSIS_STATUS.NOT_STARTED;
  const config = parseConfig(project.config);
  const datasetIds = (project.datasetIds || [project.datasetId]).filter(Boolean);
  const progress = latestTask?.progress ?? (
    status === ANALYSIS_STATUS.COMPLETED ? 100
      : status === ANALYSIS_STATUS.IN_PROGRESS ? 0
        : 0
  );

  return {
    id: project.id,
    name: project.name || '未命名项目',
    targetCount: config.targetCount ?? 0,
    createTime: project.createdAt || '—',
    updateTime: project.updatedAt || project.createdAt || '—',
    year: project.createdAt ? new Date(project.createdAt).getFullYear() : new Date().getFullYear(),
    status,
    backendStatus: project.status,
    progress,
    datasetName: datasetIds.map((id) => datasetNameMap[id] || id).join('、') || '—',
    datasetCount: datasetIds.length,
    creator: project.ownerId || '当前用户',
    description: config.description || '',
    raw: project,
    latestTask,
  };
}

export function mapBackendTemplate(template) {
  const imageAvailable = Boolean(template.imageAvailable);
  return {
    id: template.id,
    name: template.name,
    description: '',
    uploadBy: '—',
    hasImage: imageAvailable,
    imageAvailable,
    templateImageKey: template.templateImageKey,
    regionsJson: template.regionsJson,
    createdAt: template.createdAt,
    raw: template,
  };
}

export function mapCannyRegions(apiRegions = []) {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#fa541c'];
  return apiRegions.map((region, index) => ({
    regionId: region.region_id || region.regionId || `r${index}`,
    name: region.name || `区域 ${index + 1}`,
    polygon: (region.points || []).map((point) => ({ x: point.x, y: point.y })),
    color: colors[index % colors.length],
  }));
}
