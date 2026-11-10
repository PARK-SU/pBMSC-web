export interface XmlElement {
  readonly type: 'element';
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly type: 'text';
  readonly value: string;
}

export type XmlNode = XmlElement | XmlText;

export class XmlParseError extends Error {
  override readonly name = 'XmlParseError';
}

export function getAttribute(element: XmlElement, name: string): string {
  return element.attributes.get(name) ?? '';
}

export function item(element: XmlElement, name: string): XmlElement | undefined {
  for (const child of element.children) {
    if (child.type === 'element' && child.name === name) return child;
  }
  return undefined;
}

export function innerText(node: XmlNode): string {
  return node.type === 'text' ? node.value : node.children.map(innerText).join('');
}

const entities: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
]);

function replaceEntities(raw: string): string {
  return raw.replace(/&([a-z]+);|&/g, (reference, entity?: string) => {
    const value = entity === undefined ? undefined : entities.get(entity);
    if (value === undefined) throw new XmlParseError(`unsupported reference '${reference}'`);
    return value;
  });
}

const nameChars = '[A-Za-z_:][A-Za-z0-9_:.-]*';
const tagPattern = new RegExp(
  `<(/?)(${nameChars})((?:[ \\t\\r\\n]+${nameChars}[ \\t\\r\\n]*=[ \\t\\r\\n]*` +
    `(?:"[^"<]*"|'[^'<]*'))*)[ \\t\\r\\n]*(/?)>`,
  'y',
);
const attributePattern = new RegExp(
  `(${nameChars})[ \\t\\r\\n]*=[ \\t\\r\\n]*(?:"([^"]*)"|'([^']*)')`,
  'g',
);
const textPattern = /[^<]*/y;
const whiteSpace = /^[ \t\r\n]*$/;

export function parseXml(source: string): XmlElement {
  let pos = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (source.startsWith('<?xml', pos)) {
    const end = source.indexOf('?>', pos);
    if (end < 0) throw new XmlParseError('the XML declaration is not closed');
    pos = end + 2;
  }

  type OpenElement = XmlElement & { readonly children: XmlNode[] };
  const stack: OpenElement[] = [];
  let root: XmlElement | undefined;
  const close = (element: XmlElement): void => {
    const parent = stack.at(-1);
    if (parent === undefined) root = element;
    else parent.children.push(element);
  };

  for (;;) {
    textPattern.lastIndex = pos;
    const text = textPattern.exec(source)![0];
    pos += text.length;
    if (!whiteSpace.test(text)) {
      const parent = stack.at(-1);
      if (parent === undefined) throw new XmlParseError(`text outside the root element at ${pos}`);
      parent.children.push({ type: 'text', value: replaceEntities(text) });
    }
    if (pos >= source.length) break;
    if (root !== undefined) throw new XmlParseError(`content after the root element at ${pos}`);

    tagPattern.lastIndex = pos;
    const tag = tagPattern.exec(source);
    if (tag === null) throw new XmlParseError(`unsupported markup at ${pos}`);
    pos = tagPattern.lastIndex;
    const [, endSlash, name = '', attributeText = '', emptySlash] = tag;
    if (endSlash === '/') {
      const open = stack.pop();
      if (open?.name !== name || attributeText !== '' || emptySlash === '/') {
        throw new XmlParseError(`end tag </${name}> does not match its start tag`);
      }
      close(open);
    } else {
      const attributes = new Map<string, string>();
      for (const [, attribute = '', double, single] of attributeText.matchAll(attributePattern)) {
        attributes.set(attribute, replaceEntities(double ?? single ?? ''));
      }
      const element: OpenElement = { type: 'element', name, attributes, children: [] };
      if (emptySlash === '/') close(element);
      else stack.push(element);
    }
  }

  const open = stack.at(-1);
  if (open !== undefined) throw new XmlParseError(`element <${open.name}> is not closed`);
  if (root === undefined) throw new XmlParseError('the document has no root element');
  return root;
}
