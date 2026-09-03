import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseTimekeepResponse,
  TimekeepGatewayError,
} from "../src/platform/timekeep/timekeepGateway.ts";

test("Timekeep gateway parses a successful response", () => {
  const result = parseTimekeepResponse<{ refreshed: boolean }>(
    { request_id: "request-1", ok: true, data: { refreshed: true } },
    "request-1",
  );
  assert.deepEqual(result, { refreshed: true });
});

test("Timekeep gateway rejects a response for another request", () => {
  assert.throws(
    () => parseTimekeepResponse({ request_id: "request-2", ok: true, data: {} }, "request-1"),
    (error: unknown) => error instanceof TimekeepGatewayError && error.code === "REQUEST_MISMATCH",
  );
});

test("Timekeep gateway preserves structured service errors", () => {
  assert.throws(
    () => parseTimekeepResponse(
      { request_id: "request-3", ok: false, error: { code: "not_found", message: "missing" } },
      "request-3",
    ),
    (error: unknown) => error instanceof TimekeepGatewayError
      && error.code === "not_found"
      && error.message === "missing",
  );
});

test("Timekeep gateway fails closed for invalid responses", () => {
  assert.throws(
    () => parseTimekeepResponse(null, "request-4"),
    (error: unknown) => error instanceof TimekeepGatewayError && error.code === "INVALID_RESPONSE",
  );
});
