import type { McpServerConfig, ServerSettings, ThreadId } from "@t3tools/contracts";

/**
 * Per-thread snapshot of the user-registered MCP servers that should be active
 * for the current turn. Resolved from `ServerSettings.mcpServers` ∩ the thread's
 * selection at dispatch time (see ws.ts) and read back, transport-agnostic, by
 * each provider adapter — mirroring the in-memory `McpProviderSession` registry.
 */

export type ResolvedMcpServer = McpServerConfig;

const byThread = new Map<ThreadId, readonly ResolvedMcpServer[]>();

export function setThreadMcpServers(
  threadId: ThreadId,
  servers: readonly ResolvedMcpServer[],
): void {
  if (servers.length === 0) {
    byThread.delete(threadId);
    return;
  }
  byThread.set(threadId, servers);
}

export function readThreadMcpServers(threadId: ThreadId): readonly ResolvedMcpServer[] {
  return byThread.get(threadId) ?? [];
}

export function clearThreadMcpServers(threadId: ThreadId): void {
  byThread.delete(threadId);
}

export function clearAllThreadMcpServers(): void {
  byThread.clear();
}

/**
 * Resolve which configured MCP servers apply to a turn. An undefined selection
 * means "every enabled server"; an explicit (possibly empty) list narrows to
 * the chosen ids. Disabled servers are always excluded.
 */
export function resolveMcpServers(
  settings: ServerSettings,
  selectedIds: readonly string[] | undefined,
): readonly ResolvedMcpServer[] {
  const enabled = Object.values(settings.mcpServers).filter((server) => server.enabled);
  if (selectedIds === undefined) {
    return enabled;
  }
  const chosen = new Set(selectedIds);
  return enabled.filter((server) => chosen.has(server.id));
}
