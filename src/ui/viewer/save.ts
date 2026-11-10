export const saveFileTypes = [
  ['_bms', 'Supported BMS Format (*.bms, *.bme, *.bml, *.pms, *.txt)'],
  ['BMS', 'Be-Music Script (*.bms)'],
  ['BME', 'Be-Music Extended Format (*.bme)'],
  ['BML', 'Be-Music Longnote Format (*.bml)'],
  ['PMS', 'Po-Mu Script (*.pms)'],
  ['TXT', 'Text document (*.txt)'],
  ['_all', 'All files (*.*)'],
] as const;

export type SaveFileType = (typeof saveFileTypes)[number][0];

export function saveFileName(name: string, type: SaveFileType): string {
  if (name.trim() === '' || type === '_all') return name;
  const extension = type === '_bms' ? 'bms' : type.toLowerCase();
  if (
    (type === '_bms' && /\.[^./\\]+$/.test(name)) ||
    name.toLowerCase().endsWith(`.${extension}`)
  )
    return name;
  return `${name.replace(/\.(bms|bme|bml|pms|bmsc|txt)?$/i, '')}.${extension}`;
}

export function downloadFile(bytes: Uint8Array, fileName: string): void {
  downloadBlob(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }),
    fileName,
  );
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
