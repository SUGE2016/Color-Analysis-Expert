import {
  findIncompleteSelection,
  normalizeAnalysisConfigV1,
  sanitizeAnalysisConfigV1,
} from './analysisConfigV1';

test('normalization excludes unconfigured images and empty regions', () => {
  expect(normalizeAnalysisConfigV1({
    imageA: { region1: ['color_distribution'], region2: [] },
    imageB: {},
  })).toEqual({ imageA: { region1: ['color_distribution'] } });
});

test('legacy unsupported methods are removed and reported', () => {
  const result = sanitizeAnalysisConfigV1({
    imageA: {
      region1: ['color_distribution', 'boundary_check'],
      region2: ['boundary_check'],
    },
  });
  expect(result.changed).toBe(true);
  expect(result.config).toEqual({
    imageA: { region1: ['color_distribution'], region2: [] },
  });
});

test('selected region without color distribution is incomplete', () => {
  expect(findIncompleteSelection({ imageA: { region2: [] } }))
    .toEqual({ imageId: 'imageA', regionId: 'region2' });
});
