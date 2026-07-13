import type {
  ProviderDriverKind,
  ProviderInstanceId,
  ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { WaypointsIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { ProviderModelPicker } from "./ProviderModelPicker";
import type { ProviderInstanceEntry } from "../../providerInstances";
import type { AppModelOption } from "../../modelSelection";

const SUBAGENT_COUNT_MIN = 1;
const SUBAGENT_COUNT_MAX = 5;

export interface DelegateSettingsPopoverProps {
  readonly delegateEnabled: boolean;
  readonly onDelegateEnabledChange: (enabled: boolean) => void;
  readonly subagentCount: number;
  readonly subagentInstanceId: ProviderInstanceId;
  readonly subagentModel: string;
  readonly lockedProvider: ProviderDriverKind | null;
  readonly lockedContinuationGroupKey?: string | null;
  readonly instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<AppModelOption>>;
  readonly terminalOpen: boolean;
  readonly onSubagentCountChange: (count: number) => void;
  readonly onSubagentModelChange: (instanceId: ProviderInstanceId, model: string) => void;
}

function clampSubagentCount(count: number): number {
  return Math.min(SUBAGENT_COUNT_MAX, Math.max(SUBAGENT_COUNT_MIN, Math.round(count)));
}

export const DelegateSubagentCountSlider = memo(function DelegateSubagentCountSlider(props: {
  readonly value: number;
  readonly onChange: (count: number) => void;
}) {
  const value = clampSubagentCount(props.value);
  const steps = Array.from(
    { length: SUBAGENT_COUNT_MAX - SUBAGENT_COUNT_MIN + 1 },
    (_, index) => SUBAGENT_COUNT_MIN + index,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Parallel subagents</span>
        <span className="tabular-nums text-foreground">{value}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${step} subagent${step === 1 ? "" : "s"}`}
            aria-pressed={step === value}
            className={cn(
              "rounded-md py-1.5 text-xs font-medium transition-colors",
              step === value
                ? "bg-[#3b82f6] text-white"
                : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => props.onChange(step)}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  );
});

export const DelegateSettingsPopover = memo(function DelegateSettingsPopover(
  props: DelegateSettingsPopoverProps,
) {
  const [open, setOpen] = useState(false);
  const [isSubagentModelPickerOpen, setIsSubagentModelPickerOpen] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && !props.delegateEnabled) {
        props.onDelegateEnabledChange(true);
      }
      setOpen(next);
    },
    [props],
  );

  const handleDisable = useCallback(() => {
    props.onDelegateEnabledChange(false);
    setOpen(false);
  }, [props]);

  const delegateButtonTitle = props.delegateEnabled
    ? open
      ? "Configure parallel sub-tasks"
      : "Delegation on — click to configure"
    : "Delegate: split your message into parallel sub-tasks";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              "composer-pill shrink-0 whitespace-nowrap",
              props.delegateEnabled
                ? "border-[#d4af37]/45! bg-[#d4af37]/15! text-[#ffd700]! hover:bg-[#d4af37]/25!"
                : "text-[#c9a227]/70 hover:text-[#d4af37]",
            )}
            size="sm"
            type="button"
            aria-pressed={props.delegateEnabled}
            aria-label="Delegate settings"
            aria-haspopup="dialog"
            aria-expanded={open}
            title={delegateButtonTitle}
          />
        }
      >
        <WaypointsIcon />
        <span className="sr-only sm:not-sr-only">Delegate</span>
      </PopoverTrigger>
      <PopoverPopup side="top" align="start" className="w-[min(20rem,calc(100vw-1.5rem))] p-3">
        <div data-chat-delegate-settings="true" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Delegate</span>
            <Button variant="ghost" size="sm" type="button" onClick={handleDisable}>
              Turn off
            </Button>
          </div>
          <DelegateSubagentCountSlider
            value={props.subagentCount}
            onChange={props.onSubagentCountChange}
          />
          <ProviderModelPicker
            compact
            activeInstanceId={props.subagentInstanceId}
            model={props.subagentModel}
            lockedProvider={props.lockedProvider}
            lockedContinuationGroupKey={props.lockedContinuationGroupKey ?? null}
            instanceEntries={props.instanceEntries}
            keybindings={props.keybindings}
            modelOptionsByInstance={props.modelOptionsByInstance}
            terminalOpen={props.terminalOpen}
            open={isSubagentModelPickerOpen}
            triggerClassName="composer-pill w-full max-w-none justify-start"
            onOpenChange={setIsSubagentModelPickerOpen}
            onInstanceModelChange={props.onSubagentModelChange}
          />
        </div>
      </PopoverPopup>
    </Popover>
  );
});
