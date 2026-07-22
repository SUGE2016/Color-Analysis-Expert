import { resolveUploadFileName } from './uploadFileName';

test('preserves the original name of a browser File', () => {
  const file = new File(['image'], 'child-01.jpg', { type: 'image/jpeg' });
  expect(resolveUploadFileName(file)).toBe('child-01.jpg');
});

test('uses the explicit name for renamed or generated uploads', () => {
  const file = new File(['image'], 'original.jpg', { type: 'image/jpeg' });
  expect(resolveUploadFileName(file, 'renamed.jpg')).toBe('renamed.jpg');
});

test('falls back only for a nameless Blob', () => {
  const blob = new Blob(['image'], { type: 'image/png' });
  expect(resolveUploadFileName(blob)).toBe('upload.png');
});
