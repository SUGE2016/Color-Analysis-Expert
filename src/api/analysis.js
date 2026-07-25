import apiClient from './index';

/**
 * 分析项目 API
 */
export const analysisApi = {
  getProjects: () => apiClient.get('/projects'),

  createProject: (data) => {
    const { name, datasetId, datasetIds, templateId, config } = data;
    const normalizedDatasetIds = datasetIds || (datasetId ? [datasetId] : []);
    return apiClient.post('/projects', {
      name,
      datasetIds: normalizedDatasetIds,
      templateId,
      config: config || {},
    }, { skipErrorToast: true });
  },

  getProjectDetail: (projectId) => apiClient.get(`/projects/${projectId}`),

  getProjectTasks: (projectId) => apiClient.get(`/projects/${projectId}/tasks`),

  updateProject: (projectId, data) => {
    const { name, datasetIds, templateId, config } = data;
    return apiClient.put(`/projects/${projectId}`, { name, datasetIds, templateId, config });
  },

  deleteProject: (projectId) => apiClient.delete(`/projects/${projectId}`),

  startAnalysis: (projectId) => apiClient.post(`/projects/${projectId}/run`, {}),

  correctImage: (projectId, imageId) => apiClient.post(
    `/projects/${projectId}/corrections/${imageId}`,
    {},
    { responseType: 'blob' }
  ),

  getCorrections: (projectId) => apiClient.get(`/projects/${projectId}/corrections`),

  getCorrectedImage: (projectId, imageId) => apiClient.get(
    `/projects/${projectId}/corrections/${imageId}/file`,
    { responseType: 'blob' }
  ),

  stopAnalysis: (projectId) => apiClient.post(`/projects/${projectId}/stop`),

  getAnalysisProgress: (projectId) => apiClient.get(`/projects/${projectId}/tasks`),

  getTask: (taskId) => apiClient.get(`/tasks/${taskId}`),
};

export default analysisApi;
