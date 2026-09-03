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

  await runTest("Timekeep primary actions support direct focus and low-noise row controls", async () => {
    await evaluate(client!, sessionId, `
      Array.from(document.querySelectorAll("button"))
        .find((node) => node.textContent?.includes("添加程序") && node.closest("header"))
        ?.click();
    `);
    await waitForExpression(
      client!,
      sessionId,
      `document.querySelector('[role="dialog"]') !== null`,
      5_000,
      "Timekeep scan dialog should open",
    );
    await waitForExpression(
      client!,
      sessionId,
      `document.activeElement?.getAttribute("aria-label") === "程序名"`,
      5_000,
      "Timekeep scan dialog should focus its search field",
    );

    const scanFocus = await evaluate(client!, sessionId, `({
      activeLabel: document.activeElement?.getAttribute("aria-label"),
      actionWrap: getComputedStyle(document.querySelector(".qp-dialog-actions")).flexWrap,
      settingsOpen: document.querySelector("[data-timekeep-service-settings]")?.hasAttribute("open") ?? false,
      programActions: [
        document.querySelector('[aria-label="编辑程序 code.exe"]'),
        document.querySelector('[aria-label="重置统计 code.exe"]'),
        document.querySelector('[aria-label="移除 code.exe"]'),
      ].every((node) => node?.classList.contains("qp-icon-action")),
      programActionSize: getComputedStyle(document.querySelector('[aria-label="编辑程序 code.exe"]')).width,
    })`) as {
      activeLabel: string | null;
      actionWrap: string;
      settingsOpen: boolean;
      programActions: boolean;
      programActionSize: string;
    };
    assert.equal(scanFocus.activeLabel, "程序名");
    assert.equal(scanFocus.actionWrap, "wrap");
    assert.equal(scanFocus.settingsOpen, false);
    assert.equal(scanFocus.programActions, true);
    assert.equal(scanFocus.programActionSize, "32px");

    await evaluate(client!, sessionId, `
      Array.from(document.querySelectorAll("button"))
        .find((node) => node.textContent?.trim() === "手动添加")
        ?.click();
    `);
    await waitForExpression(
      client!,
      sessionId,
      `document.querySelector('[role="dialog"] input') !== null
        && document.activeElement?.tagName === "INPUT"`,
      5_000,
      "Timekeep manual add dialog should open",
    );
    const manualFocus = await evaluate(client!, sessionId, `document.activeElement?.tagName === "INPUT"`);
    assert.equal(manualFocus, true);

    await evaluate(client!, sessionId, `
      Array.from(document.querySelectorAll('[role="dialog"] button'))
        .find((node) => node.textContent?.trim() === "取消")
        ?.click();
    `);
  });
}
