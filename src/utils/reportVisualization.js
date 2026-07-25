export function normalizedPolygonPoints(polygon = [], width = 0, height = 0) {
  if (!Array.isArray(polygon) || width <= 0 || height <= 0) return '';
  return polygon
    .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
    .map((point) => `${Number(point.x) * width},${Number(point.y) * height}`)
    .join(' ');
}

export function dominantColor(items = []) {
  return items
    .filter((item) => item?.key !== 'uncategorized' && Number(item?.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))[0] || null;
}

export function activeMetrics(items = []) {
  return items.filter((item) => Number(item?.count) > 0);
}
