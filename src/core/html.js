// Minimal HTML parser/serializer for markup produced by the page editor.
// It is not a general-purpose parser: it only has to be robust for our own
// saved block HTML, so the server can clean it and add SEO details.

const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const droppedTags = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button']);
// <p>, <li> etc. implicitly close an open element of the same kind.
const selfClosingSiblings = new Set(['p', 'li', 'option']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&');
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

export function parseHtml(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<\/\s*([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let index = 0;
  let match;

  const current = () => stack[stack.length - 1];
  const pushText = (text) => {
    if (text) current().children.push({ type: 'text', text: decodeEntities(text) });
  };

  while ((match = pattern.exec(html))) {
    pushText(html.slice(index, match.index));
    index = pattern.lastIndex;
    if (match[0].startsWith('<!--')) continue;

    if (match[1]) {
      const tag = match[1].toLowerCase();
      const openIndex = stack.findLastIndex((node) => node.tag === tag);
      if (openIndex > 0) stack.length = openIndex;
      continue;
    }

    const tag = match[2].toLowerCase();
    const rawAttributes = match[3] || '';
    if (selfClosingSiblings.has(tag) && current().tag === tag) stack.pop();
    const element = { type: 'element', tag, attributes: parseAttributes(rawAttributes), children: [] };
    current().children.push(element);

    if (['script', 'style', 'textarea', 'title'].includes(tag)) {
      // Raw text content: skip to the matching closing tag.
      const close = html.toLowerCase().indexOf(`</${tag}`, index);
      const end = close === -1 ? html.length : close;
      element.children.push({ type: 'text', text: html.slice(index, end) });
      const closeEnd = close === -1 ? html.length : html.indexOf('>', close) + 1;
      index = closeEnd;
      pattern.lastIndex = closeEnd;
      continue;
    }
    if (!voidTags.has(tag) && !/\/\s*$/.test(rawAttributes)) stack.push(element);
  }
  pushText(html.slice(index));
  return root.children;
}

export function serializeHtml(nodes) {
  return nodes
    .map((node) => {
      if (node.type === 'text') return escapeHtml(node.text).replaceAll('&#039;', "'");
      const attributes = Object.entries(node.attributes || {})
        .map(([name, value]) => (value === '' && name !== 'alt' ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`))
        .join('');
      if (voidTags.has(node.tag)) return `<${node.tag}${attributes}>`;
      return `<${node.tag}${attributes}>${serializeHtml(node.children)}</${node.tag}>`;
    })
    .join('');
}

export function textContent(nodes) {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text;
      if (node.tag === 'br') return ' ';
      return ` ${textContent(node.children)} `;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function walkElements(nodes, visit, parent = null) {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    visit(node, parent);
    walkElements(node.children, visit, node);
  }
}

function safeUrl(value, { image = false } = {}) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) return url;
  if (image && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url)) return url;
  return '';
}

// Removes anything executable and editor-only from saved block HTML.
export function sanitizeNodes(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      result.push(node);
      continue;
    }
    if (droppedTags.has(node.tag) || node.tag.includes(':')) continue;
    const attributes = {};
    for (const [name, value] of Object.entries(node.attributes)) {
      if (name.startsWith('on') || name === 'contenteditable' || name === 'draggable') continue;
      if (name === 'href' || name === 'src') {
        const url = safeUrl(value, { image: name === 'src' });
        if (url) attributes[name] = url;
        continue;
      }
      attributes[name] = value;
    }
    result.push({ ...node, attributes, children: sanitizeNodes(node.children) });
  }
  return result;
}
