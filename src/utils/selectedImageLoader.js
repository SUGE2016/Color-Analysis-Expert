export function loadSelectedImage({ imageId, src, onLoad, onError, ImageConstructor = window.Image }) {
  let cancelled = false;
  const image = new ImageConstructor();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (!cancelled) onLoad({ imageId, image });
  };
  image.onerror = () => {
    if (!cancelled && onError) onError(imageId);
  };
  image.src = src;
  return () => {
    cancelled = true;
    image.onload = null;
    image.onerror = null;
  };
}

export function resolveSelectedImage(loadedImage, selectedImage) {
  if (!loadedImage || !selectedImage || loadedImage.imageId !== selectedImage.id) {
    return null;
  }
  return loadedImage.image || null;
}
