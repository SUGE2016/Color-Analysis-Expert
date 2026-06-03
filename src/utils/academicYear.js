/**
 * 从分组/数据集列表中提取不重复学年（降序）
 * @param {...Array} lists - 含 academicYear 字段的对象数组
 */
export function extractAcademicYears(...lists) {
  const years = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const y = item?.academicYear ?? item?.year;
      if (y == null || y === '') continue;
      const n = Number(y);
      if (!Number.isNaN(n) && n > 1900 && n < 2200) {
        years.add(n);
      }
    }
  }
  return [...years].sort((a, b) => b - a);
}

/** 筛选条选项：['all', 2025, 2024, ...] */
export function buildYearFilterOptions(years) {
  return ['all', ...years];
}
