import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { API_BASE_URL } from '../../api';
import { getAuthToken } from '../../utils/session';

/**
 * 带 JWT 拉取受保护图片并展示
 */
const AuthenticatedImage = ({ datasetId, imageId, url, alt, style, className, fallback }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const imageUrl = url || `${(API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')}/datasets/${datasetId}/images/${imageId}/file`;
        const res = await fetch(imageUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('load failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (error) {
        // 静默处理 404 错误，不抛出到控制台
        if (!cancelled) setSrc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (url || (datasetId && imageId)) {
      load();
    } else {
      setLoading(false);
      setSrc(null);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, imageId, url]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }} className={className}>
        <Spin size="small" />
      </div>
    );
  }

  if (!src) {
    if (fallback) return fallback;
    return (
      <div
        style={{ background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
        className={className}
      >
        无法加载
      </div>
    );
  }

  return <img src={src} alt={alt || ''} style={style} className={className} />;
};

export default AuthenticatedImage;
