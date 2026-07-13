import type { ThreadId } from "@t3tools/contracts";

export type DelegatedSubagentSummary = {
  readonly id: ThreadId;
  readonly title: string;
  readonly taskLabel: string | null;
  readonly parentThreadId: ThreadId;
};

type ThreadWithDelegation = {
  readonly id: ThreadId;
  readonly title: string;
  readonly parentThreadId?: ThreadId | null | undefined;
  readonly taskLabel?: string | null | undefined;
};

export function getDelegatedChildrenForParent<T extends ThreadWithDelegation>(
  threads: readonly T[],
  parentThreadId: ThreadId,
): T[] {
  return threads.filter((thread) => thread.parentThreadId === parentThreadId);
}

export function toDelegatedSubagentSummary(thread: ThreadWithDelegation): DelegatedSubagentSummary {
  const parentThreadId = thread.parentThreadId;
  if (parentThreadId == null) {
    throw new Error("Expected a delegated subagent thread with parentThreadId.");
  }
  return {
    id: thread.id,
    title: thread.title,
    taskLabel: thread.taskLabel ?? null,
    parentThreadId,
  };
}

export function delegatedSubagentSurfaceId(threadId: ThreadId): `subagent:${ThreadId}` {
  return `subagent:${threadId}`;
}
