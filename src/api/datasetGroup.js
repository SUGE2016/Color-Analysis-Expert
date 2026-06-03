import apiClient from './index';

export const datasetGroupApi = {
  listGroups: (params = {}) => apiClient.get('/dataset-groups', { params }),

  getGroup: (groupId) => apiClient.get(`/dataset-groups/${groupId}`),

  createGroup: (data) => {
    const { name, description, academicYear } = data;
    return apiClient.post('/dataset-groups', { name, description, academicYear });
  },

  updateGroup: (groupId, data) => {
    const { name, description, academicYear } = data;
    return apiClient.put(`/dataset-groups/${groupId}`, { name, description, academicYear });
  },

  deleteGroup: (groupId) => apiClient.delete(`/dataset-groups/${groupId}`),
};

export default datasetGroupApi;
