import fs from "node:fs";
import { buildImmersionPdfDoc } from "@/lib/immersion-final-pdf";
const data = JSON.parse(fs.readFileSync("/tmp/pdfqa/ipel.json","utf8"));
const doc = buildImmersionPdfDoc(data);
fs.writeFileSync("/tmp/pdfqa/out.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("pages", doc.getNumberOfPages());
