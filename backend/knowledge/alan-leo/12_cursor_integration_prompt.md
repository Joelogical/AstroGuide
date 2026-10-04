# Cursor Agent Integration Prompt

Review the current AstroGuide repository before editing.

I am adding a source-aware astrology knowledge library based on Alan
Leo's *Esoteric Astrology* (1913). Integrate the files in this package
without rewriting their substantive content.

## Goals

1.  Keep deterministic astrology calculations in JavaScript.
2.  Keep communication/reasoning instructions in the existing prompt
    system.
3.  Add a knowledge layer that can supply relevant reference modules to
    the LLM.
4.  Do not inject the entire knowledge library into every request.
5.  Preserve current Beginner/Advanced and CHART_ANALYSIS behavior.

## First inspect

Identify: - current prompt loader; - system-prompt assembly; - intent
routing; - chart architecture object; - token/context strategy; - any
existing knowledge or retrieval mechanism.

Before implementing a large retrieval system, determine whether the
current architecture can use a simple intent-to-module mapping.

## Preferred first implementation

Start simple and deterministic.

Create or use: `backend/knowledge/alan-leo/`

Store the knowledge files there.

Implement a small loader/cache for static Markdown knowledge files.

Create a mapping from detected intent/topic to relevant modules. For
example: - aspect question -\> aspects + planets - houses -\> houses +
planets - whole-chart advanced -\> methodology + advanced rules + only
relevant topical modules - explicit esoteric request -\> esoteric
doctrine + relevant modules

Do not use embeddings/vector search unless the existing application
already has such infrastructure or deterministic routing becomes
inadequate.

## Critical boundaries

Do not move astronomical calculations into Markdown. Do not ask the LLM
to calculate positions, aspects, houses, dignity, angularity, nodes, or
subdivisions that the backend can calculate. Do not silently enable Alan
Leo's metaphysical doctrine in ordinary readings. Do not let the new
knowledge files override current chart facts. Do not alter unrelated
frontend behavior.

## Prompt order

Conceptually assemble: 1. core behavioral prompt; 2. Beginner or
Advanced prompt; 3. intent-specific prompt such as CHART_ANALYSIS; 4.
relevant source knowledge; 5. deterministic chart data; 6. user request.

Use clear delimiters so the model can distinguish instructions, source
knowledge, and chart facts.

## Source labeling

The model should understand that the Alan Leo modules are a
historical/esoteric source framework. If it uses distinctive claims from
that framework, it should not present them as empirical facts.

## Regression check

After implementation: - server starts; - prompt files resolve
independent of working directory; - static files are cached
appropriately; - no duplicated prompt blocks remain accidentally; -
existing intent routing still works; - Beginner Mode remains
accessible; - Advanced CHART_ANALYSIS remains technical and
chart-centered; - no source module can overwrite deterministic chart
data.

Report every file created or modified and explain the final
prompt/knowledge assembly path.
