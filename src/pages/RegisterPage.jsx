import React, { useState } from 'react';
import { Form, Input, Button, message, Card, Typography, Space } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import styles from '../styles/auth-page.module.css';

const { Title, Text, Paragraph } = Typography;

const RegisterPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [form] = Form.useForm();

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        password: values.password
      });

      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error) {
      console.error('注册失败:', error);
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
          <aside className={styles.brand}>
            <div className={styles.logo}>
              <SafetyCertificateOutlined className={styles.logoIcon} />
            </div>

            <Title level={3} className={styles.brandTitle}>
              涂色图像分析工具
            </Title>

            <Paragraph className={styles.brandDesc}>
              专业的涂色图像分析工具
              <br />
              助力儿童涂色评估与教学
            </Paragraph>

            <div className={styles.divider} />

            <Space direction="vertical" size={16} className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.featureDot} />
                <Text className={styles.featureText}>智能图像分析</Text>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureDot} />
                <Text className={styles.featureText}>可视化数据报告</Text>
              </div>
            </Space>
          </aside>

          <section className={styles.formPanel}>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/login')}
              className={styles.backBtn}
            >
              返回登录
            </Button>

            <div className={styles.formHeader}>
              <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                <UserAddOutlined style={{ marginRight: 8, color: '#667eea' }} />
                用户注册
              </Title>
              <Text type="secondary">创建新账号以开始使用</Text>
            </div>

            <Form
              form={form}
              name="register"
              onFinish={handleRegister}
              autoComplete="off"
              className={styles.form}
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入账号' },
                  { min: 3, message: '账号长度至少3位' },
                  { max: 20, message: '账号长度最多20位' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="请输入账号"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码长度至少6位' }
                ]}
              >
                <Input
                  prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                  type={passwordVisible ? 'text' : 'password'}
                  placeholder="请输入密码"
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

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    }
                  })
                ]}
              >
                <Input
                  prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  placeholder="请确认密码"
                  size="large"
                  suffix={
                    <span
                      onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                      style={{ cursor: 'pointer', color: '#999' }}
                    >
                      {confirmPasswordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </span>
                  }
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  block
                  className={styles.primaryBtn}
                >
                  注 册
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  已有账号？
                  <Button
                    type="link"
                    onClick={() => navigate('/login')}
                    style={{ padding: '0 4px', fontSize: 13 }}
                  >
                    立即登录
                  </Button>
                </Text>
              </div>
            </Form>

            <div className={styles.footer}>
              <Text type="secondary" className={styles.footerText}>
                © 2026 涂色图像分析工具
              </Text>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
