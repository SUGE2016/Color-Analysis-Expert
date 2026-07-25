import React from 'react';
import { Empty, Spin } from 'antd';
import { normalizedPolygonPoints } from '../../utils/reportVisualization';

const ReportRegionOverlay = ({
  imageState,
  regions,
  selectedRegionId,
  onSelectRegion,
}) => {
  if (imageState.loading) return <Spin description="正在加载矫正图片..." />;
  if (!imageState.url) return <Empty description={imageState.error || '矫正图片不可用'} />;

  return (
    <svg
      role="img"
      aria-label="矫正图片及分析区域"
      viewBox={`0 0 ${imageState.width} ${imageState.height}`}
      style={{ width: '100%', maxHeight: 560, display: 'block', background: '#f5f5f5' }}
    >
      <image href={imageState.url} width={imageState.width} height={imageState.height} />
      {regions.map((region) => {
        const selected = region.regionId === selectedRegionId;
        const points = normalizedPolygonPoints(
          region.polygon,
          imageState.width,
          imageState.height
        );
        if (!points) return null;
        const selectRegion = () => onSelectRegion(region.regionId);
        return (
          <polygon
            key={region.regionId}
            points={points}
            role="button"
            tabIndex={0}
            aria-label={`查看${region.name || region.regionId}分析结果`}
            aria-pressed={selected}
            fill={selected ? 'rgba(22,119,255,0.22)' : 'rgba(255,255,255,0.03)'}
            stroke={selected ? '#0958d9' : 'rgba(255,255,255,0.82)'}
            strokeWidth={selected ? 4 : 2}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'pointer', outline: 'none' }}
            onClick={selectRegion}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectRegion();
              }
            }}
          >
            <title>{region.name || region.regionId}</title>
          </polygon>
        );
      })}
    </svg>
  );
};

export default ReportRegionOverlay;
