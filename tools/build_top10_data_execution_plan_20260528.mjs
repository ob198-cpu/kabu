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

const officialLinks = {
  '8316.T': ['https://www.smfg.co.jp/investor/', 'https://www.smfg.co.jp/investor/financial/latest_statement.html'],
  '8766.T': ['https://www.tokiomarinehd.com/ir/'],
  '8306.T': ['https://www.mufg.jp/ir/index.html'],
  '7011.T': ['https://www.mhi.com/jp/finance/ir'],
  '8058.T': ['https://www.mitsubishicorp.com/jp/ja/ir/'],
  '6501.T': ['https://www.hitachi.co.jp/IR/'],
  '8031.T': ['https://www.mitsui.com/jp/ja/ir/'],
  '5802.T': ['https://sumitomoelectric.com/jp/ir'],
  '5801.T': ['https://www.furukawa.co.jp/ir/'],
  '8001.T': ['https://www.itochu.co.jp/ja/ir/']
};

function sourceType(item) {
  if (item.includes('PER/PBR/ROE') || item.includes('同業')) return ['参考値 + 公式照合', 'Yahoo等の参考指標で入口確認し、IR/決算短信/有報で照合'];
  if (item.includes('売上')) return ['公式決算', '決算短信、決算説明資料、通期予想'];
  if (item.includes('決算後')) return ['株価時系列', 'Yahoo Finance chart API、日経平均またはTOPIX'];
  if (item.includes('公式')) return ['公式資料', '決算短信、決算説明資料、IR資料'];
  if (item.includes('過熱')) return ['株価時系列 + 指標', '5年最大下落率、1年上昇率、出来高、PER'];
  return ['確認資料', '公式資料または既存CSV'];
}

function actionPhase(row, item) {
  if (row.判定段階.startsWith('A')) return '先行確認';
  if (item.includes('決算後')) return '株価反応計算';
  if (item.includes('同業')) return '同業比較';
  if (item.includes('過熱')) return 'リスク検算';
  return '財務補完';
}

function priority(row, item) {
  if (row.判定段階.startsWith('A') && item.includes('公式')) return 1;
  if (item.includes('PER/PBR/ROE')) return 2;
  if (item.includes('売上')) return 3;
  if (item.includes('決算後')) return 4;
  if (item.includes('同業')) return 5;
  return 6;
}

const selected = readCsv('741_top10_selection_gate.csv');
const input = readCsv('742_top10_required_input_template.csv');

const actionRows = input.map((row) => {
  const parent = selected.find((item) => item.ticker === row.ticker) || {};
  const [データ区分, 取得方法] = sourceType(row.入力項目);
  return {
    実行順: '',
    ticker: row.ticker,
    銘柄: row.銘柄,
    判定段階: parent.判定段階 || '',
    作業段階: actionPhase(parent, row.入力項目),
    入力項目: row.入力項目,
    データ区分,
    取得方法,
    公式URL候補: (officialLinks[row.ticker] || []).join(' / '),
    反映条件: '取得元、対象期、単位、計算式を記録できた場合のみ反映',
    未取得時の扱い: parent.判定段階?.startsWith('A') ? '候補化を保留' : '再計算対象から除外または比較枠へ下げる',
    優先番号: priority(parent, row.入力項目)
  };
}).sort((a, b) => a.優先番号 - b.優先番号 || a.ticker.localeCompare(b.ticker) || a.入力項目.localeCompare(b.入力項目));

actionRows.forEach((row, index) => {
  row.実行順 = index + 1;
});

const summaryRows = [
  ['実行項目数', actionRows.length, '10社事前候補に対して次に埋める作業数'],
  ['先行確認', actionRows.filter((row) => row.作業段階 === '先行確認').length, 'A判定銘柄の原資料照合'],
  ['財務補完', actionRows.filter((row) => row.作業段階 === '財務補完').length, 'PER/PBR/ROE、成長率など'],
  ['株価反応計算', actionRows.filter((row) => row.作業段階 === '株価反応計算').length, '決算後1日/5日/20日反応'],
  ['同業比較', actionRows.filter((row) => row.作業段階 === '同業比較').length, '同業中央値で業種差を補正'],
  ['リスク検算', actionRows.filter((row) => row.作業段階 === 'リスク検算').length, '過熱・下落耐性の確認']
].map(([項目, 件数, 説明]) => ({ 項目, 件数, 説明 }));

writeCsv('744_top10_data_execution_plan.csv', actionRows, Object.keys(actionRows[0]));
writeCsv('745_top10_data_execution_summary.csv', summaryRows, ['項目', '件数', '説明']);

function badge(phase) {
  if (phase === '先行確認') return 'ok';
  if (phase === '財務補完') return 'warn';
  if (phase === '株価反応計算') return 'mid';
  if (phase === '同業比較') return 'peer';
  return 'risk';
}

const tableRows = actionRows.map((row) => `<tr>
  <td>${esc(row.実行順)}</td>
  <td><b>${esc(row.ticker)}</b><br>${esc(row.銘柄)}</td>
  <td><span class="badge ${badge(row.作業段階)}">${esc(row.作業段階)}</span><br><small>${esc(row.判定段階)}</small></td>
  <td>${esc(row.入力項目)}</td>
  <td><b>${esc(row.データ区分)}</b><br>${esc(row.取得方法)}</td>
  <td>${row.公式URL候補 ? row.公式URL候補.split(' / ').map((url) => `<a href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ''))}</a>`).join('<br>') : '追加確認'}</td>
  <td>${esc(row.反映条件)}</td>
  <td>${esc(row.未取得時の扱い)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社データ取得 実行計画</title>
  <style>
    :root { --ink:#050b14; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --green:#087f5b; --amber:#a85b00; --red:#b42318; --purple:#5b3aa4; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1240px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:22px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    .grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    th:nth-child(1), td:nth-child(1) { width:5%; text-align:center; }
    th:nth-child(2), td:nth-child(2) { width:12%; }
    th:nth-child(3), td:nth-child(3) { width:12%; }
    th:nth-child(6), td:nth-child(6) { width:17%; }
    .badge { display:inline-block; border-radius:8px; color:#fff; padding:4px 8px; font-weight:900; }
    .ok { background:var(--green); }
    .warn { background:var(--amber); }
    .mid { background:var(--blue); }
    .peer { background:var(--purple); }
    .risk { background:var(--red); }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>10社データ取得 実行計画</h1>
    <p>10社事前候補について、次に取得・照合するデータを実行順に整理しました。取得元、反映条件、未取得時の扱いを分け、未確認値を点数に混ぜない運用にします。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.説明)}</p></div>`).join('')}
  </div>

  <section>
    <h2>反映ルール</h2>
    <p class="notice">数値は、取得元、対象期、単位、計算式を記録できた場合のみ反映します。未取得の値は推定で埋めず、候補化を保留するか比較枠へ下げます。</p>
  </section>

  <section>
    <h2>実行リスト</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>順</th><th>銘柄</th><th>作業段階</th><th>入力項目</th><th>取得方法</th><th>公式URL候補</th><th>反映条件</th><th>未取得時の扱い</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="744_top10_data_execution_plan.csv">実行計画CSV</a> / <a href="745_top10_data_execution_summary.csv">要約CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_data_execution_plan_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_data_execution_plan_20260528.html',
  rows: actionRows.length
}, null, 2));
