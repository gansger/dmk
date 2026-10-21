import { maskSecret } from '../core/format.js';

export function sanitizeIntegrations(integrations) {
  return {
    ...integrations,
    telegram: {
      ...integrations.telegram,
      botToken: maskSecret(integrations.telegram?.botToken),
      webhookSecret: maskSecret(integrations.telegram?.webhookSecret)
    },
    bitrix: {
      ...integrations.bitrix,
      webhookUrl: maskSecret(integrations.bitrix?.webhookUrl)
    },
    ai: {
      ...integrations.ai,
      apiKey: maskSecret(integrations.ai?.apiKey)
    }
  };
}

export function mergeIntegrations(previous, next) {
  const merged = structuredClone(previous);
  for (const [group, value] of Object.entries(next || {})) {
    merged[group] = { ...(merged[group] || {}) };
    for (const [key, fieldValue] of Object.entries(value || {})) {
      if (
        (group === 'telegram' && ['botToken', 'webhookSecret'].includes(key)) ||
        (group === 'bitrix' && key === 'webhookUrl') ||
        (group === 'ai' && key === 'apiKey')
      ) {
        continue;
      }
      merged[group][key] = fieldValue;
    }
  }
  return merged;
}
