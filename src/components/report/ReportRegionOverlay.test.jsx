import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReportRegionOverlay from './ReportRegionOverlay';

jest.mock('antd', () => ({
  Empty: ({ description }) => <div>{description}</div>,
  Spin: ({ description }) => <div>{description}</div>,
}));

const regions = [
  {
    regionId: 'region-1',
    name: '区域1',
    polygon: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }],
  },
  {
    regionId: 'region-2',
    name: '区域2',
    polygon: [{ x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }],
  },
];

const imageState = {
  url: 'blob:test-image',
  width: 800,
  height: 400,
  loading: false,
  error: '',
};

test('clicking a polygon selects its report region', () => {
  const onSelectRegion = jest.fn();
  render(
    <ReportRegionOverlay
      imageState={imageState}
      regions={regions}
      selectedRegionId="region-1"
      onSelectRegion={onSelectRegion}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: '查看区域2分析结果' }));

  expect(onSelectRegion).toHaveBeenCalledWith('region-2');
});

test.each(['Enter', ' '])('keyboard %p selects the focused region', (key) => {
  const onSelectRegion = jest.fn();
  render(
    <ReportRegionOverlay
      imageState={imageState}
      regions={regions}
      selectedRegionId="region-1"
      onSelectRegion={onSelectRegion}
    />
  );

  fireEvent.keyDown(screen.getByRole('button', { name: '查看区域2分析结果' }), { key });

  expect(onSelectRegion).toHaveBeenCalledWith('region-2');
});

test('legacy regions without polygons remain absent from the image controls', () => {
  render(
    <ReportRegionOverlay
      imageState={imageState}
      regions={[{ regionId: 'legacy', name: '旧区域', polygon: [] }]}
      selectedRegionId="legacy"
      onSelectRegion={jest.fn()}
    />
  );

  expect(screen.queryByRole('button', { name: '查看旧区域分析结果' })).not.toBeInTheDocument();
});
