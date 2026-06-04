function normalizeWebhookUrl(webhookUrl) {
  if (!webhookUrl) return '';
  return webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;
}

export async function testBitrix(config) {
  const webhookUrl = normalizeWebhookUrl(config.webhookUrl);
  if (!webhookUrl) return { ok: false, message: 'Bitrix webhook URL is empty.' };

  const response = await fetch(`${webhookUrl}profile.json`);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    return { ok: false, message: payload.error_description || 'Bitrix API request failed.' };
  }

  return { ok: true, message: 'Bitrix webhook is active.', profile: payload.result };
}

export async function createBitrixLead(config, lead) {
  const webhookUrl = normalizeWebhookUrl(config.webhookUrl);
  if (!webhookUrl) throw new Error('Bitrix webhook URL is empty.');

  const fields = {
    TITLE: lead.title || 'Website request',
    NAME: lead.name || '',
    PHONE: lead.phone ? [{ VALUE: lead.phone, VALUE_TYPE: 'WORK' }] : undefined,
    EMAIL: lead.email ? [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }] : undefined,
    COMMENTS: lead.comments || '',
    ASSIGNED_BY_ID: config.defaultAssignedById || undefined,
    SOURCE_ID: 'WEB'
  };

  const response = await fetch(`${webhookUrl}crm.lead.add.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || 'Bitrix lead creation failed.');
  }

  return payload.result;
}
