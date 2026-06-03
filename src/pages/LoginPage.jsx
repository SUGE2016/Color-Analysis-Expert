import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  UserOutlined,
  LockOutlined,
  LoginOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth';
import {
  saveSession,
  clearSession,
  getAuthToken,
  SESSION_DURATION,
  scheduleAutoLogout,
} from '../utils/session';
import AuthBrand from '../components/auth/AuthBrand';
import AuthFooter from '../components/auth/AuthFooter';
import styles from '../styles/auth-page.module.css';

const { Title } = Typography;

const SESSION_KEY = 'user_session';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session && getAuthToken()) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.expiresAt > Date.now()) {
          navigate('/dataset');
          return;
        }
        clearSession();
        message.warning('会话已过期，请重新登录');
      } catch {
        clearSession();
      }
    }
  }, [navigate]);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await authApi.login({
        username: values.username,
        password: values.password
      });

      let userId = response.userId;
      let username = response.username || values.username;
      saveSession({
        token: response.token,
        userId,
        username,
        loginTime: new Date().toISOString(),
        expiresAt: Date.now() + SESSION_DURATION,
      });
      if (!userId && response.token) {
        try {
          const me = await authApi.me();
          userId = me.userId;
          username = me.username || username;
          saveSession({ userId, username });
        } catch {
          /* 旧版仅返回 token */
        }
      }

      scheduleAutoLogout(() => {
        clearSession();
        message.warning('登录已超时，请重新登录');
        navigate('/login', { replace: true });
      });

      message.success('登录成功，欢迎回来！');
      const from = location.state?.from;
      navigate(from && !from.startsWith('/login') ? from : '/dataset', { replace: true });
    } catch (error) {
      clearSession();
      const status = error?.response?.status;
      if (status === 401) {
        message.error('用户名或密码错误。默认账号：admin，密码：admin123');
      } else if (!error?.response) {
        message.error('无法连接后端，请确认 color-api 已启动（http://localhost:8080）');
      }
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.blobTop} aria-hidden />
      <div className={styles.blobBottom} aria-hidden />

      <Card className={styles.card}>
        <div className={styles.layout}>
          <AuthBrand />

          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <Title level={4} style={{ margin: 0 }}>
                <LoginOutlined style={{ marginRight: 8, color: '#667eea' }} />
                欢迎登录
              </Title>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              className={styles.form}
              initialValues={{ username: 'admin', password: 'admin123' }}
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入账号' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="账号（默认 admin）"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input
                  prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                  type={passwordVisible ? 'text' : 'password'}
                  placeholder="密码（默认 admin123）"
                  size="large"
                  suffix={
                    <span
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      style={{ cursor: 'pointer', color: '#999' }}
                    >
                      {passwordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </span>
                  }
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  block
                  className={styles.primaryBtn}
                >
                  登 录
                </Button>
              </Form.Item>
            </Form>

            <AuthFooter />
          </section>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
