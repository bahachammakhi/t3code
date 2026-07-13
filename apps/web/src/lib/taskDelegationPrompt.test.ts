import { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  appendDelegateRequestToPrompt,
  buildDelegateRequestSuffix,
  DEFAULT_DELEGATE_REQUEST_SETTINGS,
  DELEGATE_REQUEST_SUFFIX,
  sanitizeDelegateModelSelection,
  stripTrailingDelegateRequest,
} from "./taskDelegationPrompt";

describe("taskDelegationPrompt", () => {
  it("appends the delegate suffix when enabled", () => {
    expect(appendDelegateRequestToPrompt("hello", true)).toBe(
      `hello\n\n${DELEGATE_REQUEST_SUFFIX}`,
    );
  });

  it("appends a custom delegate suffix when settings are provided", () => {
    const settings = {
      subagentCount: 2,
      modelSelection: { instanceId: ProviderInstanceId.make("grok"), model: "grok-3" },
    };
    expect(appendDelegateRequestToPrompt("hello", true, settings)).toBe(
      `hello\n\n${buildDelegateRequestSuffix(settings)}`,
    );
  });

  it("leaves the prompt unchanged when disabled", () => {
    expect(appendDelegateRequestToPrompt("hello", false)).toBe("hello");
  });

  it("strips a trailing delegate suffix for display", () => {
    const prompt = `hello\n\n${DELEGATE_REQUEST_SUFFIX}`;
    expect(stripTrailingDelegateRequest(prompt)).toEqual({
      promptText: "hello",
      delegated: true,
    });
  });

  it("strips a dynamic trailing delegate suffix for display", () => {
    const suffix = buildDelegateRequestSuffix({
      subagentCount: 5,
      modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    });
    const prompt = `hello\n\n${suffix}`;
    expect(stripTrailingDelegateRequest(prompt)).toEqual({
      promptText: "hello",
      delegated: true,
    });
  });

  it("includes maxConcurrency and modelSelection in the suffix", () => {
    const suffix = buildDelegateRequestSuffix(DEFAULT_DELEGATE_REQUEST_SETTINGS);
    expect(suffix).toContain("maxConcurrency=3");
    expect(suffix).toContain("up to 3 independent sub-tasks");
    expect(suffix).toContain('"instanceId":"codex"');
    expect(suffix).toContain('"model":"gpt-5.4"');
    expect(suffix).not.toContain('"options"');
  });

  it("drops provider trait options from delegated model selections", () => {
    expect(
      sanitizeDelegateModelSelection({
        instanceId: ProviderInstanceId.make("grok"),
        model: "grok-4.5",
        options: [{ id: "effort", value: "high" }],
      }),
    ).toEqual({
      instanceId: ProviderInstanceId.make("grok"),
      model: "grok-4.5",
    });
  });
});
