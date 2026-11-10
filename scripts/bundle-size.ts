import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { base } from '../vite.config.ts';

export function initialScripts(html: string, basePath: string): string[] {
  const paths: string[] = [];
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
    const url = tag.startsWith('<script')
      ? attr('type') === 'module'
        ? attr('src')
        : undefined
      : attr('rel') === 'modulepreload'
        ? attr('href')
        : undefined;
    if (url === undefined) continue;
    if (!url.startsWith(basePath)) throw new Error(`Script outside ${basePath}: ${url}`);
    paths.push(url.slice(basePath.length));
  }
  return paths;
}

function main(): void {
  const dist = join(import.meta.dirname, '..', 'dist');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const rows = initialScripts(html, base).map((path) => {
    const bytes = readFileSync(join(dist, path));
    return { path, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
  });
  const total = rows.reduce((sum, row) => sum + row.gzip, 0);
  const size = (bytes: number) => `${bytes.toLocaleString('en-US')} B`;

  console.log(`Initial JS: ${size(total)} gzip`);
  for (const row of rows) {
    console.log(`  ${row.path}: ${size(row.raw)} raw, ${size(row.gzip)} gzip`);
  }

  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) {
    const lines = [
      `### Initial JS: ${size(total)} gzip`,
      '',
      '| File | Raw | Gzip |',
      '| --- | ---: | ---: |',
      ...rows.map((row) => `| ${row.path} | ${size(row.raw)} | ${size(row.gzip)} |`),
      '',
    ];
    appendFileSync(summary, lines.join('\n'));
  }
}

if (import.meta.main) main();
