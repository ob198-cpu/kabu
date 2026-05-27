import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `\uFEFF${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
}

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const themeRows = readCsv('569_qualitative_idea_map_detail.csv');
const candidateRows = readCsv('609_candidate_selection_operation_rules.csv');

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    detail: '通年で株価に影響し得るニュース・イベントを、質的項目、対象銘柄、確認数字、通知条件に分けて記録する。',
  },
  {
    updated_at: generatedAt,
    item: '使い方',
    detail: 'ニュースを見たら、事実、仮説、確認数字、影響銘柄、反証条件を入力する。直接買い判断には使わない。',
  },
  {
    updated_at: generatedAt,
    item: '出力',
    detail: '通知対象、確認待ち、保留、除外候補に分け、銘柄別の売買ルールへ接続する。',
  },
  {
    updated_at: generatedAt,
    item: '重要ルール',
    detail: '事実と仮説を分ける。出典がない情報、数字で確認できない情報はスコアに混ぜない。',
  },
];

const eventTemplateRows = [
  {
    event_id: 'EVT-YYYYMMDD-001',
    found_date: '',
    source_type: '公式資料/決算/統計/報道/13F/その他',
    source_name: '',
    source_url_or_file: '',
    qualitative_theme: '',
    event_fact: '',
    hypothesis: '',
    affected_sector: '',
    affected_ticker: '',
    expected_direction: '追い風/逆風/中立/不明',
    required_numbers: '',
    reject_condition: '',
    alert_level: '通知/確認待ち/保留/除外候補',
    score_use: '候補抽出/確認条件/警戒条件/除外条件',
    next_action: '',
    owner_note: '',
  },
];

const alertRuleRows = [
  {
    category: '通知',
    condition: 'TOB、M&A、大型提携、下方修正、大幅売却、全売却、主要顧客の投資延期など、銘柄固有に大きく影響する事実が出た場合',
    action: '当日中に対象銘柄、確認数字、売買ルールへの影響を記録する。',
  },
  {
    category: '確認待ち',
    condition: 'AI、金利、原油、食品値上げ、データセンターなどテーマ性はあるが、銘柄の売上・利益・受注に接続していない場合',
    action: '候補抽出に留め、決算資料や株価反応で確認する。',
  },
  {
    category: '保留',
    condition: '出典が報道のみ、数字未確認、または影響が業界全体に薄く広い場合',
    action: 'スコアには入れず、次回確認リストへ回す。',
  },
  {
    category: '除外候補',
    condition: '下方修正、利益率悪化、決算後指数劣後、主要テーマの反証が出た場合',
    action: '新規買いを止め、候補順位を下げる。',
  },
];

const themeMonitorRows = themeRows.map((row, index) => ({
  monitor_id: `THEME-${String(index + 1).padStart(2, '0')}`,
  theme: row.theme,
  hypothesis_layer: row.hypothesis_layer,
  evidence_layer: row.evidence_layer,
  required_numbers: row.required_numbers,
  reject_condition: row.reject_condition,
  scoring_use: row.scoring_use,
  monitor_frequency: row.hypothesis_layer === 'S' || row.hypothesis_layer === 'A' ? '週次確認' : '月次確認',
}));

const candidateMonitorRows = candidateRows.map((row) => ({
  ticker: row.ticker,
  company: row.company,
  status: row.status,
  qualitative_themes: row.qualitative_themes,
  buy_rule: row.buy_rule,
  sell_risk_rule: row.sell_risk_rule,
  event_monitor_action: row.status.includes('テスト') ? '関連イベント発生時は当日確認' : '週次または補完時に確認',
}));

writeCsv('612_qual_event_monitor_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('613_qual_event_input_template.csv', eventTemplateRows, [
  'event_id',
  'found_date',
  'source_type',
  'source_name',
  'source_url_or_file',
  'qualitative_theme',
  'event_fact',
  'hypothesis',
  'affected_sector',
  'affected_ticker',
  'expected_direction',
  'required_numbers',
  'reject_condition',
  'alert_level',
  'score_use',
  'next_action',
  'owner_note',
]);
writeCsv('614_qual_event_alert_rules.csv', alertRuleRows, ['category', 'condition', 'action']);
writeCsv('615_theme_monitor_schedule.csv', themeMonitorRows, [
  'monitor_id',
  'theme',
  'hypothesis_layer',
  'evidence_layer',
  'required_numbers',
  'reject_condition',
  'scoring_use',
  'monitor_frequency',
]);
writeCsv('616_candidate_event_monitor_map.csv', candidateMonitorRows, [
  'ticker',
  'company',
  'status',
  'qualitative_themes',
  'buy_rule',
  'sell_risk_rule',
  'event_monitor_action',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的イベント監視・登録台帳 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1320px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1040px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1900px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>質的イベント監視・登録台帳</h1>
      <p class="lead">通年で株価に影響し得るニュース・イベントを、事実、仮説、確認数字、対象銘柄、通知条件に分けて記録する台帳です。</p>
    </header>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">事実と仮説を分けて記録します。出典と確認数字がない情報は、スコアへ混ぜません。</div>
    </section>
    <section>
      <h2>2. イベント入力テンプレート</h2>
      ${table([
        { key: 'event_id', label: 'ID' },
        { key: 'found_date', label: '発見日' },
        { key: 'source_type', label: '出典種別' },
        { key: 'source_name', label: '出典名' },
        { key: 'source_url_or_file', label: 'URL/ファイル' },
        { key: 'qualitative_theme', label: '質的項目' },
        { key: 'event_fact', label: '確認事実' },
        { key: 'hypothesis', label: '仮説' },
        { key: 'affected_ticker', label: '対象銘柄' },
        { key: 'required_numbers', label: '確認数字' },
        { key: 'alert_level', label: '通知区分' },
        { key: 'score_use', label: '使い道' },
      ], eventTemplateRows, 'wide')}
    </section>
    <section>
      <h2>3. 通知・分類ルール</h2>
      ${table([
        { key: 'category', label: '分類' },
        { key: 'condition', label: '条件' },
        { key: 'action', label: 'アクション' },
      ], alertRuleRows, 'wide')}
    </section>
    <section>
      <h2>4. 質的テーマ監視スケジュール</h2>
      ${table([
        { key: 'monitor_id', label: 'ID' },
        { key: 'theme', label: 'テーマ' },
        { key: 'hypothesis_layer', label: '仮説層' },
        { key: 'evidence_layer', label: '実績層' },
        { key: 'required_numbers', label: '確認数字' },
        { key: 'reject_condition', label: '反証条件' },
        { key: 'monitor_frequency', label: '頻度' },
      ], themeMonitorRows, 'wide')}
    </section>
    <section>
      <h2>5. 銘柄別イベント監視</h2>
      ${table([
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'status', label: '分類' },
        { key: 'qualitative_themes', label: '質的テーマ' },
        { key: 'buy_rule', label: '買い条件' },
        { key: 'sell_risk_rule', label: '下げる・売る条件' },
        { key: 'event_monitor_action', label: 'イベント時の対応' },
      ], candidateMonitorRows, 'wide')}
      <div class="actions">
        <a href="612_qual_event_monitor_summary.csv">概要CSV</a>
        <a href="613_qual_event_input_template.csv">入力テンプレートCSV</a>
        <a href="614_qual_event_alert_rules.csv">通知ルールCSV</a>
        <a href="615_theme_monitor_schedule.csv">テーマ監視CSV</a>
        <a href="616_candidate_event_monitor_map.csv">銘柄監視CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qual_event_monitor_ledger_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  themes: themeMonitorRows.length,
  candidates: candidateMonitorRows.length,
  output: 'qual_event_monitor_ledger_20260527.html',
}, null, 2));
