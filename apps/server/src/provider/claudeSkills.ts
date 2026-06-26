import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { ServerProviderSkill } from "@t3tools/contracts";

import { expandHomePath } from "../pathExpansion.ts";

/**
 * Claude's ACP protocol exposes no "list skills" capability (unlike Codex's
 * `skills/list` RPC), so t3code discovers Claude Code SKILL.md skills directly
 * from disk: the project's `.claude/skills` and the user's `~/.claude/skills`.
 * Each `<dir>/SKILL.md` is parsed for its frontmatter `name`/`description`.
 */

const SKILL_FILE_NAME = "SKILL.md";
/** Frontmatter keys we surface; everything else in the block is ignored. */
const FRONTMATTER_KEYS = ["name", "description", "displayName", "shortDescription"] as const;
/** Bound recursion so a misconfigured directory can't trigger a runaway walk. */
const MAX_SCAN_DEPTH = 12;
/** Directories never worth walking into when hunting for SKILL.md files. */
const SKIP_DIRECTORIES = new Set([".git", "node_modules", ".cache", "dist", "build"]);

/**
 * Split a user-entered directory list (newline- and/or comma-separated) into
 * cleaned, home-expanded absolute-ish paths. Blank entries are dropped.
 */
export function parseSkillDirectories(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => expandHomePath(entry));
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  displayName?: string;
  shortDescription?: string;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Extract the leading `--- … ---` YAML frontmatter block and return the subset
 * of single-line scalar keys we care about. Intentionally minimal (no YAML
 * dependency in the server): handles `key: value` lines, nothing nested.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const normalized = content.replace(/^﻿/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(normalized);
  if (!match) {
    return {};
  }
  const result: SkillFrontmatter = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!(FRONTMATTER_KEYS as ReadonlyArray<string>).includes(key)) {
      continue;
    }
    const value = stripQuotes(line.slice(separator + 1));
    if (value.length > 0) {
      result[key as (typeof FRONTMATTER_KEYS)[number]] = value;
    }
  }
  return result;
}

/**
 * Build a `ServerProviderSkill` from a parsed SKILL.md, falling back to the
 * containing directory name when the frontmatter omits `name`. Returns null
 * when no usable name can be derived.
 */
export function toClaudeSkill(input: {
  frontmatter: SkillFrontmatter;
  dirName: string;
  path: string;
  scope: string;
}): ServerProviderSkill | null {
  const name = (input.frontmatter.name ?? "").trim() || input.dirName.trim();
  if (name.length === 0) {
    return null;
  }
  const skill: {
    name: string;
    path: string;
    scope: string;
    enabled: boolean;
    description?: string;
    displayName?: string;
    shortDescription?: string;
  } = {
    name,
    path: input.path,
    scope: input.scope,
    enabled: true,
  };
  if (input.frontmatter.description) skill.description = input.frontmatter.description;
  if (input.frontmatter.displayName) skill.displayName = input.frontmatter.displayName;
  if (input.frontmatter.shortDescription) {
    skill.shortDescription = input.frontmatter.shortDescription;
  }
  return skill as ServerProviderSkill;
}

/** Recursively collect absolute paths of every `SKILL.md` under `root`. */
const collectSkillFiles = (
  root: string,
  depth: number,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const entries = yield* fs.readDirectory(root).pipe(Effect.orElseSucceed(() => []));
    const found: string[] = [];
    const childDirs: string[] = [];

    for (const entry of entries) {
      if (entry === SKILL_FILE_NAME) {
        found.push(path.join(root, entry));
      } else if (depth < MAX_SCAN_DEPTH && !SKIP_DIRECTORIES.has(entry) && !entry.startsWith(".")) {
        childDirs.push(path.join(root, entry));
      }
    }

    if (childDirs.length > 0) {
      const nested = yield* Effect.forEach(childDirs, (dir) => collectSkillFiles(dir, depth + 1), {
        concurrency: "unbounded",
      });
      for (const group of nested) {
        found.push(...group);
      }
    }

    return found;
  });

/** Recursively find and parse every `SKILL.md` under one root directory. */
const discoverSkillsInDir = (
  skillsDir: string,
  scope: string,
): Effect.Effect<ReadonlyArray<ServerProviderSkill>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const skillFiles = yield* collectSkillFiles(skillsDir, 0);

    const skills = yield* Effect.forEach(
      skillFiles,
      (skillPath) =>
        Effect.gen(function* () {
          const content = yield* fs
            .readFileString(skillPath)
            .pipe(
              Effect.option,
              Effect.map((option) => (option._tag === "Some" ? option.value : null)),
            );
          if (content === null) {
            return null;
          }
          return toClaudeSkill({
            frontmatter: parseSkillFrontmatter(content),
            dirName: path.basename(path.dirname(skillPath)),
            path: skillPath,
            scope,
          });
        }),
      { concurrency: "unbounded" },
    );

    return skills.filter((skill): skill is ServerProviderSkill => skill !== null);
  });

/**
 * Discover Claude Code skills from several roots (each scanned recursively):
 * user-scoped `~/.claude/skills` always; project-scoped `<cwd>/.claude/skills`
 * when `cwd` is given; and any user-configured `extraDirs` (e.g. a plugins
 * folder). Later roots win on a name conflict, so a configured folder overrides
 * a same-named user skill, which overrides nothing. Never fails — discovery
 * problems resolve to an empty list so they can't break provider status.
 */
export const discoverClaudeSkills = (options?: {
  cwd?: string;
  extraDirs?: ReadonlyArray<string>;
}): Effect.Effect<ReadonlyArray<ServerProviderSkill>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    // Ordered low → high precedence; a later root's skill overrides an earlier
    // same-named one when collected into the name map below.
    const roots: Array<{ dir: string; scope: string }> = [
      { dir: expandHomePath("~/.claude/skills"), scope: "user" },
    ];
    if (options?.cwd) {
      roots.push({ dir: path.join(options.cwd, ".claude", "skills"), scope: "project" });
    }
    for (const dir of options?.extraDirs ?? []) {
      if (dir.trim().length > 0) {
        roots.push({ dir, scope: path.basename(dir) || "custom" });
      }
    }

    const discovered = yield* Effect.all(
      roots.map(({ dir, scope }) => discoverSkillsInDir(dir, scope)),
      { concurrency: "unbounded" },
    );

    const byName = new Map<string, ServerProviderSkill>();
    for (const skill of discovered.flat()) {
      byName.set(skill.name, skill);
    }
    return [...byName.values()];
  }).pipe(Effect.orElseSucceed(() => []));
