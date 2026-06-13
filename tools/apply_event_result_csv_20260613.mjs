import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SOURCE_ARG = process.argv[2] || "";
const CANONICAL_FILE = "102_june_event_result_input.csv";
const DEFAULT_INPUT_FILE = "102_june_event_result_input_to_apply.csv";
const HELPER_HTML = "post_0618_event_csv_apply_helper_20260613.html";
const HELPER_CSV = "post_0618_event_csv_apply_helper_20260613.csv";
const BACKUP_DIR = "_event_result_backups";
const REQUIRED_HEADERS = [
  "event_id",
  "planned_date",
  "event",
  "input_required",
  "actual_value",
  "market_reaction",
  "pass_condition",
  "current_status",
  "action_if_fail",
];
const REQUIRED_EVENTS = ["E01", "E02", "E03", "E04"];
const ALLOWED_STATUSES = ["未入力", "通過", "注意", "悪化"];

const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function parseCsv(text) {
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

function readCsvRaw(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const [headers, ...body] = rows;
  if (!headers) return { headers: [], rows: [] };
  return {
    headers,
    rows: body.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""]))),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  const text = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function table(headers, rows, options = {}) {
  const widths = options.widths ?? {};
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th style="${widths[header] ? `width:${widths[header]}` : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function resolveSource() {
  if (!SOURCE_ARG) return "";
  return path.isAbsolute(SOURCE_ARG) ? SOURCE_ARG : path.join(ROOT, SOURCE_ARG);
}

function validate(headers, rows) {
  const errors = [];
  const warnings = [];
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) errors.push(`必須列が不足: ${missingHeaders.join(" / ")}`);

  const eventIds = rows.map((row) => row.event_id).filter(Boolean);
  const missingEvents = REQUIRED_EVENTS.filter((eventId) => !eventIds.includes(eventId));
  if (missingEvents.length) errors.push(`必須イベントが不足: ${missingEvents.join(" / ")}`);

  const duplicateEvents = eventIds.filter((eventId, index) => eventIds.indexOf(eventId) !== index);
  if (duplicateEvents.length) errors.push(`イベントIDが重複: ${[...new Set(duplicateEvents)].join(" / ")}`);

  const unexpectedEvents = eventIds.filter((eventId) => !REQUIRED_EVENTS.includes(eventId));
  if (unexpectedEvents.length) errors.push(`想定外のイベントID: ${unexpectedEvents.join(" / ")}`);

  for (const row of rows) {
    if (!ALLOWED_STATUSES.includes(row.current_status)) {
      errors.push(`${row.event_id || "(IDなし)"} の状態が不正: ${row.current_status || "(空欄)"}`);
    }
    if (row.current_status !== "未入力" && (!row.actual_value || !row.market_reaction)) {
      warnings.push(`${row.event_id} は ${row.current_status} だが、実数または市場反応が空欄です。`);
    }
  }

  return { errors, warnings };
}

function normalize(rows) {
  return REQUIRED_EVENTS.map((eventId) => {
    const row = rows.find((item) => item.event_id === eventId);
    return Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, row?.[header] ?? ""]));
  });
}

function backupCanonical() {
  fs.mkdirSync(path.join(ROOT, BACKUP_DIR), { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const backupName = `${BACKUP_DIR}/102_june_event_result_input_${stamp}.csv`;
  fs.copyFileSync(path.join(ROOT, CANONICAL_FILE), path.join(ROOT, backupName));
  return backupName;
}

function runNode(script) {
  execFileSync("node", [script], { cwd: ROOT, stdio: "inherit" });
}

function counts(rows) {
  return Object.fromEntries(ALLOWED_STATUSES.map((status) => [
    status,
    rows.filter((row) => row.current_status === status).length,
  ]));
}

function writeHelperPage(result) {
  const current = readCsvRaw(path.join(ROOT, CANONICAL_FILE));
  const currentCounts = counts(current.rows);
  const resultRows = [
    { "項目": "現在の正本CSV", "内容": CANONICAL_FILE },
    { "項目": "貼り付け用CSV", "内容": DEFAULT_INPUT_FILE },
    { "項目": "反映コマンド", "内容": `node tools/apply_event_result_csv_20260613.mjs ${DEFAULT_INPUT_FILE}` },
    { "項目": "現在の状態", "内容": `未入力${currentCounts["未入力"]}件 / 注意${currentCounts["注意"]}件 / 悪化${currentCounts["悪化"]}件 / 通過${currentCounts["通過"]}件` },
  ];
  const logRows = [
    { section: "summary", item: "canonical_file", value: CANONICAL_FILE, note: "" },
    { section: "summary", item: "default_input_file", value: DEFAULT_INPUT_FILE, note: "" },
    { section: "summary", item: "last_result", value: result.status, note: result.message },
    ...(result.backup ? [{ section: "apply", item: "backup", value: result.backup, note: "反映前の102バックアップ" }] : []),
    ...result.errors.map((error) => ({ section: "error", item: "validation", value: error, note: "" })),
    ...result.warnings.map((warning) => ({ section: "warning", item: "validation", value: warning, note: "" })),
  ];
  writeCsv(HELPER_CSV, ["section", "item", "value", "note"], logRows);

  const statusRows = [
    { "分類": "未入力", "件数": `${currentCounts["未入力"]}件`, "扱い": "購入金額を確定しない" },
    { "分類": "注意", "件数": `${currentCounts["注意"]}件`, "扱い": "小比率または保留" },
    { "分類": "悪化", "件数": `${currentCounts["悪化"]}件`, "扱い": "新規購入停止" },
    { "分類": "通過", "件数": `${currentCounts["通過"]}件`, "扱い": "次のゲートへ進める" },
  ];
  const validationRows = [
    ...result.errors.map((error) => ({ "区分": "エラー", "内容": error, "対応": "正本へ反映しない" })),
    ...result.warnings.map((warning) => ({ "区分": "注意", "内容": warning, "対応": "反映は可能。ただし根拠説明を補う" })),
  ];
  if (validationRows.length === 0) validationRows.push({ "区分": "OK", "内容": "前回検査で重大な不備はありません。", "対応": "通常手順で確認" });

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベントCSV 正本反映補助</title>
  <style>
    :root { --ink:#061a2f; --blue:#0b4b78; --line:#c7d9ea; --soft:#f4f8fc; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:#edf4fa; font-size:18px; line-height:1.75; }
    header { background:#0d3f66; color:#fff; padding:32px 44px; }
    h1 { margin:0 0 10px; font-size:34px; }
    main { max-width:1180px; margin:0 auto; padding:28px 24px 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:24px; margin:0 0 22px; page-break-inside:avoid; break-inside:avoid; }
    h2 { margin:0 0 14px; font-size:25px; border-left:8px solid var(--blue); padding-left:12px; }
    .box { border:2px solid var(--line); border-radius:12px; background:var(--soft); padding:16px; font-weight:800; }
    .box.error { border-color:#f1a7a0; background:#fff5f5; color:#7a1f16; }
    .links { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
    .links a { color:#06436d; text-decoration:none; font-weight:800; border:1px solid #78acd2; border-radius:9px; padding:9px 14px; background:#fff; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { border-collapse:collapse; width:100%; min-width:820px; background:#fff; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:11px 12px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e2f0fb; font-weight:800; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    code { display:block; padding:10px 12px; border:1px solid #d8e6f1; border-radius:8px; background:#f7fafc; overflow-wrap:anywhere; white-space:normal; }
    @media(max-width:860px){ body{font-size:16px;} header{padding:24px 20px;} main{padding:18px 12px 40px;} }
  </style>
</head>
<body>
<header>
  <h1>6月イベントCSV 正本反映補助</h1>
  <p>ブラウザで出力した判定CSVを、正本の ${esc(CANONICAL_FILE)} へ反映するための実務ページです。反映時は既存CSVをバックアップしてから更新します。</p>
</header>
<main>
  <section>
    <h2>前回実行結果</h2>
    <div class="box ${result.errors.length ? "error" : ""}">${esc(result.status)}: ${esc(result.message)}</div>
    <div class="links">
      <a href="912_june_event_actual_input_sheet_20260606.html">イベント実数入力</a>
      <a href="post_0618_event_update_runbook_20260613.html">CSV反映ランブック</a>
      <a href="post_0618_operation_board_20260613.html">当日運用ボード</a>
      <a href="${HELPER_CSV}">実行ログCSV</a>
    </div>
  </section>
  <section>
    <h2>使い方</h2>
    ${table(["項目", "内容"], resultRows, { widths: { "項目": "24%" } })}
    <p><code>node tools/apply_event_result_csv_20260613.mjs 102_june_event_result_input_to_apply.csv</code></p>
    <p>このコマンドは、貼り付け用CSVを検査し、問題がなければ正本CSVをバックアップしてから更新します。その後、資金配分、当日運用ボード、反映ワークフロー、ランブックを再生成します。</p>
  </section>
  <section>
    <h2>現在の正本CSVの状態</h2>
    ${table(["分類", "件数", "扱い"], statusRows, { widths: { "分類": "18%", "件数": "18%" } })}
  </section>
  <section>
    <h2>検査結果</h2>
    ${table(["区分", "内容", "対応"], validationRows, { widths: { "区分": "16%" } })}
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(path.join(ROOT, HELPER_HTML), html, "utf8");
}

function applySource(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    return {
      status: "未反映",
      message: `指定ファイルが見つかりません: ${sourcePath}`,
      errors: [`指定ファイルが見つかりません: ${sourcePath}`],
      warnings: [],
    };
  }
  const { headers, rows } = readCsvRaw(sourcePath);
  const validation = validate(headers, rows);
  if (validation.errors.length > 0) {
    return {
      status: "未反映",
      message: "CSV検査でエラーが出たため、正本CSVは更新していません。",
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
  const normalized = normalize(rows);
  const backup = backupCanonical();
  writeCsv(CANONICAL_FILE, REQUIRED_HEADERS, normalized);
  runNode("tools/recalculate_event_outputs_from_102_20260613.mjs");
  runNode("tools/build_post_0618_operation_board_20260613.mjs");
  runNode("tools/build_event_reflection_workflow_20260613.mjs");
  runNode("tools/build_event_update_runbook_20260613.mjs");
  runNode("tools/check_critical_links_20260613.mjs");
  return {
    status: "反映完了",
    message: `${path.basename(sourcePath)} を正本CSVへ反映しました。`,
    backup,
    errors: [],
    warnings: validation.warnings,
  };
}

function ensureDefaultInput() {
  const defaultPath = path.join(ROOT, DEFAULT_INPUT_FILE);
  if (!fs.existsSync(defaultPath)) {
    fs.copyFileSync(path.join(ROOT, CANONICAL_FILE), defaultPath);
  }
}

ensureDefaultInput();
const source = resolveSource();
const result = source
  ? applySource(source)
  : {
      status: "準備完了",
      message: `${DEFAULT_INPUT_FILE} を編集してから反映コマンドを実行します。`,
      errors: [],
      warnings: [],
  };
writeHelperPage(result);

console.log(`${result.status}: ${result.message}`);
if (result.backup) console.log(`backup: ${result.backup}`);
if (result.errors.length) {
  for (const error of result.errors) console.log(`error: ${error}`);
  process.exitCode = 1;
}
