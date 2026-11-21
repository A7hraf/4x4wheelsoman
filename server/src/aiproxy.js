// AI providers. The dashboard speaks the Claude (Anthropic Messages) format. When the owner picks another
// provider — e.g. Google Gemini's free tier, or any OpenAI-compatible service — requests are translated here
// and the answer is translated back (including tool calls and streamed replies), so every AI feature works
// the same whichever provider is chosen.
import { safeUrl } from './suppliers.js';

export const PROVIDERS = {
  claude: { label: 'Claude (Anthropic)', model: 'claude-opus-5-5' },
  gemini: { label: 'Google Gemini (free tier available)', model: 'gemini-flash-latest', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  openai: { label: 'OpenAI-compatible (Groq, OpenRouter, …)', model: '' }
};

const textOf = (c) => (typeof c === 'string' ? c : (c || []).filter(b => b.type === 'text').map(b => b.text).join('\n'));

// Anthropic Messages request → OpenAI chat.completions request
export function toOpenAI(body, model) {
  const messages = [];
  const sys = textOf(body.system);
  const fmt = body.output_config && body.output_config.format;
  const wantsJSON = fmt && fmt.type === 'json_schema' && fmt.schema;
  if (sys || wantsJSON) messages.push({ role: 'system', content: (sys || '') + (wantsJSON ? `\n\nAnswer with JSON only (no markdown), matching this JSON schema:\n${JSON.stringify(fmt.schema)}` : '') });
  for (const m of body.messages || []) {
    if (typeof m.content === 'string') { messages.push({ role: m.role, content: m.content }); continue; }
    const blocks = m.content || [];
    if (m.role === 'assistant') {
      const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const calls = blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      messages.push(Object.assign({ role: 'assistant', content: text || null }, calls.length ? { tool_calls: calls } : {}));
    } else {
      for (const b of blocks.filter(x => x.type === 'tool_result')) messages.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : textOf(b.content) });
      const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (text) messages.push({ role: 'user', content: text });
    }
  }
  const req = { model, messages, max_tokens: Math.min(Number(body.max_tokens) || 4096, 8192) };
  if (body.tools && body.tools.length) req.tools = body.tools.filter(t => t.input_schema).map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema } }));
  if (wantsJSON) req.response_format = { type: 'json_schema', json_schema: { name: 'answer', schema: fmt.schema } };
  return req;
}

// OpenAI chat.completions response → Anthropic Message
export function fromOpenAI(r, model) {
  const ch = (r.choices || [])[0] || {}; const msg = ch.message || {};
  const content = [];
  let text = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map(p => p.text || '').join('') : '';
  text = text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/m, (m0, inner) => (/^\s*[[{]/.test(inner) ? inner : m0));
  if (text) content.push({ type: 'text', text });
  (msg.tool_calls || []).forEach((c, i) => {
    let input = {}; try { input = JSON.parse((c.function && c.function.arguments) || '{}'); } catch { input = {}; }
    content.push({ type: 'tool_use', id: c.id || `call_${Date.now().toString(36)}_${i}`, name: c.function && c.function.name, input });
  });
  const stop = (msg.tool_calls || []).length ? 'tool_use' : ch.finish_reason === 'length' ? 'max_tokens' : 'end_turn';
  return { id: r.id || 'msg_' + Date.now().toString(36), type: 'message', role: 'assistant', model, content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: (r.usage && r.usage.prompt_tokens) || 0, output_tokens: (r.usage && r.usage.completion_tokens) || 0 } };
}

// A complete message sent as the Anthropic streaming events the SDK expects.
export function toSSE(m) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify(Object.assign({ type }, data))}\n\n`;
  let s = ev('message_start', { message: Object.assign({}, m, { content: [], stop_reason: null, usage: { input_tokens: m.usage.input_tokens, output_tokens: 0 } }) });
  m.content.forEach((b, index) => {
    if (b.type === 'text') {
      s += ev('content_block_start', { index, content_block: { type: 'text', text: '' } });
      s += ev('content_block_delta', { index, delta: { type: 'text_delta', text: b.text } });
    } else {
      s += ev('content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      s += ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    s += ev('content_block_stop', { index });
  });
  s += ev('message_delta', { delta: { stop_reason: m.stop_reason, stop_sequence: null }, usage: { output_tokens: m.usage.output_tokens } });
  s += ev('message_stop', {});
  return s;
}

const errJSON = (status, message) => new Response(JSON.stringify({ type: 'error', error: { type: status === 429 ? 'rate_limit_error' : status === 401 ? 'authentication_error' : status >= 500 ? 'api_error' : 'invalid_request_error', message } }), { status, headers: { 'content-type': 'application/json' } });

// fetch() replacement for calls to api.anthropic.com/v1/messages: passes them to the configured provider.
// cfg: { provider, model, baseUrl, key }
export function makeAIFetch(fetchImpl, getCfg) {
  return async function aiFetch(url, opts = {}) {
    if (!/^https:\/\/api\.anthropic\.com\/v1\/messages/.test(String(url))) return fetchImpl(url, opts);
    const cfg = await getCfg();
    if (!cfg.key) return errJSON(412, 'No AI key has been saved yet (Settings → AI).');
    if (!cfg.provider || cfg.provider === 'claude') {
      const headers = Object.assign({}, opts.headers || {}, { 'x-api-key': cfg.key });
      return fetchImpl(url, Object.assign({}, opts, { headers }));
    }
    let body; try { body = JSON.parse(typeof opts.body === 'string' ? opts.body : Buffer.from(opts.body || '').toString('utf8')); } catch { return errJSON(400, 'Bad request'); }
    const model = cfg.model || PROVIDERS[cfg.provider].model;
    const endpoint = cfg.provider === 'gemini' ? PROVIDERS.gemini.url : String(cfg.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
    if (!safeUrl(endpoint)) return errJSON(400, 'The AI provider address must be a public https:// address.');
    const call = async (req) => fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key }, body: JSON.stringify(req), signal: opts.signal });
    let req = toOpenAI(body, model);
    let r = await call(req);
    // some providers don't accept every JSON-schema keyword: retry with the instruction only
    if (r.status === 400 && req.response_format) { delete req.response_format; r = await call(req); }
    const raw = await r.text();
    let j; try { j = JSON.parse(raw); } catch { j = null; }
    if (Array.isArray(j)) j = j[0];
    if (!r.ok) {
      const m = (j && (j.error && (j.error.message || j.error.status))) || raw.slice(0, 300) || ('HTTP ' + r.status);
      return errJSON(r.status === 400 || r.status === 404 ? 400 : r.status, `${cfg.provider === 'gemini' ? 'Gemini' : 'AI provider'}: ${m}`);
    }
    const msg = fromOpenAI(j || {}, model);
    if (body.stream) return new Response(toSSE(msg), { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    return new Response(JSON.stringify(msg), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
