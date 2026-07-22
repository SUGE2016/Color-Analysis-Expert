export const resolveUploadFileName = (file, explicitFileName) => {
  const candidate = explicitFileName || file?.name;
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : 'upload.png';
};
