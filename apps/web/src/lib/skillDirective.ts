// Steers the agent toward the thread's selected skills by injecting the
// existing `$skillname` directive into the turn text at send time. This is the
// "direction" mechanism (see docs/superpowers/specs/2026-06-25-per-thread-skill-selection-design.md):
// it reuses the provider-agnostic `$skillname` signal the agent already
// understands; it does not gate which skills are available.

// Mirror of the token grammar in `SkillInlineText.tsx` so that a skill the user
// already typed inline is not duplicated in the directive.
const SKILL_TOKEN_REGEX = /(^|\s)\$([a-zA-Z][a-zA-Z0-9:_-]*)(?=\s|$)/g;

const SKILL_DIRECTIVE_PREFIX = "Use these skills for this turn:";

/** Names of skills already referenced as `$name` tokens in `prompt`. */
export function findInlineSkillNames(prompt: string): Set<string> {
  const names = new Set<string>();
  for (const match of prompt.matchAll(SKILL_TOKEN_REGEX)) {
    const name = match[2];
    if (name) {
      names.add(name);
    }
  }
  return names;
}

/**
 * Prepend a `$skillname` directive for every selected skill not already
 * referenced inline. Returns `prompt` unchanged when there is nothing to add
 * (no selection, or every selected skill is already inline).
 */
export function applySelectedSkillsToTurnText(
  prompt: string,
  selectedSkillNames: readonly string[],
): string {
  const alreadyInline = findInlineSkillNames(prompt);
  const seen = new Set<string>();
  const toAdd: string[] = [];
  for (const raw of selectedSkillNames) {
    const name = raw.trim();
    if (name.length === 0 || seen.has(name) || alreadyInline.has(name)) {
      continue;
    }
    seen.add(name);
    toAdd.push(name);
  }

  if (toAdd.length === 0) {
    return prompt;
  }

  const directive = `${SKILL_DIRECTIVE_PREFIX} ${toAdd.map((name) => `$${name}`).join(" ")}`;
  return prompt.length === 0 ? directive : `${directive}\n\n${prompt}`;
}
