/**
 * Minimal JSON-RPC 2.0 handler for the app's /api/mcp endpoint.
 *
 * The timer keeps no user data, so the single tool returns the app's real,
 * public configuration: the three modes and their fixed durations.
 */
import { LONG_BREAK_EVERY, MODES, type Mode } from "./timer.ts";

export type JsonRpcId = number | string | null;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

type JsonRpcRequest = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: unknown };

export const PROTOCOL_VERSION = "2024-11-05";
export const TOOL_NAME = "get_timer_modes";

function isRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.jsonrpc === "2.0" && typeof candidate.method === "string";
}

function toolNameOf(params: unknown): unknown {
  if (typeof params !== "object" || params === null) return undefined;
  return (params as Record<string, unknown>).name;
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function timerModes() {
  return {
    modes: (Object.keys(MODES) as Mode[]).map(id => ({ id, label: MODES[id].label, minutes: MODES[id].duration / 60 })),
    longBreakEvery: LONG_BREAK_EVERY,
  };
}

/** Returns null for notifications (requests without an id), which get no reply. */
export function handleRpc(body: unknown): JsonRpcResponse | null {
  if (!isRequest(body)) return error(null, -32600, "Invalid Request");
  const id = body.id ?? null;
  const isNotification = body.id === undefined;

  switch (body.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: "Pomodoro Timer", version: "1.0.0" } },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [{ name: TOOL_NAME, description: "List the timer modes and their fixed durations", inputSchema: { type: "object", properties: {} } }],
        },
      };
    case "tools/call": {
      const name = toolNameOf(body.params);
      if (name !== TOOL_NAME) return error(id, -32602, `Unknown tool: ${String(name)}`);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(timerModes()) }] } };
    }
    default:
      if (isNotification) return null;
      return error(id, -32601, `Method not found: ${body.method}`);
  }
}
