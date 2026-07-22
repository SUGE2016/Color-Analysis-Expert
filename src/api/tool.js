import { uploadClient } from './index';

/**
 * 图像处理工具 API
 */
export const toolApi = {
  cannyEdgeDetection: (formData, config = {}) => {
    if (Object.keys(config).length > 0 && !formData.has('config')) {
      formData.append('config', JSON.stringify(config));
    }
    return uploadClient.post('/images/canny', formData);
  },

  alignImage: (formData) => {
    return uploadClient.post('/images/correction/align', formData, {
      responseType: 'blob',
    });
  },

  getRegionAtPoint: (imageId, x, y) => {
    return uploadClient.get(`/images/${imageId}/region/at-point`, {
      params: { x, y },
    });
  },

  getRegions: (imageId) => {
    return uploadClient.get(`/images/${imageId}/regions`);
  },

  deleteRegions: (imageId) => {
    return uploadClient.delete(`/images/${imageId}/regions`);
  },

  mergePolygons: (polygons) => {
    return uploadClient.post('/images/polygon/merge', { polygons });
  },
};

export default toolApi;
