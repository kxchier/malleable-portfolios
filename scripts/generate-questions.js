/** Ask design-space clarification questions before generating a portfolio interface. */
const { callTextModel } = require('./ai-client.js');

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty model response');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('could not parse JSON from model response');
  }
}

function buildQuestionSystemPrompt() {
  return `You help an artist explore portfolio interface designs before generation.

Return ONLY valid JSON:
{
  "done": false,
  "question": {
    "id": "short_id",
    "category": "metaphor_place_world",
    "question": "short question",
    "options": [
      { "label": "Option", "description": "brief effect" }
    ]
  }
}

Ask one question at a time.
Ask at most 3 total questions across the whole conversation.
If the request includes REFERENCE_FIDELITY: high, the uploaded image is the main art direction. Do not ask the user to replace the image's metaphor/place-world with a different one. Preserve the reference image's palette, texture, composition, mood, and component language.
Use previous answers to choose a relevant next question within the requested category.
Ask questions in this category order unless the user's prompt already fully answers one:
1. metaphor_place_world - the place, object, container, or metaphor world that frames the portfolio.
2. visit_encounter - how visitors move through, discover, linger, or quickly understand the work.
3. artist_intent - what the portfolio is mainly for right now, such as commissions, social connection, professional review, archive, or experimentation.
If previous answers cover all three categories, return { "done": true }.
The question must have exactly 3 options.
Focus on the category's design decision, not generic style preferences.
When targetCategory is metaphor_place_world, every option must be a new metaphor/place-world not already represented in existingInterfaces. Avoid semantically equivalent versions of those existing metaphors; change the actual object world, material system, and encounter.
Do not ask about implementation details, CSS, file formats, API keys, or screen sizes.
Make options concrete and different from each other.`;
}

function isHighFidelityReference(prompt) {
  return /REFERENCE_FIDELITY:\s*high/i.test(String(prompt || ''));
}

function questionCategoryForIndex(index, prompt = '') {
  if (isHighFidelityReference(prompt)) {
    return ['visit_encounter', 'artist_intent'][index] || 'artist_intent';
  }
  return ['metaphor_place_world', 'visit_encounter', 'artist_intent'][index] || 'artist_intent';
}

function buildQuestionUserPrompt({ prompt, designSpace, layouts, answers }) {
  const compactLayouts = (layouts || []).slice(0, 8).map((layout) => ({
    key: layout.key,
    name: layout.name,
    metaphor: layout.metaphor,
    description: String(layout.prompt || layout.examplePrompt || '').slice(0, 160),
    designSpace: layout.designSpace || null,
  }));
  const usedMetaphors = compactLayouts
    .map((layout) => layout.metaphor || layout.key || layout.name)
    .filter(Boolean);
  return JSON.stringify({
    request: prompt,
    selectedDesignSpace: designSpace || null,
    existingInterfaces: compactLayouts,
    usedMetaphors,
    previousAnswers: answers || [],
    questionNumber: (answers || []).length + 1,
    targetCategory: questionCategoryForIndex((answers || []).length, prompt),
    categoryOrder: isHighFidelityReference(prompt)
      ? ['visit_encounter', 'artist_intent']
      : ['metaphor_place_world', 'visit_encounter', 'artist_intent'],
    maxQuestions: isHighFidelityReference(prompt) ? 2 : 3,
    referenceFidelity: isHighFidelityReference(prompt) ? 'high' : 'normal',
  }, null, 2);
}

function normalizeQuestion(item, fallbackIndex = 1) {
  if (!item?.question || !Array.isArray(item.options)) return null;
  const question = {
    id: String(item.id || `q${fallbackIndex}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40),
    category: String(item.category || questionCategoryForIndex(fallbackIndex - 1)).slice(0, 40),
    question: String(item.question).slice(0, 140),
    options: item.options.slice(0, 3).map((option) => ({
      label: String(option.label || '').slice(0, 48),
      description: String(option.description || '').slice(0, 120),
    })).filter((option) => option.label),
  };
  return question.options.length === 3 ? question : null;
}

async function generateQuestions({ prompt, designSpace, layouts, answers = [] }) {
  if (!prompt?.trim()) throw new Error('missing prompt');
  if (isHighFidelityReference(prompt) && answers.length === 0) return { done: true };
  if (answers.length >= 3) return { done: true };

  const result = await callTextModel({
    system: buildQuestionSystemPrompt(),
    user: buildQuestionUserPrompt({ prompt, designSpace, layouts, answers }),
    maxTokens: 900,
    temperature: 0.35,
    responseFormat: { type: 'json_object' },
  });

  if (!result.text) throw new Error('AI returned no design questions');
  const parsed = extractJson(result.text);
  if (parsed.done === true) return { done: true };
  const questionPayload = typeof parsed.question === 'object'
    ? parsed.question
    : (Array.isArray(parsed.questions) ? parsed.questions[0] : parsed);
  const question = normalizeQuestion(questionPayload, answers.length + 1);
  if (!question) throw new Error('AI did not return a usable design question');
  return { done: false, question };
}

module.exports = { generateQuestions };
