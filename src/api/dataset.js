import apiClient, { uploadClient } from './index';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

export const datasetApi = {
  getDatasets: (params = {}) => apiClient.get('/datasets', { params }),

  createDataset: (data) => apiClient.post('/datasets', data),

  getDatasetDetail: (datasetId) => apiClient.get(`/datasets/${datasetId}`),

  getDatasetImages: (datasetId) => apiClient.get(`/datasets/${datasetId}/images`),

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

  imageFileUrl: (datasetId, imageId) =>
    `${API_BASE}/datasets/${datasetId}/images/${imageId}/file`,
};

export default datasetApi;
