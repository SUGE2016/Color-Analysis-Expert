import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Row, Select, Space, Spin,
  Statistic, Table, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, EyeOutlined, FileExcelOutlined,
  FilePdfOutlined, FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import reportApi from '../../api/report';
import TableWrap from '../../components/table/TableWrap';
import { buildActionColumn, TABLE_SCROLL_X } from '../../utils/tableColumns';

const { Title, Text } = Typography;
const SECTION_KEYS = ['mainColor', 'mainColorNumber', 'entropy', 'edgeColor'];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const GlobalSummaryReportPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    if (!projectId) {
      setError('缺少项目 ID，无法加载报告。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await reportApi.getProjectSummaryReport(projectId));
    } catch (requestError) {
      setReport(null);
      setError(requestError?.response?.data || '报告加载失败，请确认项目已有成功的分析任务。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const imageRows = useMemo(() => {
    const rowsByImage = new Map();
    const preview = report?.preview || {};
    SECTION_KEYS.forEach((sectionKey) => {
      const sectionRows = Array.isArray(preview[sectionKey]) ? preview[sectionKey] : [];
      sectionRows.forEach((row) => {
        const imageName = row?.image_name;
        if (!imageName) return;
        if (!rowsByImage.has(imageName)) {
          rowsByImage.set(imageName, {
            key: imageName, imageName, mainColor: 0,
            mainColorNumber: 0, entropy: 0, edgeColor: 0,
          });
        }
        rowsByImage.get(imageName)[sectionKey] += 1;
      });
    });
    return Array.from(rowsByImage.values()).sort((a, b) =>
      a.imageName.localeCompare(b.imageName, 'zh-CN')
    );
  }, [report]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportApi.exportProjectReport(projectId, selectedFormat);
      downloadBlob(blob, `project-report-${projectId}.${selectedFormat}`);
      message.success(`${selectedFormat.toUpperCase()} 报告导出成功`);
    } catch (_requestError) {
      message.error('报告导出失败，请稍后重试。');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: '图片名称', dataIndex: 'imageName', key: 'imageName', ellipsis: true },
    { title: '主色行数', dataIndex: 'mainColor', key: 'mainColor', width: 110 },
    { title: '主色数量行数', dataIndex: 'mainColorNumber', key: 'mainColorNumber', width: 130 },
    { title: '熵值行数', dataIndex: 'entropy', key: 'entropy', width: 110 },
    { title: '边缘颜色行数', dataIndex: 'edgeColor', key: 'edgeColor', width: 130 },
    buildActionColumn({
      width: 108,
      actions: [{
        key: 'view', label: '详情', icon: <EyeOutlined />, pinned: true,
        onClick: (record) => navigate(
          `/analysis/${projectId}/report/image/${encodeURIComponent(record.imageName)}`
        ),
      }],
    }),
  ];

  const stats = report?.stats || {};
  const availableFiles = report?.availableFiles || {};

  return (
    <div style={{ width: '100%', minHeight: '100%', padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analysis')}>返回项目</Button>
          <Title level={4} style={{ margin: 0 }}>项目汇总报告</Title>
        </Space>
        <Space wrap>
          <Select
            aria-label="导出格式" value={selectedFormat} onChange={setSelectedFormat}
            style={{ width: 140 }}
            options={[
              { value: 'csv', label: <Space><FileTextOutlined />CSV</Space> },
              { value: 'xlsx', label: <Space><FileExcelOutlined />Excel</Space> },
              { value: 'pdf', label: <Space><FilePdfOutlined />PDF</Space> },
            ]}
          />
          <Button type="primary" icon={<DownloadOutlined />} loading={exporting} disabled={!report} onClick={handleExport}>
            导出项目报告
          </Button>
        </Space>
      </div>

      {error && (
        <Alert type="error" showIcon message="无法加载报告" description={String(error)}
          action={<Button icon={<ReloadOutlined />} onClick={loadReport}>重试</Button>}
          style={{ marginBottom: 24 }} />
      )}

      <Spin spinning={loading} description="正在加载真实报告数据...">
        {report ? (
          <>
            <Card style={{ marginBottom: 24 }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} lg={6}><Statistic title="图片总数" value={stats.imageCount || 0} suffix="张" /></Col>
                <Col xs={24} sm={12} lg={6}><Statistic title="主色数据" value={stats.mainColorRows || 0} suffix="行" /></Col>
                <Col xs={24} sm={12} lg={6}><Statistic title="熵值数据" value={stats.entropyRows || 0} suffix="行" /></Col>
                <Col xs={24} sm={12} lg={6}><Statistic title="边缘颜色数据" value={stats.edgeColorRows || 0} suffix="行" /></Col>
              </Row>
            </Card>

            <Card title="报告信息" style={{ marginBottom: 24 }}>
              <Row gutter={[24, 16]}>
                <Col xs={24} lg={8}><Text type="secondary">项目 ID：</Text><Text copyable>{report.projectId}</Text></Col>
                <Col xs={24} lg={8}><Text type="secondary">任务 ID：</Text><Text copyable>{report.taskId}</Text></Col>
                <Col xs={24} lg={8}><Text type="secondary">任务时间：</Text><Text>{report.taskCreatedAt || '-'}</Text></Col>
                <Col span={24}><Text type="secondary">可用结果文件：</Text><Text>{Object.keys(availableFiles).length ? Object.keys(availableFiles).join('、') : '无'}</Text></Col>
              </Row>
            </Card>

            <TableWrap>
              <Card title="图片结果预览">
                <Table dataSource={imageRows} columns={columns} rowKey="imageName"
                  scroll={{ x: TABLE_SCROLL_X }} pagination={{ pageSize: 10, showSizeChanger: false }}
                  locale={{ emptyText: <Empty description="报告预览中暂无图片数据" /> }} />
                <Text type="secondary">此处展示接口返回的预览数据（每类最多 20 行）；完整数据请使用上方导出功能。</Text>
              </Card>
            </TableWrap>
          </>
        ) : !loading && !error ? <Empty description="暂无报告数据" /> : null}
      </Spin>
    </div>
  );
};

export default GlobalSummaryReportPage;
