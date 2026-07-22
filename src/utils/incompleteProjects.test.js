import {
  dedupeIncompleteProjects,
  isTemporaryProjectId,
  reconcileIncompleteProjects,
} from './incompleteProjects';

const draft = (id, lastSaved, overrides = {}) => ({
  id,
  name: 'same project',
  lastSaved,
  selectedDatasets: [{ id: 'dataset-1' }],
  selectedTemplateImage: { id: 'template-1' },
  ...overrides,
});

test('deduplicates legacy autosaves and keeps the latest draft', () => {
  const result = dedupeIncompleteProjects([
    draft('temp-old', '2026-07-21T10:00:00Z'),
    draft('temp-new', '2026-07-21T10:01:00Z'),
  ]);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('temp-new');
});

test('removes a local draft once the backend has the same project', () => {
  const result = reconcileIncompleteProjects(
    [draft('temp-local', '2026-07-21T10:00:00Z')],
    [{ id: 'backend-1', name: 'same project' }]
  );

  expect(result).toEqual([]);
});

test('recognizes temporary project ids', () => {
  expect(isTemporaryProjectId('temp-123-abc')).toBe(true);
  expect(isTemporaryProjectId('backend-id')).toBe(false);
});
