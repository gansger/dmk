import { appendEvent, read, write } from '../core/store.js';
import { withRuntimeSecrets } from '../core/config.js';
import { importTelegramUpdates } from '../integrations/telegram.js';

export function startTelegramScheduler() {
  const intervalMs = Number(process.env.CMS_TELEGRAM_POLL_MS || 120000);
  const runOnce = async () => {
    try {
      const integrations = await read('integrations');
      const telegram = withRuntimeSecrets(integrations).telegram || {};
      if (!telegram.enabled || telegram.mode !== 'polling' || !telegram.botToken) return;

      const posts = await read('posts');
      const result = await importTelegramUpdates(telegram, posts);
      if (result.imported.length > 0) {
        await write('posts', [...result.imported, ...posts]);
        await appendEvent('telegram.auto_import', { count: result.imported.length });
      }

      integrations.telegram = { ...integrations.telegram, lastUpdateId: result.nextUpdateId };
      await write('integrations', integrations);
    } catch (error) {
      await appendEvent('telegram.auto_import_error', { message: error.message });
    }
  };

  setInterval(runOnce, intervalMs);
  setTimeout(runOnce, 2000);
}
