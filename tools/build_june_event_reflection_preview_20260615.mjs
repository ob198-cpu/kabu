import fs from 'node:fs';

const entryCsv = 'june_event_result_entry_20260615.csv';
const previewCsv = 'june_event_reflection_preview_20260615.csv';
const htmlFile = 'june_event_reflection_preview_20260615.html';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

const reflectionMap = {
  T01: {
    destination: '6503_event_boj_result / 8035_event_boj_result / event_post_reaction_workbench',
    purpose: '日銀後の円高ショック、日本株急落、銀行・輸出・半導体候補への影響を確認する',
  },
  T02: {
    destination: '6503_event_fomc_result / 8035_event_fomc_result / event_post_reaction_workbench',
    purpose: 'FOMC後の米10年金利、NASDAQ、SOX、VIXを確認し、高PER・半導体候補を保留すべきか判定する',
  },
  T03: {
    destination: '6503_post_event_index_reaction / 8035_post_event_index_reaction / p1_event_gate_remaining',
    purpose: '6月イベント後の地合いを指数で確認し、個別株比率を上げるか下げるか判定する',
  },
  T04: {
    destination: '6503_post_event_ticker_reaction / 8035_post_event_ticker_reaction / p1_segment_next_gate_input_validator',
    purpose: '候補銘柄が指数に対して強いか弱いかを確認し、P1復帰候補に戻せるか判定する',
  },
  T05: {
    destination: 'nisa_account_execution_gate_20260614 / 購入前チェック / 注文票',
    purpose: '本人操作、NISA口座区分、NISA残枠、入金、注文画面を確認し、買付上限0円を解除できるか判定する',
  },
};

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
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

function blank(value) {
  return String(value ?? '').trim() === '';
}

function judge(row) {
  const missing = [];
  for (const field of ['結果値', '市場反応', '出所URL', '取得日時', '反映先']) {
    if (blank(row[field])) missing.push(field);
  }
  if (row.入力ステータス === '停止候補') {
    return { status: '反映停止', reason: '停止候補が入力されているため、買付系の反映に進めない', missing };
  }
  if (row.入力ステータス === '注意' || row.入力ステータス === '部分確認') {
    return { status: '反映保留', reason: '注意または部分確認のため、比率引き下げ・停止条件との接続確認が必要', missing };
  }
  if (row.入力ステータス === '確認済' && missing.length === 0) {
    return { status: '反映可能', reason: '結果値、出所、取得日時、反映先が揃っている', missing };
  }
  return { status: '反映禁止', reason: '未入力または根拠不足のため、スコア・買付判定へ反映しない', missing };
}

const entries = fs.existsSync(entryCsv) ? parseCsv(fs.readFileSync(entryCsv, 'utf8')) : [];
const rows = entries.map((entry) => {
  const rule = reflectionMap[entry.ID] ?? { destination: entry.反映先 || '', purpose: '反映先未定義' };
  const result = judge(entry);
  return {
    作成時刻: generatedAt,
    ID: entry.ID,
    イベント: entry.イベント,
    入力ステータス: entry.入力ステータス,
    反映判定: result.status,
    不足項目: result.missing.join('、') || 'なし',
    反映先: rule.destination,
    反映目的: rule.purpose,
    判定理由: result.reason,
    次アクション: result.status === '反映可能' ? '対象入力欄へ転記し、検証画面で再判定する' : '公式結果、出所、取得日時、反映状況を先に埋める',
  };
});

const headers = ['作成時刻', 'ID', 'イベント', '入力ステータス', '反映判定', '不足項目', '反映先', '反映目的', '判定理由', '次アクション'];
writeCsv(previewCsv, [headers, ...rows.map((row) => headers.map((header) => row[header]))]);

const ok = rows.filter((row) => row.反映判定 === '反映可能').length;
const hold = rows.filter((row) => row.反映判定 === '反映保留').length;
const stop = rows.filter((row) => row.反映判定 === '反映停止').length;
const block = rows.filter((row) => row.反映判定 === '反映禁止').length;
const buyLimit = ok === rows.length && hold === 0 && stop === 0 && rows.length > 0 ? '次ゲートで判定' : '0円';

const tableRows = rows.map((row) => `<tr>
  <td class="id">${h(row.ID)}</td>
  <td>${h(row.イベント)}</td>
  <td>${h(row.入力ステータス)}</td>
  <td class="${row.反映判定 === '反映可能' ? 'ok' : row.反映判定 === '反映禁止' ? 'bad' : 'warn'}">${h(row.反映判定)}</td>
  <td>${h(row.不足項目)}</td>
  <td>${h(row.反映先)}</td>
  <td>${h(row.反映目的)}</td>
  <td>${h(row.次アクション)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント反映プレビュー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1320px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント反映プレビュー</h1>
  <p>入力台帳の結果を、P1ゲート・反応判定・口座確認へ反映できるかを事前確認します。</p>
</header>
<main>
  <section>
    <h2>現在の反映判定</h2>
    <div class="cards">
      <div class="card"><b>反映可能</b><strong>${ok}/${rows.length}</strong></div>
      <div class="card"><b>反映保留</b><strong>${hold}</strong></div>
      <div class="card"><b>反映停止</b><strong>${stop}</strong></div>
      <div class="card"><b>反映禁止</b><strong>${block}</strong></div>
      <div class="card"><b>買付上限</b><strong>${h(buyLimit)}</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">未入力・根拠不足のイベントは、スコア、P1復帰、買付金額へ反映しません。反映可能になっても、次ゲートで停止条件・口座条件を再確認します。</p>
  </section>
  <section>
    <h2>反映プレビュー</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>イベント</th><th>入力状態</th><th>反映判定</th><th>不足項目</th><th>反映先</th><th>反映目的</th><th>次アクション</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_ticket_validator_20260615.html">入力検証</a>
      <a href="p1_event_gate_remaining_20260615.html">P1イベント後ゲート</a>
      <a href="event_post_reaction_workbench_20260615.html">反応判定</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  previewCsv,
  rows: rows.length,
  ok,
  hold,
  stop,
  block,
  buyLimit,
  generatedAt,
}, null, 2));
