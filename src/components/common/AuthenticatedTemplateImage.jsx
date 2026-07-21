import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getAuthToken } from '../../utils/session';
import { templateApi } from '../../api/template';

const AuthenticatedTemplateImage = ({ templateId, alt, style, className }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const res = await fetch(templateApi.getTemplateImageUrl(templateId), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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

    if (templateId) load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [templateId]);

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
        无预览
      </div>
    );
  }

  return <img src={src} alt={alt || ''} style={style} className={className} />;
};

export default AuthenticatedTemplateImage;
