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

function num(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '';
}

const gateRows = readCsv('741_top10_selection_gate.csv');
const priceRows = readCsv('761_top10_yahoo_price_metrics.csv');
const controlRows = readCsv('759_top10_decision_control_board.csv');

const priceByTicker = new Map(priceRows.map((row) => [row.symbol, row]));
const controlByTicker = new Map(controlRows.map((row) => [row.ticker, row]));

function classify(row, price, score) {
  const overheat = price.過熱判定 === '過熱・データ確認';
  const weakPrice = price.価格面の扱い === '価格面は要注意';
  if (overheat) return '過熱確認を優先';
  if (weakPrice) return '保留寄り';
  if (score >= 76) return '前面候補';
  if (score >= 68) return '比較候補';
  return '補完後に再確認';
}

function reason(row, price, control, score) {
  if (price.過熱判定 === '過熱・データ確認') {
    return `1年騰落率が${price['1年騰落率%']}%と極端に大きいため、価格点を上限処理。${control?.確認する数字 || row.次に入れるデータ}で利益成長が追いつくか確認。`;
  }
  if (price.価格面の扱い === '価格面は要注意') {
    return `1年騰落率${price['1年騰落率%']}%、60日騰落率${price['60日騰落率%']}%で価格面が弱い。質的仮説より先に決算・受注・反応の確認が必要。`;
  }
  return `事前スコア${row.事前スコア}点に、今朝の価格確認点${price.価格確認点}点を反映。${control?.質的テーマ || row.質的接続}は、${control?.確認する数字 || row.次に入れるデータ}で確認する。`;
}

const rows = gateRows.map((row) => {
  const price = priceByTicker.get(row.ticker);
  const control = controlByTicker.get(row.ticker);
  const base = num(row.事前スコア);
  const priceScore = num(price?.価格確認点);
  const recalc = base === null || priceScore === null ? null : (base * 0.70) + (priceScore * 0.30);
  return {
    旧順位: row.事前順位,
    ticker: row.ticker,
    銘柄: row.銘柄,
    業種: row.業種,
    事前スコア: row.事前スコア,
    価格確認点: price?.価格確認点 || '',
    '1年騰落率%': price?.['1年騰落率%'] || '',
    '60日騰落率%': price?.['60日騰落率%'] || '',
    '日経平均との差%': price?.['日経平均との差%'] || '',
    'S&P500差%': price?.['S&P500差%'] || '',
    '1年最大下落%': price?.['1年最大下落%'] || '',
    過熱判定: price?.過熱判定 || '',
    朝更新スコア: round(recalc, 1),
    現時点の扱い: recalc === null ? '未計算' : classify(row, price, recalc),
    判断理由: recalc === null ? '価格指標が未取得' : reason(row, price, control, recalc),
    まだ必要な確認: row.次に入れるデータ
  };
}).sort((a, b) => num(b.朝更新スコア) - num(a.朝更新スコア))
  .map((row, index) => ({ 朝更新順位: index + 1, ...row }));

const summaryRows = [
  {
    項目: '再計算の位置づけ',
    内容: '今朝取得した株価時系列を反映した暫定再計算。財務、業績成長、決算後反応、同業中央値が未補完のため、購入候補の確定ではない。'
  },
  {
    項目: '再計算式',
    内容: '朝更新スコア = 事前スコア70% + 価格確認点30%。価格確認点は過熱判定で上限処理済み。'
  },
  {
    項目: '順位変化の要点',
    内容: '三井住友FGと東京海上HDが上位に残る。三菱商事、三菱UFJ FG、三井物産は次点。住友電工と古河電工は株価上昇が大きいが過熱確認を優先。'
  },
  {
    項目: '次に必要なこと',
    内容: 'PER/PBR/ROE、売上・利益成長率、決算後1日/5日/20日反応、同業中央値を補完して最終再計算する。'
  }
];

writeCsv('764_morning_recalc_top10.csv', rows, Object.keys(rows[0]));
writeCsv('765_morning_recalc_summary.csv', summaryRows, Object.keys(summaryRows[0]));

function table(headers, tableRows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${tableRows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const rankingHeaders = [
  '朝更新順位',
  '旧順位',
  'ticker',
  '銘柄',
  '業種',
  '事前スコア',
  '価格確認点',
  '1年騰落率%',
  '60日騰落率%',
  '日経平均との差%',
  'S&P500差%',
  '1年最大下落%',
  '過熱判定',
  '朝更新スコア',
  '現時点の扱い'
];

const reasonCards = rows.map((row) => `
  <article class="reason-card">
    <div class="reason-head">
      <b>${esc(row.朝更新順位)}. ${esc(row.ticker)} ${esc(row.銘柄)}</b>
      <span>${esc(row.現時点の扱い)} / ${esc(row.朝更新スコア)}点</span>
    </div>
    <p><strong>判断理由:</strong> ${esc(row.判断理由)}</p>
    <p><strong>まだ必要な確認:</strong> ${esc(row.まだ必要な確認)}</p>
  </article>
`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>今朝指標反映 10社暫定再計算</title>
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
    .rank-table th:nth-child(1), .rank-table td:nth-child(1),
    .rank-table th:nth-child(2), .rank-table td:nth-child(2) { width:72px; }
    .rank-table th:nth-child(3), .rank-table td:nth-child(3) { width:86px; }
    .rank-table th:nth-child(4), .rank-table td:nth-child(4) { width:130px; }
    .rank-table th:nth-child(15), .rank-table td:nth-child(15) { width:120px; }
    .reason-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .reason-card { border:1px solid var(--line); border-radius:9px; background:#f8fbff; padding:12px; }
    .reason-head { display:flex; justify-content:space-between; gap:10px; align-items:start; border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:8px; }
    .reason-head b { color:var(--navy); font-size:15px; }
    .reason-head span { color:#36506a; font-size:12px; font-weight:800; white-space:nowrap; }
    .reason-card p { margin:6px 0; font-size:13px; }
    a { color:#075e91; font-weight:800; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a { border:1px solid var(--blue); color:#fff; background:var(--blue); border-radius:8px; padding:9px 12px; text-decoration:none; }
    @media (max-width:980px) { .grid,.reason-grid { grid-template-columns:1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>今朝指標反映 10社暫定再計算</h1>
    <p>今朝取得した株価時系列指標を既存の10社候補に反映し、暫定順位を出しました。財務・業績・決算後反応が未補完のため、購入候補の確定ではありません。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="grid">
      <div class="card"><b>対象</b><div class="value">10</div><p>候補10社</p></div>
      <div class="card"><b>式</b><div class="value">70/30</div><p>事前スコア / 価格確認点</p></div>
      <div class="card"><b>前面候補</b><div class="value">${rows.filter((row) => row.現時点の扱い === '前面候補').length}</div><p>暫定上位</p></div>
      <div class="card"><b>過熱確認</b><div class="value">${rows.filter((row) => row.現時点の扱い === '過熱確認を優先').length}</div><p>急騰の過信を抑制</p></div>
    </div>
    <p class="note">今回の再計算は、株価指標だけを追加した暫定版です。価格が強い銘柄でも、過熱判定、財務、業績、決算後反応を通らなければ候補確定にはしません。</p>
  </section>

  <section>
    <h2>要約</h2>
    ${table(Object.keys(summaryRows[0]), summaryRows)}
  </section>

  <section>
    <h2>暫定再計算ランキング</h2>
    <p class="note">一覧表は数字と扱いだけに絞り、長文の判断理由は下のカードに分けました。</p>
    <div class="rank-table">
      ${table(rankingHeaders, rows)}
    </div>
  </section>

  <section>
    <h2>判断理由・まだ必要な確認</h2>
    <div class="reason-grid">
      ${reasonCards}
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="764_morning_recalc_top10.csv">暫定再計算CSV</a>
      <a href="765_morning_recalc_summary.csv">要約CSV</a>
      <a href="761_top10_yahoo_price_metrics.csv">株価指標CSV</a>
      <a href="top10_price_metrics_refresh_20260528.html">株価時系列 取得結果</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'morning_recalc_top10_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'morning_recalc_top10_20260528.html',
  rows: rows.length
}, null, 2));
