import apiClient, { API_BASE_URL, uploadClient } from './index';

export const datasetApi = {
  getDatasets: (params = {}) => apiClient.get('/datasets', { params }),

  createDataset: (data) => apiClient.post('/datasets', data),

  getDatasetDetail: (datasetId) => apiClient.get(`/datasets/${datasetId}`),

  getDatasetImages: (datasetId) => apiClient.get(`/datasets/${datasetId}/images`),

  getDatasetImageFile: (datasetId, imageId) =>
    apiClient.get(`/datasets/${datasetId}/images/${imageId}/file`, { responseType: 'blob' }),

  uploadDatasetImage: (datasetId, file, extra = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (extra.subjectCode) formData.append('subjectCode', extra.subjectCode);
    if (extra.label) formData.append('label', extra.label);
    return uploadClient.post(`/datasets/${datasetId}/images/upload`, formData);
  },

  updateDataset: (datasetId, data) => apiClient.put(`/datasets/${datasetId}`, data),

  deleteDataset: (datasetId) => apiClient.delete(`/datasets/${datasetId}`),

  deleteDatasetImage: (datasetId, imageId) =>
    apiClient.delete(`/datasets/${datasetId}/images/${imageId}`),

  updateImageMeta: (datasetId, imageId, data) =>
    apiClient.put(`/datasets/${datasetId}/images/${imageId}`, data),

  recalculateFileCount: (datasetId) => apiClient.post(`/datasets/${datasetId}/recalculate-count`),

  recalculateAllFileCounts: () => apiClient.post('/datasets/recalculate-all-counts'),

  imageFileUrl: (datasetId, imageId) =>
    `${(API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')}/datasets/${datasetId}/images/${imageId}/file`,
};

export default datasetApi;
