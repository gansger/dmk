// Cleans HTML pasted from Word, Google Docs or other sites: keeps the structure
// (paragraphs, headings, lists, bold/italic, links, images) and drops fonts,
// colors, classes and Office markup, so pasted text matches the site design.

const keptTags = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'IMG']);
const renamedTags = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', H1: 'H2', H5: 'H4', H6: 'H4', DIV: 'P' };
const droppedTags = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'XML', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM']);
const blockTags = new Set(['P', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE']);

function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith('/') || href.startsWith('#')) return href;
  return '';
}

function safeImageSrc(value) {
  const src = String(value || '').trim();
  // Word puts local file:/// paths into the clipboard; those images cannot be loaded.
  if (/^https?:/i.test(src) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src) || src.startsWith('/')) return src;
  return '';
}

// Word marks bold/italic with inline styles on spans instead of <b>/<i>.
function inlineFormatting(element) {
  const style = element.getAttribute('style') || '';
  return {
    bold: /font-weight\s*:\s*(bold|[6-9]00)/i.test(style),
    italic: /font-style\s*:\s*italic/i.test(style)
  };
}

function cleanNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent.replace(/ /g, ' '));
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName.toUpperCase();
  if (droppedTags.has(tag) || tag.includes(':')) return null;

  const children = doc.createDocumentFragment();
  for (const child of node.childNodes) {
    const cleaned = cleanNode(child, doc);
    if (cleaned) children.append(cleaned);
  }

  const targetTag = renamedTags[tag] || tag;
  if (!keptTags.has(targetTag)) {
    // Unknown wrapper (span, font, section, table cell...): keep its content only,
    // but preserve bold/italic that Word expresses through styles.
    const { bold, italic } = inlineFormatting(node);
    let content = children;
    if (italic) {
      const em = doc.createElement('em');
      em.append(content);
      content = em;
    }
    if (bold) {
      const strong = doc.createElement('strong');
      strong.append(content);
      content = strong;
    }
    if (['TD', 'TH', 'TR', 'TABLE', 'SECTION', 'ARTICLE'].includes(tag)) {
      const paragraph = doc.createElement('p');
      paragraph.append(content);
      return paragraph;
    }
    return content;
  }

  if (targetTag === 'IMG') {
    const src = safeImageSrc(node.getAttribute('src'));
    if (!src) return null;
    const image = doc.createElement('img');
    image.src = src;
    image.alt = node.getAttribute('alt') || '';
    return image;
  }

  const element = doc.createElement(targetTag);
  if (targetTag === 'A') {
    const href = safeHref(node.getAttribute('href'));
    if (!href) return children;
    element.href = href;
    if (/^https?:/i.test(href) && !href.startsWith(window.location.origin)) {
      element.target = '_blank';
      element.rel = 'noopener';
    }
  }
  element.append(children);
  return element;
}

function removeEmptyBlocks(container) {
  container.querySelectorAll('p, li, h2, h3, h4, blockquote, strong, em, u, s').forEach((element) => {
    if (!element.textContent.trim() && !element.querySelector('img, br')) element.remove();
  });
  // A paragraph cannot contain another block (Word nests them); unwrap the outer one.
  container.querySelectorAll('p').forEach((paragraph) => {
    if ([...paragraph.children].some((child) => blockTags.has(child.tagName))) paragraph.replaceWith(...paragraph.childNodes);
  });
}

export function cleanPastedHtml(html) {
  const source = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const output = document.implementation.createHTMLDocument('');
  const container = output.createElement('div');
  for (const child of source.body.childNodes) {
    const cleaned = cleanNode(child, output);
    if (cleaned) container.append(cleaned);
  }
  removeEmptyBlocks(container);
  return container.innerHTML.trim();
}

function escapeText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function plainTextToHtml(text) {
  const paragraphs = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) return escapeText(paragraphs[0] || '').replaceAll('\n', '<br>');
  return paragraphs.map((part) => `<p>${escapeText(part).replaceAll('\n', '<br>')}</p>`).join('');
}
