import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

export function makeGeneratedAt(date = new Date()) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const generatedAt = makeGeneratedAt();

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value !== ""));
}

export function readCsvWithHeaders(file) {
  const fullPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const rows = parseCsv(fs.readFileSync(fullPath, "utf8"));
  const [headers, ...body] = rows;
  if (!headers) return { headers: [], rows: [] };
  return {
    headers,
    rows: body.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""]))),
  };
}

export function readCsv(file) {
  return readCsvWithHeaders(file).rows;
}

export function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeCsv(file, headers, rows) {
  const text = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function yen(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("ja-JP")}円`;
}

export function pct(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2).replace(/\.00$/, "")}%`;
}

export function table(headers, rows, options = {}) {
  const widths = options.widths ?? options;
  const htmlColumns = new Set(options.htmlColumns ?? []);
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((header) => `<th style="${widths[header] ? `width:${widths[header]}` : ""}">${esc(header)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headers.map((header) => `<td>${htmlColumns.has(header) ? (row[header] ?? "") : esc(row[header])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function insertCardAfter(file, anchorHref, cardHtml, markerText = "") {
  const fullPath = path.join(ROOT, file);
  let text = fs.readFileSync(fullPath, "utf8");
  if (markerText && text.includes(markerText)) return false;
  if (!markerText && text.includes(cardHtml)) return false;

  const index = text.indexOf(`href="${anchorHref}"`);
  if (index < 0) return false;
  const start = text.lastIndexOf("<a", index);
  const end = text.indexOf("</a>", index);
  if (start < 0 || end < 0) return false;

  text = `${text.slice(0, end + 4)}\n      ${cardHtml}${text.slice(end + 4)}`;
  fs.writeFileSync(fullPath, text, "utf8");
  return true;
}
