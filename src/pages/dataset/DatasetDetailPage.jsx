import React, { useCallback, useEffect, useState } from 'react';
import {
  Typography, Button, Upload, Modal, message, Empty, Spin, Space, Tag
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined, InboxOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { colors } from '../../components/common/constants';
import listPage from '../../styles/list-page.module.css';
import { datasetApi } from '../../api/dataset';
import { datasetGroupApi } from '../../api/datasetGroup';
import AuthenticatedImage from '../../components/dataset/AuthenticatedImage';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const DatasetDetailPage = () => {
  const { groupId, datasetId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [duplicateModal, setDuplicateModal] = useState({ visible: false, file: null });

  const loadImages = useCallback(async () => {
    const list = await datasetApi.getDatasetImages(datasetId);
    setImages(Array.isArray(list) ? list : []);
  }, [datasetId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ds, grp] = await Promise.all([
        datasetApi.getDatasetDetail(datasetId),
        groupId ? datasetGroupApi.getGroup(groupId).catch(() => null) : Promise.resolve(null),
      ]);
      setDataset(ds);
      setGroupName(grp?.name || '');
      await loadImages();
    } catch {
      message.error('加载数据集失败');
    } finally {
      setLoading(false);
    }
  }, [datasetId, groupId, loadImages]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const goBack = () => navigate(`/dataset/group/${groupId}`);

  const handleUpload = async ({ file, onSuccess, onError }) => {
    const existingImage = images.find(img => img.fileName === file.name);
    
    if (existingImage) {
      setDuplicateModal({ visible: true, file, onSuccess, onError });
      return;
    }
    
    await performUpload(file, onSuccess, onError);
  };

  const handleDuplicateAction = async (action) => {
    const { file, onSuccess, onError } = duplicateModal;
    setDuplicateModal({ visible: false, file: null, onSuccess: null, onError: null });
    
    if (action === 'skip') {
      return;
    }
    
    if (action === 'rename') {
      const existingNames = images.map(img => img.fileName);
      const newFileName = generateUniqueFileName(file.name, existingNames);
      const renamedFile = new File([file], newFileName, { type: file.type });
      await performUpload(renamedFile, onSuccess, onError);
      return;
    }
    
    if (action === 'overwrite') {
      await performUpload(file, onSuccess, onError, true);
      return;
    }
  };

  const generateUniqueFileName = (fileName, existingNames) => {
    const nameParts = fileName.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop() : '';
    const baseName = nameParts.join('.');
    
    let counter = 1;
    let newName = fileName;
    
    while (existingNames.includes(newName)) {
      newName = `${baseName} (${counter}).${ext}`;
      counter++;
    }
    
    return newName;
  };

  const performUpload = async (file, onSuccess, onError, overwrite = false) => {
    setUploading(true);
    try {
      await datasetApi.uploadDatasetImage(datasetId, file, { overwrite });
      onSuccess?.();
      await loadImages();
      const ds = await datasetApi.getDatasetDetail(datasetId);
      setDataset(ds);
      message.success(`${file.name} 上传成功`);
    } catch (e) {
      onError?.(e);
      message.error(`${file.name} 上传失败`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOne = (imageId) => {
    Modal.confirm({
      title: '删除作品',
      content: '确定删除该图片？不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await datasetApi.deleteDatasetImage(datasetId, imageId);
        message.success('已删除');
        setSelectedIds((ids) => ids.filter((id) => id !== imageId));
        await loadImages();
        const ds = await datasetApi.getDatasetDetail(datasetId);
        setDataset(ds);
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定删除 ${selectedIds.length} 张图片？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        for (const id of selectedIds) {
          await datasetApi.deleteDatasetImage(datasetId, id);
        }
        message.success('批量删除完成');
        setSelectedIds([]);
        await loadImages();
        const ds = await datasetApi.getDatasetDetail(datasetId);
        setDataset(ds);
      },
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === images.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(images.map(img => img.id));
    }
  };

  if (loading) {
    return (
      <div className={listPage.page} style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className={listPage.page}>
        <Empty description="数据集不存在" />
        <Button type="link" onClick={goBack}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className={listPage.page}>
      <header className={listPage.header}>
        <div className={listPage.headerMain}>
          <button type="button" className={listPage.backBtn} onClick={goBack}>
            <ArrowLeftOutlined />
            <span>返回数据集</span>
          </button>
          <div className={listPage.titleRow}>
            <Title level={4} className={listPage.pageTitle}>{dataset.name}</Title>
            <span className={listPage.pageMeta}>
              {groupName && `${groupName} · `}
              共 {dataset.fileCount ?? images.length} 张作品
            </span>
          </div>
          {dataset.scene && <Tag color="blue">{dataset.scene}</Tag>}
        </div>
        <div className={listPage.headerActions}>
          {images.length > 0 && (
            <Button onClick={toggleSelectAll}>
              {selectedIds.length === images.length ? '取消全选' : '全选'}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              删除选中 ({selectedIds.length})
            </Button>
          )}
        </div>
      </header>

      <section style={{ marginBottom: 24 }}>
        <Dragger
          multiple
          accept=".jpg,.jpeg,.png"
          showUploadList={false}
          customRequest={({ file, onSuccess, onError }) => handleUpload({ file, onSuccess, onError })}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: colors.primary, fontSize: 40 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽上传 JPG/PNG（单张 ≤10MB）</p>
        </Dragger>
      </section>

      {images.length === 0 ? (
        <Empty description="暂无作品，请上传图片" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
          }}
        >
          {images.map((img) => {
            const selected = selectedIds.includes(img.id);
            return (
              <div
                key={img.id}
                style={{
                  border: selected ? `2px solid ${colors.primary}` : '1px solid #eee',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <div onClick={() => setPreviewId(img.id)}>
                  <AuthenticatedImage
                    datasetId={datasetId}
                    imageId={img.id}
                    alt={img.fileName}
                    style={{ width: '100%', height: 140, objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <Text ellipsis style={{ fontSize: 12, display: 'block' }}>
                    {img.fileName || img.label || '未命名'}
                  </Text>
                  {img.subjectCode && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      编号 {img.subjectCode}
                    </Text>
                  )}
                  <Space size={4} style={{ marginTop: 6 }}>
                    <Button
                      size="small"
                      type={selected ? 'primary' : 'default'}
                      onClick={() => toggleSelect(img.id)}
                    >
                      {selected ? '已选' : '选择'}
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteOne(img.id)}
                    />
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!previewId}
        footer={null}
        width="80%"
        centered
        onCancel={() => setPreviewId(null)}
        destroyOnClose
      >
        {previewId && (
          <AuthenticatedImage
            datasetId={datasetId}
            imageId={previewId}
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}
      </Modal>

      <Modal
        title="检测到同名文件"
        open={duplicateModal.visible}
        onCancel={() => setDuplicateModal({ visible: false, file: null, onSuccess: null, onError: null })}
        footer={null}
        centered
      >
        <p>检测到同名文件 {duplicateModal.file?.name}，请选择操作：</p>
        <Space style={{ marginTop: 16 }}>
          <Button onClick={() => handleDuplicateAction('skip')}>
            跳过
          </Button>
          <Button onClick={() => handleDuplicateAction('rename')}>
            重命名
          </Button>
          <Button type="primary" danger onClick={() => handleDuplicateAction('overwrite')}>
            覆盖
          </Button>
        </Space>
      </Modal>
    </div>
  );
};

export default DatasetDetailPage;
