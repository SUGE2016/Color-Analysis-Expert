import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Tag, Input, Dropdown, Modal, message, Button,
  Form, Space, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  DownOutlined, FolderOutlined,
  AppstoreOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, styles } from '../../components/common/constants';
import listPage from '../../styles/list-page.module.css';
import { datasetGroupApi } from '../../api/datasetGroup';
import { datasetApi } from '../../api/dataset';
import { buildYearFilterOptions, extractAcademicYears } from '../../utils/academicYear';

const { Title, Text } = Typography;

const GroupListPage = () => {
  const navigate = useNavigate();
  const [groupRows, setGroupRows] = useState([]);
  const [datasetsRaw, setDatasetsRaw] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [form] = Form.useForm();

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [groupList, datasets] = await Promise.all([
        datasetGroupApi.listGroups(),
        datasetApi.getDatasets(),
      ]);
      const groupsArr = Array.isArray(groupList) ? groupList : [];
      const datasetsArr = Array.isArray(datasets) ? datasets : [];
      setAvailableYears(extractAcademicYears(groupsArr, datasetsArr));

      setDatasetsRaw(datasetsArr);
      setGroupRows(
        groupsArr.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          year: g.academicYear,
        }))
      );
    } catch {
      /* 错误提示由 api 拦截器统一处理，避免重复弹窗 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const yearFilterOptions = useMemo(
    () => buildYearFilterOptions(availableYears),
    [availableYears]
  );

  useEffect(() => {
    if (activeYear !== 'all' && !availableYears.includes(Number(activeYear))) {
      setActiveYear('all');
    }
  }, [activeYear, availableYears]);

  const groups = useMemo(() => {
    const counts = {};
    datasetsRaw.forEach((ds) => {
      if (activeYear !== 'all' && ds.academicYear !== Number(activeYear)) return;
      if (ds.groupId) counts[ds.groupId] = (counts[ds.groupId] || 0) + 1;
    });
    return groupRows.map((g) => ({
      ...g,
      datasetCount: counts[g.id] || 0,
    }));
  }, [groupRows, datasetsRaw, activeYear]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const matchYear = activeYear === 'all' || group.year === Number(activeYear);
      const matchSearch =
        group.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        (group.description || '').toLowerCase().includes(searchValue.toLowerCase());
      return matchYear && matchSearch;
    });
  }, [groups, searchValue, activeYear, availableYears]);

  const handleCreateGroup = async (values) => {
    try {
      await datasetGroupApi.createGroup({
        name: values.name,
        description: values.description,
        academicYear: values.academicYear || new Date().getFullYear(),
      });
      message.success('分组创建成功');
      setIsCreateModalVisible(false);
      form.resetFields();
      loadGroups();
    } catch {
      /* 拦截器已提示 */
    }
  };

  const handleEditGroup = async (values) => {
    try {
      await datasetGroupApi.updateGroup(currentGroup.id, {
        name: values.name,
        description: values.description,
        academicYear: currentGroup.year,
      });
      message.success('分组更新成功');
      setIsEditModalVisible(false);
      setCurrentGroup(null);
      form.resetFields();
      loadGroups();
    } catch {
      /* */
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await datasetGroupApi.deleteGroup(currentGroup.id);
      message.success('分组删除成功');
      setIsDeleteModalVisible(false);
      setCurrentGroup(null);
      loadGroups();
    } catch {
      /* */
    }
  };

  const openEditModal = (group) => {
    setCurrentGroup(group);
    form.setFieldsValue({ name: group.name, description: group.description });
    setIsEditModalVisible(true);
  };

  const openDeleteModal = (group) => {
    setCurrentGroup(group);
    setIsDeleteModalVisible(true);
  };

  const handleGroupClick = (group, e) => {
    if (e) e.stopPropagation();
    navigate(`/dataset/group/${group.id}`);
  };

  if (loading && groupRows.length === 0) {
    return (
      <div className={listPage.page} style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={listPage.page}>
      <header className={listPage.header}>
        <div className={listPage.headerMain}>
          <div className={listPage.titleRow}>
            <Title level={4} className={listPage.pageTitle}>
              <AppstoreOutlined style={{ marginRight: 8, color: colors.primary }} />
              数据集分组管理
            </Title>
            <span className={listPage.pageMeta}>共 {filteredGroups.length} 个分组</span>
          </div>
        </div>
        <div className={listPage.headerActions}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
            新建分组
          </Button>
        </div>
      </header>

      <div className={listPage.filterBar}>
        <span className={listPage.filterLabel}>学年</span>
        {yearFilterOptions.map((item) => {
          const active = activeYear === item.toString();
          return (
            <Tag
              key={item}
              className={`${listPage.yearChip} ${active ? listPage.yearChipActive : listPage.yearChipIdle}`}
              onClick={() => setActiveYear(item.toString())}
            >
              {item === 'all' ? '全部' : `${item}年`}
            </Tag>
          );
        })}
        {availableYears.length === 0 && (
          <span className={listPage.filterMeta}>暂无学年数据，可在新建分组时填写学年</span>
        )}
        <div className={listPage.headerActions}>
          <Input
            className={listPage.searchInput}
            placeholder="搜索分组…"
            prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            allowClear
          />
        </div>
      </div>

      <div className={listPage.cardGrid}>
        <Card
          className={listPage.createCard}
          onClick={() => setIsCreateModalVisible(true)}
          styles={{ body: { padding: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', backgroundColor: colors.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
            }}>
              <PlusOutlined style={{ fontSize: 28, color: colors.primary }} />
            </div>
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: 500 }}>创建新分组</Text>
          </div>
        </Card>

        {filteredGroups.map((group) => (
          <Card
            key={group.id}
            className={listPage.groupCard}
            onClick={(e) => handleGroupClick(group, e)}
            styles={{ body: { padding: '1.25rem', height: '100%' } }}
          >
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <Dropdown
                menu={{
                  items: [
                    { key: 'edit', icon: <EditOutlined />, label: '重命名', onClick: (e) => { e.domEvent.stopPropagation(); openEditModal(group); } },
                    { key: 'delete', icon: <DeleteOutlined />, label: '删除分组', danger: true, onClick: (e) => { e.domEvent.stopPropagation(); openDeleteModal(group); } },
                  ],
                }}
                trigger={['click']}
              >
                <DownOutlined
                  style={{ cursor: 'pointer', color: colors.textTertiary, fontSize: 14, padding: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 4 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                width: 48, height: 48, borderRadius: styles.borderRadius.md, backgroundColor: colors.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12
              }}>
                <FolderOutlined style={{ fontSize: 24, color: colors.primary }} />
              </div>
              <Text style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {group.name}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {group.description || '暂无描述'}
              </Text>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={4}>
                  <DatabaseOutlined style={{ fontSize: 12, color: colors.textTertiary }} />
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{group.datasetCount} 个数据集</Text>
                </Space>
                {group.year && <Text style={{ fontSize: 12, color: colors.textTertiary }}>{group.year}年</Text>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title="创建新分组"
        open={isCreateModalVisible}
        onCancel={() => { setIsCreateModalVisible(false); form.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateGroup} initialValues={{ academicYear: new Date().getFullYear() }}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="例如：XX幼儿园" maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="分组描述">
            <Input.TextArea rows={3} maxLength={200} />
          </Form.Item>
          <Form.Item name="academicYear" label="学年">
            <Input type="number" min={2000} max={2100} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsCreateModalVisible(false); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑分组"
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setCurrentGroup(null); form.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleEditGroup}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="分组描述">
            <Input.TextArea rows={3} maxLength={200} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsEditModalVisible(false); setCurrentGroup(null); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认删除分组"
        open={isDeleteModalVisible}
        onOk={handleDeleteGroup}
        onCancel={() => { setIsDeleteModalVisible(false); setCurrentGroup(null); }}
        okText="删除"
        okButtonProps={{ danger: true }}
      >
        <Text>确定删除分组 <Text strong>{currentGroup?.name}</Text> 吗？</Text>
        {currentGroup?.datasetCount > 0 && (
          <div style={{ marginTop: 12, color: colors.danger }}>
            该分组下有 {currentGroup.datasetCount} 个数据集，需先删除数据集才能删除分组。
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GroupListPage;
