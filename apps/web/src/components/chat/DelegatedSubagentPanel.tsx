import { scopeProjectRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { WaypointsIcon } from "lucide-react";
import { memo, useMemo, useRef } from "react";
import type { LegendListRef } from "@legendapp/list/react";

import { deriveTimelineEntries, deriveWorkLogEntries } from "../../session-logic";
import {
  useProject,
  useThread,
  useThreadActivities,
  useThreadMessages,
  useThreadShell,
} from "../../state/entities";
import { useTheme } from "../../hooks/useTheme";
import { useUiStateStore } from "../../uiStateStore";
import { MessagesTimeline } from "./MessagesTimeline";
import { resolveThreadStatusPill } from "../Sidebar.logic";
import { ThreadStatusLabel } from "../ThreadStatusIndicators";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";

const EMPTY_MAP = new Map();
const NOOP = () => {};

interface DelegatedSubagentPanelProps {
  readonly parentThreadRef: ScopedThreadRef;
  readonly subagentThreadRef: ScopedThreadRef;
  readonly timestampFormat: import("@t3tools/contracts/settings").TimestampFormat;
}

export const DelegatedSubagentPanel = memo(function DelegatedSubagentPanel(
  props: DelegatedSubagentPanelProps,
) {
  const { subagentThreadRef, timestampFormat } = props;
  const listRef = useRef<LegendListRef | null>(null);
  const { resolvedTheme } = useTheme();
  const subagentThread = useThread(subagentThreadRef);
  const subagentThreadShell = useThreadShell(subagentThreadRef);
  const messages = useThreadMessages(subagentThreadRef);
  const activities = useThreadActivities(subagentThreadRef);
  const routeThreadKey = scopedThreadKey(subagentThreadRef);
  const lastVisitedAt = useUiStateStore(
    (state) => state.threadLastVisitedAtById[routeThreadKey] ?? undefined,
  );

  const projectRef = useMemo(
    () =>
      subagentThread
        ? scopeProjectRef(subagentThread.environmentId, subagentThread.projectId)
        : null,
    [subagentThread],
  );
  const project = useProject(projectRef);
  const workspaceRoot = project?.workspaceRoot;
  const gitCwd = subagentThread?.worktreePath ?? workspaceRoot ?? undefined;

  const workLogEntries = useMemo(() => deriveWorkLogEntries(activities), [activities]);
  const timelineEntries = useMemo(
    () => deriveTimelineEntries(messages, subagentThread?.proposedPlans ?? [], workLogEntries),
    [messages, subagentThread?.proposedPlans, workLogEntries],
  );

  const latestTurn = subagentThread?.latestTurn ?? null;
  const isWorking =
    subagentThread?.session?.status === "running" && subagentThread.session.activeTurnId != null;
  const threadStatus =
    subagentThreadShell &&
    resolveThreadStatusPill({
      thread: { ...subagentThreadShell, lastVisitedAt },
    });

  if (!subagentThread) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading subagent…
      </div>
    );
  }

  const displayTitle = subagentThread.taskLabel?.trim() || subagentThread.title;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-[#d4af37]/35 bg-[#d4af37]/12 text-[#d4af37] dark:text-[#ffd700]">
          <WaypointsIcon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayTitle}</p>
          <p className="truncate text-[11px] text-muted-foreground">Delegated subagent</p>
        </div>
        {threadStatus ? <ThreadStatusLabel status={threadStatus} /> : null}
      </div>
      <ScrollArea className={cn("min-h-0 flex-1")}>
        <MessagesTimeline
          key={subagentThread.id}
          isWorking={isWorking}
          activeTurnInProgress={isWorking}
          activeTurnStartedAt={latestTurn?.startedAt ?? null}
          listRef={listRef}
          timelineEntries={timelineEntries}
          latestTurn={latestTurn}
          runningTurnId={
            subagentThread.session?.status === "running"
              ? subagentThread.session.activeTurnId
              : null
          }
          turnDiffSummaryByAssistantMessageId={EMPTY_MAP}
          routeThreadKey={routeThreadKey}
          onOpenTurnDiff={NOOP}
          revertTurnCountByUserMessageId={EMPTY_MAP}
          onRevertUserMessage={NOOP}
          isRevertingCheckpoint={false}
          onImageExpand={NOOP}
          activeThreadEnvironmentId={subagentThread.environmentId}
          markdownCwd={gitCwd}
          resolvedTheme={resolvedTheme}
          timestampFormat={timestampFormat}
          workspaceRoot={workspaceRoot}
          anchorMessageId={null}
          onAnchorReady={NOOP}
          onAnchorSizeChanged={NOOP}
          contentInsetEndAdjustment={0}
          onIsAtEndChange={NOOP}
          onManualNavigation={NOOP}
        />
      </ScrollArea>
    </div>
  );
});
