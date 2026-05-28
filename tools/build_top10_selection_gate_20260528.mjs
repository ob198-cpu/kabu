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

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '';
}

function splitNeeds(text) {
  return String(text || '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
}

function gateStatus(row) {
  const needs = splitNeeds(row.補完する項目);
  const hasFinancialMissing = needs.some((item) => item.includes('PER') || item.includes('売上') || item.includes('決算後'));
  if (row.作業分類 === '確証強化') return ['A 確認後に候補化可能', '既存の量的評価・長期安定性・質的接続がそろう。原資料照合と6月イベント確認で候補化できる。'];
  if (row.作業分類 === '仮説検算') return ['C 仮説検算後に比較', 'テーマ接続は強いが、過熱や最大下落率の確認を先に行う。'];
  if (hasFinancialMissing) return ['B 量的補完後に再計算', '長期では浮上しているが、PER/PBR/ROE、成長率、決算後反応を埋めるまで候補確定にしない。'];
  return ['B 追加確認後に再計算', '不足項目を埋めてから再順位化する。'];
}

function provisionalScore(row) {
  const priority = num(row.作業優先度) ?? 0;
  const longScore = num(row.長期安定性点) ?? 0;
  const quantitativeKnown = row.量的点 !== '未補完';
  const dataPenalty = quantitativeKnown ? 0 : 10;
  const hypothesisPenalty = row.作業分類 === '仮説検算' ? 8 : 0;
  return round(Math.max(0, Math.min(100, priority * 0.65 + longScore * 0.35 - dataPenalty - hypothesisPenalty)), 1);
}

function requiredInputRows(row) {
  const needs = splitNeeds(row.補完する項目 || row.次に入れるデータ);
  const output = [];
  const common = {
    ticker: row.ticker,
    銘柄: row.銘柄,
    業種: row.業種,
    作業分類: row.作業分類
  };
  if (needs.some((item) => item.includes('PER'))) {
    output.push({ ...common, 入力項目: 'PER/PBR/ROE', 入力する値: '', 推奨取得先: '決算短信、IR、EDINET、J-Quants等', 判定への使い方: '同業中央値と比較し、割高・割安・資本効率を確認' });
  }
  if (needs.some((item) => item.includes('売上'))) {
    output.push({ ...common, 入力項目: '売上成長率・利益成長率', 入力する値: '', 推奨取得先: '直近決算、過去決算、通期予想', 判定への使い方: '長期株価上昇が業績成長で説明できるか確認' });
  }
  if (needs.some((item) => item.includes('決算後'))) {
    output.push({ ...common, 入力項目: '決算後1日/5日/20日反応', 入力する値: '', 推奨取得先: '株価時系列、日経平均またはTOPIX', 判定への使い方: '決算後に市場平均を上回ったか確認' });
  }
  if (needs.some((item) => item.includes('質的'))) {
    output.push({ ...common, 入力項目: '質的接続仮説', 入力する値: '', 推奨取得先: 'テーマID、政策、受注、金利、資源、ニュース根拠', 判定への使い方: '出来事から需要・資金流入へつながる構造を確認' });
  }
  if (needs.some((item) => item.includes('公式'))) {
    output.push({ ...common, 入力項目: '公式値照合', 入力する値: '', 推奨取得先: '原資料、決算短信、IR資料', 判定への使い方: '既存入力値が原資料と一致するか確認' });
  }
  if (needs.some((item) => item.includes('過熱'))) {
    output.push({ ...common, 入力項目: '過熱・最大下落確認', 入力する値: '', 推奨取得先: '5年最大下落率、1年上昇率、出来高、PER', 判定への使い方: 'テーマ先行で買われすぎていないか確認' });
  }
  if (needs.some((item) => item.includes('同業'))) {
    output.push({ ...common, 入力項目: '同業中央値比較', 入力する値: '', 推奨取得先: '同業3〜5社のPER/PBR/ROE', 判定への使い方: '業種ごとの差を補正して比較' });
  }
  return output;
}

const queue = readCsv('739_integrated_completion_queue.csv');
const selected = queue.slice(0, 10).map((row, index) => {
  const [status, reason] = gateStatus(row);
  return {
    事前順位: index + 1,
    ticker: row.ticker,
    銘柄: row.銘柄,
    業種: row.業種,
    現在の扱い: row.現在の扱い,
    作業分類: row.作業分類,
    事前スコア: provisionalScore(row),
    長期安定性点: row.長期安定性点,
    量的点: row.量的点,
    質的接続: row.質的接続,
    判定段階: status,
    理由: reason,
    次に入れるデータ: row.補完する項目,
    '10社に残す条件': row['10社選定への条件']
  };
});

const inputRows = selected.flatMap(requiredInputRows);
const summaryRows = [
  ['事前選定数', selected.length, '補完キュー上位から10社を抽出'],
  ['確認後に候補化可能', selected.filter((row) => row.判定段階.startsWith('A')).length, '既存データが比較的そろう銘柄'],
  ['量的補完後に再計算', selected.filter((row) => row.判定段階.startsWith('B')).length, '財務・決算後反応の追加が必要な銘柄'],
  ['仮説検算後に比較', selected.filter((row) => row.判定段階.startsWith('C')).length, 'テーマ先行・過熱確認が必要な銘柄'],
  ['入力欄数', inputRows.length, '銘柄別に次に埋める値の数']
].map(([項目, 件数, 説明]) => ({ 項目, 件数, 説明 }));

writeCsv('741_top10_selection_gate.csv', selected, Object.keys(selected[0]));
writeCsv('742_top10_required_input_template.csv', inputRows, Object.keys(inputRows[0]));
writeCsv('743_top10_selection_gate_summary.csv', summaryRows, ['項目', '件数', '説明']);

function badge(status) {
  if (status.startsWith('A')) return 'ok';
  if (status.startsWith('B')) return 'warn';
  return 'risk';
}

const rowsHtml = selected.map((row) => `<tr>
  <td>${esc(row.事前順位)}</td>
  <td><b>${esc(row.ticker)}</b><br>${esc(row.銘柄)}</td>
  <td>${esc(row.業種)}</td>
  <td><b>${esc(row.事前スコア)}</b><br><small>長期 ${esc(row.長期安定性点)} / 量的 ${esc(row.量的点)}</small></td>
  <td>${esc(row.質的接続)}</td>
  <td><span class="badge ${badge(row.判定段階)}">${esc(row.判定段階)}</span></td>
  <td>${esc(row.理由)}</td>
  <td>${esc(row.次に入れるデータ)}</td>
</tr>`).join('');

const inputHtml = inputRows.map((row, index) => `<tr>
  <td>${index + 1}</td>
  <td><b>${esc(row.ticker)}</b><br>${esc(row.銘柄)}</td>
  <td>${esc(row.入力項目)}</td>
  <td>${esc(row.推奨取得先)}</td>
  <td>${esc(row.判定への使い方)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社選定ゲート 事前候補</title>
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
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    th:nth-child(1), td:nth-child(1) { width:5%; text-align:center; }
    th:nth-child(2), td:nth-child(2) { width:13%; }
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
    <h1>10社選定ゲート 事前候補</h1>
    <p>補完優先キューから10社を抽出し、どの段階で候補化できるかを分けました。未補完の値は購入候補スコアに混ぜず、入力欄として管理します。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.説明)}</p></div>`).join('')}
  </div>

  <section>
    <h2>扱い</h2>
    <p class="notice">この10社は最終購入候補ではありません。現時点では、公式値照合、財務補完、決算後反応、同業中央値、過熱確認を行うための事前候補です。補完後に再計算し、6月の市場イベント後に残す銘柄を再判定します。</p>
  </section>

  <section>
    <h2>事前候補10社</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>順</th><th>銘柄</th><th>業種</th><th>事前スコア</th><th>質的接続</th><th>判定段階</th><th>理由</th><th>次に入れるデータ</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>入力欄</h2>
    <p>次に埋める値を、銘柄別・項目別に展開しています。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>順</th><th>銘柄</th><th>入力項目</th><th>推奨取得先</th><th>判定への使い方</th></tr></thead>
        <tbody>${inputHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="741_top10_selection_gate.csv">10社選定ゲートCSV</a> / <a href="742_top10_required_input_template.csv">入力テンプレートCSV</a> / <a href="743_top10_selection_gate_summary.csv">要約CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_selection_gate_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_selection_gate_20260528.html',
  selected: selected.length,
  inputRows: inputRows.length
}, null, 2));
