// Catalog membership is not an entitlement check. Providers validate access;
// this validates IDs passed as a single CLI argument or JSON field.
export function validModelId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(value) && !value.includes('..');
}

export function modelAdvice(prompt, provider, model, available = []) {
  const complex = /architect|migration|authentication|security|payment|database|entire app|full app|from scratch|multi.file|refactor/i.test(prompt) || prompt.length > 1200;
  const specialist = /coder|codestral|devstral|codex/i.test(model);
  const local = available.find(item => item.id === 'local' && item.available);
  const localCoder = local?.models?.find(item => /coder|codestral|devstral/i.test(item.id));
  const stronger = available.find(item => item.available && ['codex', 'claude'].includes(item.id));
  if (complex) return {
    level: 'consider',
    message: 'This looks like a broad or sensitive change. A stronger coding model may need fewer retries. You can still try the selected model and review its tests and changes.',
    recommendation: stronger ? { provider: stronger.id, model: stronger.activeModel } : null,
  };
  if (provider === 'local' && !specialist && localCoder) return {
    level: 'consider', message: 'Your selected local model can attempt this. An installed coding specialist may produce more reliable edits.',
    recommendation: { provider: 'local', model: localCoder.id },
  };
  return { level: 'suggestion', message: 'For a focused task, a local coding model is a good starting point. Compare the resulting changes and verification results before merging.',
    recommendation: localCoder ? { provider: 'local', model: localCoder.id } : null };
}
