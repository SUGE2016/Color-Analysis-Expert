import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Button, Input, Table,
  Space, Select, Modal, message, Form, Tag, Empty, Pagination, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, ArrowLeftOutlined,
  SortAscendingOutlined, SortDescendingOutlined,
  FileImageOutlined, PictureOutlined, FolderOpenOutlined, SyncOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { colors } from '../../components/common/constants';
import listPage from '../../styles/list-page.module.css';
import { datasetApi } from '../../api/dataset';
import { datasetGroupApi } from '../../api/datasetGroup';
import { getOwnerId } from '../../utils/session';
import { buildYearFilterOptions, extractAcademicYears } from '../../utils/academicYear';
import { buildActionColumn, TABLE_SCROLL_X } from '../../utils/tableColumns';
import TableWrap from '../../components/table/TableWrap';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const scenarioOptions = [
  '儿童发展评估',
  '教育研究',
  '精细控制能力评估',
  '色彩认知研究',
  '其他',
];

function mapDataset(ds) {
  return {
    id: ds.id,
    name: ds.name,
    description: ds.description || '',
    scenario: ds.scene || '—',
    imageCount: ds.fileCount ?? 0,
    year: ds.academicYear,
    raw: ds,
  };
}

const DatasetListPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [currentDataset, setCurrentDataset] = useState(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [list, group] = await Promise.all([
        datasetApi.getDatasets({ groupId }),
        datasetGroupApi.getGroup(groupId),
      ]);
      const listArr = Array.isArray(list) ? list : [];
      setGroupName(group?.name || '数据集');
      setAvailableYears(extractAcademicYears(listArr, group ? [group] : []));
      setDatasets(listArr.map(mapDataset));
    } catch {
      /* 拦截器统一提示 */
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const yearFilterOptions = useMemo(
    () => buildYearFilterOptions(availableYears),
    [availableYears]
  );

  useEffect(() => {
    if (activeYear !== 'all' && !availableYears.includes(Number(activeYear))) {
      setActiveYear('all');
    }
  }, [activeYear, availableYears]);

  const filteredDatasets = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return datasets.filter((ds) => {
      const matchYear = activeYear === 'all' || ds.year === Number(activeYear);
      if (!matchYear) return false;
      if (!q) return true;
      return (
        ds.name.toLowerCase().includes(q) ||
        ds.description.toLowerCase().includes(q) ||
        String(ds.scenario).toLowerCase().includes(q)
      );
    });
  }, [datasets, searchValue, activeYear]);

  const sortedDatasets = useMemo(() => {
    const list = [...filteredDatasets];
    list.sort((a, b) => {
      let c = 0;
      if (sortField === 'name') c = a.name.localeCompare(b.name, 'zh-CN');
      else if (sortField === 'imageCount') c = a.imageCount - b.imageCount;
      else if (sortField === 'year') c = (a.year ?? 0) - (b.year ?? 0);
      return sortOrder === 'asc' ? c : -c;
    });
    return list;
  }, [filteredDatasets, sortField, sortOrder]);

  const paginatedDatasets = sortedDatasets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalImages = filteredDatasets.reduce((sum, ds) => sum + ds.imageCount, 0);

  const sortLabel =
    sortField === 'name' ? '名称' : sortField === 'imageCount' ? '图片数' : '学年';

  const handleCreateDataset = async (values) => {
    const ownerId = getOwnerId();
    if (!ownerId) {
      message.error('请先登录');
      return;
    }
    try {
      const created = await datasetApi.createDataset({
        name: values.name,
        description: values.description,
        ownerId,
        scene: values.scenario,
        groupId,
        academicYear: values.academicYear,
      });
      message.success('数据集创建成功');
      setIsCreateModalVisible(false);
      form.resetFields();
      if (created?.id) {
        navigate(`/dataset/group/${groupId}/dataset/${created.id}`);
      } else {
        loadData();
      }
    } catch {
      /* */
    }
  };

  const handleEditDataset = async (values) => {
    try {
      await datasetApi.updateDataset(currentDataset.id, {
        name: values.name,
        description: values.description,
        scene: values.scenario,
        groupId,
        academicYear: values.academicYear,
      });
      message.success('数据集已更新');
      setIsEditModalVisible(false);
      setCurrentDataset(null);
      form.resetFields();
      loadData();
    } catch {
      /* */
    }
  };

  const handleDeleteDataset = async () => {
    try {
      await datasetApi.deleteDataset(currentDataset.id);
      message.success('数据集已删除');
      setIsDeleteModalVisible(false);
      setCurrentDataset(null);
      loadData();
    } catch {
      /* */
    }
  };

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '批量删除确认',
      content: `确定删除选中的 ${selectedDatasets.length} 个数据集？将同时删除其下所有作品，不可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        for (const id of selectedDatasets) {
          await datasetApi.deleteDataset(id);
        }
        message.success('批量删除完成');
        setSelectedDatasets([]);
        loadData();
      },
    });
  };

  const handleRecalculateCounts = async () => {
    Modal.confirm({
      title: '重新计算图片数量',
      content: '确定要重新计算所有数据集的图片数量吗？这将根据数据库中的实际图片记录更新每个数据集的fileCount字段。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await datasetApi.recalculateAllFileCounts();
          message.success('图片数量重新计算完成');
          loadData();
        } catch (error) {
          console.error('重新计算失败:', error);
          if (error.response?.status === 401) {
            message.error('登录已过期，请重新登录后重试');
          } else {
            message.error('重新计算失败：' + (error.response?.data?.message || error.message || '未知错误'));
          }
        }
      },
    });
  };

  const openDetail = (record) => {
    navigate(`/dataset/group/${groupId}/dataset/${record.id}`);
  };

  const openEditModal = (record) => {
    setCurrentDataset(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      scenario: record.scenario === '—' ? undefined : record.scenario,
      academicYear: record.year,
    });
    setIsEditModalVisible(true);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const columns = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => (
        <div
          className={listPage.nameCell}
          style={{ cursor: 'pointer' }}
          onClick={() => openDetail(record)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') openDetail(record);
          }}
          role="button"
          tabIndex={0}
        >
          <PictureOutlined style={{ color: colors.primary, marginTop: 2, flexShrink: 0 }} />
          <div className={listPage.nameCellBody}>
            <span className={listPage.namePrimary}>{text}</span>
            {record.description ? (
              <span className={listPage.nameDesc} title={record.description}>
                {record.description}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: '所属场景',
      dataIndex: 'scenario',
      width: 140,
      render: (s) => (s && s !== '—' ? <Tag color="blue">{s}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: '图片数量',
      dataIndex: 'imageCount',
      width: 108,
      align: 'center',
      render: (count) => (
        <Space size={4}>
          <FileImageOutlined style={{ color: colors.textTertiary }} />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: '学年',
      dataIndex: 'year',
      width: 72,
      align: 'center',
      render: (y) => (y ? <Tag>{y}</Tag> : <Text type="secondary">—</Text>),
    },
    buildActionColumn({
      width: 188,
      actions: [
        { key: 'detail', label: '详情', icon: <EyeOutlined />, onClick: openDetail, pinned: true },
        { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: openEditModal },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (record) => {
            setCurrentDataset(record);
            setIsDeleteModalVisible(true);
          },
        },
      ],
    }),
  ];

  const rowSelection = {
    selectedRowKeys: selectedDatasets,
    onChange: setSelectedDatasets,
  };

  const defaultAcademicYear =
    activeYear !== 'all' ? Number(activeYear) : availableYears[0] ?? new Date().getFullYear();

  if (loading && datasets.length === 0) {
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
          <button type="button" className={listPage.backBtn} onClick={() => navigate('/dataset')}>
            <ArrowLeftOutlined />
            <span>返回分组</span>
          </button>
          <div className={listPage.titleRow}>
            <Title level={4} className={listPage.pageTitle}>
              <FolderOpenOutlined style={{ color: colors.primary }} />
              {groupName}
            </Title>
            <span className={listPage.pageMeta}>
              共 {filteredDatasets.length} 个数据集 · {totalImages} 张作品
            </span>
          </div>
        </div>
        <div className={listPage.headerActions}>
          <Input
            className={listPage.searchInput}
            placeholder="搜索名称、描述、场景…"
            prefix={<SearchOutlined style={{ color: colors.textTertiary }} />}
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setCurrentPage(1);
            }}
            allowClear
          />
          <Button icon={<SyncOutlined />} onClick={handleRecalculateCounts}>
            修复统计
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
            新建数据集
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
          <span className={listPage.filterMeta}>暂无学年，新建时可填写</span>
        )}
        <div className={listPage.sortGroup}>
          <Button
            size="small"
            icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
            onClick={() => handleSort(sortField)}
          >
            {sortLabel}
          </Button>
          {selectedDatasets.length > 0 && (
            <>
              <span className={listPage.selectionHint}>已选 {selectedDatasets.length} 项</span>
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
          dataSource={paginatedDatasets}
          rowKey="id"
          pagination={false}
          size="middle"
          scroll={{ x: TABLE_SCROLL_X }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text type="secondary">暂无数据集</Text>
                    <div style={{ marginTop: 12 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
                        创建数据集
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
            本页 {paginatedDatasets.length} 个，合计 {sortedDatasets.length} 个数据集、{totalImages} 张作品
          </span>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={sortedDatasets.length}
            onChange={(p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            }}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={[12, 24, 48]}
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      </Card>
      </TableWrap>

      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: colors.primary }} />
            <span>新建数据集</span>
          </Space>
        }
        open={isCreateModalVisible}
        onCancel={() => {
          setIsCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDataset}
          initialValues={{ academicYear: defaultAcademicYear }}
        >
          <Form.Item name="name" label="数据集名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：大班第一次涂色" maxLength={50} />
          </Form.Item>
          <Form.Item name="scenario" label="所属场景">
            <Select allowClear placeholder="请选择（可选）">
              {scenarioOptions.map((s) => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="academicYear" label="学年">
            <Input type="number" min={2000} max={2100} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
            <TextArea rows={3} maxLength={500} showCount placeholder="简要说明内容与用途" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsCreateModalVisible(false); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">创建并上传作品</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: colors.primary }} />
            <span>编辑数据集</span>
          </Space>
        }
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          setCurrentDataset(null);
          form.resetFields();
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleEditDataset}>
          <Form.Item name="name" label="数据集名称" rules={[{ required: true }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="scenario" label="所属场景">
            <Select allowClear>
              {scenarioOptions.map((s) => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="academicYear" label="学年">
            <Input type="number" min={2000} max={2100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsEditModalVisible(false); setCurrentDataset(null); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: colors.danger }} />
            <span>删除数据集</span>
          </Space>
        }
        open={isDeleteModalVisible}
        onOk={handleDeleteDataset}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setCurrentDataset(null);
        }}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Text>
          确定删除「<Text strong>{currentDataset?.name}</Text>」？将同时删除其下所有作品，不可恢复。
        </Text>
      </Modal>
    </div>
  );
};

export default DatasetListPage;
