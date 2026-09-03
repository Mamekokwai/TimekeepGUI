import assert from "node:assert/strict";
import type { BrowserSmokeContext } from "./scenarioTypes.ts";
import { evaluate, waitForExpression } from "./browserHarness.ts";

export async function runTimekeepScenarios(context: BrowserSmokeContext) {
  const { client, sessionId, runTest } = context;

  await runTest("Timekeep page renders Service data through the IPC gateway", async () => {
    await evaluate(client!, sessionId, `
      localStorage.setItem("patina:last-active-view", "dashboard");
      globalThis.__PATINA_TIMEKEEP_REQUESTS = [];
      document.querySelector('[data-sidebar-nav-item="timekeep"]')?.click();
    `);
    await waitForExpression(
      client!,
      sessionId,
      `document.querySelector('[data-presented-view="timekeep"]') !== null
        && document.body.innerText.includes("code.exe")
        && document.body.innerText.includes("smoke-service")`,
      15_000,
      "Timekeep page should render Service-backed data",
    );

    const result = await evaluate(client!, sessionId, `({
      requests: globalThis.__PATINA_TIMEKEEP_REQUESTS.map((request) => request.action),
      program: Array.from(document.querySelectorAll("body *")).find((node) => node.textContent?.trim() === "code.exe")?.textContent,
      activeSession: document.body.innerText.includes("当前会话") || document.body.innerText.includes("Active sessions"),
      history: document.body.innerText.includes("最近记录") || document.body.innerText.includes("Recent history"),
    })`) as {
      requests: string[];
      program: string | undefined;
      activeSession: boolean;
      history: boolean;
    };
    assert.ok(result.requests.includes("service_status"));
    assert.ok(result.requests.includes("list_programs"));
    assert.ok(result.requests.includes("active_sessions"));
    assert.ok(result.requests.includes("history"));
    assert.ok(result.requests.includes("get_config"));
    assert.equal(result.program, "code.exe");
    assert.equal(result.activeSession, true);
    assert.equal(result.history, true);
  });
}
