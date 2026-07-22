const normalizeText = (value) => String(value || '').trim().toLowerCase();

const savedAt = (project) => {
  const timestamp = Date.parse(project?.lastSaved || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
export const createTemporaryProjectId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const isTemporaryProjectId = (projectId) =>
  String(projectId || '').startsWith('temp-');

export const getIncompleteProjectFingerprint = (project) => {
  const name = normalizeText(project?.name);
  if (!name) return `id:${String(project?.id || '')}`;

  const datasetIds = (project?.selectedDatasets || [])
    .map((dataset) => String(dataset?.id || ''))
    .filter(Boolean)
    .sort()
    .join(',');
  const templateId = String(project?.selectedTemplateImage?.id || '');
  return `${name}|${datasetIds}|${templateId}`;
};

export const dedupeIncompleteProjects = (projects) => {
  const latestById = new Map();
  (Array.isArray(projects) ? projects : []).forEach((project) => {
    if (!project?.id) return;
    const id = String(project.id);
    const existing = latestById.get(id);
    if (!existing || savedAt(project) >= savedAt(existing)) latestById.set(id, project);
  });

  const latestByFingerprint = new Map();
  latestById.forEach((project) => {
    const fingerprint = getIncompleteProjectFingerprint(project);
    const existing = latestByFingerprint.get(fingerprint);
    if (!existing || savedAt(project) >= savedAt(existing)) {
      latestByFingerprint.set(fingerprint, project);
    }
  });

  return Array.from(latestByFingerprint.values());
};

export const reconcileIncompleteProjects = (savedProjects, apiProjects = []) => {
  const apiIds = new Set(apiProjects.map((project) => String(project?.id || '')).filter(Boolean));
  const apiNames = new Set(apiProjects.map((project) => normalizeText(project?.name)).filter(Boolean));

  return dedupeIncompleteProjects(savedProjects).filter((project) =>
    !apiIds.has(String(project.id)) && !apiNames.has(normalizeText(project.name))
  );
};
