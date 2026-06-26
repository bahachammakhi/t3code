import { describe, expect, it } from "vite-plus/test";

import { applySelectedSkillsToTurnText, findInlineSkillNames } from "./skillDirective";

describe("findInlineSkillNames", () => {
  it("extracts $name skill tokens from prompt text", () => {
    expect(findInlineSkillNames("please $code-review then $debugging this")).toEqual(
      new Set(["code-review", "debugging"]),
    );
  });

  it("ignores $ that is not a standalone token", () => {
    expect(findInlineSkillNames("cost is $5 and email a$b")).toEqual(new Set());
  });

  it("returns an empty set for text with no tokens", () => {
    expect(findInlineSkillNames("just a normal prompt")).toEqual(new Set());
  });
});

describe("applySelectedSkillsToTurnText", () => {
  it("returns the prompt unchanged when no skills are selected", () => {
    expect(applySelectedSkillsToTurnText("fix the bug", [])).toBe("fix the bug");
  });

  it("prepends a directive listing selected skills", () => {
    expect(applySelectedSkillsToTurnText("fix the bug", ["code-review", "debugging"])).toBe(
      "Use these skills for this turn: $code-review $debugging\n\nfix the bug",
    );
  });

  it("omits skills already referenced inline in the prompt", () => {
    expect(applySelectedSkillsToTurnText("use $code-review now", ["code-review", "debugging"])).toBe(
      "Use these skills for this turn: $debugging\n\nuse $code-review now",
    );
  });

  it("returns the prompt unchanged when every selected skill is already inline", () => {
    expect(applySelectedSkillsToTurnText("run $code-review", ["code-review"])).toBe(
      "run $code-review",
    );
  });

  it("deduplicates selected skill names", () => {
    expect(applySelectedSkillsToTurnText("go", ["code-review", "code-review"])).toBe(
      "Use these skills for this turn: $code-review\n\ngo",
    );
  });

  it("emits only the directive when the prompt is empty", () => {
    expect(applySelectedSkillsToTurnText("", ["code-review"])).toBe(
      "Use these skills for this turn: $code-review",
    );
  });
});
