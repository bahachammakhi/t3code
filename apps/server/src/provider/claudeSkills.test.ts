// @effect-diagnostics nodeBuiltinImport:off
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vite-plus/test";

import {
  discoverClaudeSkills,
  parseSkillDirectories,
  parseSkillFrontmatter,
  toClaudeSkill,
} from "./claudeSkills.ts";

describe("parseSkillFrontmatter", () => {
  it("parses name and description from a standard frontmatter block", () => {
    const content = ["---", "name: code-review", "description: Review a diff", "---", "body"].join(
      "\n",
    );
    expect(parseSkillFrontmatter(content)).toEqual({
      name: "code-review",
      description: "Review a diff",
    });
  });

  it("strips surrounding quotes from values", () => {
    const content = ['---', 'name: "debugging"', "description: 'Find bugs'", "---"].join("\n");
    expect(parseSkillFrontmatter(content)).toMatchObject({
      name: "debugging",
      description: "Find bugs",
    });
  });

  it("returns an empty object when there is no frontmatter block", () => {
    expect(parseSkillFrontmatter("# Just a heading\n\nsome text")).toEqual({});
  });

  it("ignores keys it does not care about", () => {
    const content = ["---", "name: foo", "license: MIT", "random: 123", "---"].join("\n");
    expect(parseSkillFrontmatter(content)).toEqual({ name: "foo" });
  });
});

describe("toClaudeSkill", () => {
  it("builds a skill from frontmatter name", () => {
    expect(
      toClaudeSkill({
        frontmatter: { name: "code-review", description: "Review a diff" },
        dirName: "code-review-dir",
        path: "/home/u/.claude/skills/code-review/SKILL.md",
        scope: "user",
      }),
    ).toEqual({
      name: "code-review",
      description: "Review a diff",
      path: "/home/u/.claude/skills/code-review/SKILL.md",
      scope: "user",
      enabled: true,
    });
  });

  it("falls back to the directory name when frontmatter has no name", () => {
    const skill = toClaudeSkill({
      frontmatter: {},
      dirName: "my-skill",
      path: "/p/.claude/skills/my-skill/SKILL.md",
      scope: "project",
    });
    expect(skill?.name).toBe("my-skill");
    expect(skill?.scope).toBe("project");
    expect(skill?.enabled).toBe(true);
  });

  it("omits optional fields when absent", () => {
    const skill = toClaudeSkill({
      frontmatter: { name: "bare" },
      dirName: "bare",
      path: "/p/SKILL.md",
      scope: "project",
    });
    expect(skill).toEqual({ name: "bare", path: "/p/SKILL.md", scope: "project", enabled: true });
  });

  it("returns null when neither frontmatter name nor directory name is usable", () => {
    expect(
      toClaudeSkill({ frontmatter: {}, dirName: "   ", path: "/p/SKILL.md", scope: "user" }),
    ).toBeNull();
  });
});

describe("parseSkillDirectories", () => {
  it("splits on newlines and commas, trimming blanks", () => {
    expect(parseSkillDirectories("/a/b\n/c/d, /e/f\n\n")).toEqual(["/a/b", "/c/d", "/e/f"]);
  });

  it("expands a leading ~ to the home directory", () => {
    const [expanded] = parseSkillDirectories("~/skills");
    expect(expanded).toBe(NodePath.join(NodeOS.homedir(), "skills"));
  });

  it("returns an empty list for empty input", () => {
    expect(parseSkillDirectories("")).toEqual([]);
    expect(parseSkillDirectories("  \n , ")).toEqual([]);
  });
});

describe("discoverClaudeSkills", () => {
  it("discovers SKILL.md files under <cwd>/.claude/skills", async () => {
    const cwd = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-skills-"));
    const skillDir = NodePath.join(cwd, ".claude", "skills", "my-skill");
    NodeFS.mkdirSync(skillDir, { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(skillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: Does a thing\n---\nbody\n",
    );

    const skills = await Effect.runPromise(
      discoverClaudeSkills({ cwd }).pipe(Effect.provide(NodeServices.layer)),
    );

    expect(skills.find((skill) => skill.name === "my-skill")).toMatchObject({
      name: "my-skill",
      description: "Does a thing",
      scope: "project",
      enabled: true,
    });
  });

  it("recursively discovers skills under a configured extra directory", async () => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-extra-skills-"));
    // Nested layout like ~/.claude/plugins/<owner>/<plugin>/skills/<name>/SKILL.md
    const nested = NodePath.join(root, "owner", "plugin", "skills", "deep-skill");
    NodeFS.mkdirSync(nested, { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(nested, "SKILL.md"),
      "---\nname: deep-skill\ndescription: Nested\n---\n",
    );

    const skills = await Effect.runPromise(
      discoverClaudeSkills({ extraDirs: [root] }).pipe(Effect.provide(NodeServices.layer)),
    );

    expect(skills.find((skill) => skill.name === "deep-skill")).toMatchObject({
      name: "deep-skill",
      description: "Nested",
      enabled: true,
    });
  });

  it("returns an empty list when the skills directory does not exist", async () => {
    const cwd = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-skills-empty-"));

    const skills = await Effect.runPromise(
      discoverClaudeSkills({ cwd }).pipe(Effect.provide(NodeServices.layer)),
    );

    // No project skills exist; user-scope (~/.claude/skills) may or may not on
    // this machine, so only assert the temp project contributed nothing.
    expect(skills.some((skill) => skill.path.startsWith(cwd))).toBe(false);
  });
});
