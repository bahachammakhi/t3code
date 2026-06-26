import type { ResolvedMcpServer } from "./ThreadMcpSelection.ts";

/** Quote and escape a value for use in a Codex `-c key=value` TOML override. */
const tomlString = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const sanitizeEnvVarSuffix = (name: string): string =>
  name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();

export interface CodexMcpInjection {
  readonly configArgs: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

/**
 * Translate user-registered MCP servers into Codex `-c mcp_servers.*` config
 * overrides (plus any env vars referenced by bearer-token headers). stdio
 * servers map to command/args/env; http/sse servers map to url, with an
 * Authorization header routed through `bearer_token_env_var` and other headers
 * passed via `http_headers`.
 */
export function buildCodexMcpInjection(servers: readonly ResolvedMcpServer[]): CodexMcpInjection {
  const configArgs: string[] = [];
  const env: Record<string, string> = {};

  for (const server of servers) {
    if (server.name === "t3-code") continue;
    const base = `mcp_servers.${server.name}`;

    if (server.transport.kind === "stdio") {
      configArgs.push("-c", `${base}.command=${tomlString(server.transport.command)}`);
      if (server.transport.args.length > 0) {
        const args = server.transport.args.map(tomlString).join(",");
        configArgs.push("-c", `${base}.args=[${args}]`);
      }
      for (const [key, value] of Object.entries(server.transport.env)) {
        configArgs.push("-c", `${base}.env.${key}=${tomlString(value)}`);
      }
      continue;
    }

    configArgs.push("-c", `${base}.url=${tomlString(server.transport.url)}`);
    for (const [headerName, headerValue] of Object.entries(server.transport.headers)) {
      if (/^authorization$/i.test(headerName)) {
        const envVar = `T3_MCP_BEARER_TOKEN_${sanitizeEnvVarSuffix(server.name)}`;
        env[envVar] = headerValue.replace(/^Bearer\s+/i, "");
        configArgs.push("-c", `${base}.bearer_token_env_var=${tomlString(envVar)}`);
      } else {
        configArgs.push("-c", `${base}.http_headers.${headerName}=${tomlString(headerValue)}`);
      }
    }
  }

  return { configArgs, env };
}
