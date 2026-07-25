import {
  activeMetrics,
  dominantColor,
  normalizedPolygonPoints,
} from './reportVisualization';

test('normalized polygon uses the image natural dimensions', () => {
  expect(normalizedPolygonPoints(
    [{ x: 0.25, y: 0.5 }, { x: 1, y: 0 }],
    800,
    400
  )).toBe('200,200 800,0');
});

test('dominant color ignores uncategorized pixels', () => {
  expect(dominantColor([
    { key: 'uncategorized', count: 900 },
    { key: 'blue', label: '蓝色', count: 80 },
    { key: 'red', label: '红色', count: 20 },
  ])?.key).toBe('blue');
});

test('active metrics remove zero-value chart entries', () => {
  expect(activeMetrics([{ key: 'red', count: 0 }, { key: 'blue', count: 3 }]))
    .toEqual([{ key: 'blue', count: 3 }]);
});
