'use strict';

const PROMPT_BINDING_SCHEMA = 'NATIVE_PRODUCER_PROMPT_BINDING/V1';

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function buildBindingInstructions(sectionReference) {
  return [
    `GOVERNED SECTION REFERENCE: ${sectionReference}`,
    '',
    `Every emitted section_reference must equal ${JSON.stringify(sectionReference)} exactly. Do not use a relative subsection label and do not add a child reference.`,
    '',
    'QUOTE FIDELITY: Every quote must be one contiguous byte-identical substring of SOURCE TEXT. Preserve punctuation exactly. Do not complete, shorten, normalise, or re-punctuate a quote. Omit the assertion if you cannot copy its quote exactly.',
  ].join('\n');
}

function bindNativePromptToGovernedScope({ prompt, governed_scope: governedScope } = {}) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) {
    throw new TypeError('prompt must be an object');
  }
  if (!Array.isArray(prompt.messages) || prompt.messages.length === 0) {
    throw new TypeError('prompt.messages must be a non-empty array');
  }
  if (!governedScope || typeof governedScope !== 'object' || Array.isArray(governedScope)) {
    throw new TypeError('governed_scope must be an object');
  }

  const sectionReference = requireNonEmptyString(
    governedScope.section_reference,
    'governed_scope.section_reference',
  );
  const bindingInstructions = buildBindingInstructions(sectionReference);
  let boundUserMessageCount = 0;
  const messages = prompt.messages.map((message, index) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new TypeError(`prompt.messages[${index}] must be an object`);
    }
    if (message.role !== 'user') return Object.freeze({ ...message });
    requireNonEmptyString(message.content, `prompt.messages[${index}].content`);
    boundUserMessageCount += 1;
    return Object.freeze({
      ...message,
      content: `${bindingInstructions}\n\n${message.content}`,
    });
  });
  if (boundUserMessageCount === 0) {
    throw new TypeError('prompt.messages must contain at least one user message');
  }

  return Object.freeze({
    ...prompt,
    prompt_binding_schema: PROMPT_BINDING_SCHEMA,
    messages: Object.freeze(messages),
  });
}

module.exports = {
  PROMPT_BINDING_SCHEMA,
  buildBindingInstructions,
  bindNativePromptToGovernedScope,
};
