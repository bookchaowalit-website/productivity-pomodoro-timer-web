import assert from "node:assert/strict";
import { test } from "node:test";
import { handleRpc, TOOL_NAME } from "../lib/mcp.ts";

test("initialize answers with the Pomodoro server info", () => {
  const response = handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.deepEqual(response, {
    jsonrpc: "2.0",
    id: 1,
    result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Pomodoro Timer", version: "1.0.0" } },
  });
});

test("tools/list advertises only the timer-modes tool", () => {
  const response = handleRpc({ jsonrpc: "2.0", id: "a", method: "tools/list" });
  assert.ok(response && "result" in response);
  const { tools } = response.result as { tools: { name: string }[] };
  assert.deepEqual(tools.map(tool => tool.name), [TOOL_NAME]);
});

test("tools/call returns the real mode durations, not sample data", () => {
  const response = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: TOOL_NAME } });
  assert.ok(response && "result" in response);
  const { content } = response.result as { content: { type: string; text: string }[] };
  assert.equal(content[0].type, "text");
  assert.deepEqual(JSON.parse(content[0].text), {
    modes: [
      { id: "work", label: "Focus", minutes: 25 },
      { id: "shortBreak", label: "Short break", minutes: 5 },
      { id: "longBreak", label: "Long break", minutes: 15 },
    ],
    longBreakEvery: 4,
  });
});

test("unknown tools, unknown methods and malformed requests get JSON-RPC errors", () => {
  assert.deepEqual(handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "nope" } }), {
    jsonrpc: "2.0", id: 3, error: { code: -32602, message: "Unknown tool: nope" },
  });
  assert.deepEqual(handleRpc({ jsonrpc: "2.0", id: 4, method: "bogus" }), {
    jsonrpc: "2.0", id: 4, error: { code: -32601, message: "Method not found: bogus" },
  });
  assert.deepEqual(handleRpc({ id: 5, method: "initialize" }), {
    jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" },
  });
});

test("notifications (no id) get no reply", () => {
  assert.equal(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});
