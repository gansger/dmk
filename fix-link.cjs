const fs = require('fs');

try {
  const pages = JSON.parse(fs.readFileSync('./data/pages.json', 'utf8'));
  
  for (const pageId in pages) {
    const page = pages[pageId];
    if (page && page.blocks) {
      const rp = page.blocks.find(b => b.type === 'rightPanel');
      if (rp && rp.fields && rp.fields.html) {
        rp.fields.html = rp.fields.html.replace(
          /(<a\s+class="builder-widget-link"[^>]*)href="[^"]*"/,
          '$1href="?page=director-address"'
        );
      }
    }
  }

  fs.writeFileSync('./data/pages.json', JSON.stringify(pages, null, 2));
  console.log('Fixed widget link.');
} catch (err) {
  console.error(err);
}
