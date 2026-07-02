import apiClient from './index';

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @param {string} credentials.username - 用户名
   * @param {string} credentials.password - 密码
   */
  login: (credentials) => {
    const { username, password } = credentials;
    return apiClient.post('/auth/login', { username, password }, { skipAuth: true });
  },

  /**
   * 用户注册
   * @param {Object} data - 注册信息
   * @param {string} data.username - 用户名
   * @param {string} data.password - 密码
   */
  register: (data) => {
    const { username, password } = data;
    return apiClient.post('/auth/register', { username, password }, { skipAuth: true });
  },

  me: () => apiClient.get('/auth/me'),

  changePassword: (data) => {
    const { oldPassword, newPassword } = data;
    return apiClient.post('/auth/change-password', { oldPassword, newPassword });
  },
};

export default authApi;
