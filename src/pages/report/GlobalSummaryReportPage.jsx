import React, { useState } from 'react';
import { 
  Card, Typography, Button, Table, Tag, 
  Row, Col, Statistic, Space, Select,
  Divider, message
} from 'antd';
import { 
  ArrowLeftOutlined, DownloadOutlined, FileExcelOutlined, 
  FileTextOutlined, EyeOutlined, FilePdfOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { buildActionColumn, TABLE_SCROLL_X } from '../../utils/tableColumns';
import TableWrap from '../../components/table/TableWrap';

const { Title, Text } = Typography;
const { Option } = Select;

// 模拟全局汇总报告数据
const globalSummaryData = {
  projectInfo: {
    name: '幼儿园涂色分析项目',
    createTime: '2025-10-12 00:00:00',
    totalChildren: 25,
    totalImages: 120,
    analyzedImages: 118,
    status: 'completed'
  },
  summaryStatistics: {
    avgCompletionRate: 87.5,
    avgColorUsage: 78.3,
    avgCoverage: 65.7
  },
  imageResults: [
    { 
      id: 1, 
      name: '涂色作品_001.jpg', 
      childName: '小朋友1',
      analysisTime: '2025-10-12 14:30:25',
      colorCount: 8,
      colorUsage: 85.2,
      coverage: 72.1,
      dominantColor: { name: '红色', hex: '#FF4D4F', percentage: 28.5 },
      status: 'completed'
    },
    { 
      id: 2, 
      name: '涂色作品_002.jpg', 
      childName: '小朋友2',
      analysisTime: '2025-10-12 14:32:18',
      colorCount: 6,
      colorUsage: 76.8,
      coverage: 68.5,
      dominantColor: { name: '蓝色', hex: '#1890FF', percentage: 25.3 },
      status: 'completed'
    },
    { 
      id: 3, 
      name: '涂色作品_003.jpg', 
      childName: '小朋友3',
      analysisTime: '2025-10-12 14:35:42',
      colorCount: 9,
      colorUsage: 82.1,
      coverage: 75.3,
      dominantColor: { name: '黄色', hex: '#FAAD14', percentage: 22.8 },
      status: 'completed'
    },
    { 
      id: 4, 
      name: '涂色作品_004.jpg', 
      childName: '小朋友4',
      analysisTime: '2025-10-12 14:38:15',
      colorCount: 5,
      colorUsage: 68.4,
      coverage: 58.2,
      dominantColor: { name: '绿色', hex: '#52C41A', percentage: 30.2 },
      status: 'completed'
    },
    { 
      id: 5, 
      name: '涂色作品_005.jpg', 
      childName: '小朋友5',
      analysisTime: '2025-10-12 14:42:33',
      colorCount: 7,
      colorUsage: 79.5,
      coverage: 70.8,
      dominantColor: { name: '紫色', hex: '#722ED1', percentage: 24.6 },
      status: 'completed'
    }
  ]
};

const GlobalSummaryReportPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [selectedFormat, setSelectedFormat] = useState('excel');

  // 导出功能
  const handleExport = () => {
    if (selectedFormat === 'csv') {
      exportToCSV();
    } else if (selectedFormat === 'excel') {
      exportToExcel();
    } else if (selectedFormat === 'pdf') {
      exportToPDF();
    }
  };

  // 导出为CSV
  const exportToCSV = () => {
    const headers = ['图片ID', '图片名称', '分析对象', '分析时间', '状态'];
    const rows = globalSummaryData.imageResults.map(item => [
      item.id,
      item.name,
      item.childName,
      item.analysisTime,
      item.status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `全局汇总报告_${projectId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 导出为Excel（模拟）
  const exportToExcel = () => {
    const data = {
      projectInfo: globalSummaryData.projectInfo,
      details: globalSummaryData.imageResults.map(item => ({
        id: item.id,
        name: item.name,
        childName: item.childName,
        analysisTime: item.analysisTime,
        status: item.status
      }))
    };
    
    message.success('正在生成Excel文件...');
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `全局汇总报告_${projectId}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 导出为PDF（模拟）
  const exportToPDF = () => {
    message.success('正在生成PDF报告...');
    // 实际项目中需要使用pdf生成库
  };

  // 查看单张图片详情
  const viewImageDetail = (imageId) => {
    navigate(`/analysis/${projectId}/report/image/${imageId}`);
  };

  // 返回项目详情
  const goBackToProject = () => {
    navigate(`/analysis/`);
  };

  // 表格列定义 - 只保留基本信息
  const columns = [
    {
      title: '图片名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text) => <Text>{text}</Text>,
    },
    {
      title: '分析对象',
      dataIndex: 'childName',
      key: 'childName',
    },
    {
      title: '分析时间',
      dataIndex: 'analysisTime',
      key: 'analysisTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'completed' ? 'success' : 'processing'}>
          {status === 'completed' ? '已完成' : '分析中'}
        </Tag>
      )
    },
    buildActionColumn({
      width: 108,
      actions: [
        {
          key: 'view',
          label: '详情',
          icon: <EyeOutlined />,
          onClick: (record) => viewImageDetail(record.id),
          pinned: true,
        },
      ],
    }),
  ];

  return (
    <div style={{ width: '100%', height: '100%', padding: '0 24px' }}>
      {/* 顶部标题栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={goBackToProject}
          >
            返回项目
          </Button>
          <Title level={4} style={{ margin: 0 }}>全局汇总报告</Title>
        </div>
        
        <Space>
          <Select 
            value={selectedFormat} 
            onChange={setSelectedFormat}
            style={{ width: 130 }}
          >
            <Option value="csv">
              <Space>
                <FileTextOutlined />
                CSV格式
              </Space>
            </Option>
            <Option value="excel">
              <Space>
                <FileExcelOutlined />
                Excel格式
              </Space>
            </Option>
            <Option value="pdf">
              <Space>
                <FilePdfOutlined />
                PDF格式
              </Space>
            </Option>
          </Select>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出报告
          </Button>
        </Space>
      </div>

      {/* 项目信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic 
              title="项目名称" 
              value={globalSummaryData.projectInfo.name}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="分析对象数" 
              value={globalSummaryData.projectInfo.totalImages} 
              suffix="张"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="图片总数" 
              value={globalSummaryData.projectInfo.totalImages} 
              suffix="张"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="已分析" 
              value={globalSummaryData.projectInfo.analyzedImages} 
              suffix={`/ ${globalSummaryData.projectInfo.totalImages} 张`}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 数据表格 - 简洁汇总 */}
      <TableWrap>
      <Card title="全局汇总列表">
        <Table
          dataSource={globalSummaryData.imageResults}
          columns={columns}
          rowKey="id"
          scroll={{ x: TABLE_SCROLL_X }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
      </TableWrap>

      <Divider />

      {/* 操作说明 */}
      <Card size="small" type="inner" title="导出功能说明">
        <Row gutter={24}>
          <Col span={12}>
            <Text strong>CSV格式：</Text>
            <Text>纯文本逗号分隔值文件，便于导入其他统计工具</Text>
          </Col>
          <Col span={12}>
            <Text strong>Excel格式：</Text>
            <Text>Microsoft Excel文件，保留表格格式和数据类型</Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default GlobalSummaryReportPage;
