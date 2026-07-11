import { ServerIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { McpServerId, ScopedThreadRef } from "@t3tools/contracts";

import { type DraftId, useComposerDraftStore } from "../../composerDraftStore";
import { usePrimarySettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * Per-thread MCP server picker for the composer footer. Lists every enabled
 * MCP server registered in settings and lets the user narrow which ones are
 * active for the current thread. A `null` selection (the default) means "use
 * every enabled server"; toggling produces an explicit subset.
 */
export function McpServerSelector({
  composerDraftTarget,
}: {
  composerDraftTarget: ScopedThreadRef | DraftId;
}) {
  const enabledServers = usePrimarySettings((settings) =>
    Object.values(settings.mcpServers ?? {}).filter((server) => server.enabled),
  );
  const selection = useComposerDraftStore(
    (store) => store.getComposerDraft(composerDraftTarget)?.mcpServerIds ?? null,
  );
  const setThreadMcpServerIds = useComposerDraftStore((store) => store.setThreadMcpServerIds);

  const allIds = useMemo(() => enabledServers.map((server) => server.id), [enabledServers]);

  const isChecked = useCallback(
    (id: McpServerId) => (selection === null ? true : selection.includes(id)),
    [selection],
  );

  const activeCount = selection === null ? allIds.length : selection.length;

  const handleToggle = useCallback(
    (id: McpServerId, checked: boolean) => {
      const current = selection === null ? allIds : selection;
      const next = checked
        ? [...current.filter((existing) => existing !== id), id]
        : current.filter((existing) => existing !== id);
      // Collapse a full set back to `null` so "all enabled" stays the implicit
      // default rather than a frozen snapshot that ignores newly added servers.
      const isFullSet = next.length === allIds.length && allIds.every((x) => next.includes(x));
      setThreadMcpServerIds(composerDraftTarget, isFullSet ? null : next);
    },
    [allIds, composerDraftTarget, selection, setThreadMcpServerIds],
  );

  if (enabledServers.length === 0) {
    return null;
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  className="composer-pill shrink-0 gap-1.5"
                  aria-label="MCP servers"
                />
              }
            >
              <ServerIcon className="size-4" />
              <span className="sr-only sm:not-sr-only">MCP</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {activeCount}/{allIds.length}
              </span>
            </PopoverTrigger>
          }
        />
        <TooltipPopup side="top">
          MCP servers active for this thread ({activeCount} of {allIds.length})
        </TooltipPopup>
      </Tooltip>
      <PopoverPopup align="end" className="w-72 p-1">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
          MCP servers
        </p>
        {enabledServers.map((server) => (
          <label
            key={server.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <Checkbox
              checked={isChecked(server.id)}
              onCheckedChange={(checked) => handleToggle(server.id, checked === true)}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
              {server.name}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground/70">
              {server.transport.kind}
            </span>
          </label>
        ))}
      </PopoverPopup>
    </Popover>
  );
}
