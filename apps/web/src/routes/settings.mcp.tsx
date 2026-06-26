import { createFileRoute } from "@tanstack/react-router";

import { McpServersPanel } from "../components/settings/McpServersSettings";

function SettingsMcpRoute() {
  return <McpServersPanel />;
}

export const Route = createFileRoute("/settings/mcp")({
  component: SettingsMcpRoute,
});
