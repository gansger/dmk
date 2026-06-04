export function slugify(input) {
  const translit = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya'
  };

  return String(input || 'post')
    .toLowerCase()
    .split('')
    .map((char) => translit[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

export function excerptFrom(content, limit = 180) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trim()}...`;
}

export function firstSentenceFrom(content, fallback = 'Telegram post', limit = 140) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  const match = clean.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = (match?.[1] || clean).replace(/^#+\s*/, '').trim();
  return sentence.slice(0, limit).trim() || fallback;
}

export function maskSecret(value) {
  if (!value) return '';
  const text = String(value);
  if (text.length <= 8) return '••••';
  return `${text.slice(0, 3)}••••${text.slice(-3)}`;
}
