import apiClient, { API_BASE_URL, uploadClient } from './index';

/**
 * 模板管理 API
 */
export const templateApi = {
  /**
   * 获取模板列表
   * @param {Object} params - 查询参数
   * @param {string} params.keyword - 搜索关键词
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   */
  getTemplates: (params = {}) => {
    return apiClient.get('/templates', { params });
  },

  /**
   * 获取模板详情
   * @param {number|string} id - 模板ID
   */
  getTemplateDetail: (id) => {
    return apiClient.get(`/templates/${id}`);
  },

  /**
   * 创建模板 (multipart: name, imageFile?, regionsJson?)
   * @param {Object} options
   * @param {string} options.name - 模板名称
   * @param {File} [options.imageFile] - 模板图片
   * @param {string} [options.regionsJson] - 区域定义 JSON
   */
  createTemplate: ({ name, imageFile, regionsJson }) => {
    const fd = new FormData();
    fd.append('name', name);
    if (regionsJson) fd.append('regionsJson', regionsJson);
    if (imageFile) fd.append('imageFile', imageFile);
    return uploadClient.post('/templates', fd);
  },

  /**
   * 更新模板 (multipart: name?, imageFile?, regionsJson?)
   * @param {number|string} id - 模板ID
   * @param {Object} options
   * @param {string} [options.name] - 模板名称
   * @param {File} [options.imageFile] - 模板图片
   * @param {string} [options.regionsJson] - 区域定义 JSON
   */
  updateTemplate: (id, { name, imageFile, regionsJson } = {}) => {
    const fd = new FormData();
    if (name) fd.append('name', name);
    if (regionsJson) fd.append('regionsJson', regionsJson);
    if (imageFile) fd.append('imageFile', imageFile);
    return uploadClient.put(`/templates/${id}`, fd);
  },

  /**
   * 删除模板
   * @param {number|string} id - 模板ID
   */
  deleteTemplate: (id) => {
    return apiClient.delete(`/templates/${id}`);
  },

  /**
   * 上传模板图片
   * @param {number|string} id - 模板ID
   * @param {FormData} formData - 包含 imageFile 的 FormData
   */
  uploadTemplateImage: (id, formData) => {
    return uploadClient.post(`/templates/${id}/image`, formData);
  },

  /**
   * 获取模板图片
   * @param {number|string} id - 模板ID
   */
  getTemplateImage: (id) => {
    return apiClient.get(`/templates/${id}/image`, { responseType: 'blob' });
  },

  getTemplateImageUrl: (id) => {
    return `${(API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')}/templates/${id}/image`;
  }
};

export default templateApi;
