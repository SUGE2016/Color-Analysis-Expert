import { uploadClient } from './index';

/**
 * 图像处理工具 API
 */
export const toolApi = {
  /**
   * Canny边缘检测
   * @param {FormData} formData - 包含图片文件的FormData
   * @param {Object} config - 检测配置参数
   * @param {number} config.threshold1 - 低阈值
   * @param {number} config.threshold2 - 高阈值
   * @returns {Promise} 边缘检测结果
   */
  cannyEdgeDetection: (formData, config = {}) => {
    if (Object.keys(config).length > 0 && !formData.has('config')) {
      formData.append('config', JSON.stringify(config));
    }

    return uploadClient.post('/images/canny', formData);
  },

  /**
   * 图像校正 - 根据模板自动校正
   * @param {FormData} formData - 包含模板文件(model)和目标图片(image)的FormData
   * @returns {Promise} 校正后的图片
   */
  alignImage: (formData) => {
    return uploadClient.post('/images/correction/align', formData, { responseType: 'blob' });
  },

  getRegionAtPoint: (imageId, x, y) => {
    return uploadClient.get(`/images/${imageId}/region/at-point`, {
      params: { x, y }
    });
  },

  getRegions: (imageId) => {
    return uploadClient.get(`/images/${imageId}/regions`);
  },

  deleteRegions: (imageId) => {
    return uploadClient.delete(`/images/${imageId}/regions`);
  },

  /**
   * 多边形合并
   * @param {Array} polygons - 多边形数组，每个多边形是 [{x, y}, ...] 格式
   * @returns {Promise} 合并后的多边形
   */
  mergePolygons: (polygons) => {
    return uploadClient.post('/images/polygon/merge', { polygons });
  }
};

export default toolApi;
