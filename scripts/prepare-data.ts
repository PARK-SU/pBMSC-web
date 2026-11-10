import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export function themeXmlToUtf8(bytes: Uint8Array): string {
  if (bytes[0] !== 0xff || bytes[1] !== 0xfe) {
    throw new Error('Theme XML must start with a UTF-16LE byte order mark');
  }
  const text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  return text.replace(/^(<\?xml[^>]*?\bencoding=)(["'])utf-16\2/i, '$1$2utf-8$2');
}

function main(): void {
  const root = join(import.meta.dirname, '..');
  const source = join(root, 'data');
  const target = join(root, 'public', 'data');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const vendor = join(root, 'public/vendor/codec-parser');
  mkdirSync(vendor, { recursive: true });
  cpSync(join(root, 'node_modules/codec-parser/src'), join(vendor, 'src'), { recursive: true });
  for (const name of ['index.js', 'LICENSE', 'package.json'])
    copyFileSync(join(root, 'node_modules/codec-parser', name), join(vendor, name));
  copyFileSync(join(root, 'THIRD-PARTY-NOTICES.txt'), join(root, 'public/vendor/NOTICE.txt'));

  let themes = 0;
  let languages = 0;
  let images = 0;
  for (const name of readdirSync(source).sort()) {
    if (name.endsWith('.Theme.xml')) {
      writeFileSync(join(target, name), themeXmlToUtf8(readFileSync(join(source, name))));
      themes++;
    } else if (name.endsWith('.Lang.xml')) {
      copyFileSync(join(source, name), join(target, name));
      languages++;
    } else if (name.endsWith('.png')) {
      copyFileSync(join(source, name), join(target, name));
      images++;
    }
  }
  console.log(
    `prepare-data: ${themes} themes, ${languages} languages and ${images} images written to ` +
      'public/data',
  );
}

if (import.meta.main) main();
