export type AttachmentContentAssessment = {
  detectedMimeType: string | null;
  mimeMismatch: boolean;
  suspicious: boolean;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectAttachmentMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (startsWith(bytes, [0x4d, 0x5a])) return "application/x-dosexec";
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "application/x-executable";

  const prefix = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  if (
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.startsWith("<script")
  )
    return "text/html";
  return null;
}

export function assessAttachmentContent(
  bytes: Uint8Array,
  declaredMimeType: string | null,
): AttachmentContentAssessment {
  const detectedMimeType = detectAttachmentMime(bytes);
  const declared = declaredMimeType?.split(";", 1)[0]?.trim().toLowerCase() || null;
  const comparableDeclared = declared && declared !== "application/octet-stream" ? declared : null;
  const mimeMismatch = Boolean(
    comparableDeclared && detectedMimeType && comparableDeclared !== detectedMimeType,
  );
  const suspicious =
    detectedMimeType === "application/x-dosexec" ||
    detectedMimeType === "application/x-executable" ||
    detectedMimeType === "text/html";
  return { detectedMimeType, mimeMismatch, suspicious };
}
