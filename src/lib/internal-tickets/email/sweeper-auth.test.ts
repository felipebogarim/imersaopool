import { describe, expect, it } from "vitest";
import { authorizeInternalTicketSweeper } from "./sweeper-auth.server";

describe("autorização do sweeper", () => {
  it("aceita somente bearer idêntico", () => {
    expect(authorizeInternalTicketSweeper("Bearer secret-value", "secret-value")).toBe(true);
    expect(authorizeInternalTicketSweeper("Bearer secret-other", "secret-value")).toBe(false);
    expect(authorizeInternalTicketSweeper(null, "secret-value")).toBe(false);
  });
});
