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
   * @param {number|string} imageId - 图片ID
   * @returns {Promise} 单图报告数据
   */
  getImageReport: (projectId, imageName) => {
    return apiClient.get(`/reports/projects/${projectId}/images/${imageName}`);
  },

  /**
   * 导出项目报告
   * @param {number|string} projectId - 项目ID
   * @param {string} format - 导出格式 (pdf, excel, csv)
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
