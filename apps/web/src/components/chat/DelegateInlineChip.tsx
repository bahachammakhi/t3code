import { WaypointsIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface DelegateInlineChipProps {
  className?: string;
}

export function DelegateInlineChip({ className }: DelegateInlineChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-block align-middle"
        render={
          <span
            className={cn(
              "inline-flex h-5 max-w-full select-none items-center gap-1 rounded-md border border-[#d4af37]/35 bg-[#d4af37]/12 px-1.5 align-middle text-[11px] font-medium leading-none text-[#d4af37] dark:text-[#ffd700]",
              className,
            )}
            data-delegate-inline-chip="true"
          >
            <WaypointsIcon className="size-3 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Delegate</span>
          </span>
        }
      />
      <TooltipPopup side="top" className="max-w-72 leading-tight">
        Delegation on — this message fans out into parallel sub-tasks
      </TooltipPopup>
    </Tooltip>
  );
}
