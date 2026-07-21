import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, InputNumber, Space, Spin, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { logsApi } from '../../api/logs';
import listPage from '../../styles/list-page.module.css';

const { Text, Title } = Typography;

export default function BackendLogsPage() {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState(300);
  const [payload, setPayload] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await logsApi.getBackendLogs(lines);
      setPayload(data);
      if (!data?.available) {
        message.warning(data?.message || '后端日志暂不可用');
      }
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '后端日志加载失败');
    } finally {
      setLoading(false);
    }
  }, [lines]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const logText = Array.isArray(payload?.lines) ? payload.lines.join('\n') : '';

  return (
    <div className={listPage.page}>
      <header className={listPage.header}>
        <div className={listPage.headerMain}>
          <div className={listPage.titleRow}>
            <Title level={4} className={listPage.pageTitle}>后端日志</Title>
            {payload?.path && <span className={listPage.pageMeta}>{payload.path}</span>}
          </div>
        </div>
        <div className={listPage.headerActions}>
          <Space>
            <Text type="secondary">行数</Text>
            <InputNumber min={1} max={2000} value={lines} onChange={(value) => setLines(value || 300)} />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadLogs}>
              刷新
            </Button>
          </Space>
        </div>
      </header>

      {payload && !payload.available && (
        <Alert type="warning" showIcon message={payload.message || '日志不可用'} style={{ marginBottom: 16 }} />
      )}

      <Card>
        {loading && !payload ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <pre style={{
            minHeight: 420,
            maxHeight: 'calc(100vh - 260px)',
            overflow: 'auto',
            margin: 0,
            padding: 16,
            background: '#111827',
            color: '#e5e7eb',
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            {logText || '暂无日志内容'}
          </pre>
        )}
      </Card>
    </div>
  );
}
