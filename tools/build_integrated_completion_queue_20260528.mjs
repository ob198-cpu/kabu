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

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '';
}

function completionNeeds(row) {
  const needs = [];
  const quantMissing = row.量的点 === '' || row.補完項目.includes('PER/PBR/ROE');
  if (quantMissing) {
    needs.push('PER/PBR/ROE');
    needs.push('売上成長率・利益成長率');
    needs.push('決算後1日/5日/20日反応');
  }
  if (row.補完項目.includes('質的接続')) needs.push('質的接続仮説');
  if (row.現在の扱い === '優先深掘り') needs.push('公式値照合');
  if (row.現在の扱い === 'テーマ接続確認') needs.push('過熱・最大下落確認');
  needs.push('同業中央値比較');
  return [...new Set(needs)];
}

function sourcePlan(needs) {
  const items = [];
  if (needs.includes('PER/PBR/ROE')) items.push('決算短信、IR、EDINET、J-Quants等の公式・準公式データ');
  if (needs.includes('売上成長率・利益成長率')) items.push('直近決算、過去決算、通期予想');
  if (needs.includes('決算後1日/5日/20日反応')) items.push('株価時系列、日経平均またはTOPIXとの超過リターン');
  if (needs.includes('質的接続仮説')) items.push('テーマID、政策・金利・資源・受注などの接続根拠');
  if (needs.includes('公式値照合')) items.push('入力済み数値の原資料照合');
  if (needs.includes('過熱・最大下落確認')) items.push('5年最大下落率、1年上昇率、PER、出来高急増');
  if (needs.includes('同業中央値比較')) items.push('同業3〜5社のPER/PBR/ROE中央値');
  return [...new Set(items)].join(' / ');
}

function taskType(row) {
  if (row.現在の扱い === '優先深掘り') return '確証強化';
  if (row.現在の扱い === '量的優先確認') return '質的接続追加';
  if (row.現在の扱い === 'テーマ接続確認') return '仮説検算';
  if (row.現在の扱い.includes('量的補完')) return '量的補完';
  return '比較確認';
}

function priority(row, needs) {
  const longScore = n(row.長期安定性点) ?? 0;
  const quantScore = n(row.量的点);
  const qualFit = n(row.質的接続強度) ?? 0;
  const missingImpact = needs.includes('PER/PBR/ROE') ? 85 : 45;
  const base = (longScore * 0.45) + ((quantScore ?? 55) * 0.20) + (qualFit * 0.20) + (missingImpact * 0.15);
  const statusBonus = row.現在の扱い === '優先深掘り' ? 8 : row.現在の扱い.includes('量的補完') ? 5 : 0;
  return round(clamp(0, 100, base + statusBonus), 1);
}

function gate(row, needs) {
  if (needs.includes('PER/PBR/ROE')) return '購入候補化前に補完必須';
  if (row.現在の扱い === '優先深掘り') return '公式値照合後に6月イベントで再判定';
  if (row.現在の扱い === 'テーマ接続確認') return '仮説と過熱確認後に比較枠へ';
  return '追加確認後に順位再計算';
}

const sourceRows = readCsv('737_integrated_selection_top20.csv');
const queueRows = sourceRows.map((row) => {
  const needs = completionNeeds(row);
  return {
    優先順位: '',
    ticker: row.ticker,
    銘柄: row.銘柄,
    業種: row.業種,
    現在の扱い: row.現在の扱い,
    作業分類: taskType(row),
    作業優先度: priority(row, needs),
    長期安定性点: row.長期安定性点,
    量的点: row.量的点 || '未補完',
    質的接続: row.質的接続 || '未接続',
    補完する項目: needs.join(' / '),
    取得・確認先: sourcePlan(needs),
    '10社選定への条件': gate(row, needs)
  };
}).sort((a, b) => (n(b.作業優先度) ?? 0) - (n(a.作業優先度) ?? 0));

queueRows.forEach((row, index) => {
  row.優先順位 = index + 1;
});

const summaryRows = [
  ['対象', queueRows.length, '統合ワークベンチ上位20件を作業対象に変換'],
  ['確証強化', queueRows.filter((row) => row.作業分類 === '確証強化').length, '既に量的・長期・質的がそろう銘柄の原資料照合'],
  ['量的補完', queueRows.filter((row) => row.作業分類 === '量的補完').length, '長期で浮上した銘柄にPER/PBR/ROE等を追加'],
  ['質的接続追加', queueRows.filter((row) => row.作業分類 === '質的接続追加').length, '量的には強いが構造仮説が未接続の銘柄'],
  ['仮説検算', queueRows.filter((row) => row.作業分類 === '仮説検算').length, 'テーマは強いが過熱・下落耐性の検証が必要な銘柄']
].map(([項目, 件数, 説明]) => ({ 項目, 件数, 説明 }));

writeCsv('739_integrated_completion_queue.csv', queueRows, Object.keys(queueRows[0]));
writeCsv('740_integrated_completion_summary.csv', summaryRows, ['項目', '件数', '説明']);

function badge(type) {
  if (type === '確証強化') return 'ok';
  if (type === '量的補完') return 'warn';
  if (type === '質的接続追加') return 'mid';
  return 'risk';
}

const tableRows = queueRows.map((row) => `<tr>
  <td>${esc(row.優先順位)}</td>
  <td><b>${esc(row.ticker)}</b><br>${esc(row.銘柄)}</td>
  <td>${esc(row.業種)}</td>
  <td><span class="badge ${badge(row.作業分類)}">${esc(row.作業分類)}</span><br><small>${esc(row.現在の扱い)}</small></td>
  <td><b>${esc(row.作業優先度)}</b><br><small>長期 ${esc(row.長期安定性点)} / 量的 ${esc(row.量的点)}</small></td>
  <td>${esc(row.質的接続)}</td>
  <td>${esc(row.補完する項目)}</td>
  <td>${esc(row['10社選定への条件'])}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>統合選定 補完優先キュー</title>
  <style>
    :root { --ink:#050b14; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:22px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    .grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .card b { color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    th:nth-child(1), td:nth-child(1) { width:5%; text-align:center; }
    th:nth-child(2), td:nth-child(2) { width:13%; }
    th:nth-child(4), td:nth-child(4) { width:13%; }
    th:nth-child(5), td:nth-child(5) { width:10%; }
    .badge { display:inline-block; border-radius:8px; color:#fff; padding:4px 8px; font-weight:900; }
    .ok { background:var(--green); }
    .warn { background:var(--amber); }
    .mid { background:var(--blue); }
    .risk { background:var(--red); }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>統合選定 補完優先キュー</h1>
    <p>100社統合選定ワークベンチで浮上した銘柄について、10社選定に進めるための不足データと確認順序を整理します。これは投資スコアではなく、作業優先度です。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.説明)}</p></div>`).join('')}
  </div>

  <section>
    <h2>運用ルール</h2>
    <p class="notice">未補完データは投資判断の点数に混ぜません。まず作業優先度として並べ、PER/PBR/ROE、成長率、決算後反応、同業中央値、質的接続の不足を埋めた後に、10社候補へ再計算します。</p>
  </section>

  <section>
    <h2>補完優先キュー</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>順</th><th>銘柄</th><th>業種</th><th>作業分類</th><th>作業優先度</th><th>質的接続</th><th>補完する項目</th><th>10社選定への条件</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="739_integrated_completion_queue.csv">補完優先キューCSV</a> / <a href="740_integrated_completion_summary.csv">要約CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'integrated_completion_queue_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: queueRows.length,
  output: 'integrated_completion_queue_20260528.html',
  top: queueRows.slice(0, 3).map((row) => `${row.ticker} ${row.銘柄}`)
}, null, 2));
