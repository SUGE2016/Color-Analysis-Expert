import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Row, Select, Space, Spin,
  Statistic, Table, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined,
  FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import reportApi from '../../api/report';
import TableWrap from '../../components/table/TableWrap';
import { TABLE_SCROLL_X } from '../../utils/tableColumns';

const { Title, Text } = Typography;
const SECTION_CONFIG = [
  { key: 'mainColor', title: '主色分析' },
  { key: 'mainColorNumber', title: '主色数量分析' },
  { key: 'entropy', title: '图像熵分析' },
  { key: 'edgeColor', title: '边缘颜色分析' },
];

function safeDecode(value = '') {
  try { return decodeURIComponent(value); } catch (_error) { return value; }
}

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

function renderCell(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '-';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

const SingleImageReportPage = () => {
  const navigate = useNavigate();
  const { projectId, imageName: imageNameParam } = useParams();
  const imageName = useMemo(() => safeDecode(imageNameParam), [imageNameParam]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    if (!projectId || !imageName) {
      setError('缺少项目 ID 或图片名称，无法加载报告。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await reportApi.getImageReport(projectId, imageName));
    } catch (requestError) {
      setReport(null);
      setError(requestError?.response?.data || '单图报告加载失败，请确认图片名称和分析结果。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, imageName]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportApi.exportProjectReport(projectId, exportFormat);
      downloadBlob(blob, `project-report-${projectId}.${exportFormat}`);
      message.success(`${exportFormat.toUpperCase()} 项目报告导出成功`);
    } catch (_requestError) {
      message.error('项目报告导出失败，请稍后重试。');
    } finally {
      setExporting(false);
    }
  };

  const sections = report?.sections || {};
  const totalRows = SECTION_CONFIG.reduce((sum, section) =>
    sum + (Array.isArray(sections[section.key]) ? sections[section.key].length : 0), 0);
  const buildColumns = (rows) => Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))))
    .map((key) => ({ title: key, dataIndex: key, key, ellipsis: true, render: renderCell }));

  return (
    <div style={{ width: '100%', minHeight: '100%', padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/analysis/${projectId}/report`)}>返回汇总报告</Button>
          <Title level={4} style={{ margin: 0 }}>单张图片分析报告</Title>
        </Space>
        <Space wrap>
          <Select aria-label="导出格式" value={exportFormat} onChange={setExportFormat} style={{ width: 130 }}
            options={[
              { value: 'csv', label: <Space><FileTextOutlined />CSV</Space> },
              { value: 'pdf', label: <Space><FilePdfOutlined />PDF</Space> },
            ]} />
          <Button type="primary" icon={<DownloadOutlined />} loading={exporting} disabled={!report} onClick={handleExport}>
            导出项目报告
          </Button>
        </Space>
      </div>

      {error && (
        <Alert type="error" showIcon message="无法加载单图报告" description={String(error)}
          action={<Button icon={<ReloadOutlined />} onClick={loadReport}>重试</Button>}
          style={{ marginBottom: 24 }} />
      )}

      <Spin spinning={loading} description="正在加载真实单图报告数据...">
        {report ? (
          <>
            <Card style={{ marginBottom: 24 }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={8}><Text type="secondary">图片名称</Text><div><Text strong copyable>{report.imageName}</Text></div></Col>
                <Col xs={24} lg={8}><Text type="secondary">项目 ID</Text><div><Text copyable>{report.projectId}</Text></div></Col>
                <Col xs={24} lg={8}><Text type="secondary">任务 ID</Text><div><Text copyable>{report.taskId}</Text></div></Col>
              </Row>
            </Card>

            <Card title="数据概览" style={{ marginBottom: 24 }}>
              <Row gutter={[24, 24]}>
                {SECTION_CONFIG.map((section) => (
                  <Col xs={24} sm={12} lg={6} key={section.key}>
                    <Statistic title={section.title}
                      value={Array.isArray(sections[section.key]) ? sections[section.key].length : 0} suffix="行" />
                  </Col>
                ))}
              </Row>
            </Card>

            {SECTION_CONFIG.map((section) => {
              const rows = Array.isArray(sections[section.key]) ? sections[section.key] : [];
              return (
                <TableWrap key={section.key}>
                  <Card title={section.title} style={{ marginBottom: 24 }}>
                    <Table dataSource={rows.map((row, index) => ({ ...row, __rowKey: `${section.key}-${index}` }))}
                      columns={buildColumns(rows)} rowKey="__rowKey" scroll={{ x: TABLE_SCROLL_X }}
                      pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="此项暂无数据" /> }} size="small" />
                  </Card>
                </TableWrap>
              );
            })}

            {totalRows === 0 && <Alert type="info" showIcon message="该图片存在于报告中，但四类分析结果均为空。" />}
          </>
        ) : !loading && !error ? <Empty description="暂无单图报告数据" /> : null}
      </Spin>
    </div>
  );
};

export default SingleImageReportPage;
