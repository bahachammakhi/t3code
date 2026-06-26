import { type EnvironmentId, TaskRoutingSettings, type ThreadId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { SlidersHorizontalIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";

const decodeRouting = Schema.decodeUnknownSync(TaskRoutingSettings);

export interface ThreadDelegationRoutingButtonProps {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}

/**
 * Per-thread delegation-routing editor. Opens a popover with the thread's
 * routing rules as JSON (seeded from the override if present, otherwise the
 * global rules as a template). Saving validates against `TaskRoutingSettings`
 * and patches `threadTaskRouting[threadId]`; the server orchestrator uses that
 * override for delegated sub-tasks in this thread, falling back to global.
 */
export function ThreadDelegationRoutingButton({
  environmentId,
  threadId,
}: ThreadDelegationRoutingButtonProps) {
  const settings = useEnvironmentSettings(environmentId);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const hasOverride = settings.threadTaskRouting?.[threadId] !== undefined;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        const seed = settings.threadTaskRouting?.[threadId] ??
          settings.taskRouting ?? { rules: [] };
        setDraft(JSON.stringify(seed, null, 2));
        setError(null);
      }
      setOpen(next);
    },
    [settings.threadTaskRouting, settings.taskRouting, threadId],
  );

  const handleSave = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Invalid JSON.");
      return;
    }
    let routing: TaskRoutingSettings;
    try {
      routing = decodeRouting(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Does not match the routing schema.");
      return;
    }
    updateSettings({
      threadTaskRouting: { ...(settings.threadTaskRouting ?? {}), [threadId]: routing },
    });
    setError(null);
    setOpen(false);
  }, [draft, settings.threadTaskRouting, threadId, updateSettings]);

  const handleReset = useCallback(() => {
    const next = { ...(settings.threadTaskRouting ?? {}) };
    delete next[threadId];
    updateSettings({ threadTaskRouting: next });
    setOpen(false);
  }, [settings.threadTaskRouting, threadId, updateSettings]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-label="Delegation routing for this thread"
            title={
              hasOverride
                ? "Delegation routing — this thread overrides the global rules"
                : "Delegation routing for this thread (uses global rules)"
            }
            className={cn(
              "shrink-0 px-2",
              hasOverride
                ? "text-violet-400 hover:text-violet-300"
                : "text-muted-foreground/70 hover:text-foreground/80",
            )}
          />
        }
      >
        <SlidersHorizontalIcon />
      </PopoverTrigger>
      <PopoverPopup side="top" align="start" className="w-[28rem] max-w-[90vw] p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Delegation routing — this thread</span>
            <span className="text-muted-foreground text-xs">
              {hasOverride ? "Overriding global" : "Using global default"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Rules map a sub-task (by <code>modelHint</code> or <code>labelMatches</code>) to a
            model; first match wins. Edit the JSON to override the global routing for this thread
            only.
          </p>
          <textarea
            value={draft}
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            className="bg-muted/40 focus-visible:ring-ring h-56 w-full resize-y rounded-md border p-2 font-mono text-xs outline-none focus-visible:ring-1"
          />
          {error ? <p className="text-destructive text-xs whitespace-pre-wrap">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleReset}
              disabled={!hasOverride}
            >
              Reset to global
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="button" onClick={handleSave}>
                Save for this thread
              </Button>
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
