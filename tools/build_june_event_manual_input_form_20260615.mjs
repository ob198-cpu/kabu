import fs from 'node:fs';

const entryCsv = 'june_event_result_entry_20260615.csv';
const htmlFile = 'june_event_manual_input_form_20260615.html';
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

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const rows = fs.existsSync(entryCsv) ? parseCsv(fs.readFileSync(entryCsv, 'utf8')) : [];
const formRows = rows.map((row) => ({
  id: row.ID,
  timing: row.確認時期,
  event: row.イベント,
  requiredInput: row.入力するもの,
  sourceCandidate: row.取得元候補,
  status: row.入力ステータス || '未入力',
  resultValue: row.結果値 || '',
  marketReaction: row.市場反応 || '',
  sourceUrl: row.出所URL || '',
  sourcePeriod: row.出所時刻または対象期間 || '',
  acquiredAt: row.取得日時 || '',
  reflectTo: row.反映先 || '',
  reflectStatus: row.反映状況 || '未反映',
  nextAction: row.次アクション || '',
  stopRule: row.停止条件メモ || '',
  memo: row.確認者メモ || '',
}));

const tableRows = formRows.map((row, index) => `<tr data-index="${index}">
  <td class="id">${h(row.id)}</td>
  <td>${h(row.timing)}<br><b>${h(row.event)}</b></td>
  <td>${h(row.requiredInput)}</td>
  <td><select data-field="status">
    ${['未入力', '部分確認', '確認済', '注意', '停止候補'].map((value) => `<option value="${value}"${row.status === value ? ' selected' : ''}>${value}</option>`).join('')}
  </select></td>
  <td><textarea data-field="resultValue" placeholder="公式結果、政策内容、確認した数値">${h(row.resultValue)}</textarea></td>
  <td><textarea data-field="marketReaction" placeholder="金利、指数、為替、候補銘柄の反応">${h(row.marketReaction)}</textarea></td>
  <td><input data-field="sourceUrl" value="${h(row.sourceUrl)}" placeholder="公式URLまたは取得URL"></td>
  <td><input data-field="sourcePeriod" value="${h(row.sourcePeriod)}" placeholder="発表日時・対象期間"></td>
  <td><input data-field="acquiredAt" value="${h(row.acquiredAt)}" placeholder="取得日時"></td>
  <td><input data-field="reflectTo" value="${h(row.reflectTo)}" placeholder="反映先"></td>
  <td><select data-field="reflectStatus">
    ${['未反映', '反映待ち', '反映済', '反映保留', '反映停止'].map((value) => `<option value="${value}"${row.reflectStatus === value ? ' selected' : ''}>${value}</option>`).join('')}
  </select></td>
  <td class="missing"></td>
</tr>`).join('');

const dataJson = JSON.stringify(formRows).replace(/</g, '\\u003c');
const headersJson = JSON.stringify([
  '作成時刻',
  '更新時刻',
  'ID',
  '確認時期',
  'イベント',
  '入力するもの',
  '取得元候補',
  '入力ステータス',
  '結果値',
  '市場反応',
  '出所URL',
  '出所時刻または対象期間',
  '取得日時',
  '反映先',
  '反映状況',
  '次アクション',
  '停止条件メモ',
  '確認者メモ',
]);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント手入力フォーム</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.65}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1480px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .toolbar{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
    button{border:0;border-radius:9px;background:#0b67a3;color:#fff;font-weight:900;padding:11px 16px;font-size:16px;cursor:pointer}
    button.secondary{background:#31556f}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto;min-width:1500px}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    input,select,textarea{width:100%;font:inherit;border:1px solid #a9c3d8;border-radius:8px;padding:8px;background:#fff;color:var(--ink)}
    textarea{min-height:92px;resize:vertical}
    .missing{font-weight:900;color:var(--red)}
    .ok{color:var(--green);font-weight:900}.bad{color:var(--red);font-weight:900}
    #csvOut{width:100%;min-height:220px;font-family:Consolas,"Courier New",monospace;font-size:14px}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント手入力フォーム</h1>
  <p>公式発表と市場反応を入力し、不足項目を確認してからCSVとして出力するためのフォームです。</p>
</header>
<main>
  <section>
    <h2>現在の入力判定</h2>
    <div class="cards">
      <div class="card"><b>確認済</b><strong id="doneCount">0</strong></div>
      <div class="card"><b>注意・停止</b><strong id="warnCount">0</strong></div>
      <div class="card"><b>未完了</b><strong id="missingCount">0</strong></div>
      <div class="card"><b>CSV出力</b><strong id="csvStatus">未作成</strong></div>
      <div class="card"><b>買付上限</b><strong class="bad">0円</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">このフォームで入力しても、GitHub上のCSVは自動更新されません。出力CSVを保存し、結果入力台帳へ反映してから検証します。未入力・出所未確認の行は、買付判断に使いません。</p>
  </section>
  <section>
    <h2>入力欄</h2>
    <div class="toolbar">
      <button type="button" onclick="fillNow()">取得日時を現在時刻で補完</button>
      <button type="button" onclick="validateAll()">不足項目を確認</button>
      <button type="button" onclick="buildCsv()">CSVを作成</button>
      <button type="button" class="secondary" onclick="downloadCsv()">CSVをダウンロード</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>イベント</th><th>入力するもの</th><th>状態</th><th>結果値</th><th>市場反応</th><th>出所URL</th><th>出所時刻/対象期間</th><th>取得日時</th><th>反映先</th><th>反映状況</th><th>不足項目</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>CSV出力</h2>
    <textarea id="csvOut" readonly placeholder="CSVを作成するとここに表示されます"></textarea>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_source_checklist_20260615.html">公式ソース確認表</a>
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_ticket_validator_20260615.html">入力検証</a>
      <a href="prebuy_master_gate_20260615.html">購入前統合ゲート</a>
    </div>
  </section>
</main>
<script>
const baseRows = ${dataJson};
const headers = ${headersJson};
const generatedAt = ${JSON.stringify(generatedAt)};

function escCsv(value) {
  const text = String(value ?? '');
  return /[",\\n\\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function rowElements(row) {
  return [...row.querySelectorAll('[data-field]')].reduce((obj, el) => {
    obj[el.dataset.field] = el.value.trim();
    return obj;
  }, {});
}

function requiredMissing(values) {
  const missing = [];
  if (!values.resultValue) missing.push('結果値');
  if (!values.marketReaction) missing.push('市場反応');
  if (!values.sourceUrl) missing.push('出所URL');
  if (!values.acquiredAt) missing.push('取得日時');
  if (!values.reflectTo) missing.push('反映先');
  if (!values.reflectStatus || values.reflectStatus === '未反映') missing.push('反映状況');
  if (values.status !== '確認済') missing.push('確認済ステータス');
  return missing;
}

function validateAll() {
  let done = 0;
  let warn = 0;
  let missingRows = 0;
  document.querySelectorAll('tr[data-index]').forEach((tr) => {
    const values = rowElements(tr);
    const missing = requiredMissing(values);
    const cell = tr.querySelector('.missing');
    cell.textContent = missing.length ? missing.join('、') : 'なし';
    if (!missing.length) done += 1;
    else if (values.status === '注意' || values.status === '停止候補' || values.status === '部分確認') warn += 1;
    else missingRows += 1;
  });
  document.getElementById('doneCount').textContent = done + '/' + baseRows.length;
  document.getElementById('warnCount').textContent = String(warn);
  document.getElementById('missingCount').textContent = String(missingRows);
  return { done, warn, missingRows };
}

function fillNow() {
  const now = nowText();
  document.querySelectorAll('[data-field="acquiredAt"]').forEach((input) => {
    if (!input.value.trim()) input.value = now;
  });
  validateAll();
}

function collectRows() {
  return [...document.querySelectorAll('tr[data-index]')].map((tr) => {
    const index = Number(tr.dataset.index);
    const base = baseRows[index];
    const values = rowElements(tr);
    return {
      '作成時刻': generatedAt,
      '更新時刻': nowText(),
      'ID': base.id,
      '確認時期': base.timing,
      'イベント': base.event,
      '入力するもの': base.requiredInput,
      '取得元候補': base.sourceCandidate,
      '入力ステータス': values.status,
      '結果値': values.resultValue,
      '市場反応': values.marketReaction,
      '出所URL': values.sourceUrl,
      '出所時刻または対象期間': values.sourcePeriod,
      '取得日時': values.acquiredAt,
      '反映先': values.reflectTo,
      '反映状況': values.reflectStatus,
      '次アクション': base.nextAction,
      '停止条件メモ': base.stopRule,
      '確認者メモ': base.memo,
    };
  });
}

function buildCsv() {
  validateAll();
  const rows = collectRows();
  const csv = '\\uFEFF' + [
    headers.map(escCsv).join(','),
    ...rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')),
  ].join('\\n') + '\\n';
  document.getElementById('csvOut').value = csv;
  document.getElementById('csvStatus').textContent = '作成済';
  return csv;
}

function downloadCsv() {
  const csv = document.getElementById('csvOut').value || buildCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'june_event_result_entry_20260615_filled.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

validateAll();
</script>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  rows: formRows.length,
  generatedAt,
}, null, 2));
