import iconNewlineDataUrl from "./assets/icon-newline.png?inline";
import logoNewlineDataUrl from "./assets/logo-newline.png?inline";
import type { EmailAttachment } from "./types";

function cleanBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

export async function loadNewlineInlineAssets(): Promise<EmailAttachment[]> {
  return [
    {
      filename: "logo-newline.png",
      content: cleanBase64(logoNewlineDataUrl),
      contentType: "image/png",
      contentId: "newline-logo",
    },
    {
      filename: "icon-newline.png",
      content: cleanBase64(iconNewlineDataUrl),
      contentType: "image/png",
      contentId: "newline-icon",
    },
  ];
}
