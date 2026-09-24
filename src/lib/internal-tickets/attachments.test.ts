import { describe, expect, it } from "vitest";
import { isAttachmentDownloadable } from "./attachments";

describe("download de anexos", () => {
  it.each(["not_scanned", "pending", "blocked", "failed"])(
    "não disponibiliza scan_status=%s",
    (status) => expect(isAttachmentDownloadable(status, "ticket/file.pdf")).toBe(false),
  );

  it("exige clean e storage_path", () => {
    expect(isAttachmentDownloadable("clean", null)).toBe(false);
    expect(isAttachmentDownloadable("clean", "ticket/file.pdf")).toBe(true);
  });
});
