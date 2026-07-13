import { type KeyboardEvent, type MouseEvent } from "react";
import { WaypointsIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface DelegateInlineChipProps {
  className?: string;
  onClick?: () => void;
  subagentCount?: number;
}

export function DelegateInlineChip({
  className,
  onClick,
  subagentCount = 0,
}: DelegateInlineChipProps) {
  const clickable = onClick != null && subagentCount > 0;
  const label = subagentCount > 0 ? `Delegate (${subagentCount})` : "Delegate";
  const chip = (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-md border border-[#d4af37]/35 bg-[#d4af37]/12 px-1.5 align-middle text-[11px] font-medium leading-none text-[#d4af37] dark:text-[#ffd700]",
        clickable
          ? "cursor-pointer transition-colors hover:border-[#d4af37]/55 hover:bg-[#d4af37]/20"
          : "select-none",
        className,
      )}
      data-delegate-inline-chip="true"
      {...(clickable
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: (event: MouseEvent) => {
              event.stopPropagation();
              onClick();
            },
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onClick();
            },
          }
        : {})}
    >
      <WaypointsIcon className="size-3 shrink-0 opacity-90" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger className="inline-block align-middle" render={chip} />
      <TooltipPopup side="top" className="max-w-72 leading-tight">
        {clickable
          ? "Open delegated subagents in the side panel"
          : "Delegation on — this message fans out into parallel sub-tasks"}
      </TooltipPopup>
    </Tooltip>
  );
}
