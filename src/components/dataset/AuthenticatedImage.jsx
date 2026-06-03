import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getAuthToken } from '../../utils/session';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 带 JWT 拉取受保护图片并展示
 */
const AuthenticatedImage = ({ datasetId, imageId, alt, style, className }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const res = await fetch(
          `${API_BASE}/datasets/${datasetId}/images/${imageId}/file`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) throw new Error('load failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (datasetId && imageId) load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, imageId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }} className={className}>
        <Spin size="small" />
      </div>
    );
  }

  if (!src) {
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
