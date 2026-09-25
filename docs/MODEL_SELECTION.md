# Choosing and comparing models

In Agents, select a provider and exact model. Local/Ollama and all supported
cloud text providers can create code in an isolated worktree. Use the mode
selector for planning without file edits. Follow-up instructions can change
provider, exact model, and code/plan mode while retaining the worktree.

Task guidance is advisory. It uses task keywords and model names, not benchmark
scores. Local coding specialists are a useful starting point for focused changes;
larger tasks may benefit from a stronger model. Selecting a smaller or unfamiliar
model does not block the run or silently switch providers.

## Catalogs

- Ollama lists models installed at the configured local endpoint.
- Gemini, DeepSeek, Groq, Mistral and xAI use their model-list APIs when credentials
  are configured. Results are cached for five minutes; Refresh models requests a
  new catalog. Gemini pagination is supported.
- Codex reads its local models cache when present, falling back to suggested IDs.
- Claude's sonnet, haiku and opus entries are CLI aliases, not pinned versions.
- Enter another model ID permits newly released models before Orbit is updated.
  This is not a promise of account access. The provider validates entitlement
  when the run starts. Discovery failure retains the previous catalog and shows
  a notice. Model-list requests do not run inference.

Embeddings, audio-only and image-generation models cannot implement source code
through a text completion endpoint; they are excluded from discovered coding lists.

## Coding and verification

Codex and Claude use their CLI agent tools. API models use a bounded source-context
and unified-diff adapter. It includes up to 80 source files / 48,000 characters,
including untracked source files. It does not offer the same repository exploration
loop as a full CLI agent. New files and multi-file changes are supported, but large
apps should be built in focused tasks. An unusable patch gets one correction attempt
with the same model, then an actionable failure. Follow up to retry or change models.

Patches cannot target credentials, Git internals or paths outside the worktree.
Declared dependencies are prepared and the normal completion gate runs before
merge. A successful patch is not proof of application correctness. Inspect changed
files and which build, test and preview checks actually ran.

Parallel comparison launches the same task in two or three independent worktrees.
Each slot selects its own provider and exact model, including two or three models
from the same Ollama installation. Models share local RAM and GPU resources, so
Ollama may queue requests or reload models depending on available memory.

Catalog references: [Gemini](https://ai.google.dev/api/models),
[Ollama](https://docs.ollama.com/api/tags),
[Groq](https://console.groq.com/docs/api-reference),
[Mistral](https://docs.mistral.ai/api),
[xAI](https://docs.x.ai/developers/rest-api-reference/inference/models).
