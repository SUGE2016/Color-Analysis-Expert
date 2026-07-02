import apiClient, { API_BASE_URL, uploadClient } from './index';

/**
 * 模板管理 API
 */
export const templateApi = {
  getTemplates: (params = {}) => apiClient.get('/templates', { params }),

  getTemplateDetail: (id) => apiClient.get(`/templates/${id}`),

  createTemplate: ({ name, imageFile, regionsJson }) => {
    const fd = new FormData();
    fd.append('name', name);
    if (regionsJson) fd.append('regionsJson', regionsJson);
    if (imageFile) fd.append('imageFile', imageFile);
    return uploadClient.post('/templates', fd);
  },

  updateTemplate: (id, { name, imageFile, regionsJson } = {}) => {
    const fd = new FormData();
    if (name) fd.append('name', name);
    if (regionsJson) fd.append('regionsJson', regionsJson);
    if (imageFile) fd.append('imageFile', imageFile);
    return uploadClient.put(`/templates/${id}`, fd);
  },

  deleteTemplate: (id) => apiClient.delete(`/templates/${id}`),

  uploadTemplateImage: (id, formData) => uploadClient.post(`/templates/${id}/image`, formData),

  getTemplateImage: (id) => apiClient.get(`/templates/${id}/image`, { responseType: 'blob' }),

  getTemplateImageUrl: (id) =>
    `${(API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')}/templates/${id}/image`,
};

export default templateApi;
