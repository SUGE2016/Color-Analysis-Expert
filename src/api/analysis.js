import apiClient from './index';
import { getOwnerId } from '../utils/session';

const DEFAULT_RUN_OPTIONS = {
  steps: ['correction', 'hsv', 'entropy', 'main_color', 'main_color_number'],
  modelImagePath: '/app/storage/test-assets/model_image.jpg',
  butterflyJsonPath: '/app/storage/test-assets/butterfly.json',
  edgeJsonPath: '/app/storage/test-assets/edge.json',
};

/**
 * 分析项目 API
 */
export const analysisApi = {
  getProjects: () => apiClient.get('/projects'),

  createProject: (data) => {
    const { name, ownerId, datasetId, datasetIds, templateId, config } = data;
    const normalizedDatasetId = datasetId || datasetIds?.[0];
    return apiClient.post('/projects', {
      name,
      ownerId: ownerId || getOwnerId(),
      datasetId: normalizedDatasetId,
      templateId,
      config: {
        ...(config || {}),
        datasetIds: datasetIds || (normalizedDatasetId ? [normalizedDatasetId] : []),
      },
    });
  },

  getProjectDetail: (projectId) => apiClient.get(`/projects/${projectId}`),

  getProjectTasks: (projectId) => apiClient.get(`/projects/${projectId}/tasks`),

  updateProject: (projectId, data) => {
    const { name, description, config } = data;
    return apiClient.put(`/projects/${projectId}`, { name, description, config });
  },

  deleteProject: (projectId) => apiClient.delete(`/projects/${projectId}`),

  startAnalysis: (projectId, options = {}) => {
    const body = {
      ...DEFAULT_RUN_OPTIONS,
      ...options,
      notes: options.notes || 'started from frontend',
    };
    return apiClient.post(`/projects/${projectId}/run`, body, { timeout: 300000 });
  },

  stopAnalysis: (projectId) => apiClient.post(`/projects/${projectId}/stop`),

  getAnalysisProgress: (projectId) => apiClient.get(`/projects/${projectId}/tasks`),
};

export default analysisApi;
