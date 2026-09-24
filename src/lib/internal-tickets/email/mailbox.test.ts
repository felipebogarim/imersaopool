import { describe, expect, it } from "vitest";
import {
  calculateDirectRecipients,
  calculateRelayTargets,
  isTechnicalAddress,
  parseMailbox,
} from "./mailbox";

describe("mailbox helpers", () => {
  it("normalizes display mailboxes", () => {
    expect(parseMailbox("Felipe Bogarim <Felipe@Example.com>")).toEqual({
      email: "felipe@example.com",
      name: "Felipe Bogarim",
    });
  });

  it("removes technical addresses and deduplicates Reply All recipients", () => {
    expect(
      calculateDirectRecipients(
        ["r+token@chamados.poolflux.app", "Angelica@Example.com"],
        ["angélica <angelica@example.com>", "Diego@example.com"],
        "chamados.poolflux.app",
      ),
    ).toEqual(["angelica@example.com", "diego@example.com"]);
  });

  it("relays only to active participants who did not already receive the message", () => {
    expect(
      calculateRelayTargets(
        [
          { email: "felipe@example.com" },
          { email: "angelica@example.com" },
          { email: "diego@example.com" },
          { email: "old@example.com", active: false },
        ],
        "FELIPE@example.com",
        ["Angelica@example.com"],
      ),
    ).toEqual(["diego@example.com"]);
  });

  it("recognizes sender and per-ticket system addresses", () => {
    expect(isTechnicalAddress("chamados@chamados.poolflux.app", "chamados.poolflux.app")).toBe(
      true,
    );
    expect(isTechnicalAddress("r+abc@chamados.poolflux.app", "chamados.poolflux.app")).toBe(true);
  });
});
