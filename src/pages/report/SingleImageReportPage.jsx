import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Empty, Row, Select, Space,
  Spin, Statistic, Tag, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import reportApi from '../../api/report';
import ReportRegionOverlay from '../../components/report/ReportRegionOverlay';
import {
  activeMetrics,
  dominantColor,
} from '../../utils/reportVisualization';

const { Title, Text, Paragraph } = Typography;

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

function requestMessage(error, fallback) {
  const data = error?.response?.data;
  return data?.message || (typeof data === 'string' ? data : '') || fallback;
}

function useReportImage(projectId, imageId, variant, enabled) {
  const [state, setState] = useState({ url: '', width: 0, height: 0, loading: false, error: '' });

  useEffect(() => {
    if (!projectId || !imageId || !enabled) {
      setState({ url: '', width: 0, height: 0, loading: false, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl = '';
    let active = true;
    setState({ url: '', width: 0, height: 0, loading: true, error: '' });
    reportApi.getImageFile(projectId, imageId, variant, { signal: controller.signal })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          if (!active) return;
          setState({
            url: objectUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            loading: false,
            error: '',
          });
        };
        image.onerror = () => {
          if (active) setState({ url: '', width: 0, height: 0, loading: false, error: '图片文件无法解析' });
        };
        image.src = objectUrl;
      })
      .catch((error) => {
        if (active && error?.name !== 'CanceledError') {
          setState({ url: '', width: 0, height: 0, loading: false, error: '矫正图不可用' });
        }
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, imageId, variant, enabled]);

  return state;
}

const SingleImageReportPage = () => {
  const navigate = useNavigate();
  const { projectId, imageId } = useParams();
  const [report, setReport] = useState(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    if (!projectId || !imageId) {
      setError('缺少项目 ID 或图片 ID，无法加载报告。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await reportApi.getImageReport(projectId, imageId);
      setReport(data);
      setSelectedRegionId((current) => (
        data.regions?.some((region) => region.regionId === current)
          ? current
          : data.regions?.[0]?.regionId || ''
      ));
    } catch (requestError) {
      setReport(null);
      setError(requestMessage(requestError, '单图报告加载失败，请确认分析任务已经完成。'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, imageId]);

  const image = report?.image;
  const correctedImage = useReportImage(projectId, image?.imageId, 'corrected', Boolean(image?.correctedUrl));
  const regions = useMemo(() => report?.regions || [], [report]);
  const selectedRegion = regions.find((region) => region.regionId === selectedRegionId) || regions[0];
  const colorData = activeMetrics(selectedRegion?.colorDistribution);
  const mainColorData = activeMetrics(selectedRegion?.mainColorNumber);
  const totalPixels = regions.reduce((total, region) => total + Number(region.validPixels || 0), 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportApi.exportImageReport(projectId, image.imageId);
      downloadBlob(blob, `单图分析报告-${image.fileName || image.imageId}.pdf`);
      message.success('单图 PDF 报告导出成功');
    } catch (requestError) {
      message.error(requestMessage(requestError, '单图 PDF 报告导出失败，请稍后重试。'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100%', padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/analysis/${projectId}/report`)}>返回汇总报告</Button>
          <Title level={4} style={{ margin: 0 }}>单张图片分析报告</Title>
        </Space>
        <Button type="primary" icon={<DownloadOutlined />} loading={exporting}
          disabled={!report} onClick={handleExport}>导出 PDF</Button>
      </div>

      {error && (
        <Alert type="error" showIcon title="无法加载单图报告" description={error}
          action={<Button icon={<ReloadOutlined />} onClick={loadReport}>重试</Button>}
          style={{ marginBottom: 24 }} />
      )}

      <Spin spinning={loading} description="正在加载单图报告...">
        {report ? (
          <>
            {report.legacy && (
              <Alert type="warning" showIcon title="这是旧版分析任务"
                description="部分区域轮廓可能不可用，已有数值结果仍会正常展示。"
                style={{ marginBottom: 24 }} />
            )}

            <Card title="报告信息" style={{ marginBottom: 24 }}>
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                <Descriptions.Item label="项目">{report.project?.name || report.project?.id}</Descriptions.Item>
                <Descriptions.Item label="图片">{image?.fileName}</Descriptions.Item>
                <Descriptions.Item label="数据集 ID">{image?.datasetId || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务完成时间">{report.task?.finishedAt || '-'}</Descriptions.Item>
                <Descriptions.Item label="样本编号">{image?.subjectCode || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="矫正图片与分析区域"
              extra={<Text type="secondary">点击区域查看对应处理结果</Text>}
              style={{ marginBottom: 24 }}>
              <ReportRegionOverlay imageState={correctedImage} regions={regions}
                selectedRegionId={selectedRegion?.regionId}
                onSelectRegion={setSelectedRegionId} />
            </Card>

            <Card title="整图总览" style={{ marginBottom: 24 }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={8}><Statistic title="已分析区域" value={regions.length} suffix="个" /></Col>
                <Col xs={24} sm={8}><Statistic title="区域有效像素合计" value={totalPixels} /></Col>
                <Col xs={24} sm={8}>
                  <Text type="secondary">区域主导颜色</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {regions.map((region) => {
                        const dominant = dominantColor(region.colorDistribution);
                        return <Tag color={dominant?.color} key={region.regionId}>{region.name}：{dominant?.label || '无'}</Tag>;
                      })}
                    </Space>
                  </div>
                </Col>
              </Row>
            </Card>

            <Card title="区域分析详情" style={{ marginBottom: 24 }}
              extra={<Select value={selectedRegion?.regionId} style={{ minWidth: 180 }}
                onChange={setSelectedRegionId}
                options={regions.map((region) => ({ value: region.regionId, label: region.name }))} />}>
              {selectedRegion ? (
                <>
                  <Space wrap style={{ marginBottom: 20 }}>
                    <Tag color="blue">{selectedRegion.name}</Tag>
                    <Text type="secondary">区域 ID：{selectedRegion.regionId}</Text>
                    <Text type="secondary">有效像素：{selectedRegion.validPixels}</Text>
                  </Space>
                  <Row gutter={[24, 24]}>
                    <Col xs={24} xl={12}>
                      <Card type="inner" title="颜色分布">
                        <Paragraph type="secondary">各颜色像素在该区域有效像素中的占比。</Paragraph>
                        {colorData.length ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                              <Pie data={colorData} dataKey="count" nameKey="label" innerRadius={68}
                                outerRadius={108} paddingAngle={1}>
                                {colorData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                              </Pie>
                              <Tooltip formatter={(value, _name, item) => [
                                `${value} 像素（${(Number(item.payload.ratio) * 100).toFixed(2)}%）`,
                                item.payload.label,
                              ]} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : <Empty description="暂无颜色分布数据" />}
                      </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                      <Card type="inner" title="主色像素数量">
                        <Paragraph type="secondary">落入预设主色色域的像素数量，不表示颜色种类数。</Paragraph>
                        {mainColorData.length ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={mainColorData} layout="vertical" margin={{ left: 24, right: 24 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="label" width={72} />
                              <Tooltip formatter={(value) => [`${value} 像素`, '数量']} />
                              <Bar dataKey="count">
                                {mainColorData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : <Empty description="暂无匹配的主色像素" />}
                      </Card>
                    </Col>
                  </Row>
                  <Card type="inner" title="HSV 熵值" style={{ marginTop: 24 }}>
                    <Paragraph type="secondary">分别描述色调、饱和度和明度分布的不确定性，仅作客观数值展示。</Paragraph>
                    <Row gutter={[24, 24]}>
                      {[
                        ['H 熵值（色调）', selectedRegion.entropy?.h],
                        ['S 熵值（饱和度）', selectedRegion.entropy?.s],
                        ['V 熵值（明度）', selectedRegion.entropy?.v],
                      ].map(([title, value]) => (
                        <Col xs={24} sm={8} key={title}>
                          <Statistic title={title} value={value ?? '-'} precision={typeof value === 'number' ? 4 : undefined} />
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </>
              ) : <Empty description="暂无区域结果" />}
            </Card>

            <Alert type="info" showIcon title="结果说明"
              description="本报告只呈现客观分析指标，不生成心理、教育或诊断结论；V1.0 不包含出界、面积和线条分析。" />
          </>
        ) : !loading && !error ? <Empty description="暂无单图报告数据" /> : null}
      </Spin>
    </div>
  );
};

export default SingleImageReportPage;
