const sharedLayoutBlockTypes = ['headerNav', 'sideMenu', 'footer'];

function cloneBlock(block) {
  return block ? JSON.parse(JSON.stringify(block)) : null;
}

export function sharedPageBlocks(pages, previous = {}) {
  const homeBlocks = Array.isArray(pages.home?.blocks) ? pages.home.blocks : [];
  const previousBlocks = Array.isArray(previous.blocks) ? previous.blocks : [];
  return sharedLayoutBlockTypes
    .map((type) => cloneBlock(homeBlocks.find((block) => block.type === type) || previousBlocks.find((block) => block.type === type)))
    .filter(Boolean);
}

export function pageWithSharedLayout(page, pages) {
  if (!page || page.id === 'home') return page;

  const sharedBlocks = sharedPageBlocks(pages, page);
  if (!sharedBlocks.length) return page;

  const sharedTypes = new Set(sharedLayoutBlockTypes);
  const pageBlocks = Array.isArray(page.blocks) ? page.blocks : [];
  return {
    ...page,
    blocks: [
      ...sharedBlocks,
      ...pageBlocks.filter((block) => !sharedTypes.has(block.type))
    ]
  };
}

export function syncSharedLayoutBlocks(pages) {
  if (!pages.home) return false;

  let changed = false;
  for (const [id, page] of Object.entries(pages)) {
    if (id === 'home') continue;
    const nextPage = pageWithSharedLayout(page, pages);
    if (JSON.stringify(page) !== JSON.stringify(nextPage)) {
      pages[id] = nextPage;
      changed = true;
    }
  }
  return changed;
}

function normalizePageSeo(input = {}, previous = {}) {
  return {
    title: String(input.title ?? previous.title ?? '').trim().slice(0, 180),
    description: String(input.description ?? previous.description ?? '').trim().slice(0, 500),
    image: String(input.image ?? previous.image ?? '').trim().slice(0, 2000),
    noIndex: Boolean(input.noIndex ?? previous.noIndex ?? false)
  };
}

export function normalizePage(input = {}, previous = {}) {
  const previousBlocks = Array.isArray(previous.blocks) ? previous.blocks : [];
  const inputBlocks = Array.isArray(input.blocks) ? input.blocks : previousBlocks;

  return {
    id: input.id || previous.id || 'home',
    title: input.title || previous.title || 'Page',
    updatedAt: new Date().toISOString(),
    seo: normalizePageSeo(input.seo, previous.seo),
    blocks: inputBlocks.map((block, index) => {
      const previousBlock = previousBlocks.find((item) => item.id === block.id) || {};
      return {
        id: block.id || crypto.randomUUID(),
        type: block.type || previousBlock.type || 'text',
        enabled: block.enabled ?? previousBlock.enabled ?? true,
        order: Number(block.order ?? previousBlock.order ?? index * 10),
        fields: {
          ...(previousBlock.fields || {}),
          ...(block.fields || {})
        }
      };
    })
  };
}
