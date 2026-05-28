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
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const selected = readCsv('741_top10_selection_gate.csv');
const inputTemplate = readCsv('742_top10_required_input_template.csv');

const formulaRows = [
  {
    スコア区分: '長期安定性',
    重み: 30,
    使用項目: '長期安定性点、5年CAGR、S&P500差、最大下落率',
    役割: '1年保有で極端な短期過熱だけを拾わないための基礎点',
    反映条件: '既に100社母集団で計算済み。データ年数が不足する場合は信頼度を下げる。'
  },
  {
    スコア区分: '財務・割安',
    重み: 25,
    使用項目: 'PER、PBR、ROE、同業中央値比',
    役割: '業績に対して価格が説明できるかを確認',
    反映条件: '取得元、対象期、単位を記録できた場合のみ反映。銀行・保険・商社は業種別中央値で評価。'
  },
  {
    スコア区分: '業績成長',
    重み: 20,
    使用項目: '売上成長率、利益成長率、会社予想、増配・自社株買い',
    役割: '長期株価上昇が利益成長で説明できるかを確認',
    反映条件: '直近決算と過去決算、または通期予想を照合できた場合のみ反映。'
  },
  {
    スコア区分: '決算後反応',
    重み: 15,
    使用項目: '決算後1日/5日/20日の対指数超過リターン',
    役割: '決算を市場が評価したか、短期反応だけでなく20営業日で確認',
    反映条件: '決算日と株価時系列、比較指数を結合できた場合のみ反映。20営業日未到達は未成熟扱い。'
  },
  {
    スコア区分: '質的仮説の検証',
    重み: 10,
    使用項目: '金利、AIデータセンター、防衛、資源などの仮説IDと実績データ',
    役割: '時流テーマを直接加点せず、数値で裏付けられる場合だけ補助点にする',
    反映条件: 'テーマと企業売上・受注・利益・株価反応の接続が確認できた場合のみ反映。'
  }
];

const gateRows = [
  {
    条件: '必須データが2項目以上未取得',
    扱い: '候補化しない',
    理由: '根拠が不足したまま順位を出すことを避けるため'
  },
  {
    条件: 'PER/PBR/ROEまたは同業比較が未取得',
    扱い: '財務・割安点を未反映にし、B判定以下',
    理由: '割高・割安を説明できないため'
  },
  {
    条件: '決算後20営業日反応が未到達',
    扱い: '決算後反応点は未成熟',
    理由: '1日反応だけで過大評価しないため'
  },
  {
    条件: '1年上昇が大きく、5年最大下落率も大きい',
    扱い: '過熱確認または比較枠',
    理由: '過去上昇だけを買い理由にしないため'
  },
  {
    条件: '6月のCPI・日銀・FOMC後に市場条件が悪化',
    扱い: '全体投入を延期または縮小',
    理由: '個別銘柄以前に市場リスクが高まるため'
  }
];

const tickerNeeds = new Map();
for (const row of inputTemplate) {
  if (!tickerNeeds.has(row.ticker)) tickerNeeds.set(row.ticker, []);
  tickerNeeds.get(row.ticker).push(row.入力項目);
}

const frameworkRows = selected.map((row) => {
  const needs = tickerNeeds.get(row.ticker) || [];
  const missingCritical = needs.filter((item) => ['PER/PBR/ROE', '売上成長率・利益成長率', '決算後1日/5日/20日反応'].includes(item)).length;
  const currentStage = row.判定段階?.startsWith('A') ? '確認後候補化可能' : row.判定段階?.startsWith('B') ? '補完後再計算' : '仮説検算後比較';
  const dataReadiness = Math.max(0, 100 - missingCritical * 22 - (needs.includes('同業中央値比較') ? 8 : 0) - (needs.includes('過熱・最大下落確認') ? 12 : 0));
  return {
    ticker: row.ticker,
    銘柄: row.銘柄,
    現在段階: currentStage,
    事前スコア: row.事前スコア,
    データ準備度: dataReadiness,
    未反映項目: needs.join(' / '),
    再計算後の扱い: row.判定段階?.startsWith('A') ? '公式値照合後にA候補として再確認' : '不足項目入力後にスコアを再計算',
    注意: missingCritical >= 3 ? '重要項目の補完が先' : '追加確認へ'
  };
});

const summaryRows = [
  ['対象銘柄', frameworkRows.length, '10社選定ゲートの事前候補'],
  ['式の区分', formulaRows.length, '長期、財務、成長、反応、質的検証に分離'],
  ['除外・保留条件', gateRows.length, '未取得や過熱を候補化前に止める条件'],
  ['平均データ準備度', Math.round(frameworkRows.reduce((sum, row) => sum + row.データ準備度, 0) / frameworkRows.length), '現時点の入力準備状況。高いほど再計算に近い。']
].map(([項目, 件数, 説明]) => ({ 項目, 件数, 説明 }));

writeCsv('746_top10_recalculation_formula.csv', formulaRows, Object.keys(formulaRows[0]));
writeCsv('747_top10_recalculation_gate_rules.csv', gateRows, Object.keys(gateRows[0]));
writeCsv('748_top10_recalculation_framework.csv', frameworkRows, Object.keys(frameworkRows[0]));
writeCsv('749_top10_recalculation_summary.csv', summaryRows, ['項目', '件数', '説明']);

function badge(stage) {
  if (stage.includes('確認後')) return 'ok';
  if (stage.includes('補完後')) return 'warn';
  return 'risk';
}

const formulaHtml = formulaRows.map((row) => `<tr>
  <td>${esc(row.スコア区分)}</td>
  <td>${esc(row.重み)}%</td>
  <td>${esc(row.使用項目)}</td>
  <td>${esc(row.役割)}</td>
  <td>${esc(row.反映条件)}</td>
</tr>`).join('');

const gateHtml = gateRows.map((row) => `<tr>
  <td>${esc(row.条件)}</td>
  <td>${esc(row.扱い)}</td>
  <td>${esc(row.理由)}</td>
</tr>`).join('');

const tickerHtml = frameworkRows.map((row) => `<tr>
  <td><b>${esc(row.ticker)}</b><br>${esc(row.銘柄)}</td>
  <td><span class="badge ${badge(row.現在段階)}">${esc(row.現在段階)}</span></td>
  <td><b>${esc(row.事前スコア)}</b></td>
  <td><b>${esc(row.データ準備度)}%</b></td>
  <td>${esc(row.未反映項目)}</td>
  <td>${esc(row.再計算後の扱い)}</td>
  <td>${esc(row.注意)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社再計算フレーム</title>
  <style>
    :root { --ink:#050b14; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
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
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .badge { display:inline-block; border-radius:8px; color:#fff; padding:4px 8px; font-weight:900; }
    .ok { background:var(--green); }
    .warn { background:var(--amber); }
    .risk { background:var(--red); }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>10社再計算フレーム</h1>
    <p>取得したデータをどの式に入れ、どの条件で候補化を止めるかを固定します。質的情報は直接加点せず、実績データで確認できた場合だけ補助評価に接続します。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.説明)}</p></div>`).join('')}
  </div>

  <section>
    <h2>再計算ルール</h2>
    <p class="notice">未取得値は推定で埋めません。スコアは、長期安定性30%、財務・割安25%、業績成長20%、決算後反応15%、質的仮説の検証10%に分け、反映条件を満たした項目だけで再計算します。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>区分</th><th>重み</th><th>使用項目</th><th>役割</th><th>反映条件</th></tr></thead>
        <tbody>${formulaHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>除外・保留条件</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>条件</th><th>扱い</th><th>理由</th></tr></thead>
        <tbody>${gateHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>銘柄別の再計算準備</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>銘柄</th><th>現在段階</th><th>事前スコア</th><th>データ準備度</th><th>未反映項目</th><th>再計算後の扱い</th><th>注意</th></tr></thead>
        <tbody>${tickerHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="746_top10_recalculation_formula.csv">式CSV</a> / <a href="747_top10_recalculation_gate_rules.csv">ゲートCSV</a> / <a href="748_top10_recalculation_framework.csv">銘柄別CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_recalculation_framework_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_recalculation_framework_20260528.html',
  rows: frameworkRows.length
}, null, 2));
