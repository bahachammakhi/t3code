import { SparklesIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { ScopedThreadRef, ServerProviderSkill } from "@t3tools/contracts";

import { type DraftId, useComposerDraftStore } from "../../composerDraftStore";
import {
  formatProviderSkillDisplayName,
  formatProviderSkillInstallSource,
} from "../../providerSkillPresentation";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const UNGROUPED_LABEL = "Other";

/**
 * Per-thread skill picker for the composer footer. Lists the active provider's
 * discovered skills, grouped by install source (their on-disk folder/scope),
 * and lets the user opt skills in for the current thread. Selection is empty by
 * default; checked skills are injected into the turn as `$skillname` directives
 * at send time (see lib/skillDirective.ts).
 */
export function SkillSelector({
  composerDraftTarget,
  skills,
}: {
  composerDraftTarget: ScopedThreadRef | DraftId;
  skills: ReadonlyArray<ServerProviderSkill>;
}) {
  const selection = useComposerDraftStore(
    (store) => store.getComposerDraft(composerDraftTarget)?.selectedSkillNames ?? null,
  );
  const toggleSelectedSkillName = useComposerDraftStore((store) => store.toggleSelectedSkillName);
  const clearSelectedSkillNames = useComposerDraftStore((store) => store.clearSelectedSkillNames);

  const selectedSet = useMemo(() => new Set(selection ?? []), [selection]);

  const groups = useMemo(() => {
    const bySource = new Map<string, ServerProviderSkill[]>();
    for (const skill of skills) {
      const label = formatProviderSkillInstallSource(skill) ?? UNGROUPED_LABEL;
      const bucket = bySource.get(label);
      if (bucket) {
        bucket.push(skill);
      } else {
        bySource.set(label, [skill]);
      }
    }
    return [...bySource.entries()];
  }, [skills]);

  const handleToggle = useCallback(
    (name: string) => {
      toggleSelectedSkillName(composerDraftTarget, name);
    },
    [composerDraftTarget, toggleSelectedSkillName],
  );

  const handleClear = useCallback(() => {
    clearSelectedSkillNames(composerDraftTarget);
  }, [composerDraftTarget, clearSelectedSkillNames]);

  if (skills.length === 0) {
    return null;
  }

  const activeCount = selectedSet.size;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="shrink-0 gap-1.5 px-2 font-medium text-muted-foreground/70 hover:text-foreground/80 sm:px-3"
                  aria-label="Skills"
                />
              }
            >
              <SparklesIcon className="size-4" />
              <span className="sr-only sm:not-sr-only">Skills</span>
              {activeCount > 0 ? (
                <span className="text-xs tabular-nums text-fuchsia-600 dark:text-fuchsia-400">
                  {activeCount}
                </span>
              ) : null}
            </PopoverTrigger>
          }
        />
        <TooltipPopup side="top">
          {activeCount === 0
            ? "No skills selected for this thread"
            : `${activeCount} skill${activeCount === 1 ? "" : "s"} selected for this thread`}
        </TooltipPopup>
      </Tooltip>
      <PopoverPopup align="end" className="w-72 p-1">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
            Skills
          </p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-medium text-muted-foreground/70 hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {groups.map(([label, groupSkills]) => (
            <div key={label}>
              <p className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/45">
                {label}
              </p>
              {groupSkills.map((skill) => (
                <label
                  key={skill.name}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedSet.has(skill.name)}
                    onCheckedChange={() => handleToggle(skill.name)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {formatProviderSkillDisplayName(skill)}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
