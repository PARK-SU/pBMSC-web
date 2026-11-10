export type CssStyle = Readonly<Record<string, string | number | undefined>>;

export function styleText(style: CssStyle | undefined): string {
  if (!style) return '';
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => {
      const key = name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
      const unit = typeof value === 'number' && !['fontWeight', 'opacity', 'zIndex'].includes(name);
      return `${key}:${value}${unit ? 'px' : ''}`;
    })
    .join(';');
}
