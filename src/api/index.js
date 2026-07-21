import axios from 'axios';
import { message } from 'antd';
import {
  clearSession,
  getAuthToken,
  handleUnauthorized,
} from '../utils/session';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

let lastToastMsg = '';
let lastToastAt = 0;
function toastErrorOnce(msg) {
  const now = Date.now();
  if (msg === lastToastMsg && now - lastToastAt < 2500) return;
  lastToastMsg = msg;
  lastToastAt = now;
  message.error(msg);
}

function attachAuthInterceptors(client, { withUploadError = false } = {}) {
  client.interceptors.request.use(
    (config) => {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
      console.log('Request data type:', config.data?.constructor?.name);
      console.log('Request headers before:', config.headers);

      if (config.skipAuth) return config;

      const token = getAuthToken();
      if (!token) {
        console.log('No auth token found, user may not be logged in');
        handleUnauthorized('登录已过期，请重新登录');
        return Promise.reject(new axios.Cancel('AUTH_EXPIRED'));
      }

      config.headers.Authorization = `Bearer ${token}`;
      console.log('Authorization header set:', config.headers.Authorization.substring(0, 30) + '...');

      // Remove Content-Type for FormData to let Axios set multipart/form-data with boundary
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
        console.log('Removed Content-Type for FormData request');
      }

      console.log('Request headers after:', config.headers);
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => {
      if (response.data && typeof response.data.code !== 'undefined') {
        if (response.data.code !== 200 && response.data.code !== 0) {
          toastErrorOnce(response.data.message || '请求失败');
          return Promise.reject(response.data);
        }
        return response.data.data;
      }
      return response.data;
    },
    (error) => {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      const { response } = error;

      if (response) {
        if (error.config?.skipErrorToast) {
          return Promise.reject(error);
        }
        switch (response.status) {
          case 400:
            toastErrorOnce(response.data?.message || response.data || '请求参数错误');
            break;
          case 401:
            if (!error.config?.skipAuth) {
              handleUnauthorized('登录已过期，请重新登录');
            }
            break;
          case 403:
            if (!getAuthToken()) {
              handleUnauthorized('请先登录');
            } else {
              toastErrorOnce('没有权限执行此操作');
            }
            break;
          case 404:
            toastErrorOnce('请求的资源不存在');
            break;
          case 409:
            // Don't show toast for 409 - let the caller handle it
            break;
          case 500:
            toastErrorOnce('服务器内部错误');
            break;
          default:
            toastErrorOnce(`请求失败: ${response.status}`);
        }
      } else if (!error.config?.skipErrorToast) {
        if (withUploadError) {
          message.error('文件上传失败');
        } else {
          toastErrorOnce('网络连接失败，请确认后端已启动（默认 http://localhost:8080）');
        }
      }

      return Promise.reject(error);
    }
  );
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

attachAuthInterceptors(apiClient);

const uploadClient = axios.create({
  baseURL: process.env.REACT_APP_UPLOAD_BASE_URL || API_BASE_URL,
  timeout: 120000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

attachAuthInterceptors(uploadClient, { withUploadError: true });

export { apiClient, uploadClient, clearSession, API_BASE_URL };
export default apiClient;
