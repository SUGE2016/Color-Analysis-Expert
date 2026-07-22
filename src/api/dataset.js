import apiClient, { API_BASE_URL } from './index';
import { resolveUploadFileName } from '../utils/uploadFileName';

export const datasetApi = {
  getDatasets: (params = {}) => apiClient.get('/datasets', { params }),

  createDataset: (data) => apiClient.post('/datasets', data),

  getDatasetDetail: (datasetId) => apiClient.get(`/datasets/${datasetId}`),

  getDatasetImages: (datasetId) => apiClient.get(`/datasets/${datasetId}/images`),

  getDatasetImageFile: (datasetId, imageId) =>
    apiClient.get(`/datasets/${datasetId}/images/${imageId}/file`, { responseType: 'blob' }),

  uploadDatasetImage: (datasetId, file, extra = {}) => {
    const formData = new FormData();
    // File extends Blob in browsers, so preserve File.name before using a fallback.
    if (file instanceof Blob) {
      const fileName = resolveUploadFileName(file, extra.fileName);
      formData.append('file', file, fileName);
    } else {
      formData.append('file', file);
    }
    if (extra.subjectCode) formData.append('subjectCode', extra.subjectCode);
    if (extra.label) formData.append('label', extra.label);
    if (extra.overwrite !== undefined) formData.append('overwrite', extra.overwrite);
    // Use apiClient instead of uploadClient to ensure auth headers are properly set
    // Interceptor will remove Content-Type for FormData to let Axios set multipart/form-data with boundary
    return apiClient.post(`/datasets/${datasetId}/images/upload`, formData);
  },

  updateDataset: (datasetId, data) => apiClient.put(`/datasets/${datasetId}`, data),

  deleteDataset: (datasetId) => apiClient.delete(`/datasets/${datasetId}`),

  forceDeleteDataset: (datasetId) => apiClient.delete(`/datasets/${datasetId}/force`),

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
