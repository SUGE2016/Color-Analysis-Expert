import React, { useState } from "react";
import { Dropdown, Modal, Form, Input, Button, message, Avatar, Upload } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  EditOutlined,
  LockOutlined,
  CameraOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  MenuOutlined,
  CloseOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { colors, styles } from "../common/constants";
import AppLogo from "../common/AppLogo";
import { APP_NAME } from "../../buildInfo";
import topbar from "../../styles/topbar.module.css";

// 会话管理常量（与LoginPage保持一致）
import { clearLogoutTimer, clearSession } from '../../utils/session';

const Topbar = ({
  title = APP_NAME,
  username = "管理员",
  avatarText = "A",
  showMenuButton = false,
  onMenuClick,
  menuExpanded = false,
}) => {
  const navigate = useNavigate();
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [avatarUrl, setAvatarUrl] = useState(null);

  // 处理退出登录
  const handleLogout = () => {
    clearLogoutTimer();
    clearSession();
    message.success('已安全退出登录');
    navigate('/login', { replace: true });
  };

  // 处理修改个人信息
  const handleUpdateProfile = (values) => {
    console.log('更新个人信息:', values);
    message.success('个人信息修改成功');
    setIsProfileModalVisible(false);
  };

  // 处理修改密码
  const handleChangePassword = (values) => {
    const { oldPassword, newPassword } = values;
    console.log('修改密码:', { oldPassword, newPassword });
    
    // TODO: 调用API验证旧密码并更新新密码
    // 这里模拟旧密码验证失败的情况
    if (oldPassword !== '123456') {
      message.error('旧密码验证失败，请重新输入');
      return;
    }
    
    message.success('密码修改成功，请使用新密码重新登录');
    passwordForm.resetFields();
    setIsPasswordModalVisible(false);
    
    // 可选：修改密码后退出登录并 clearSession()
  };

  // 头像上传前检查
  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('只支持上传 JPG/PNG 格式的图片!');
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  // 处理头像上传
  const handleAvatarChange = (info) => {
    if (info.file.status === 'done') {
      message.success('头像上传成功');
    }
  };

  // 自定义上传（本地预览）
  const customRequest = ({ file, onSuccess }) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setAvatarUrl(reader.result);
      onSuccess && onSuccess();
    };
  };

  // 下拉菜单项
  const dropdownItems = [
    {
      key: 'profile',
      icon: <EditOutlined />,
      label: '个人设置',
      onClick: () => {
        setIsProfileModalVisible(true);
        profileForm.setFieldsValue({
          nickname: username,
          email: 'admin@example.com',
          phone: '13800138000'
        });
      }
    },
    {
      key: 'password',
      icon: <LockOutlined />,
      label: '修改密码',
      onClick: () => setIsPasswordModalVisible(true)
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => setIsLogoutModalVisible(true)
    }
  ];

  return (
    <>
      <div className={topbar.topbar} style={{ background: colors.primary }}>
        <div className={topbar.brandRow}>
          {showMenuButton && (
            <button
              type="button"
              className={topbar.menuBtn}
              aria-label={menuExpanded ? "关闭导航菜单" : "打开导航菜单"}
              aria-expanded={menuExpanded}
              onClick={onMenuClick}
            >
              {menuExpanded ? <CloseOutlined style={{ fontSize: 16 }} /> : <MenuOutlined style={{ fontSize: 16 }} />}
            </button>
          )}
          <div className={topbar.logoBox}>
            <AppLogo />
          </div>
          <h1 className={topbar.title}>{title}</h1>
        </div>

        <Dropdown
          menu={{ items: dropdownItems }}
          placement="bottomRight"
          arrow
          trigger={['click']}
        >
          <div className={topbar.userSection} role="button" tabIndex={0}>
            <div className={topbar.avatar}>{avatarText}</div>
            <span className={topbar.userName}>{username}</span>
          </div>
        </Dropdown>
      </div>

      {/* 修改个人信息弹窗 */}
      <Modal
        title={
          <span>
            <EditOutlined style={{ marginRight: 8, color: colors.primary }} />
            修改个人信息
          </span>
        }
        open={isProfileModalVisible}
        onCancel={() => setIsProfileModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          {/* 头像上传区域 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Upload
              name="avatar"
              showUploadList={false}
              beforeUpload={beforeUpload}
              customRequest={customRequest}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png"
            >
              <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                <Avatar
                  size={80}
                  src={avatarUrl}
                  style={{ backgroundColor: colors.primary }}
                >
                  {avatarText}
                </Avatar>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: colors.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    border: `1px solid ${colors.neutralDark}`
                  }}
                >
                  <CameraOutlined style={{ fontSize: 14, color: colors.textSecondary }} />
                </div>
              </div>
            </Upload>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
              点击更换头像 (JPG/PNG, 最大2MB)
            </div>
          </div>

          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
            ]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setIsProfileModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: colors.primary }}>
                保存修改
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title={
          <span>
            <LockOutlined style={{ marginRight: 8, color: colors.primary }} />
            修改密码
          </span>
        }
        open={isPasswordModalVisible}
        onCancel={() => {
          setIsPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          autoComplete="off"
        >
          <Form.Item
            name="oldPassword"
            label="旧密码"
            rules={[
              { required: true, message: '请输入旧密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入旧密码"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' },
              {
                pattern: /^(?=.*[a-zA-Z])(?=.*\d).+$/,
                message: '密码必须包含字母和数字'
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <div style={{ 
            backgroundColor: colors.neutral, 
            padding: '12px 16px', 
            borderRadius: styles.borderRadius.md,
            marginBottom: 16 
          }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: '1.6' }}>
              <div>密码要求：</div>
              <div>• 长度至少6位</div>
              <div>• 必须同时包含字母和数字</div>
            </div>
          </div>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => {
                setIsPasswordModalVisible(false);
                passwordForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: colors.primary }}>
                确认修改
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 退出登录确认弹窗 */}
      <Modal
        title={
          <span>
            <LogoutOutlined style={{ marginRight: 8, color: colors.danger }} />
            确认退出登录
          </span>
        }
        open={isLogoutModalVisible}
        onCancel={() => setIsLogoutModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsLogoutModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="logout"
            type="primary"
            danger
            onClick={handleLogout}
            style={{ backgroundColor: colors.danger, borderColor: colors.danger }}
          >
            确认退出
          </Button>
        ]}
        width={360}
      >
        <p style={{ color: colors.textSecondary, margin: '16px 0' }}>
          确定要退出登录吗？退出后将需要重新输入账号密码才能访问系统。
        </p>
      </Modal>
    </>
  );
};

export default Topbar;