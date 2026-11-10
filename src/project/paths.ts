export function projectPath(value: string): string {
  const raw = value.replaceAll('\\', '/');
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw))
    throw new Error(`Absolute project path: ${value}`);
  const parts: string[] = [];
  for (const part of raw.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error(`Path leaves the project: ${value}`);
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) throw new Error('A file path is required');
  return parts.join('/');
}
export const pathKey = (path: string): string => projectPath(path).toLowerCase();
export const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
export const folderName = (path: string): string =>
  path.slice(0, Math.max(0, path.lastIndexOf('/')));
export const relativeFile = (chart: string, name: string): string =>
  projectPath(`${folderName(chart)}/${name}`.replace(/^\//, ''));
export const isChartFile = (path: string): boolean => /\.(bms|bme|bml|pms|bmsc|txt)$/i.test(path);
export const isAudioFile = (path: string): boolean =>
  /\.(wav|ogg|mp3|flac|aiff?|m4a|aac|opus)$/i.test(path);
