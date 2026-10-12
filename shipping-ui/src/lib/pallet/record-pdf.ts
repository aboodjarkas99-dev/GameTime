export type RecordLine = {
  sku: string;
  product: string;
  size: string;
  qty: string;
  batch: string;
};

export type BatchRecord = {
  orderName: string;
  customer: string;
  batchDate: string;
  notes: string;
  lines: RecordLine[];
};

const PAGE_W = 612;
const PAGE_H = 792;

function pdfText(value: string): string {
  const clean = value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  return clean;
}

function clip(value: string, max: number): string {
  const text = pdfText(value.trim());
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}.`;
}

function wrap(value: string, max: number): string[] {
  const words = pdfText(value.trim()).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word.slice(0, max);
    } else {
      current = next.slice(0, max);
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function header(record: BatchRecord, page: number, pages: number): string[] {
  return [
    "0.12 g",
    "0 748 612 44 re f",
    "1 g",
    "BT /F2 16 Tf 48 766 Tm (CONFIRMATION) Tj ET",
    "0 g",
    `BT /F2 12 Tf 48 724 Tm (Shipment # ${clip(record.orderName || "Order", 42)}) Tj ET`,
    `BT /F1 11 Tf 48 706 Tm (Shipped to  ${clip(record.customer || "Customer", 52)}) Tj ET`,
    record.notes.trim() ? `BT /F1 10 Tf 48 690 Tm (${clip(record.notes, 80)}) Tj ET` : "",
    `BT /F1 8 Tf 480 724 Tm (Page ${page} of ${pages}) Tj ET`,
  ].filter(Boolean);
}

function itemBlock(line: RecordLine, index: number, top: number): { commands: string[]; bottom: number } {
  const names = wrap(line.product || "Item", 58);
  const commands: string[] = [];
  let y = top;
  commands.push(`BT /F2 13 Tf 48 ${y} Tm (${index + 1}.  ${names[0]}) Tj ET`);
  for (const extra of names.slice(1)) {
    y -= 16;
    commands.push(`BT /F2 13 Tf 72 ${y} Tm (${extra}) Tj ET`);
  }
  y -= 16;
  commands.push(`BT /F1 11 Tf 72 ${y} Tm (Size   ${clip(line.size || "—", 22)}) Tj ET`);
  commands.push(`BT /F1 11 Tf 280 ${y} Tm (Qty   ${clip(line.qty || "0", 8)}) Tj ET`);
  y -= 18;
  if (line.size === "Drawdown") {
    commands.push(`BT /F1 11 Tf 72 ${y} Tm (Ship by FedEx or UPS. Not on a pallet.) Tj ET`);
  } else {
    commands.push(`BT /F1 11 Tf 72 ${y} Tm (Batch) Tj ET`);
    commands.push(`BT /F2 13 Tf 130 ${y} Tm (${clip(line.batch || "—", 32)}) Tj ET`);
  }
  y -= 12;
  commands.push("0.75 g", `0.6 w 48 ${y} m 564 ${y} l S`, "0 g");
  return { commands, bottom: y - 16 };
}

function layoutPages(record: BatchRecord, rows: RecordLine[]): string[] {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 660;
  rows.forEach((line, index) => {
    const names = wrap(line.product || "Item", 58);
    const height = 16 + names.length * 16 + 18 + 12 + 16;
    if (y - height < 56) {
      pages.push(commands);
      commands = [];
      y = 660;
    }
    const block = itemBlock(line, index, y);
    commands.push(...block.commands);
    y = block.bottom;
  });
  pages.push(commands);
  const total = pages.length;
  return pages.map((body, index) => [...header(record, index + 1, total), ...body].join("\n"));
}

function buildPdf(streams: string[]): Uint8Array {
  const objects: string[] = [];
  const fontRegular = objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>") ;
  const fontBold = objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];
  for (const stream of streams) {
    const content = objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const page = objects.push(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${content} 0 R >>`,
    );
    pageIds.push(page);
  }
  const pagesId = objects.push(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  const catalogId = objects.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  for (const id of pageIds) {
    objects[id - 1] = objects[id - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }
  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export function batchRecordPdf(record: BatchRecord): Uint8Array {
  const rows = record.lines.length > 0 ? record.lines : [{ sku: "", product: "No product lines", size: "", qty: "", batch: "" }];
  return buildPdf(layoutPages(record, rows));
}

export function recordFileName(orderName: string, _batchDate: string): string {
  const order = orderName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "order";
  return `packing-slip-${order}.pdf`;
}
