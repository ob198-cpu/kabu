import fs from 'node:fs';

const baselineCsv = 'event_pre_baseline_20260615.csv';
const htmlFile = 'event_post_reaction_workbench_20260615.html';
const csvFile = 'event_post_reaction_workbench_20260615.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quote = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quote = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? '').trim() !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseNumber(value) {
  const text = String(value ?? '').replace(/,/g, '').replace(/%/g, '').trim();
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });
}

function formatValue(value, symbol) {
  if (!Number.isFinite(value)) return '';
  if (symbol === '^TNX') return `${value.toFixed(3)}%`;
  if (symbol === 'JPY=X') return value.toFixed(3);
  return value.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

function classify(row, base, current) {
  if (!Number.isFinite(base) || !Number.isFinite(current)) {
    return { change: '', changeForSort: 0, status: '未取得', action: '取得できるまで判定しない', reason: '基準値または現在値が不足。' };
  }

  if (row['シンボル'] === '^TNX') {
    const bp = (current - base) * 100;
    if (bp >= 25) return { change: `+${bp.toFixed(1)}bp`, changeForSort: bp, status: '停止候補', action: '高PER・半導体候補は買付停止', reason: '米10年金利がイベント前から大きく上昇。' };
    if (bp >= 15) return { change: `+${bp.toFixed(1)}bp`, changeForSort: bp, status: '注意', action: '半導体・高PERの比率を下げる', reason: '金利上昇が成長株のバリュエーションに逆風。' };
    return { change: `${bp >= 0 ? '+' : ''}${bp.toFixed(1)}bp`, changeForSort: bp, status: '通常範囲', action: '金利面だけでは停止しない', reason: '米10年金利の急騰は確認されない。' };
  }

  const pct = ((current - base) / base) * 100;
  const pctText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const symbol = row['シンボル'];
  const name = row['名称'];

  if (symbol === '^VIX') {
    if (pct >= 35) return { change: pctText, changeForSort: pct, status: '停止候補', action: '買付停止、現金比率維持', reason: 'VIX急上昇で市場不安が大きい。' };
    if (pct >= 20) return { change: pctText, changeForSort: pct, status: '注意', action: '予定買付を縮小', reason: '市場不安の上昇を確認。' };
    return { change: pctText, changeForSort: pct, status: '通常範囲', action: 'VIX単独では停止しない', reason: '不安指数の急上昇は確認されない。' };
  }

  if (symbol === 'JPY=X') {
    if (pct <= -3.5) return { change: pctText, changeForSort: pct, status: '停止候補', action: '輸出・半導体候補の買付停止', reason: 'ドル円下落は円高方向。急な円高ショックとして扱う。' };
    if (pct <= -2.0) return { change: pctText, changeForSort: pct, status: '注意', action: '輸出・半導体候補の比率を下げる', reason: '円高方向の動きが候補銘柄の重しになり得る。' };
    return { change: pctText, changeForSort: pct, status: '通常範囲', action: '為替単独では停止しない', reason: '急な円高ショックは確認されない。' };
  }

  if (['^N225', '1306.T', '^IXIC', '^SOX'].includes(symbol)) {
    if (pct <= -5.0) return { change: pctText, changeForSort: pct, status: '停止候補', action: '個別株買付停止', reason: `${name}がイベント前から大きく下落。地合い悪化。` };
    if (pct <= -3.0) return { change: pctText, changeForSort: pct, status: '注意', action: '予定買付を半分以下に縮小', reason: `${name}が弱く、個別株へ進むには地合い確認が不足。` };
    return { change: pctText, changeForSort: pct, status: '通常範囲', action: '指数面だけでは停止しない', reason: `${name}の急落は確認されない。` };
  }

  if (['6503.T', '8035.T'].includes(symbol)) {
    if (pct <= -7.0) return { change: pctText, changeForSort: pct, status: '停止候補', action: '対象銘柄はP1復帰見送り', reason: '候補銘柄自身がイベント前基準から大きく下落。' };
    if (pct <= -4.0) return { change: pctText, changeForSort: pct, status: '注意', action: '買付比率を下げ、1日/5日反応を追加確認', reason: '候補銘柄の短期反応が弱い。' };
    return { change: pctText, changeForSort: pct, status: '通常範囲', action: '個別反応だけでは停止しない', reason: '候補銘柄の大きな下落は確認されない。' };
  }

  return { change: pctText, changeForSort: pct, status: '確認', action: '個別確認', reason: '共通ルール外のため個別確認。' };
}

async function fetchCurrent(row) {
  const symbol = row['シンボル'];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    let latest = null;
    for (let i = closes.length - 1; i >= 0; i -= 1) {
      if (closes[i] !== null && closes[i] !== undefined) {
        latest = { timestamp: timestamps[i], close: Number(closes[i]) };
        break;
      }
    }
    if (!latest) throw new Error('no close data');
    const base = parseNumber(row['基準値']);
    const judgement = classify(row, base, latest.close);
    return {
      group: row['区分'],
      symbol,
      name: row['名称'],
      baseline: row['基準値'],
      baselineDate: row['基準値日時'],
      current: formatValue(latest.close, symbol),
      currentDate: formatDate(latest.timestamp),
      status: judgement.status,
      change: judgement.change,
      action: judgement.action,
      reason: judgement.reason,
      source: url,
    };
  } catch (error) {
    return {
      group: row['区分'],
      symbol,
      name: row['名称'],
      baseline: row['基準値'],
      baselineDate: row['基準値日時'],
      current: '',
      currentDate: '',
      status: '未取得',
      change: '',
      action: '取得できるまで判定しない',
      reason: `取得失敗: ${error.message}`,
      source: url,
    };
  }
}

function overallDecision(rows) {
  const missing = rows.filter((row) => row.status === '未取得');
  if (missing.length > 0) {
    return {
      status: '取得待ち',
      action: '現在値を取得できる環境で再実行し、取得完了まで買付判断に使わない',
      reason: `未取得が${missing.length}件あります。`,
    };
  }
  const stop = rows.filter((row) => row.status === '停止候補');
  const warn = rows.filter((row) => row.status === '注意');
  if (stop.length > 0) {
    return {
      status: '買付停止',
      action: 'イベント後の再評価まで個別株買付は行わない',
      reason: `停止候補が${stop.length}件あります。`,
    };
  }
  if (warn.length > 0) {
    return {
      status: '縮小・保留',
      action: '予定買付を縮小し、指数・個別株の1日/5日反応を追加確認',
      reason: `注意項目が${warn.length}件あります。`,
    };
  }
  return {
    status: '監視継続',
    action: '日銀・FOMCの正式結果とイベント後反応が揃うまで買付不可',
    reason: '現時点の取得値では停止候補はありません。ただしイベントは未完了です。',
  };
}

function updateNav(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(htmlFile)) return;
  const link = `<a href="${htmlFile}">イベント後反応 判定ワークベンチ</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

const baseline = parseCsv(fs.readFileSync(baselineCsv, 'utf8'));
const results = await Promise.all(baseline.map(fetchCurrent));
const decision = overallDecision(results);

writeCsv(csvFile, [
  ['取得時刻', '区分', 'シンボル', '名称', '基準値', '基準値日時', '現在値', '現在値日時', '変化', '判定', 'アクション', '理由', '出所'],
  ...results.map((row) => [
    generatedAt,
    row.group,
    row.symbol,
    row.name,
    row.baseline,
    row.baselineDate,
    row.current,
    row.currentDate,
    row.change,
    row.status,
    row.action,
    row.reason,
    row.source,
  ]),
]);

const grouped = Map.groupBy(results, (row) => row.group);
const sections = [...grouped.entries()].map(([group, rows]) => {
  const body = rows.map((row) => `<tr>
    <td>${h(row.symbol)}</td>
    <td>${h(row.name)}</td>
    <td>${h(row.baseline)}</td>
    <td>${h(row.current)}</td>
    <td class="value">${h(row.change)}</td>
    <td class="${row.status === '停止候補' ? 'bad' : row.status === '注意' ? 'warn' : row.status === '通常範囲' ? 'ok' : 'neutral'}">${h(row.status)}</td>
    <td>${h(row.action)}</td>
    <td>${h(row.reason)}</td>
  </tr>`).join('');
  return `<section>
    <h2>${h(group)}</h2>
    <div class="table-wrap"><table><thead><tr><th>シンボル</th><th>名称</th><th>基準値</th><th>現在値</th><th>変化</th><th>判定</th><th>アクション</th><th>理由</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>イベント後反応 判定ワークベンチ</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#061827;line-height:1.75;font-size:18px}
    main{max-width:1220px;margin:0 auto;padding:28px}
    h1{font-size:32px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .decision{border:2px solid #0b67a3;background:#f2f9ff;color:#061827;font-weight:700;padding:14px;border-radius:10px}
    .notice{border:2px solid #b42318;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:11px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .value{font-weight:700;color:#003b67}
    .ok{color:#007a3d;font-weight:700}.warn{color:#b66a00;font-weight:700}.bad{color:#b30000;font-weight:700}.neutral{color:#425b76;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>イベント後反応 判定ワークベンチ</h1>
  <p>6月イベント前基準値と現在値を比較し、金利急騰、円高ショック、指数急落、候補銘柄の下落を同じルールで確認します。</p>
  <section>
    <p class="decision">現在の自動判定: ${h(decision.status)}。${h(decision.action)}。${h(decision.reason)}</p>
    <p class="notice">このページは安全確認用です。日銀・FOMCの正式結果とイベント後1日/5日反応が揃うまで、P1復帰0社・買付上限0円を維持します。</p>
  </section>
  ${sections}
  <section>
    <h2>判定ルール</h2>
    <p>米10年金利: +15bp以上で注意、+25bp以上で停止候補。VIX: +20%以上で注意、+35%以上で停止候補。指数: -3%以上で注意、-5%以上で停止候補。候補銘柄: -4%以上で注意、-7%以上で停止候補。ドル円: -2%以上を円高注意、-3.5%以上を円高停止候補として扱います。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  generatedAt,
  decision,
  rows: results.length,
  buyLimit: '0円',
}, null, 2));
