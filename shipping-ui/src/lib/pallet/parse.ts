import type { PalletRule, SizeKey } from "./types";
import { ruleFor } from "./types";

export type ParsedLine = {
  sku: string;
  description: string;
  size: SizeKey;
  /** Quantity already converted to units (eaches). */
  qty: number;
  basis: "each" | "case";
  /** Original quantity before case conversion, when basis is case. */
  basisQty: number;
  source: string;
};

export type ParseResult = {
  lines: ParsedLine[];
  warnings: string[];
};

export function isOvertime8ozText(text: string): boolean {
  if (/\bquarts?\b/i.test(text)) return false;
  if (!/\b8\s*-?\s*oz\b/i.test(text)) return false;
  return /over\s*time|\bgtot|cataly|catylist/i.test(text);
}

const SIZE_LABEL: Record<SizeKey, string> = {
  quart: "Quart",
  pint: "Pint",
  gal1: "1 Gallon",
  gal125: "1.25 Gallon",
  gal15: "1.5 Gallon",
  gal5: "5 Gallon",
  vinyl: "Paint vinyl box",
  drawdown: "Paint drawdown",
};

export function detectSize(line: string): SizeKey | null {
  const text = line.toLowerCase();
  if (/\bvinyls?\b/.test(text)) return "vinyl";
  if (/\bdraw\s*-?\s*downs?\b/.test(text)) return "drawdown";
  if (/\bpints?\b/.test(text) || /(?<![-_])\bpts?\b/.test(text)) return "pint";
  if (
    /\b1\s*(?:\.|-|,)\s*25\s*[-\s]?(?:gal|gallon)s?\b/.test(text) ||
    /\b1\s+1\/4\s*(?:gal|gallon)s?\b/.test(text) ||
    (/\b1\.25\b/.test(text) && /\b(?:gal|gallon)s?\b/.test(text))
  ) {
    return "gal125";
  }
  if (
    /\b1\s*(?:\.|-|,)\s*5\s*[-\s]?(?:gal|gallon)s?\b/.test(text) ||
    /\b1\s+1\/2\s*(?:gal|gallon)s?\b/.test(text) ||
    (/\b1\.5\b/.test(text) && /\b(?:gal|gallon)s?\b/.test(text))
  ) {
    return "gal15";
  }
  if (/\b5\s*[-\s]?(?:gal|gallon)s?\b/.test(text) || /\bpails?\b/.test(text) || /\bbuckets?\b/.test(text)) {
    return "gal5";
  }
  if (/\bquarts?\b/.test(text) || /(?<![-_])\bqts?\b/.test(text)) return "quart";
  if (
    /\b1\s*[-\s]?(?:gal|gallon)s?\b/.test(text) ||
    /\bgallons?\b/.test(text) ||
    /\bgal\b/.test(text)
  ) {
    return "gal1";
  }
  return null;
}

function stripSize(line: string): string {
  return line
    .replace(/\b1\s*(?:\.|-|,)\s*25\s*[-\s]?(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b1\s+1\/4\s*(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b1\s*(?:\.|-|,)\s*5\s*[-\s]?(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b1\s+1\/2\s*(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b5\s*[-\s]?(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b1\s*[-\s]?(?:gal|gallon)s?\b/gi, " ")
    .replace(/\b(?:quarts?|gallons?|pails?|buckets?|gal)\b/gi, " ")
    .replace(/(?<![-_])\bqts?\b/gi, " ");
}

function detectQty(line: string): { qty: number; basis: "each" | "case" } | null {
  const stripped = stripSize(line);
  const each = stripped.match(/\b(\d{1,6})\s*(?:ea|each|pcs|pc|units?|cans?)\b/i);
  const pack = stripped.match(/\b(\d{1,6})\s*(?:cs|cases?|bx|boxes?|cartons?)\b/i);
  if (each && pack) return { qty: Number(each[1]), basis: "each" };
  if (pack) return { qty: Number(pack[1]), basis: "case" };
  if (each) return { qty: Number(each[1]), basis: "each" };
  const labeled = stripped.match(/\b(?:qty|quantity|order(?:ed)?)\s*[:#]?\s*(\d{1,6})\b/i);
  if (labeled) return { qty: Number(labeled[1]), basis: "each" };
  const nums = [...stripped.matchAll(/\b(\d{1,6})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value < 100000);
  if (nums.length === 0) return null;
  return { qty: nums[nums.length - 1], basis: "each" };
}

function detectSku(line: string): string {
  const tokens = line.split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/^[#(]+|[,:;)>\]]+$/g, "");
    if (/^[A-Z0-9]{1,12}(?:[-_][A-Z0-9]+)+$/i.test(clean)) return clean;
  }
  const first = tokens[0]?.replace(/^[#(]+|[,:;)>\]]+$/g, "") ?? "";
  if (/^[A-Z]{1,8}\d{2,}[A-Z0-9]*$/i.test(first)) return first;
  if (/^\d{4,10}$/.test(first)) return first;
  return "";
}

function cleanupDescription(line: string, sku: string): string {
  let text = stripSize(line);
  if (sku) {
    const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "i"), " ");
  }
  text = text
    .replace(/\b\d{1,6}\s*(?:ea|each|pcs|pc|units?|cans?|cs|cases?|bx|boxes?|cartons?)\b/gi, " ")
    .replace(/\b(?:qty|quantity)\s*[:#]?\s*\d{1,6}\b/gi, " ")
    .replace(/\b\d{1,6}\b/g, (number) => (number === "275" || number === "450" || number === "500" ? number : " "))
    .replace(/[|,]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s\-–—]+$/g, "")
    .trim();
  return text.slice(0, 80);
}

function isNoise(line: string): boolean {
  return /packing slip|bill to|ship to|sold to|page \d|subtotal|sales tax|invoice total|phone|fax|@|www\.|thank you|picking list/i.test(
    line,
  );
}

function paintColor(line: string): string {
  const pantone = line.match(/\bPantone\s+[A-Za-z0-9]+(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,5}/i);
  if (pantone) return pantone[0].replace(/\s+/g, " ").trim();
  const match = line.match(/\bSW\s*\d{3,5}\b(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,4}/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}

function cleanColor(line: string): string {
  return line
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorNearBullet(rawLines: string[], index: number, body: string): string {
  const bodyKey = body.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (let back = index - 1; back >= 0 && index - back <= 6; back -= 1) {
    const previous = rawLines[back].trim();
    if (/[•●]/.test(previous)) break;
    if (/^\d{1,6}$/.test(previous)) continue;
    if (/coatings\s*&\s*paints|^product\s*:|^description\s*:|^quantity\b|shipment|page \d/i.test(previous)) continue;
    const marked = paintColor(previous);
    if (marked) return marked;
    const key = previous.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || key === bodyKey || bodyKey.includes(key) || key.includes(bodyKey)) continue;
    if (!/[A-Za-z]{3,}/.test(previous)) continue;
    const color = cleanColor(previous);
    if (color) return color;
  }
  return "";
}

function detailNearBullet(rawLines: string[], index: number, body: string): string {
  const bodyKey = body.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!bodyKey) return "";
  for (let back = index - 1; back >= 0 && index - back <= 8; back -= 1) {
    const previous = rawLines[back].trim();
    if (/[•●]/.test(previous)) break;
    if (/^\d{1,6}$/.test(previous)) continue;
    if (/coatings\s*&\s*paints|^product\s*:|^description\s*:|^quantity\b|shipment|page \d/i.test(previous)) continue;
    const key = previous.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (key.includes(bodyKey) && key.length > bodyKey.length + 2) return previous.replace(/\s+/g, " ").trim();
  }
  return "";
}

function fixOcrWords(line: string): string {
  return line
    .replace(/\bga(?:ll|l1|11|il|li|ii)on\b/gi, "Gallon")
    .replace(/\bgalion\b/gi, "Gallon")
    .replace(/\bgai+on\b/gi, "Gallon")
    .replace(/\b[0o]uarts?\b/gi, (word) => (word.toLowerCase().endsWith("s") ? "Quarts" : "Quart"))
    .replace(/\bpai[l1]s?\b/gi, (word) => (word.toLowerCase().endsWith("s") ? "pails" : "pail"));
}

function looksLikeProduct(body: string): boolean {
  if (/shipping|freight|package\(s\)|ship date|ship via|invoice|page\s+\d/i.test(body)) return false;
  return detectSize(body) !== null || isOvertime8ozText(body) || /\b(?:stencil|vinyl|t-?shirts?|boxes?\s+of|draw\s*-?\s*downs?|pints?)\b/i.test(body);
}

/** Turn a phone-scan into the same bullet lines a PDF packing slip uses. */
export function normalizeSlipText(text: string): string {
  const raw = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => fixOcrWords(line).replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines: string[] = [];
  const alreadyBulleted = raw.some((line) => /[•●]\s*\d{1,4}\s*,/.test(line));
  if (alreadyBulleted) return raw.join("\n");
  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index];
    if (/^\d{1,4}$/.test(line)) {
      let at = -1;
      for (let back = lines.length - 1; back >= 0 && lines.length - back <= 5; back -= 1) {
        if (lines[back].startsWith("• ")) break;
        if (looksLikeProduct(lines[back]) && !/^\d{1,4}\b/.test(lines[back])) {
          at = back;
          break;
        }
      }
      if (at >= 0) {
        const product = lines[at];
        const between = lines.slice(at + 1);
        lines.splice(at, lines.length - at, ...between, `• ${line}, ${product}`);
        continue;
      }
    }
    const lead = line.match(/^(?:[•●*·∙\-–—]\s*)?(\d{1,4})\s*[,.]?\s+(\S.*)$/);
    if (lead && looksLikeProduct(lead[2])) {
      lines.push(`• ${lead[1]}, ${lead[2]}`);
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function parseBulletLines(rawLines: string[]): ParsedLine[] {
  const lines: ParsedLine[] = [];
  rawLines.forEach((source, index) => {
    const match = source.match(/[•●]\s*(\d{1,6})\s*,\s*([^•\n]+)/);
    if (!match) return;
    const body = match[2].trim().replace(/[.,]+$/, "");
    if (/shipping|freight|package\(s\)|ship date|ship via|invoice/i.test(body)) return;
    if (isOvertime8ozText(body)) {
      const qty = Number(match[1]);
      if (!Number.isFinite(qty) || qty <= 0) return;
      const sku = detectSku(body);
      const kept = body.replace(/\b8\s*-?\s*oz\b/gi, "8oz");
      const description = (cleanupDescription(kept, sku) || kept).replace(/8oz/gi, "8 oz").replace(/\s+/g, " ").trim();
      lines.push({
        sku,
        description,
        size: "pint",
        qty,
        basis: "each",
        basisQty: qty,
        source,
      });
      return;
    }
    const size = detectSize(body);
    if (!size) return;
    const qty = Number(match[1]);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const sku = detectSku(body);
    const fuller = size === "drawdown" ? detailNearBullet(rawLines, index, body) : "";
    const isPaint =
      !fuller &&
      size !== "vinyl" &&
      size !== "drawdown" &&
      /chameleon|\bpaint\b|\bcwp\b|\bgtcop\b/i.test(body);
    const tinted = /hybild/i.test(body) && /tinted/i.test(body);
    const color = isPaint || tinted ? colorNearBullet(rawLines, index, body) || paintColor(body) : "";
    const description = (
      fuller || `${cleanupDescription(body, sku) || body}${color ? ` [[${color}]]` : ""}`
    )
      .replace(/\s+/g, " ")
      .trim();
    lines.push({
      sku,
      description,
      size,
      qty,
      basis: "each",
      basisQty: qty,
      source,
    });
  });
  return lines;
}

function isCustomerLine(line: string): boolean {
  if (!line || line.length > 80 || line.includes(":")) return false;
  if (/@|www\.|gametime|\(\d{3}\)|\d{3}-\d{4}|^\d/.test(line)) return false;
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}/.test(line)) return false;
  return /[A-Za-z]/.test(line);
}

function customerFromSlip(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = lines.findIndex((line) => /^shipped\s+to:?$/i.test(line) || /^ship\s+to:?$/i.test(line));
  const window = start >= 0 ? lines.slice(start + 1, start + 30) : lines;
  const stop = window.findIndex((line) => /^(description|quantity|product)\b/i.test(line));
  const block = stop >= 0 ? window.slice(0, stop) : window;
  const company = block.find((line) => /\b(?:Inc\.?|LLC|L\.L\.C\.|Corp\.?|Company|Co\.|Ltd\.?)\b/i.test(line));
  if (company) return company.replace(/\s+/g, " ").trim();
  const streetAt = block.findIndex((line) => /^\d+\s+\S/.test(line));
  if (streetAt > 0 && isCustomerLine(block[streetAt - 1])) return block[streetAt - 1];
  const cityAt = block.findIndex((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}/.test(line));
  if (cityAt >= 0 && block[cityAt + 1] && isCustomerLine(block[cityAt + 1])) return block[cityAt + 1];
  return "";
}

export function extractBatchCodes(text: string): string[] {
  return text.match(/\d-\d{2}-\d{2}-\d{2}/g) ?? [];
}

export function parseSlipMeta(text: string): { orderName: string; customer: string; po: string } {
  const shipment = text.match(/Shipment\s*#?\s*:?\s*([A-Za-z0-9-]+)/i);
  const po = text.match(/PO\s*#:\s*([A-Za-z0-9-]+)/i);
  return {
    orderName: shipment?.[1] ?? "",
    customer: customerFromSlip(text),
    po: po?.[1] ?? "",
  };
}

/** UPS Ground, FedEx Ground, or LTL. Read from Ship via on the packing slip. */
export function shipMethodFromSlip(text: string): "UPS Ground" | "FedEx Ground" | "LTL" | "" {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let via = "";
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/ship\s*via\s*:?\s*(.*)$/i);
    if (!match) continue;
    via = match[1].replace(/^[•●*\s,.-]+/, "").trim();
    if (!via && lines[index + 1]) via = lines[index + 1].replace(/^[•●*\s]+/, "").trim();
    break;
  }
  if (!via) return "";
  if (/fed\s*-?\s*ex/i.test(via)) return "FedEx Ground";
  if (/\bups\b/i.test(via)) return "UPS Ground";
  if (/\bltl\b|truck\s*line/i.test(via)) return "LTL";
  return "";
}

export function salespersonFromSlip(text: string): { name: string; email: string } {
  const block = text.split(/Salesperson\s*:/i)[1] ?? "";
  const email = block.match(/[A-Za-z0-9._%+-]+@gametime[a-z0-9.-]*\.[a-z]{2,}/i)?.[0] ?? "";
  if (!email) return { name: "", email: "" };
  const after = block.slice(block.toLowerCase().indexOf(email.toLowerCase()) + email.length);
  const name =
    after
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^[A-Za-z][A-Za-z .'-]{1,40}$/.test(line) && line.split(/\s+/).length <= 4) ?? "";
  return { name, email };
}

export function parsePackingSlip(text: string): ParseResult {
  const rawLines = normalizeSlipText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = parseBulletLines(rawLines);
  if (bullets.length > 0) return { lines: bullets, warnings: [] };
  const lines: ParsedLine[] = [];
  const warnings: string[] = [];
  for (const source of rawLines) {
    const size = detectSize(source);
    if (!size) continue;
    if (isNoise(source) && !detectQty(source)) continue;
    const qty = detectQty(source);
    if (!qty) {
      warnings.push(`Size found but no quantity: ${source.slice(0, 90)}`);
      continue;
    }
    const sku = detectSku(source);
    const description = cleanupDescription(source, sku) || SIZE_LABEL[size];
    lines.push({
      sku,
      description,
      size,
      qty: qty.qty,
      basis: qty.basis,
      basisQty: qty.qty,
      source,
    });
  }
  if (lines.length === 0) {
    warnings.push("No product lines detected. Add them by hand, or paste text that includes a size and a quantity.");
  }
  return { lines, warnings };
}

function splitCsv(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function headerIndex(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.includes(header.trim().toLowerCase()));
}

export function parseDelimited(text: string): ParseResult | null {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return null;
  const delimiter = rows[0].includes("\t") ? "\t" : rows[0].includes(",") ? "," : "";
  if (!delimiter) return null;
  const headers = splitCsv(rows[0], delimiter).map((cell) => cell.toLowerCase());
  const qtyCol = headerIndex(headers, ["qty", "quantity", "units", "ordered", "order qty"]);
  if (qtyCol < 0) return null;
  const skuCol = headerIndex(headers, ["sku", "item", "item #", "item no", "item number", "code", "product"]);
  const descCol = headerIndex(headers, ["description", "desc", "name", "product name"]);
  const sizeCol = headerIndex(headers, ["size", "pack", "uom", "unit", "container"]);
  if (skuCol < 0 && descCol < 0 && sizeCol < 0) return null;

  const lines: ParsedLine[] = [];
  const warnings: string[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsv(row, delimiter);
    const blob = [cells[sizeCol] ?? "", cells[descCol] ?? "", cells[skuCol] ?? "", row].join(" ");
    const size = detectSize(cells[sizeCol] ?? "") ?? detectSize(blob);
    const qtyRaw = Number((cells[qtyCol] ?? "").replace(/,/g, ""));
    if (!size || !Number.isFinite(qtyRaw) || qtyRaw <= 0) continue;
    const sizeText = sizeCol >= 0 ? (cells[sizeCol] ?? "") : "";
    const basis: "each" | "case" = /\b(cs|cases?|bx|boxes?|cartons?)\b/i.test(sizeText) ? "case" : "each";
    lines.push({
      sku: skuCol >= 0 ? cells[skuCol] ?? "" : detectSku(row),
      description: (descCol >= 0 ? cells[descCol] : cleanupDescription(row, "")) || SIZE_LABEL[size],
      size,
      qty: Math.round(qtyRaw),
      basis,
      basisQty: Math.round(qtyRaw),
      source: row,
    });
  }
  if (lines.length === 0) {
    warnings.push("The table has a quantity column, but no rows had both a size and a quantity.");
  }
  return { lines, warnings };
}

export function parseOrderText(text: string): ParseResult {
  const table = parseDelimited(text);
  if (table && table.lines.length > 0) return table;
  const slip = parsePackingSlip(text);
  if (table && slip.lines.length === 0) return table;
  return slip;
}

export function toUnits(line: ParsedLine, rules: PalletRule[]): number {
  if (line.basis !== "case") return line.qty;
  return line.basisQty * ruleFor(rules, line.size).unitsPerCase;
}
