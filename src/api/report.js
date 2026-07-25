import apiClient from './index';

/**
 * 报告管理 API
 */
export const reportApi = {
  /**
   * 查询项目汇总报告
   * @param {number|string} projectId - 项目ID
   * @returns {Promise} 项目汇总报告数据
   */
  getProjectSummaryReport: (projectId) => {
    return apiClient.get(`/reports/projects/${projectId}/summary`);
  },

  /**
   * 查询单图报告
   * @param {number|string} projectId - 项目ID
   * @param {string} imageId - 图片稳定 ID（旧任务可兼容唯一图片名）
   * @returns {Promise} 单图报告数据
   */
  getImageReport: (projectId, imageId) => {
    return apiClient.get(`/reports/projects/${projectId}/images/${encodeURIComponent(imageId)}`);
  },

  getImageFile: (projectId, imageId, variant = 'corrected', options = {}) => {
    return apiClient.get(`/reports/projects/${projectId}/images/${encodeURIComponent(imageId)}/file`, {
      params: { variant },
      responseType: 'blob',
      signal: options.signal,
      skipErrorToast: true,
    });
  },

  exportImageReport: (projectId, imageId) => {
    return apiClient.get(`/reports/projects/${projectId}/images/${encodeURIComponent(imageId)}/export`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });
  },

  /**
   * 导出项目报告
   * @param {number|string} projectId - 项目ID
   * @param {string} format - 导出格式 (pdf, xlsx, csv)
   * @returns {Promise} 导出的报告文件
   */
  exportProjectReport: (projectId, format = 'pdf') => {
    return apiClient.get(`/reports/projects/${projectId}/export`, {
      params: { format },
      responseType: 'blob'
    });
  }
};

export default reportApi;
