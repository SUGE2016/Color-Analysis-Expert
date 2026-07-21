export const ANALYSIS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const BACKEND_STATUS_MAP = {
  created: ANALYSIS_STATUS.NOT_STARTED,
  running: ANALYSIS_STATUS.IN_PROGRESS,
  completed: ANALYSIS_STATUS.COMPLETED,
  failed: ANALYSIS_STATUS.FAILED,
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

export function mapBackendProject(project, datasetNameMap = {}) {
  const status = BACKEND_STATUS_MAP[project.status] || ANALYSIS_STATUS.NOT_STARTED;
  const config = parseConfig(project.config);
  const progress =
    status === ANALYSIS_STATUS.COMPLETED ? 100
      : status === ANALYSIS_STATUS.IN_PROGRESS ? 50
        : status === ANALYSIS_STATUS.FAILED ? 0
          : 0;

  return {
    id: project.id,
    name: project.name || '未命名项目',
    targetCount: config.targetCount ?? 0,
    createTime: project.createdAt || '—',
    updateTime: project.updatedAt || project.createdAt || '—',
    year: new Date().getFullYear(),
    status,
    progress,
    datasetName: datasetNameMap[project.datasetId] || project.datasetId || '—',
    datasetCount: 1,
    creator: project.ownerId || '—',
    description: config.description || '',
    raw: project,
  };
}

export function mapBackendTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    description: '',
    uploadBy: '—',
    hasImage: Boolean(template.templateImageKey),
    imageAvailable: Boolean(template.templateImageKey),
    templateImageKey: template.templateImageKey,
    regionsJson: template.regionsJson,
    createdAt: template.createdAt,
    raw: template,
  };
}

export function mapCannyRegions(apiRegions = []) {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#fa541c'];
  return apiRegions.map((r, idx) => ({
    regionId: r.region_id || r.regionId || `r${idx}`,
    name: r.name || `区域 ${idx + 1}`,
    polygon: (r.points || []).map((p) => ({ x: p.x, y: p.y })),
    color: colors[idx % colors.length],
  }));
}
