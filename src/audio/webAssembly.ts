export function hasWebAssembly(): boolean {
  return typeof WebAssembly !== 'undefined';
}
