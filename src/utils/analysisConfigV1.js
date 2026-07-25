export const V1_ANALYSIS_METHOD = 'color_distribution';
const REMOVED_METHODS = new Set(['boundary_check', 'line_feature']);

export const sanitizeAnalysisConfigV1 = (config = {}, validImageIds, validRegionIds) => {
  const imageSet = validImageIds ? new Set(validImageIds) : null;
  const regionSet = validRegionIds ? new Set(validRegionIds) : null;
  const sanitized = {};
  let changed = false;

  Object.entries(config || {}).forEach(([imageId, regionConfig]) => {
    if (imageSet && !imageSet.has(imageId)) {
      changed = true;
      return;
    }
    if (!regionConfig || typeof regionConfig !== 'object' || Array.isArray(regionConfig)) {
      changed = true;
      return;
    }
    const nextRegions = {};
    Object.entries(regionConfig).forEach(([regionId, methods]) => {
      if (regionSet && !regionSet.has(regionId)) {
        changed = true;
        return;
      }
      const original = Array.isArray(methods) ? methods : [];
      const next = original.includes(V1_ANALYSIS_METHOD) ? [V1_ANALYSIS_METHOD] : [];
      if (!Array.isArray(methods)
          || original.length !== next.length
          || original.some((method) => REMOVED_METHODS.has(method) || method !== V1_ANALYSIS_METHOD)) {
        changed = true;
      }
      nextRegions[regionId] = next;
    });
    if (Object.keys(nextRegions).length > 0) sanitized[imageId] = nextRegions;
    else if (Object.keys(regionConfig).length > 0) changed = true;
  });
  return { config: sanitized, changed };
};

export const normalizeAnalysisConfigV1 = (config = {}) => {
  const normalized = {};
  Object.entries(config || {}).forEach(([imageId, regions]) => {
    if (!regions || typeof regions !== 'object' || Array.isArray(regions)) return;
    const selected = {};
    Object.entries(regions).forEach(([regionId, methods]) => {
      if (Array.isArray(methods) && methods.includes(V1_ANALYSIS_METHOD)) {
        selected[regionId] = [V1_ANALYSIS_METHOD];
      }
    });
    if (Object.keys(selected).length > 0) normalized[imageId] = selected;
  });
  return normalized;
};

export const findIncompleteSelection = (config = {}) => {
  for (const [imageId, regions] of Object.entries(config || {})) {
    for (const [regionId, methods] of Object.entries(regions || {})) {
      if (!Array.isArray(methods) || !methods.includes(V1_ANALYSIS_METHOD)) {
        return { imageId, regionId };
      }
    }
  }
  return null;
};
