export const defaultSliderSettings = {
  enabled: true,
  autoplay: true,
  intervalMs: 6500,
  transitionMs: 450,
  showControls: true,
  showDots: true,
  pauseOnHover: true,
  maxItems: 6,
  imageFit: 'cover',
  imagePositionX: 50,
  imagePositionY: 50
};

export function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeImageFit(value, fallback = 'cover') {
  return ['cover', 'contain'].includes(value) ? value : fallback;
}

export function normalizeSliderSettings(input = {}, previous = {}) {
  const base = { ...defaultSliderSettings, ...previous };
  return {
    enabled: Boolean(input.enabled ?? base.enabled),
    autoplay: Boolean(input.autoplay ?? base.autoplay),
    intervalMs: clampNumber(input.intervalMs ?? base.intervalMs, 1500, 60000, defaultSliderSettings.intervalMs),
    transitionMs: clampNumber(input.transitionMs ?? base.transitionMs, 100, 3000, defaultSliderSettings.transitionMs),
    showControls: Boolean(input.showControls ?? base.showControls),
    showDots: Boolean(input.showDots ?? base.showDots),
    pauseOnHover: Boolean(input.pauseOnHover ?? base.pauseOnHover),
    maxItems: clampNumber(input.maxItems ?? base.maxItems, 1, 20, defaultSliderSettings.maxItems),
    imageFit: normalizeImageFit(input.imageFit ?? base.imageFit, defaultSliderSettings.imageFit),
    imagePositionX: clampNumber(input.imagePositionX ?? base.imagePositionX, 0, 100, defaultSliderSettings.imagePositionX),
    imagePositionY: clampNumber(input.imagePositionY ?? base.imagePositionY, 0, 100, defaultSliderSettings.imagePositionY)
  };
}

export function sliderPosts(posts, settings = defaultSliderSettings) {
  if (!settings.enabled) return [];
  return posts
    .filter((post) => post.status === 'published' && post.showInSlider)
    .sort((a, b) => Number(a.sliderOrder || 0) - Number(b.sliderOrder || 0) || String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, settings.maxItems);
}
