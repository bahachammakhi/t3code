import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  delegatedSubagentSurfaceId,
  getDelegatedChildrenForParent,
  toDelegatedSubagentSummary,
} from "./delegatedSubagents";

const parentId = ThreadId.make("parent");
const childA = ThreadId.make("child-a");
const childB = ThreadId.make("child-b");

describe("delegatedSubagents", () => {
  it("returns only direct children of the parent thread", () => {
    const threads = [
      { id: parentId, title: "Lead" },
      { id: childA, title: "Child A", parentThreadId: parentId, taskLabel: "Auth" },
      { id: childB, title: "Child B", parentThreadId: parentId },
      { id: ThreadId.make("other"), title: "Other" },
    ];

    expect(getDelegatedChildrenForParent(threads, parentId).map((thread) => thread.id)).toEqual([
      childA,
      childB,
    ]);
  });

  it("builds a subagent summary and surface id", () => {
    const summary = toDelegatedSubagentSummary({
      id: childA,
      title: "Child A",
      parentThreadId: parentId,
      taskLabel: "Auth",
    });

    expect(summary).toEqual({
      id: childA,
      title: "Child A",
      taskLabel: "Auth",
      parentThreadId: parentId,
    });
    expect(delegatedSubagentSurfaceId(childA)).toBe(`subagent:${childA}`);
  });
});
