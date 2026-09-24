import { parseInboundEmailData, type ParsedInboundEmail } from "./inbound";

const RECEIVING_API = "https://api.resend.com/emails/receiving";

type AttachmentDownload = {
  downloadUrl: string;
  expiresAt: string | null;
  size: number | null;
};

export class ResendReceivingClient {
  constructor(private readonly apiKey = process.env.RESEND_API_KEY ?? "") {
    if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${RECEIVING_API}/${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body
          ? String((body as { message: unknown }).message)
          : "sem detalhe";
      throw new Error(`Resend Receiving falhou [${response.status}]: ${message.slice(0, 500)}`);
    }
    if (!body || typeof body !== "object") throw new Error("Resposta inválida do Resend Receiving");
    return body as Record<string, unknown>;
  }

  async retrieveEmail(emailId: string): Promise<ParsedInboundEmail> {
    return parseInboundEmailData(await this.get(encodeURIComponent(emailId)));
  }

  async retrieveAttachment(emailId: string, attachmentId: string): Promise<AttachmentDownload> {
    const value = await this.get(
      `${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    if (typeof value.download_url !== "string") {
      throw new Error("Resend não retornou download_url para o anexo");
    }
    return {
      downloadUrl: value.download_url,
      expiresAt: typeof value.expires_at === "string" ? value.expires_at : null,
      size: typeof value.size === "number" ? value.size : null,
    };
  }
}
