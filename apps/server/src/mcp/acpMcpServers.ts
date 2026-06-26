import type * as EffectAcpSchema from "effect-acp/schema";

import type { ResolvedMcpServer } from "./ThreadMcpSelection.ts";

/**
 * Translate user-registered MCP servers into the ACP `McpServer` shape shared
 * by the Cursor and Grok adapters. stdio maps to the command variant; http/sse
 * map to the URL variants with header tuples.
 */
export function toAcpMcpServer(server: ResolvedMcpServer): EffectAcpSchema.McpServer {
  if (server.transport.kind === "stdio") {
    return {
      name: server.name,
      command: server.transport.command,
      args: [...server.transport.args],
      env: Object.entries(server.transport.env).map(([name, value]) => ({ name, value })),
    };
  }
  return {
    type: server.transport.kind,
    name: server.name,
    url: server.transport.url,
    headers: Object.entries(server.transport.headers).map(([name, value]) => ({ name, value })),
  };
}

export function toAcpMcpServers(
  servers: readonly ResolvedMcpServer[],
): EffectAcpSchema.McpServer[] {
  return servers.filter((server) => server.name !== "t3-code").map(toAcpMcpServer);
}
