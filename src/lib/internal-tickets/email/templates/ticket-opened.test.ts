import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { TicketOpenedEmail } from "./ticket-opened";

describe("TicketOpenedEmail template dimensions", () => {
  it("renderiza a logo Newline com dimensões explícitas reduzidas em 30% (108px)", async () => {
    const html = await render(
      TicketOpenedEmail({
        ticketNumber: "SOL-000001",
        title: "Teste",
        description: "Descrição de teste",
        sectorName: "Engenharia",
        categoryName: "Dúvida",
        priorityLabel: "Normal",
        requesterName: "Solicitante",
        recipientName: "Destinatário",
        dueAtLabel: null,
      }),
    );

    expect(html).toContain('src="cid:newline-logo"');
    expect(html).toContain('width="108"');
    expect(html).toContain("width:108px");
    expect(html).toContain("max-width:108px");
  });

  it("renderiza o ícone Newline com dimensões explícitas reduzidas a ~15% (7px x 7px)", async () => {
    const html = await render(
      TicketOpenedEmail({
        ticketNumber: "SOL-000001",
        title: "Teste",
        description: "Descrição de teste",
        sectorName: "Engenharia",
        categoryName: "Dúvida",
        priorityLabel: "Normal",
        requesterName: "Solicitante",
        recipientName: "Destinatário",
        dueAtLabel: null,
      }),
    );

    expect(html).toContain('src="cid:newline-icon"');
    expect(html).toContain('width="7"');
    expect(html).toContain('height="7"');
    expect(html).toContain("width:7px");
    expect(html).toContain("height:7px");
  });
});
