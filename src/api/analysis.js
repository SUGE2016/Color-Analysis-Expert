import apiClient from './index';
import { getOwnerId } from '../utils/session';

/**
 * 分析项目 API
 */
export const analysisApi = {
  /**
   * 查询项目列表
   */
  getProjects: () => {
    return apiClient.get('/projects');
  },

  /**
   * 创建分析项目
   * @param {Object} data - 项目数据
   * @param {string} data.name - 项目名称
   * @param {string} data.ownerId - 所有者ID
   * @param {string} data.datasetId - 数据集ID
   * @param {string} data.templateId - 模板ID
   * @param {Object} data.config - 分析配置
   */
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

  /**
   * 查询项目详情
   * @param {string} projectId - 项目ID
   */
  getProjectDetail: (projectId) => {
    return apiClient.get(`/projects/${projectId}`);
  },

  /**
   * 查询项目任务列表
   * @param {string} projectId - 项目ID
   */
  getProjectTasks: (projectId) => {
    return apiClient.get(`/projects/${projectId}/tasks`);
  },

  /**
   * 更新项目
   * @param {string} projectId - 项目ID
   * @param {Object} data - 更新数据
   * @param {string} data.name - 项目名称
   * @param {string} data.description - 项目描述
   * @param {Object} data.config - 分析配置
   */
  updateProject: (projectId, data) => {
    const { name, description, config } = data;
    return apiClient.put(`/projects/${projectId}`, { name, description, config });
  },

  /**
   * 删除项目
   * @param {string} projectId - 项目ID
   */
  deleteProject: (projectId) => {
    return apiClient.delete(`/projects/${projectId}`);
  },

  /**
   * 启动项目分析
   * @param {string} projectId - 项目ID
   */
  startAnalysis: (projectId, data = {}) => {
    return apiClient.post(`/projects/${projectId}/run`, data);
  },

  /**
   * 停止项目分析
   * @param {string} projectId - 项目ID
   */
  stopAnalysis: (projectId) => {
    return apiClient.post(`/projects/${projectId}/stop`);
  },

  /**
   * 查询分析进度
   * @param {string} projectId - 项目ID
   */
  getAnalysisProgress: (projectId) => {
    return apiClient.get(`/projects/${projectId}/tasks`);
  }
};

export default analysisApi;
