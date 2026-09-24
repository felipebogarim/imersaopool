import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EmailAttachment } from "./types";

const ASSETS = [
  {
    filename: "logo-newline.png",
    contentId: "newline-logo",
  },
  {
    filename: "icon-newline.png",
    contentId: "newline-icon",
  },
] as const;

export async function loadNewlineInlineAssets(): Promise<EmailAttachment[]> {
  return Promise.all(
    ASSETS.map(async (asset) => {
      const filePath = resolve(process.cwd(), "public", "email-assets", asset.filename);
      try {
        const content = await readFile(filePath);
        return {
          filename: asset.filename,
          content: content.toString("base64"),
          contentType: "image/png",
          contentId: asset.contentId,
        };
      } catch (error) {
        throw new Error(`Asset Newline ausente: public/email-assets/${asset.filename}`, {
          cause: error,
        });
      }
    }),
  );
}
