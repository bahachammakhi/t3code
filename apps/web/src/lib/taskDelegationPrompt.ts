import { type ModelSelection, ProviderInstanceId } from "@t3tools/contracts";

export const DELEGATE_REQUEST_PREFIX = "[Delegate this request:";
export const DELEGATE_REQUEST_MARKER = DELEGATE_REQUEST_PREFIX;

export type DelegateRequestSettings = {
  readonly subagentCount: number;
  readonly modelSelection: ModelSelection;
};

const TRAILING_DELEGATE_REQUEST_PATTERN = /\n*\[Delegate this request:[\s\S]*?\]\s*$/;

/** Subagent sessions only need the routing key + model slug — never trait options. */
export function sanitizeDelegateModelSelection(modelSelection: ModelSelection): ModelSelection {
  return {
    instanceId: modelSelection.instanceId,
    model: modelSelection.model.trim(),
  };
}

export function buildDelegateRequestSuffix(settings: DelegateRequestSettings): string {
  const modelSelection = sanitizeDelegateModelSelection(settings.modelSelection);
  const modelSelectionJson = JSON.stringify({
    instanceId: modelSelection.instanceId,
    model: modelSelection.model,
  });
  const count = Math.min(5, Math.max(1, Math.round(settings.subagentCount)));
  return (
    `${DELEGATE_REQUEST_PREFIX} use the delegate_tasks tool to break it into up to ${count} independent sub-tasks that run in parallel. ` +
    `Call delegate_tasks with maxConcurrency=${count}. ` +
    `For each sub-task, set modelSelection to exactly ${modelSelectionJson} (only instanceId and model — no options). ` +
    `For any sub-task that comes back still running, call collect_delegated_tasks. Then synthesize their results into your answer.]`
  );
}

export const DEFAULT_DELEGATE_REQUEST_SETTINGS: DelegateRequestSettings = {
  subagentCount: 3,
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
};

export const DELEGATE_REQUEST_SUFFIX = buildDelegateRequestSuffix(
  DEFAULT_DELEGATE_REQUEST_SETTINGS,
);

export function appendDelegateRequestToPrompt(
  prompt: string,
  enabled: boolean,
  settings?: DelegateRequestSettings,
): string {
  if (!enabled) return prompt;
  const suffix = settings
    ? buildDelegateRequestSuffix({
        subagentCount: settings.subagentCount,
        modelSelection: sanitizeDelegateModelSelection(settings.modelSelection),
      })
    : DELEGATE_REQUEST_SUFFIX;
  const trimmed = prompt.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n\n${suffix}` : suffix;
}

export function stripTrailingDelegateRequest(prompt: string): {
  readonly promptText: string;
  readonly delegated: boolean;
} {
  const match = TRAILING_DELEGATE_REQUEST_PATTERN.exec(prompt);
  if (!match) {
    return { promptText: prompt, delegated: false };
  }
  return {
    promptText: prompt.slice(0, match.index).replace(/\n+$/, ""),
    delegated: true,
  };
}
