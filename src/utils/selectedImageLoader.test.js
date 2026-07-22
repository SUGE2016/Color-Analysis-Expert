import { loadSelectedImage, resolveSelectedImage } from './selectedImageLoader';

describe('loadSelectedImage', () => {
  test('ignores an older image load after its selection is cancelled', () => {
    const instances = [];
    class MockImage {
      constructor() {
        instances.push(this);
      }
    }
    const loaded = [];
    const cancelA = loadSelectedImage({
      imageId: 'A',
      src: 'blob:a',
      onLoad: ({ imageId }) => loaded.push(imageId),
      ImageConstructor: MockImage,
    });
    cancelA();
    loadSelectedImage({
      imageId: 'B',
      src: 'blob:b',
      onLoad: ({ imageId }) => loaded.push(imageId),
      ImageConstructor: MockImage,
    });

    expect(instances[0].onload).toBeNull();
    instances[1].onload();
    expect(loaded).toEqual(['B']);
  });

  test('reports the id belonging to the loaded image', () => {
    let instance;
    class MockImage {
      constructor() {
        instance = this;
      }
    }
    const onLoad = jest.fn();
    loadSelectedImage({ imageId: 'image-2', src: 'blob:2', onLoad, ImageConstructor: MockImage });
    instance.onload();
    expect(onLoad.mock.calls[0][0].imageId).toBe('image-2');
    expect(onLoad.mock.calls[0][0].image).toBe(instance);
  });
});

describe('resolveSelectedImage', () => {
  test.each([
    [null, null],
    [null, { id: 'A' }],
    [{ imageId: 'A', image: {} }, null],
    [{ imageId: 'A', image: {} }, { id: 'B' }],
    [{ imageId: 'A', image: null }, { id: 'A' }],
  ])('returns null unless both records exist and refer to a loaded image', (loadedImage, selectedImage) => {
    expect(resolveSelectedImage(loadedImage, selectedImage)).toBeNull();
  });

  test('returns the image when the loaded and selected image ids match', () => {
    const image = { naturalWidth: 100, naturalHeight: 80 };
    expect(resolveSelectedImage({ imageId: 'A', image }, { id: 'A' })).toBe(image);
  });
});
