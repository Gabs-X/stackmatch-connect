import { afterEach, describe, expect, it, vi } from "vitest";
import { currentRequestId, log, redact, requestIdFrom, withRequestId } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("structured logs", () => {
  it("never writes secrets and masks e-mails", () => {
    expect(
      redact({
        password: "segredo123",
        sessionToken: "abc",
        code: "123456",
        headers: { Authorization: "Bearer x", cookie: "sid=1" },
        apiKey: "re_123",
        user: { email: "marina@example.com", note: "fale com bia@acme.com" },
      }),
    ).toEqual({
      password: "[redacted]",
      sessionToken: "[redacted]",
      code: "[redacted]",
      headers: { Authorization: "[redacted]", cookie: "[redacted]" },
      apiKey: "[redacted]",
      user: { email: "m***@example.com", note: "fale com b***@acme.com" },
    });
  });

  it("writes one JSON line with the request's id", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await withRequestId("req-12345678", async () => {
      await Promise.resolve();
      log("info", "report.filed", { targetId: "job-1", email: "ana@example.com" });
    });
    log("info", "outside");
    const [inside, outside] = info.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(inside).toMatchObject({
      level: "info",
      event: "report.filed",
      requestId: "req-12345678",
      targetId: "job-1",
      email: "a***@example.com",
    });
    expect(outside).toMatchObject({ event: "outside", requestId: null });
    expect(currentRequestId()).toBeNull();
  });

  it("takes the proxy's request id when it looks like one, else makes one", () => {
    expect(requestIdFrom(new Headers({ "x-vercel-id": "gru1::abcd-1234" }))).toBe(
      "gru1::abcd-1234",
    );
    const made = requestIdFrom(new Headers({ "x-request-id": "<script>" }));
    expect(made).toMatch(/^[0-9a-f-]{36}$/);
  });
});
