"use client";

import { PlusIcon, ServerIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { McpServerId, type McpServerConfig, type McpServerTransport } from "@t3tools/contracts";

import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { randomUUID } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

type TransportKind = McpServerTransport["kind"];

const TRANSPORT_OPTIONS: ReadonlyArray<{ value: TransportKind; label: string }> = [
  { value: "stdio", label: "stdio (local command)" },
  { value: "http", label: "HTTP" },
  { value: "sse", label: "SSE" },
];

/** Parse `KEY=VALUE` lines into a record; blank lines and missing `=` are skipped. */
function parseKeyValueLines(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key !== "") result[key] = value;
  }
  return result;
}

function serializeKeyValueLines(record: Readonly<Record<string, string>>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

/** Split args by whitespace/newlines, preserving nothing fancy — one token per arg. */
function parseArgs(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

function transportSummary(transport: McpServerTransport): string {
  return transport.kind === "stdio"
    ? `stdio · ${transport.command}`
    : `${transport.kind.toUpperCase()} · ${transport.url}`;
}

interface McpServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly existing: McpServerConfig | null;
  readonly existingNames: ReadonlySet<string>;
  readonly onSave: (server: McpServerConfig) => void;
}

function McpServerDialog({
  open,
  onOpenChange,
  existing,
  existingNames,
  onSave,
}: McpServerDialogProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TransportKind>("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever the dialog opens for a (possibly different) server.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (existing?.id ?? "new") : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    setError(null);
    if (existing) {
      setName(existing.name);
      setKind(existing.transport.kind);
      if (existing.transport.kind === "stdio") {
        setCommand(existing.transport.command);
        setArgsText(existing.transport.args.join(" "));
        setEnvText(serializeKeyValueLines(existing.transport.env));
        setUrl("");
        setHeadersText("");
      } else {
        setUrl(existing.transport.url);
        setHeadersText(serializeKeyValueLines(existing.transport.headers));
        setCommand("");
        setArgsText("");
        setEnvText("");
      }
    } else {
      setName("");
      setKind("stdio");
      setCommand("");
      setArgsText("");
      setEnvText("");
      setUrl("");
      setHeadersText("");
    }
  }

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      setError("Name is required.");
      return;
    }
    const collidesWithOther =
      existingNames.has(trimmedName) && trimmedName !== existing?.name;
    if (collidesWithOther) {
      setError("Another MCP server already uses this name.");
      return;
    }

    let transport: McpServerTransport;
    if (kind === "stdio") {
      if (command.trim() === "") {
        setError("Command is required for stdio servers.");
        return;
      }
      transport = {
        kind: "stdio",
        command: command.trim(),
        args: parseArgs(argsText),
        env: parseKeyValueLines(envText),
      };
    } else {
      if (url.trim() === "") {
        setError("URL is required for HTTP/SSE servers.");
        return;
      }
      transport = {
        kind,
        url: url.trim(),
        headers: parseKeyValueLines(headersText),
      };
    }

    onSave({
      id: existing?.id ?? McpServerId.make(randomUUID()),
      name: trimmedName,
      enabled: existing?.enabled ?? true,
      transport,
    });
    onOpenChange(false);
  }, [
    argsText,
    command,
    envText,
    existing,
    existingNames,
    headersText,
    kind,
    name,
    onOpenChange,
    onSave,
    url,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit MCP server" : "Add MCP server"}</DialogTitle>
          <DialogDescription>
            Register an MCP server you can enable per coding thread.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input
              id="mcp-name"
              value={name}
              placeholder="context7"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Transport</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as TransportKind)}
            >
              <SelectTrigger aria-label="Transport">
                <SelectValue>
                  {TRANSPORT_OPTIONS.find((option) => option.value === kind)?.label ?? kind}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {TRANSPORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          {kind === "stdio" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-command">Command</Label>
                <Input
                  id="mcp-command"
                  value={command}
                  placeholder="npx"
                  onChange={(event) => setCommand(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-args">Arguments</Label>
                <Input
                  id="mcp-args"
                  value={argsText}
                  placeholder="-y @upstash/context7-mcp"
                  onChange={(event) => setArgsText(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-env">Environment (KEY=VALUE per line)</Label>
                <Textarea
                  id="mcp-env"
                  value={envText}
                  rows={3}
                  placeholder={"API_KEY=sk-..."}
                  onChange={(event) => setEnvText(event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-url">URL</Label>
                <Input
                  id="mcp-url"
                  value={url}
                  placeholder="https://mcp.example.com/sse"
                  onChange={(event) => setUrl(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-headers">Headers (Name=Value per line)</Label>
                <Textarea
                  id="mcp-headers"
                  value={headersText}
                  rows={3}
                  placeholder={"Authorization=Bearer ..."}
                  onChange={(event) => setHeadersText(event.target.value)}
                />
              </div>
            </>
          )}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{existing ? "Save" : "Add server"}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function McpServersPanel() {
  const settings = usePrimarySettings();
  const updateSettings = useUpdatePrimarySettings();

  const servers = useMemo(
    () => Object.values(settings.mcpServers ?? {}),
    [settings.mcpServers],
  );
  const existingNames = useMemo(
    () => new Set(servers.map((server) => server.name)),
    [servers],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerConfig | null>(null);

  const persist = useCallback(
    (next: Record<string, McpServerConfig>) => {
      updateSettings({ mcpServers: next as Record<McpServerId, McpServerConfig> });
    },
    [updateSettings],
  );

  const handleSave = useCallback(
    (server: McpServerConfig) => {
      persist({ ...settings.mcpServers, [server.id]: server });
    },
    [persist, settings.mcpServers],
  );

  const handleToggle = useCallback(
    (server: McpServerConfig, enabled: boolean) => {
      persist({ ...settings.mcpServers, [server.id]: { ...server, enabled } });
    },
    [persist, settings.mcpServers],
  );

  const handleRemove = useCallback(
    (server: McpServerConfig) => {
      const next = { ...settings.mcpServers };
      delete next[server.id];
      persist(next);
    },
    [persist, settings.mcpServers],
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((server: McpServerConfig) => {
    setEditing(server);
    setDialogOpen(true);
  }, []);

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="MCP Servers"
        icon={<ServerIcon className="size-3.5" />}
        headerAction={
          <Button size="sm" variant="outline" onClick={openAdd}>
            <PlusIcon className="size-3.5" />
            Add
          </Button>
        }
      >
        {servers.length === 0 ? (
          <SettingsRow
            title="No MCP servers yet"
            description="Add a Model Context Protocol server to expose its tools to your coding agents. Enabled servers can be toggled per thread from the composer."
          />
        ) : (
          servers.map((server) => (
            <SettingsRow
              key={server.id}
              title={
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => openEdit(server)}
                >
                  {server.name}
                </button>
              }
              description={transportSummary(server.transport)}
              control={
                <div className="flex items-center gap-3">
                  <Switch
                    aria-label={`Enable ${server.name}`}
                    checked={server.enabled}
                    onCheckedChange={(checked) => handleToggle(server, checked)}
                  />
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove ${server.name}`}
                    onClick={() => handleRemove(server)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              }
            />
          ))
        )}
      </SettingsSection>

      <McpServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        existingNames={existingNames}
        onSave={handleSave}
      />
    </SettingsPageContainer>
  );
}
