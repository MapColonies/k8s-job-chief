export const flattenLabels = (labels: Record<string, string>): string => {
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
};
