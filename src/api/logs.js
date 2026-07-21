import apiClient from './index';

export const logsApi = {
  getBackendLogs: (lines = 300) => apiClient.get('/logs/backend', { params: { lines } }),
};

export default logsApi;
