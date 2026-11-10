export const dotNetSpace =
  '[\\t-\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';

export const dotNetAny = '[^\\n]';

export const dotNetEnd = '(?=\\n?$)';


export const dotNetAlnumIgnoreCase = '[0-9A-Za-z\\u0130\\u212a]';

export function dotNetIgnoreCase(literal: string): string {
  let pattern = '';
  for (let i = 0; i < literal.length; i++) {
    const c = literal.charAt(i);
    if (/[A-Za-z]/.test(c)) {
      const lower = c.toLowerCase();
      const extra = lower === 'i' ? '\\u0130' : lower === 'k' ? '\\u212a' : '';
      pattern += `[${c.toUpperCase()}${lower}${extra}]`;
    } else {
      pattern += c.replace(/[\\^$.*+?()[\]{}|/]/, '\\$&');
    }
  }
  return pattern;
}
