import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validModelId } from './model-policy.mjs';

export function normalizeModels(provider, body) {
  const items = provider === 'gemini' ? body.models : body.data;
  if (!Array.isArray(items)) throw new Error('Invalid model catalog response');
  return [...new Map(items.filter(item => item.active !== false)
    .filter(item => provider !== 'gemini' || item.supportedGenerationMethods?.includes('generateContent'))
    .filter(item => item.capabilities?.completion_chat !== false)
    .map(item => ({ id: String(item.id || item.name || '').replace(/^models\//, ''), label: item.displayName || item.name || item.id }))
    .filter(item => validModelId(item.id))
    .filter(item => !/embed|whisper|transcri|tts|moderation|rerank|imagen|veo|audio|image-generation/i.test(item.id))
    .map(item => [item.id, { ...item, label: item.label || item.id }])).values()];
}

export function codexCachedModels(home) {
  try {
    const body = JSON.parse(readFileSync(join(home, 'models_cache.json'), 'utf8'));
    return (body.models || []).filter(item => item.visibility !== 'hide')
      .map(item => ({ id: item.slug || item.id, label: item.display_name || item.slug || item.id }))
      .filter(item => validModelId(item.id));
  } catch { return []; }
}

export function createModelCatalog({ configurations, fetcher = fetch }) {
  const cache = new Map();
  const pending = new Map();
  async function refresh(provider, force = false) {
    if (pending.has(provider)) return pending.get(provider);
    const previous = cache.get(provider);
    if (!force && previous && Date.now() - previous.checkedAt < 300000) return previous;
    const config = configurations(provider);
    if (!config) return null;
    const job = (async () => {
      try {
        let pageToken = '', models = [];
        for (let page = 0; page < 20; page++) {
          const url = new URL(config.url);
          if (provider === 'gemini') { url.searchParams.set('pageSize', '1000'); if (pageToken) url.searchParams.set('pageToken', pageToken); }
          const response = await fetcher(url, { headers: config.headers || {}, signal: AbortSignal.timeout(12000) });
          if (!response.ok) throw new Error(`Model discovery returned HTTP ${response.status}`);
          const body = await response.json();
          models.push(...normalizeModels(provider, body));
          pageToken = provider === 'gemini' ? body.nextPageToken : '';
          if (!pageToken) break;
          if (page === 19) throw new Error('Model catalog pagination limit reached');
        }
        if (!models.length) throw new Error('No text-generation models reported');
        cache.set(provider, { models, source: 'provider', checkedAt: Date.now(), refreshedAt: new Date().toISOString(), error: null });
      } catch (error) {
        cache.set(provider, { ...previous, checkedAt: Date.now(), source: previous?.models?.length ? 'cached' : 'fallback', error: 'Could not refresh models. Check the provider connection; retained the previous catalog.' });
      } finally { pending.delete(provider); }
      return cache.get(provider);
    })();
    pending.set(provider, job);
    return job;
  }
  return { refresh, get: provider => cache.get(provider) };
}
