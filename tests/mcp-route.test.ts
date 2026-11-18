import { describe, expect, it } from "vitest";
import { POST } from "../app/api/mcp/route.ts";

const post = (body: string) => POST(new Request("https://pomodoro-timer.bookchaowalit.com/api/mcp", { method: "POST", body }));

describe("POST /api/mcp", () => {
  it("answers a JSON-RPC call with the timer modes tool", async () => {
    const response = await post(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain("get_timer_modes");
  });

  it("rejects a body that is not JSON with a parse error", async () => {
    const response = await post("{not json");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32700);
  });

  it("acknowledges a notification with 202 and no body", async () => {
    const response = await post(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(response.status).toBe(202);
  });
});
