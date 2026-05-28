import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '';
}

const framework = readCsv('748_top10_recalculation_framework.csv');
const formulaRows = readCsv('746_top10_recalculation_formula.csv');

const inputRows = framework.map((row) => ({
  ticker: row.ticker,
  銘柄: row.銘柄,
  長期安定性点: '',
  財務割安点: '',
  業績成長点: '',
  決算後反応点: '',
  質的検証点: '',
  取得元メモ: '',
  対象期メモ: '',
  単位メモ: '',
  ハードゲート: '',
  備考: row.未反映項目
}));

const dryRunRows = framework.map((row) => {
  const longScore = num(row.事前スコア);
  const presentWeight = longScore === null ? 0 : 30;
  const score = longScore === null ? '' : round(longScore * 0.30, 1);
  return {
    ticker: row.ticker,
    銘柄: row.銘柄,
    現在入力済み重み: presentWeight,
    現在表示できる点: score,
    判定: presentWeight >= 80 ? '判定可能' : '判定保留',
    不足: row.未反映項目,
    理由: '現時点では長期・事前評価以外の入力が不足しているため、最終スコアは出さない。'
  };
});

const ruleRows = [
  {
    ルール: '最終スコアを出す条件',
    内容: '入力済み重みが80%以上、かつ財務・割安、業績成長、決算後反応の主要3区分が入力済みであること。'
  },
  {
    ルール: '未入力値の扱い',
    内容: '未入力値は0点換算しない。点数から除外し、入力済み重みと不足項目を表示する。'
  },
  {
    ルール: '質的検証点',
    内容: 'テーマやニュースだけでは入力しない。売上、受注、利益、株価反応などの実績データで接続できた場合のみ入力する。'
  },
  {
    ルール: 'ハードゲート',
    内容: '下方修正、重大リスク、過熱警戒、6月市場イベント悪化などがある場合は、点数に関係なく候補化を止める。'
  },
  {
    ルール: '+1%目標との接続',
    内容: 'スコア上位をそのまま採用せず、S&P500、日経平均、TOPIXとの1年比較で+1%を狙う説明ができる銘柄だけを残す。'
  }
];

writeCsv('750_top10_score_input_template.csv', inputRows, Object.keys(inputRows[0]));
writeCsv('751_top10_score_calculation_rules.csv', ruleRows, Object.keys(ruleRows[0]));
writeCsv('752_top10_score_current_dryrun.csv', dryRunRows, Object.keys(dryRunRows[0]));

const embeddedTemplate = JSON.stringify(inputRows);
const embeddedRules = JSON.stringify(formulaRows.map((row) => ({
  section: row.スコア区分,
  weight: Number(row.重み),
  fields: row.使用項目,
  condition: row.反映条件
})));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社スコア入力・再計算</title>
  <style>
    :root { --ink:#050b14; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --green:#087f5b; --amber:#a85b00; --red:#b42318; --muted:#45566a; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:22px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0; align-items:center; }
    button, .button { border:1px solid var(--blue); background:var(--blue); color:#fff; border-radius:8px; padding:10px 14px; font-weight:900; cursor:pointer; text-decoration:none; display:inline-block; }
    input[type=file] { border:1px solid var(--line); padding:9px; border-radius:8px; background:#fff; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .badge { display:inline-block; border-radius:8px; color:#fff; padding:4px 8px; font-weight:900; }
    .ok { background:var(--green); }
    .warn { background:var(--amber); }
    .stop { background:var(--red); }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>10社スコア入力・再計算</h1>
    <p>取得した数値を入力して、反映条件を満たした銘柄だけ再計算します。未入力値は0点にせず、入力済み重みと不足項目を表示します。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <div class="grid">
    <div class="card"><b>対象</b><div class="value">10</div><p>事前候補10社</p></div>
    <div class="card"><b>重み区分</b><div class="value">5</div><p>長期・財務・成長・反応・質的検証</p></div>
    <div class="card"><b>判定条件</b><div class="value">80%</div><p>入力済み重みが80%以上で判定</p></div>
    <div class="card"><b>現状</b><div class="value">保留</div><p>未入力が多いため最終スコアは出さない</p></div>
  </div>

  <section>
    <h2>使い方</h2>
    <p class="notice">CSVテンプレートに数値を入れ、下の読み込み欄から選択すると再計算します。財務・割安、業績成長、決算後反応が未入力の場合は、入力済み重みが高くても判定保留にします。</p>
    <div class="actions">
      <a class="button" href="750_top10_score_input_template.csv">入力テンプレートCSV</a>
      <a class="button" href="751_top10_score_calculation_rules.csv">計算ルールCSV</a>
      <input id="csvFile" type="file" accept=".csv,text/csv">
      <button id="loadSample" type="button">空テンプレートで確認</button>
    </div>
  </section>

  <section>
    <h2>計算ルール</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>区分</th><th>重み</th><th>反映条件</th></tr></thead>
        <tbody id="ruleBody"></tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>再計算結果</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>銘柄</th><th>入力済み重み</th><th>参考スコア</th><th>判定</th><th>不足項目</th><th>ハードゲート</th></tr></thead>
        <tbody id="resultBody"></tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="750_top10_score_input_template.csv">入力テンプレートCSV</a> / <a href="751_top10_score_calculation_rules.csv">計算ルールCSV</a> / <a href="752_top10_score_current_dryrun.csv">現状ドライランCSV</a></p>
  </section>
</main>

<script>
const templateRows = ${embeddedTemplate};
const rules = ${embeddedRules};
const weights = {
  長期安定性点: 30,
  財務割安点: 25,
  業績成長点: 20,
  決算後反応点: 15,
  質的検証点: 10
};

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\\n') { row.push(cell.replace(/\\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) row.push(cell.replace(/\\r$/, ''));
  const headers = rows.shift() || [];
  return rows.filter(r => r.some(v => String(v).trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function toNum(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calc(row) {
  let weighted = 0;
  let present = 0;
  const missing = [];
  for (const [field, weight] of Object.entries(weights)) {
    const value = toNum(row[field]);
    if (value === null) missing.push(field);
    else {
      present += weight;
      weighted += Math.max(0, Math.min(100, value)) * weight;
    }
  }
  const normalized = present ? weighted / present : null;
  const hasCore = ['財務割安点', '業績成長点', '決算後反応点'].every(field => toNum(row[field]) !== null);
  const hardGate = String(row.ハードゲート || '').trim();
  let status = '判定保留';
  if (hardGate) status = '停止';
  else if (present >= 80 && hasCore) status = '判定可能';
  return { present, normalized, missing, status, hardGate };
}

function renderRules() {
  document.getElementById('ruleBody').innerHTML = rules.map(rule => '<tr><td>' + escHtml(rule.section) + '</td><td>' + escHtml(rule.weight) + '%</td><td>' + escHtml(rule.condition) + '</td></tr>').join('');
}

function renderRows(rows) {
  document.getElementById('resultBody').innerHTML = rows.map(row => {
    const result = calc(row);
    const badge = result.status === '判定可能' ? 'ok' : result.status === '停止' ? 'stop' : 'warn';
    return '<tr><td><b>' + escHtml(row.ticker) + '</b><br>' + escHtml(row.銘柄) + '</td><td><b>' + result.present + '%</b></td><td>' + (result.normalized === null ? '未計算' : result.normalized.toFixed(1)) + '</td><td><span class="badge ' + badge + '">' + escHtml(result.status) + '</span></td><td>' + escHtml(result.missing.join(' / ') || 'なし') + '</td><td>' + escHtml(result.hardGate || 'なし') + '</td></tr>';
  }).join('');
}

document.getElementById('loadSample').addEventListener('click', () => renderRows(templateRows));
document.getElementById('csvFile').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  renderRows(parseCsv(text));
});
renderRules();
renderRows(templateRows);
</script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_score_input_calculator_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_score_input_calculator_20260528.html',
  inputRows: inputRows.length
}, null, 2));
