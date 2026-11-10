export const maxPixelRatio = 2;

export function cappedPixelRatio(devicePixelRatio: number): number {
  return devicePixelRatio > 0 ? Math.min(maxPixelRatio, devicePixelRatio) : 1;
}

export function watchPixelRatio(onChange: (pixelRatio: number) => void): () => void {
  let query: MediaQueryList | undefined;
  const update = (): void => {
    query?.removeEventListener('change', update);
    onChange(cappedPixelRatio(window.devicePixelRatio));
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', update);
  };
  update();
  return () => query?.removeEventListener('change', update);
}
