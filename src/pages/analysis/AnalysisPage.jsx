import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Button, Table, Tag, Badge,
  Input, Space, Modal, Form, Upload, Empty, Progress, message, Pagination, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, FileTextOutlined, EditOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, BarChartOutlined,
  FileOutlined, UploadOutlined, InfoCircleOutlined,
  SettingOutlined, SortAscendingOutlined, SortDescendingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, styles } from '../../components/common/constants';
import listPage from '../../styles/list-page.module.css';
import { buildYearFilterOptions, extractAcademicYears } from '../../utils/academicYear';
import { buildActionColumn, TABLE_SCROLL_X } from '../../utils/tableColumns';
import TableWrap from '../../components/table/TableWrap';
import { analysisApi } from '../../api/analysis';
import { templateApi } from '../../api/template';
import { datasetApi } from '../../api/dataset';
import AuthenticatedTemplateImage from '../../components/common/AuthenticatedTemplateImage';
import {
  ANALYSIS_STATUS,
  mapBackendProject,
  mapBackendTemplate,
} from '../../utils/projectMapper';

const { Title, Text } = Typography;

// 状态配置
const STATUS_CONFIG = {
  [ANALYSIS_STATUS.NOT_STARTED]: {
    label: '未开始',
    color: 'default',
    icon: <ClockCircleOutlined />,
    badgeStatus: 'default'
  },
  [ANALYSIS_STATUS.IN_PROGRESS]: {
    label: '进行中',
    color: 'processing',
    icon: <LoadingOutlined />,
    badgeStatus: 'processing'
  },
  [ANALYSIS_STATUS.COMPLETED]: {
    label: '已完成',
    color: 'success',
    icon: <CheckCircleOutlined />,
    badgeStatus: 'success'
  },
  [ANALYSIS_STATUS.FAILED]: {
    label: '失败',
    color: 'error',
    icon: <CloseCircleOutlined />,
    badgeStatus: 'error'
  }
};

const AnalysisPage = () => {
  const navigate = useNavigate();
  // 从 localStorage 加载未完成的创建项目并合并到 API 数据
  const loadIncompleteProjects = () => {
    try {
      const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
      const incompleteProjects = savedProjects.map(p => ({
        id: p.id,
        name: p.name || '未命名项目',
        targetCount: p.selectedDatasets?.reduce((sum, ds) => sum + (ds.imageCount || 0), 0) || 0,
        createTime: p.lastSaved || new Date().toLocaleString(),
        updateTime: p.lastSaved || new Date().toLocaleString(),
        year: new Date().getFullYear(),
        status: ANALYSIS_STATUS.NOT_STARTED,
        progress: 0,
        datasetName: p.selectedDatasets?.[0]?.name || '未选择数据集',
        datasetCount: p.selectedDatasets?.length || 0,
        creator: '当前用户',
        description: p.description || '创建途中退出的项目',
        isIncomplete: true // 标记为未完成项目
      }));
      return incompleteProjects;
    } catch (e) {
      console.error('加载未完成项目失败:', e);
      return [];
    }
  };
  
  const mergeWithIncomplete = (apiProjects) => {
    const incompleteProjects = loadIncompleteProjects();
    const merged = [...apiProjects];
    incompleteProjects.forEach((ip) => {
      if (!merged.find((p) => String(p.id) === String(ip.id))) {
        merged.push(ip);
      }
    });
    return merged;
  };

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const [projectList, datasets] = await Promise.all([
        analysisApi.getProjects(),
        datasetApi.getDatasets(),
      ]);
      const datasetNameMap = {};
      (Array.isArray(datasets) ? datasets : []).forEach((ds) => {
        datasetNameMap[ds.id] = ds.name;
      });
      const mapped = (Array.isArray(projectList) ? projectList : []).map((p) =>
        mapBackendProject(p, datasetNameMap)
      );
      setProjects(mergeWithIncomplete(mapped));
    } catch {
      setProjects(mergeWithIncomplete([]));
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const list = await templateApi.getTemplates();
      const mapped = (Array.isArray(list) ? list : []).map(mapBackendTemplate);
      setTemplates(mapped);
      setFilteredTemplates(mapped);
    } catch {
      setTemplates([]);
      setFilteredTemplates([]);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选状态
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeYear, setActiveYear] = useState('all');
  const [sortField, setSortField] = useState('createTime');
  const [sortOrder, setSortOrder] = useState('desc');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 选中的项目
  const [selectedProjects, setSelectedProjects] = useState([]);

  // 删除弹窗
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [currentDeleteProject, setCurrentDeleteProject] = useState(null);

  // 项目详情弹窗
  const [projectDetailModalVisible, setProjectDetailModalVisible] = useState(false);
  const [currentDetailProject, setCurrentDetailProject] = useState(null);
  
  // 模板管理状态
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [templateSearchValue, setTemplateSearchValue] = useState('');
  const [templateManageModalVisible, setTemplateManageModalVisible] = useState(false);
  
  // 模板分页
  const [templateCurrentPage, setTemplateCurrentPage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState(10);
  
  // 模板弹窗状态
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [templateDetailModalVisible, setTemplateDetailModalVisible] = useState(false);
  const [deleteTemplateModalVisible, setDeleteTemplateModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  
  // 上传表单
  const [uploadForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);

  // 格式化日期为年-月-日
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const availableYears = useMemo(() => extractAcademicYears(projects), [projects]);

  const yearFilterOptions = useMemo(
    () => buildYearFilterOptions(availableYears),
    [availableYears]
  );

  useEffect(() => {
    if (activeYear !== 'all' && !availableYears.includes(Number(activeYear))) {
      setActiveYear('all');
    }
  }, [activeYear, availableYears]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (activeYear !== 'all') {
      result = result.filter((p) => p.year === Number(activeYear));
    }
    if (searchValue.trim()) {
      const keyword = searchValue.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.datasetName.toLowerCase().includes(keyword) ||
          p.creator.toLowerCase().includes(keyword) ||
          (p.description || '').toLowerCase().includes(keyword)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'createTime') {
        comparison = new Date(a.createTime) - new Date(b.createTime);
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'zh-CN');
      } else if (sortField === 'status') {
        const statusOrder = ['not_started', 'in_progress', 'failed', 'completed'];
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      } else if (sortField === 'targetCount') {
        comparison = a.targetCount - b.targetCount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [projects, statusFilter, activeYear, searchValue, sortField, sortOrder]);

  const statusCounts = useMemo(
    () => ({
      inProgress: projects.filter((p) => p.status === ANALYSIS_STATUS.IN_PROGRESS).length,
      completed: projects.filter((p) => p.status === ANALYSIS_STATUS.COMPLETED).length,
      failed: projects.filter((p) => p.status === ANALYSIS_STATUS.FAILED).length,
    }),
    [projects]
  );

  const sortLabel =
    sortField === 'name'
      ? '名称'
      : sortField === 'status'
        ? '状态'
        : sortField === 'targetCount'
          ? '对象数'
          : '创建时间';
  
  // 模板筛选逻辑
  useEffect(() => {
    let result = [...templates];
    
    // 搜索筛选
    if (templateSearchValue) {
      const keyword = templateSearchValue.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(keyword) ||
        (t.description || '').toLowerCase().includes(keyword) ||
        (t.uploadBy || '').toLowerCase().includes(keyword)
      );
    }
    
    setFilteredTemplates(result);
    setTemplateCurrentPage(1);
  }, [templates, templateSearchValue]);

  // 处理排序
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 创建新项目
  const handleCreate = () => {
    navigate('/analysis/create');
  };

  // 查看详情 - 弹窗展示项目图片分析进度
  const handleViewDetail = (project) => {
    setCurrentDetailProject(project);
    setProjectDetailModalVisible(true);
  };

  // 查看报告
  const handleViewReport = (projectId) => {
    navigate(`/analysis/${projectId}/report`);
  };

  const handleRestartAnalysis = (project) => {
    if (project.isIncomplete) {
      message.info('请先完成项目创建向导');
      return;
    }
    Modal.confirm({
      title: '重新分析确认',
      content: `确定要重新分析项目 "${project.name}" 吗？这将清空之前的分析结果并重新开始。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await analysisApi.startAnalysis(project.id);
          message.success(`项目 "${project.name}" 已开始重新分析`);
          await loadProjects();
        } catch {
          /* 拦截器已提示 */
        }
      },
    });
  };

  // 继续编辑 - 对于未开始的项目，跳转到创建页面继续编辑
  const handleEdit = (project) => {
    if (project.status === ANALYSIS_STATUS.NOT_STARTED && project.isIncomplete) {
      // 跳转到创建页面，通过state传递项目ID以恢复进度
      navigate('/analysis/create', { state: { projectId: project.id } });
    } else {
      // 对于已有项目，跳转到详情页
      navigate(`/analysis/${project.id}`);
    }
  };

  // 删除项目
  const handleDelete = (project) => {
    setCurrentDeleteProject(project);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!currentDeleteProject) return;
    try {
      if (currentDeleteProject.isIncomplete) {
        const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
        const filtered = savedProjects.filter((p) => p.id !== currentDeleteProject.id);
        localStorage.setItem('incompleteAnalysisProjects', JSON.stringify(filtered));
      } else {
        await analysisApi.deleteProject(currentDeleteProject.id);
      }
      setProjects(projects.filter((p) => p.id !== currentDeleteProject.id));
      message.success(`项目 "${currentDeleteProject.name}" 已删除`);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setDeleteModalVisible(false);
      setCurrentDeleteProject(null);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedProjects.length === 0) {
      message.warning('请至少选择一个项目');
      return;
    }
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedProjects.length} 个分析项目吗？此操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const incompleteIds = selectedProjects.filter((id) => {
          const p = projects.find((proj) => proj.id === id);
          return p?.isIncomplete;
        });
        try {
          for (const id of selectedProjects) {
            if (incompleteIds.includes(id)) continue;
            await analysisApi.deleteProject(id);
          }
          if (incompleteIds.length > 0) {
            const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
            const filtered = savedProjects.filter((p) => !incompleteIds.includes(p.id));
            localStorage.setItem('incompleteAnalysisProjects', JSON.stringify(filtered));
          }
          setProjects(projects.filter((p) => !selectedProjects.includes(p.id)));
          setSelectedProjects([]);
          message.success('批量删除成功');
        } catch {
          /* 拦截器已提示 */
        }
      },
    });
  };
  
  // ==================== 模板管理功能 ====================
  
  // 查看模板详情
  const handleViewTemplateDetail = (template) => {
    setCurrentTemplate(template);
    setTemplateDetailModalVisible(true);
  };
  
  // 删除模板
  const handleDeleteTemplate = (template) => {
    setCurrentTemplate(template);
    setDeleteTemplateModalVisible(true);
  };
  
  const confirmDeleteTemplate = async () => {
    if (!currentTemplate) return;
    try {
      await templateApi.deleteTemplate(currentTemplate.id);
      await loadTemplates();
      message.success(`模板 "${currentTemplate.name}" 已删除`);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setDeleteTemplateModalVisible(false);
      setCurrentTemplate(null);
    }
  };

  const handleUploadTemplate = async (values) => {
    setUploading(true);
    try {
      const file = values.templateImage?.fileList?.[0]?.originFileObj
        || values.templateImage?.[0]?.originFileObj;
      if (!file) {
        message.error('请选择模板图片');
        return;
      }
      const created = await templateApi.createTemplate({ name: values.name, imageFile: file });
      await loadTemplates();
      setUploadModalVisible(false);
      uploadForm.resetFields();
      message.success('模板上传成功');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setUploading(false);
    }
  };

  // 渲染状态标签
  const renderStatus = (status, progress) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[ANALYSIS_STATUS.NOT_STARTED];
    return (
      <Space direction="vertical" size={0}>
        <Tag icon={config.icon} color={config.color}>
          {config.label}
        </Tag>
        {status === ANALYSIS_STATUS.IN_PROGRESS && (
          <Progress percent={progress} size="small" status="active" style={{ width: 80, marginTop: 4 }} />
        )}
      </Space>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: true,
      onHeaderCell: () => ({
        onClick: () => handleSort('name')
      }),
      render: (text, record) => (
        <div>
          <Text strong style={{ color: colors.textPrimary }}>{text}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
              {record.description}
            </Text>
          </div>
        </div>
      )
    },
    {
      title: '分析状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      sorter: true,
      onHeaderCell: () => ({
        onClick: () => handleSort('status')
      }),
      render: (status, record) => renderStatus(status, record.progress)
    },
    {
      title: '关联数据集',
      dataIndex: 'datasetName',
      key: 'datasetName',
      width: 180,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: colors.textPrimary }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.datasetCount} 个数据集</Text>
        </Space>
      )
    },
    {
      title: '分析对象',
      dataIndex: 'targetCount',
      key: 'targetCount',
      width: 100,
      align: 'center',
      sorter: true,
      onHeaderCell: () => ({
        onClick: () => handleSort('targetCount')
      }),
      render: (count) => (
        <Badge count={count} style={{ backgroundColor: colors.primary }} />
      )
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 100,
      render: (creator) => <Tag color="blue">{creator}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 120,
      sorter: true,
      onHeaderCell: () => ({
        onClick: () => handleSort('createTime')
      }),
      render: (time) => (
        <Text style={{ fontSize: 13 }}>{formatDate(time)}</Text>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 120,
      render: (time) => (
        <Text type="secondary" style={{ fontSize: 13 }}>{formatDate(time)}</Text>
      )
    },
    buildActionColumn({
      width: 240,
      actions: [
        { key: 'view', label: '详情', icon: <EyeOutlined />, onClick: handleViewDetail, pinned: true },
        {
          key: 'report',
          label: '报告',
          icon: <FileTextOutlined />,
          pinned: true,
          disabled: (r) => r.status !== ANALYSIS_STATUS.COMPLETED,
          onClick: (r) => handleViewReport(r.id),
        },
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: (r) =>
            r.status === ANALYSIS_STATUS.NOT_STARTED && r.isIncomplete ? '编辑' : '分析',
          onClick: (r) => {
            if (r.status === ANALYSIS_STATUS.NOT_STARTED && r.isIncomplete) {
              handleEdit(r);
            } else {
              handleRestartAnalysis(r);
            }
          },
        },
        { type: 'divider' },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: handleDelete },
      ],
    }),
  ];
  
  // 模板表格列定义
  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileOutlined style={{ color: colors.primary }} />
          <Text strong style={{ color: colors.textPrimary }}>{text}</Text>
        </div>
      )
    },
    {
      title: '模板照片',
      dataIndex: 'hasImage',
      key: 'templateImage',
      width: 120,
      render: (_, record) => (
        <div style={{ 
          width: 80, 
          height: 80, 
          background: colors.neutralLight,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {record.hasImage ? (
            <AuthenticatedTemplateImage
              templateId={record.id}
              alt="模板"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <FileOutlined style={{ fontSize: 24, color: colors.textTertiary }} />
          )}
        </div>
      )
    },
    buildActionColumn({
      width: 168,
      actions: [
        { key: 'view', label: '详情', icon: <InfoCircleOutlined />, onClick: handleViewTemplateDetail, pinned: true },
        { type: 'divider' },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: handleDeleteTemplate },
      ],
    }),
  ];

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys: selectedProjects,
    onChange: (selectedKeys) => setSelectedProjects(selectedKeys),
  };

  // 分页数据
  const paginatedData = useMemo(
    () => filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProjects, currentPage, pageSize]
  );

  const statusFilterOptions = [
    { key: 'all', label: '全部' },
    { key: ANALYSIS_STATUS.NOT_STARTED, label: '未开始' },
    { key: ANALYSIS_STATUS.IN_PROGRESS, label: '进行中' },
    { key: ANALYSIS_STATUS.COMPLETED, label: '已完成' },
    { key: ANALYSIS_STATUS.FAILED, label: '失败' },
  ];
  
  // 模板分页数据
  const templatePaginatedData = filteredTemplates.slice(
    (templateCurrentPage - 1) * templatePageSize,
    templateCurrentPage * templatePageSize
  );

  if (loading && projects.length === 0) {
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
              <BarChartOutlined style={{ color: colors.primary }} />
              历史分析项目
            </Title>
            <span className={listPage.pageMeta}>
              共 {filteredProjects.length} 个项目 · 进行中 {statusCounts.inProgress} · 已完成{' '}
              {statusCounts.completed} · 失败 {statusCounts.failed}
            </span>
          </div>
        </div>
        <div className={listPage.headerActions}>
          <Input
            className={listPage.searchInput}
            placeholder="搜索项目、数据集、创建人…"
            prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setCurrentPage(1);
            }}
            allowClear
          />
          <Button icon={<SettingOutlined />} onClick={() => setTemplateManageModalVisible(true)}>
            模板管理
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建分析
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
              onClick={() => {
                setActiveYear(item.toString());
                setCurrentPage(1);
              }}
            >
              {item === 'all' ? '全部' : `${item}年`}
            </Tag>
          );
        })}
        {availableYears.length === 0 && (
          <span className={listPage.filterMeta}>暂无学年数据</span>
        )}
        <span className={listPage.filterLabel}>状态</span>
        {statusFilterOptions.map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <Tag
              key={key}
              className={`${listPage.yearChip} ${active ? listPage.yearChipActive : listPage.yearChipIdle}`}
              onClick={() => {
                setStatusFilter(key);
                setCurrentPage(1);
              }}
            >
              {label}
            </Tag>
          );
        })}
        <div className={listPage.sortGroup}>
          <Button
            size="small"
            icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
            onClick={() => handleSort(sortField)}
          >
            {sortLabel}
          </Button>
          {selectedProjects.length > 0 && (
            <>
              <span className={listPage.selectionHint}>已选 {selectedProjects.length} 项</span>
              <Button danger size="small" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                批量删除
              </Button>
            </>
          )}
        </div>
      </div>

      <TableWrap>
        <Card className={listPage.tableCard}>
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={paginatedData}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="middle"
            scroll={{ x: TABLE_SCROLL_X }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <Text type="secondary">暂无分析项目</Text>
                      <div style={{ marginTop: 12 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                          新建分析
                        </Button>
                      </div>
                    </div>
                  }
                />
              ),
            }}
          />
          <div className={listPage.tableFooter}>
            <span className={listPage.tableFooterMeta}>
              本页 {paginatedData.length} 个，合计 {filteredProjects.length} 个项目
            </span>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredProjects.length}
              onChange={(p, s) => {
                setCurrentPage(p);
                setPageSize(s);
              }}
              showSizeChanger
              showQuickJumper
              pageSizeOptions={[10, 20, 50]}
              showTotal={(t) => `共 ${t} 条`}
            />
          </div>
        </Card>
      </TableWrap>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false);
          setCurrentDeleteProject(null);
        }}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除分析项目 <Text strong>{currentDeleteProject?.name}</Text> 吗？</p>
        <p style={{ color: colors.textSecondary, fontSize: 13 }}>
          此操作将同时删除该项目的所有分析结果和报告，不可恢复。
        </p>
      </Modal>

      {/* 项目详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>项目详情</span>
            {currentDetailProject && (
              <Tag color={STATUS_CONFIG[currentDetailProject.status]?.color}>
                {STATUS_CONFIG[currentDetailProject.status]?.label}
              </Tag>
            )}
          </div>
        }
        open={projectDetailModalVisible}
        onCancel={() => {
          setProjectDetailModalVisible(false);
          setCurrentDetailProject(null);
        }}
        footer={[
          <Button key="close" onClick={() => setProjectDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
        bodyStyle={{ maxHeight: '60vh', overflow: 'auto', padding: '24px' }}
      >
        {currentDetailProject && (
          <div>
            {/* 项目基本信息 */}
            <Card size="small" style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>项目名称：</Text>
                  <Text strong>{currentDetailProject.name}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>数据集：</Text>
                  <Text>{currentDetailProject.datasetName} ({currentDetailProject.datasetCount}个)</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>分析对象数：</Text>
                  <Text strong style={{ color: colors.primary }}>{currentDetailProject.targetCount} 张</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>总进度：</Text>
                  <Text strong style={{ color: currentDetailProject.progress === 100 ? colors.success : colors.primary }}>
                    {currentDetailProject.progress}%
                  </Text>
                </div>
              </div>
            </Card>

            {/* 图片分析进度列表 */}
            <Text strong style={{ fontSize: 15, marginBottom: 12, display: 'block' }}>
              图片分析进展 ({currentDetailProject.targetCount}张)
            </Text>
            
            {/* 根据项目状态生成对应的图片进度数据 */}
            {(() => {
              // 根据项目状态确定每张图片的状态
              const generateImageProgress = () => {
                const count = currentDetailProject.targetCount;
                const images = [];
                
                for (let i = 0; i < count; i++) {
                  let status, progress;
                  
                  if (currentDetailProject.status === ANALYSIS_STATUS.COMPLETED) {
                    // 已完成：所有图片都100%完成
                    status = 'completed';
                    progress = 100;
                  } else if (currentDetailProject.status === ANALYSIS_STATUS.NOT_STARTED) {
                    // 未开始：所有图片都是0%
                    status = 'not_started';
                    progress = 0;
                  } else if (currentDetailProject.status === ANALYSIS_STATUS.FAILED) {
                    // 失败：部分完成，部分失败
                    status = i < count * 0.3 ? 'completed' : 'failed';
                    progress = i < count * 0.3 ? 100 : 30;
                  } else {
                    // 进行中：根据总进度分配
                    const completedCount = Math.floor(count * (currentDetailProject.progress / 100));
                    if (i < completedCount) {
                      status = 'completed';
                      progress = 100;
                    } else if (i === completedCount && currentDetailProject.progress < 100) {
                      status = 'processing';
                      progress = Math.round((currentDetailProject.progress % (100 / count)) * count);
                    } else {
                      status = 'pending';
                      progress = 0;
                    }
                  }
                  
                  images.push({
                    id: i + 1,
                    name: `涂色作品_${String(i + 1).padStart(3, '0')}.jpg`,
                    status,
                    progress
                  });
                }
                return images;
              };

              const imageList = generateImageProgress();
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {imageList.slice(0, 10).map((img) => (
                    <div
                      key={img.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: colors.neutralLight,
                        borderRadius: 8,
                        border: '1px solid ' + colors.neutralDark
                      }}
                    >
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 6, 
                        background: colors.neutral,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: colors.textSecondary,
                        fontWeight: 600
                      }}>
                        {img.id}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13 }} ellipsis>{img.name}</Text>
                      </div>
                      <div style={{ width: 120 }}>
                        <Progress 
                          percent={img.progress} 
                          size="small"
                          strokeColor={
                            img.status === 'completed' ? colors.success :
                            img.status === 'failed' ? colors.danger :
                            img.status === 'processing' ? colors.primary :
                            colors.textTertiary
                          }
                          showInfo={false}
                        />
                      </div>
                      <div style={{ width: 80, textAlign: 'right' }}>
                        {img.status === 'completed' && (
                          <Tag color="success" style={{ fontSize: 12 }}>已完成</Tag>
                        )}
                        {img.status === 'processing' && (
                          <Tag color="processing" style={{ fontSize: 12 }}>分析中</Tag>
                        )}
                        {img.status === 'failed' && (
                          <Tag color="error" style={{ fontSize: 12 }}>失败</Tag>
                        )}
                        {img.status === 'not_started' && (
                          <Tag style={{ fontSize: 12 }}>未开始</Tag>
                        )}
                        {img.status === 'pending' && (
                          <Tag style={{ fontSize: 12, color: colors.textTertiary }}>等待中</Tag>
                        )}
                      </div>
                    </div>
                  ))}
                  {imageList.length > 10 && (
                    <Text type="secondary" style={{ textAlign: 'center', padding: '8px 0' }}>
                      还有 {imageList.length - 10} 张图片...
                    </Text>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
      
      {/* 模板管理弹窗 */}
      <Modal
        title="分析模板管理"
        open={templateManageModalVisible}
        onCancel={() => setTemplateManageModalVisible(false)}
        footer={null}
        width={1100}
        bodyStyle={{ padding: '20px 0' }}
      >
        {/* 模板筛选工具栏 */}
        <Card
          style={{ marginBottom: 16, borderRadius: styles.borderRadius.md, margin: '0 24px 16px' }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Space size={16} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            {/* 右侧搜索和操作 */}
            <Space size={12}>
              <Input
                placeholder="搜索模板名称..."
                prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
                value={templateSearchValue}
                onChange={(e) => setTemplateSearchValue(e.target.value)}
                style={{ width: 280, borderRadius: styles.borderRadius.md }}
                allowClear
              />
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
                style={{ backgroundColor: colors.primary, borderRadius: styles.borderRadius.md }}
              >
                上传模板
              </Button>
            </Space>
          </Space>
        </Card>

        {/* 模板统计概览 */}
        <Card
          style={{ marginBottom: 16, borderRadius: styles.borderRadius.md, margin: '0 24px 16px' }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Space size={32}>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>总模板数</Text>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary }}>
                {templates.length}
              </div>
            </div>
          </Space>
        </Card>

        {/* 模板列表 */}
        <TableWrap className="template-table-wrap">
        <div style={{ padding: '0 24px' }}>
          <Table
            columns={templateColumns}
            dataSource={templatePaginatedData}
            rowKey="id"
            scroll={{ x: TABLE_SCROLL_X }}
            pagination={{
              current: templateCurrentPage,
              pageSize: templatePageSize,
              total: filteredTemplates.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个模板`,
              pageSizeOptions: [10, 20, 50],
              onChange: (page, size) => {
                setTemplateCurrentPage(page);
                setTemplatePageSize(size);
              }
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <Text style={{ color: colors.textSecondary }}>暂无分析模板</Text>
                      <div style={{ marginTop: 16 }}>
                        <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
                          上传新模板
                        </Button>
                      </div>
                    </div>
                  }
                />
              )
            }}
          />
        </div>
        </TableWrap>
      </Modal>
      
      {/* 模板上传弹窗 */}
      <Modal
        title="上传分析模板"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={handleUploadTemplate}
          style={{ padding: '16px 0' }}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：精细动作能力分析模板" />
          </Form.Item>
          
          <Form.Item
            name="templateImage"
            label="模板照片"
            rules={[{ required: true, message: '请上传模板照片' }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload.Dragger
              accept=".jpg,.jpeg,.png,.webp"
              maxCount={1}
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽模板照片到此处上传</p>
              <p className="ant-upload-hint">
                支持 .jpg, .jpeg, .png, .webp 格式的图片文件
              </p>
            </Upload.Dragger>
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setUploadModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={uploading}
                style={{ backgroundColor: colors.primary }}
              >
                上传
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 模板详情弹窗 */}
      <Modal
        title="模板详情"
        open={templateDetailModalVisible}
        onCancel={() => {
          setTemplateDetailModalVisible(false);
          setCurrentTemplate(null);
        }}
        footer={[
          <Button key="close" onClick={() => setTemplateDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentTemplate && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 18 }}>{currentTemplate.name}</Text>
            </div>
            <div style={{ 
              width: 300, 
              height: 300, 
              margin: '0 auto',
              background: colors.neutralLight,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {currentTemplate.hasImage ? (
                <AuthenticatedTemplateImage
                  templateId={currentTemplate.id}
                  alt="模板照片"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <FileOutlined style={{ fontSize: 64, color: colors.textTertiary }} />
              )}
            </div>
          </div>
        )}
      </Modal>
      
      {/* 模板删除确认弹窗 */}
      <Modal
        title="确认删除模板"
        open={deleteTemplateModalVisible}
        onOk={confirmDeleteTemplate}
        onCancel={() => {
          setDeleteTemplateModalVisible(false);
          setCurrentTemplate(null);
        }}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除分析模板 <Text strong>{currentTemplate?.name}</Text> 吗？</p>
        <p style={{ color: colors.textSecondary, fontSize: 13 }}>
          此操作将永久删除该模板文件，不可恢复。已使用该模板生成的分析报告不受影响。
        </p>
      </Modal>
    </div>
  );
};

export default AnalysisPage;
