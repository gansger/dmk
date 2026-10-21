import { withRuntimeSecrets } from '../core/config.js';
import { limitedString } from '../core/format.js';
import { appendEvent, read, searchKnowledge, write } from '../core/store.js';
import { readBody, routeParams, sendJson, sendNoContent } from '../core/http.js';
import { askAssistant } from '../services/assistant.js';

const assistantMessageMaxLength = 2000;
const knowledgeContextLimit = 6;

// Public AI assistant plus the knowledge base and memory it answers from.
export async function handleAiApi({ request, response, url, method, pathname }) {
  if (method === 'POST' && pathname === '/api/ai/assistant') {
    const body = await readBody(request);
    const message = String(body.message ?? '').trim();
    if (!message) {
      sendJson(response, 400, { error: 'Введите вопрос.' });
      return true;
    }
    if (message.length > assistantMessageMaxLength) {
      sendJson(response, 400, { error: `Вопрос не должен превышать ${assistantMessageMaxLength} символов.` });
      return true;
    }
    // "engine" is the shared memory scope; a visitor must not be able to claim it.
    const visitorId = limitedString(body.visitorId, 100).replace(/[^\w-]/g, '') || 'anonymous';
    const integrations = withRuntimeSecrets(await read('integrations'));
    // Give the model the records that match the question; with no match fall back
    // to the general records so it can still say what information is missing.
    const relevantKnowledge = await searchKnowledge(message, { limit: knowledgeContextLimit });
    const result = await askAssistant({
      config: integrations.ai,
      knowledge: relevantKnowledge.length ? relevantKnowledge : await read('knowledge'),
      memory: await read('memory'),
      message,
      visitorId: visitorId === 'engine' ? 'anonymous' : visitorId
    });
    await appendEvent('ai.assistant_message', { mode: result.mode, visitorId });
    sendJson(response, 200, result);
    return true;
  }

  if (method === 'GET' && pathname === '/api/knowledge') {
    sendJson(response, 200, await read('knowledge'));
    return true;
  }

  // Lets the admin check which records the assistant would use for a question.
  if (method === 'GET' && pathname === '/api/knowledge/search') {
    const query = limitedString(url.searchParams.get('q'), assistantMessageMaxLength);
    sendJson(response, 200, await searchKnowledge(query, { limit: knowledgeContextLimit }));
    return true;
  }

  if (method === 'POST' && pathname === '/api/knowledge') {
    const body = await readBody(request);
    const knowledge = await read('knowledge');
    const record = {
      id: crypto.randomUUID(),
      title: body.title || 'Knowledge record',
      kind: body.kind || 'note',
      tags: Array.isArray(body.tags) ? body.tags : [],
      content: body.content || '',
      updatedAt: new Date().toISOString()
    };
    await write('knowledge', [record, ...knowledge]);
    await appendEvent('knowledge.created', { id: record.id, title: record.title });
    sendJson(response, 201, record);
    return true;
  }

  const params = routeParams('/api/knowledge/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const knowledge = await read('knowledge');
    const record = knowledge.find((item) => item.id === params.id);
    if (!record) {
      sendJson(response, 404, { error: 'Knowledge record not found' });
      return true;
    }
    Object.assign(record, {
      title: body.title ?? record.title,
      kind: body.kind ?? record.kind,
      tags: Array.isArray(body.tags) ? body.tags : record.tags,
      content: body.content ?? record.content,
      updatedAt: new Date().toISOString()
    });
    await write('knowledge', knowledge);
    await appendEvent('knowledge.updated', { id: record.id, title: record.title });
    sendJson(response, 200, record);
    return true;
  }

  if (params && method === 'DELETE') {
    const knowledge = await read('knowledge');
    await write('knowledge', knowledge.filter((item) => item.id !== params.id));
    await appendEvent('knowledge.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  if (method === 'GET' && pathname === '/api/memory') {
    sendJson(response, 200, await read('memory'));
    return true;
  }

  if (method === 'POST' && pathname === '/api/memory') {
    const body = await readBody(request);
    const memory = await read('memory');
    const record = {
      id: crypto.randomUUID(),
      type: body.type || 'note',
      scope: body.scope || 'engine',
      key: body.key || 'memory',
      value: body.value || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await write('memory', [record, ...memory]);
    await appendEvent('memory.created', { id: record.id, key: record.key });
    sendJson(response, 201, record);
    return true;
  }

  return false;
}
