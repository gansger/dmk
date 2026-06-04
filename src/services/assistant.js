function knowledgeContext(knowledge) {
  return knowledge
    .slice(0, 12)
    .map((item) => `# ${item.title}\n${item.content}`)
    .join('\n\n');
}

function memoryContext(memory, visitorId) {
  return memory
    .filter((item) => item.scope === 'engine' || item.scope === visitorId)
    .slice(0, 20)
    .map((item) => `${item.key}: ${item.value}`)
    .join('\n');
}

function isLocalAiUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function askAssistant({ config, knowledge, memory, message, visitorId = 'anonymous' }) {
  const baseUrl = (process.env.OPENAI_BASE_URL || config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = process.env.OPENAI_API_KEY || config.apiKey || (isLocalAiUrl(baseUrl) ? 'lm-studio' : '');
  const model = process.env.OPENAI_MODEL || config.model || 'gpt-4.1-mini';
  const systemPrompt = config.systemPrompt || 'You are a helpful website assistant.';

  const context = [
    systemPrompt,
    'Use the knowledge base and memory below. If the answer is not in the knowledge base, say what information is missing and offer the next step.',
    `Knowledge:\n${knowledgeContext(knowledge) || 'No knowledge records yet.'}`,
    `Memory:\n${memoryContext(memory, visitorId) || 'No memory records yet.'}`
  ].join('\n\n');

  if (!config.enabled || !apiKey) {
    return {
      mode: 'local-draft',
      answer: [
        'AI-интеграция пока не подключена полностью.',
        'Черновой ответ на основе локальной базы знаний:',
        knowledgeContext(knowledge).slice(0, 700) || 'Сначала добавьте записи в базу знаний, затем подключите OpenAI-compatible API key.'
      ].join('\n\n')
    };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: Number(config.temperature ?? 0.4),
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: message }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'AI provider request failed.');
  }

  return {
    mode: 'provider',
    answer: payload.choices?.[0]?.message?.content || ''
  };
}
