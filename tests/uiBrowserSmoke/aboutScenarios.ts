import assert from "node:assert/strict";
import type { BrowserSmokeContext } from "./scenarioTypes.ts";
import { evaluate, jsonString, waitForExpression } from "./browserHarness.ts";

export async function runAboutScenarios(context: BrowserSmokeContext) {
  const { client, sessionId, runTest } = context;

  await runTest("About cold navigation renders stable static content without a loading frame", async () => {
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          localStorage.setItem("timekeepgui:last-active-view", "dashboard");
          localStorage.setItem("__time_tracker_settings_query_delay_ms", "900");
          location.reload();
          return true;
        })()
      `),
      true,
    );
    await waitForExpression(
      client!,
      sessionId,
      `Boolean(document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("关于"))} + ']'))`,
    );
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const node = document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("关于"))} + ']');
          node?.click();
          return Boolean(node);
        })()
      `),
      true,
    );
    const pendingState = JSON.parse(String(await evaluate(client!, sessionId, `JSON.stringify({
      presentedView: document.querySelector("main.qp-canvas")?.getAttribute("data-presented-view") ?? null,
      aboutMounted: Boolean(document.querySelector(".about-center-panel")),
      dashboardMounted: Boolean(document.querySelector(".dashboard-workspace")),
      showsLoadingCopy: document.body.innerText.includes("加载中..."),
    })`))) as {
      presentedView: string | null;
      aboutMounted: boolean;
      dashboardMounted: boolean;
      showsLoadingCopy: boolean;
    };
    assert.ok(pendingState.presentedView === "dashboard" || pendingState.presentedView === "about");
    assert.equal(pendingState.presentedView === "about" ? pendingState.aboutMounted : pendingState.dashboardMounted, true);
    assert.equal(pendingState.showsLoadingCopy, false);

    await waitForExpression(
      client!,
      sessionId,
      `document.querySelector("main.qp-canvas")?.getAttribute("data-presented-view") === "about"
        && Boolean(document.querySelector(".about-center-panel"))`,
      15_000,
      "About static content should present without waiting for shared bootstrap",
    );
    await evaluate(client!, sessionId, `localStorage.removeItem("__time_tracker_settings_query_delay_ms")`);
  });

  await runTest("About page exposes only the TimekeepGUI project address", async () => {
    const clicked = await evaluate(client!, sessionId, `
      (() => {
        const node = document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("关于"))} + ']');
        node?.click();
        return Boolean(node);
      })()
    `);
    assert.equal(clicked, true, "missing About navigation entry");
    await waitForExpression(client!, sessionId, "Boolean(document.querySelector('.about-center-panel'))");

    const state = await evaluate(client!, sessionId, `
      (() => ({
        actionCount: document.querySelectorAll('.about-pill-action').length,
        projectLabel: document.querySelectorAll('.about-pill-action')[0]?.textContent?.trim() ?? null,
        blogLabel: document.querySelectorAll('.about-pill-action')[1]?.textContent?.trim() ?? null,
        hasFeedback: document.body.textContent?.includes('问题反馈') ?? false,
        hasSponsor: document.body.textContent?.includes('赞助项目') ?? false,
        hasQq: document.body.textContent?.includes('QQ 频道') ?? false,
        hasKofi: document.body.textContent?.includes('Ko-fi') ?? false,
        hasDialog: Boolean(document.querySelector('[role="dialog"]')),
      }))()
    `) as {
      actionCount: number;
      projectLabel: string | null;
      blogLabel: string | null;
      hasFeedback: boolean;
      hasSponsor: boolean;
      hasQq: boolean;
      hasKofi: boolean;
      hasDialog: boolean;
    };
    assert.equal(state.actionCount, 2);
    assert.equal(state.projectLabel, "项目地址");
    assert.equal(state.blogLabel, "个人博客");
    assert.equal(state.hasFeedback, false);
    assert.equal(state.hasSponsor, false);
    assert.equal(state.hasQq, false);
    assert.equal(state.hasKofi, false);
    assert.equal(state.hasDialog, false);

    await evaluate(client!, sessionId, `
      (() => {
        globalThis.__TIME_TRACKER_OPENED_URLS = [];
        document.querySelectorAll('.about-pill-action')[0]?.click();
      })()
    `);
    await waitForExpression(
      client!,
      sessionId,
      `globalThis.__TIME_TRACKER_OPENED_URLS.includes('https://github.com/Mamekokwai/TimekeepGUI')`,
    );
    await evaluate(client!, sessionId, `
      (() => {
        globalThis.__TIME_TRACKER_OPENED_URLS = [];
        document.querySelectorAll('.about-pill-action')[1]?.click();
      })()
    `);
    await waitForExpression(
      client!,
      sessionId,
      `globalThis.__TIME_TRACKER_OPENED_URLS.includes('https://blog.nywerya.com')`,
    );
  });

  await runTest("About page keeps one centered update layout on wide desktop", async () => {
    await client!.command("Emulation.setDeviceMetricsOverride", {
      width: 1800,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);

    try {
      const clicked = await evaluate(client!, sessionId, `
        (() => {
          const node = document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("关于"))} + ']');
          node?.click();
          return Boolean(node);
        })()
      `);
      assert.equal(clicked, true, "missing About navigation entry");
      await waitForExpression(client!, sessionId, "Boolean(document.querySelector('.about-center-panel .about-center-update'))");

      const wideLayout = await evaluate(client!, sessionId, `
        (async () => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const panel = document.querySelector('.about-center-panel');
          const profile = document.querySelector('.about-center-profile');
          const actions = document.querySelector('.about-pill-row');
          const update = document.querySelector('.about-center-update.update-status-compact');
          if (!panel || !profile || !actions || !update) return null;
          const profileRect = profile.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          const updateRect = update.getBoundingClientRect();
          return {
            panelColumns: getComputedStyle(panel).gridTemplateColumns,
            updateIsBelowActions: updateRect.top > actionsRect.bottom,
            updateIsCenteredWithActions: Math.abs((updateRect.left + updateRect.width / 2) - (actionsRect.left + actionsRect.width / 2)) < 2,
            actionsStayBelowProfile: actionsRect.top > profileRect.bottom,
          };
        })()
      `) as {
        panelColumns: string;
        updateIsBelowActions: boolean;
        updateIsCenteredWithActions: boolean;
        actionsStayBelowProfile: boolean;
      } | null;
      assert.ok(wideLayout);
      assert.equal(wideLayout.panelColumns.trim().split(/\s+/).length, 1);
      assert.equal(wideLayout.updateIsBelowActions, true);
      assert.equal(wideLayout.updateIsCenteredWithActions, true);
      assert.equal(wideLayout.actionsStayBelowProfile, true);
    } finally {
      await client!.command("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 820,
        deviceScaleFactor: 1,
        mobile: false,
      }, sessionId);
    }
  });
}
