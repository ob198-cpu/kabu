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

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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

const gateRows = readCsv('741_top10_selection_gate.csv');
const frameworkRows = readCsv('748_top10_recalculation_framework.csv');
const reflectionRows = readCsv('757_qualitative_reflection_matrix.csv');

const frameworkByTicker = new Map(frameworkRows.map((row) => [row.ticker, row]));
const reflectionByTicker = new Map(reflectionRows.map((row) => [row.ticker, row]));

function stage(row) {
  if (row.判定段階.startsWith('A')) return 'A: 公式値照合後に候補化可能';
  if (row.判定段階.startsWith('B')) return 'B: 量的補完後に再判定';
  return 'C: 仮説検算後に比較';
}

function nextAction(row, fw, q) {
  if (row.判定段階.startsWith('A')) {
    return '公式決算値、同業中央値、6月市場イベント後の反応を確認する。';
  }
  if (row.判定段階.startsWith('B')) {
    return `未入力の${fw?.未反映項目 || row.次に入れるデータ}を補完し、質的仮説は「${q?.実績確認データ || '実績確認データ'}」で確認する。`;
  }
  return 'テーマ接続は残しつつ、過熱、最大下落、同業比較で過信を除く。';
}

const rows = gateRows.map((row) => {
  const fw = frameworkByTicker.get(row.ticker) || {};
  const q = reflectionByTicker.get(row.ticker) || {};
  return {
    事前順位: row.事前順位,
    ticker: row.ticker,
    銘柄: row.銘柄,
    判定段階: stage(row),
    事前スコア: row.事前スコア,
    データ準備度: fw.データ準備度 || '',
    量的に未完了: fw.未反映項目 || row.次に入れるデータ,
    質的テーマ: q.質的テーマ || row.質的接続,
    質的仮説: q.主要仮説 || '',
    確認する数字: q.実績確認データ || '',
    株価検証: q.株価検証 || '',
    停止条件: q.停止条件 || '',
    次アクション: nextAction(row, fw, q),
    現時点の扱い: '候補検証中'
  };
});

const summaryRows = [
  {
    項目: '目的',
    内容: '100社前後の母集団から抽出した10社について、量的データと質的仮説を同じ表で管理し、6月の再判定に備える。'
  },
  {
    項目: '現在の到達点',
    内容: '10社の候補、量的不足項目、質的テーマ、確認数字、停止条件を接続した。'
  },
  {
    項目: 'まだ不足していること',
    内容: 'PER/PBR/ROE、売上・利益成長率、決算後1日/5日/20日反応、同業中央値の補完が残る。'
  },
  {
    項目: '判定ルール',
    内容: '質的情報だけでは候補確定にしない。量的主要項目が入り、停止条件に抵触しない場合だけ再計算する。'
  },
  {
    項目: '6月の確認',
    内容: 'CPI、日銀、FOMC後に指数、金利、為替、候補銘柄の反応を入れて再判定する。'
  }
];

writeCsv('759_top10_decision_control_board.csv', rows, Object.keys(rows[0]));
writeCsv('760_top10_decision_control_summary.csv', summaryRows, Object.keys(summaryRows[0]));

function table(headers, tableRows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${tableRows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社候補 判定コントロール表</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --amber:#a85b00; --green:#087f5b; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:var(--bg); line-height:1.75; }
    main { max-width:1320px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; margin:16px 0; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:9px; background:#f8fbff; padding:14px; }
    .value { font-size:30px; font-weight:900; color:var(--blue); }
    .note { border-left:6px solid var(--amber); background:#fff8ec; border-radius:8px; padding:12px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; color:#050b14; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    a { color:#075e91; font-weight:800; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a { border:1px solid var(--blue); color:#fff; background:var(--blue); border-radius:8px; padding:9px 12px; text-decoration:none; }
    @media (max-width:980px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>10社候補 判定コントロール表</h1>
    <p>10社候補について、量的データの不足、質的仮説、確認すべき数字、停止条件を一つの表にまとめました。ここから実データを入れて再計算します。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="grid">
      <div class="card"><b>候補</b><div class="value">10</div><p>事前候補を全件管理</p></div>
      <div class="card"><b>A段階</b><div class="value">${rows.filter((row) => row.判定段階.startsWith('A')).length}</div><p>公式照合後に候補化可能</p></div>
      <div class="card"><b>B段階</b><div class="value">${rows.filter((row) => row.判定段階.startsWith('B')).length}</div><p>量的補完後に再判定</p></div>
      <div class="card"><b>C段階</b><div class="value">${rows.filter((row) => row.判定段階.startsWith('C')).length}</div><p>仮説検算後に比較</p></div>
    </div>
    <p class="note">現時点では検証中です。候補の最終化には、量的主要項目の入力と6月イベント後の再判定が必要です。</p>
  </section>

  <section>
    <h2>要約</h2>
    ${table(Object.keys(summaryRows[0]), summaryRows)}
  </section>

  <section>
    <h2>10社コントロール表</h2>
    ${table(Object.keys(rows[0]), rows)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="759_top10_decision_control_board.csv">判定コントロールCSV</a>
      <a href="760_top10_decision_control_summary.csv">要約CSV</a>
      <a href="top10_score_input_calculator_20260528.html">10社スコア入力・再計算</a>
      <a href="qualitative_reflection_matrix_20260528.html">質的情報 10社反映マトリクス</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_decision_control_board_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_decision_control_board_20260528.html',
  rows: rows.length
}, null, 2));
