import fs from 'node:fs';

const sourceCsv = 'financial_qualitative_next_input_queue_20260616.csv';
const outHtml = 'financial_qualitative_high_priority_workbench_20260616.html';
const outCsv = 'financial_qualitative_high_priority_input_template_20260616.csv';
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

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slug(value) {
  return String(value ?? '')
    .replace(/[^0-9A-Za-z_.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}

if (!fs.existsSync(sourceCsv)) {
  throw new Error(`${sourceCsv} が見つかりません。先に次入力キューを作成してください。`);
}

const sourceRows = parseCsv(fs.readFileSync(sourceCsv, 'utf8'));
const highRows = sourceRows.filter((row) => row['優先度'] === '高');
const financialRows = highRows.filter((row) => row['キュー種別'] === '財務入力');
const qualitativeRows = highRows.filter((row) => row['キュー種別'] === '質的テーマ検証');

const inputHeaders = [
  '作成時刻',
  '入力ID',
  'キュー種別',
  '優先度',
  'ticker',
  '銘柄またはテーマ',
  '入力項目',
  '入力値',
  '単位',
  '対象期間',
  '資料名',
  '資料日付',
  'URL',
  '確認者',
  '確認区分',
  '反映判定',
  'メモ',
];

const inputRows = highRows.map((row, index) => {
  const id = `HQ-${String(index + 1).padStart(2, '0')}-${slug(row.ticker)}-${slug(row['入力項目'])}`;
  return {
    作成時刻: generatedAt,
    入力ID: id,
    キュー種別: row['キュー種別'],
    優先度: row['優先度'],
    ticker: row.ticker,
    銘柄またはテーマ: row['銘柄'],
    入力項目: row['入力項目'],
    入力値: '',
    単位: '',
    対象期間: '',
    資料名: '',
    資料日付: '',
    URL: '',
    確認者: '',
    確認区分: '未確認',
    反映判定: '反映禁止',
    メモ: row['合格条件'],
  };
});

writeCsv(outCsv, inputHeaders, inputRows);

const byTarget = new Map();
for (const row of highRows) {
  const key = `${row['キュー種別']}__${row.ticker}__${row['銘柄']}`;
  if (!byTarget.has(key)) byTarget.set(key, []);
  byTarget.get(key).push(row);
}

function summaryCards() {
  const p1Names = Array.from(new Set(financialRows.map((row) => `${row.ticker} ${row['銘柄']}`)));
  const themeNames = qualitativeRows.map((row) => row['銘柄']);
  return `
    <div class="cards">
      <div class="card"><b>高優先キュー</b><strong>${highRows.length}件</strong><span>先に埋める対象だけを抽出</span></div>
      <div class="card"><b>P1復帰確認</b><strong>${p1Names.length}社</strong><span>${h(p1Names.join('、'))}</span></div>
      <div class="card"><b>質的テーマ</b><strong>${themeNames.length}件</strong><span>${h(themeNames.join('、'))}</span></div>
      <div class="card"><b>現在の買付</b><strong class="bad">0円</strong><span>反映前は購入判断に使わない</span></div>
    </div>
  `;
}

function groupCards(kind) {
  const groups = Array.from(byTarget.values()).filter((rows) => rows[0]['キュー種別'] === kind);
  return groups.map((rows) => {
    const row = rows[0];
    return `
      <article class="group">
        <div class="group-head">
          <div>
            <p class="eyebrow">${h(row['キュー種別'])}</p>
            <h3>${h(row.ticker)} ${h(row['銘柄'])}</h3>
          </div>
          <div class="status">${h(row['スコア反映'])}</div>
        </div>
        <div class="mini-grid">
          ${rows.map((item) => `
            <div class="mini">
              <b>${h(item['入力項目'])}</b>
              <span>確認先: ${h(item['確認先'])}</span>
              <p>${h(item['合格条件'])}</p>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function inputTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>入力ID</th>
            <th>区分</th>
            <th>対象</th>
            <th>項目</th>
            <th>入力値</th>
            <th>資料名</th>
            <th>資料日付</th>
            <th>URL</th>
            <th>反映判定</th>
          </tr>
        </thead>
        <tbody>
          ${inputRows.map((row) => `
            <tr>
              <td>${h(row.入力ID)}</td>
              <td>${h(row.キュー種別)}</td>
              <td><b>${h(row.ticker)}</b><br>${h(row.銘柄またはテーマ)}</td>
              <td>${h(row.入力項目)}</td>
              <td class="empty">未入力</td>
              <td class="empty">未入力</td>
              <td class="empty">未入力</td>
              <td class="empty">未入力</td>
              <td class="bad">${h(row.反映判定)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>財務・質的テーマ 高優先入力ワークベンチ</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:34px}
    header h1{margin:0 0 10px;font-size:clamp(34px,4vw,50px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-size:19px;font-weight:900;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:28px}
    h3{margin:0;color:var(--navy);font-size:24px;line-height:1.35}
    p{margin:0 0 10px}
    a{color:#004f86;font-weight:900}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:32px;color:var(--blue);line-height:1.25}
    .card span{display:block;font-weight:900;color:#263e55}
    .rule-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .rule{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .rule b{display:block;color:var(--navy);font-size:18px;margin-bottom:6px}
    .group{border:1px solid var(--line);border-radius:12px;margin:12px 0;background:#fff;overflow:hidden}
    .group-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;background:#e7f2fb;padding:14px 16px}
    .eyebrow{font-size:14px;font-weight:900;color:#46657e;margin:0 0 2px}
    .status{font-weight:900;color:#8a0000;text-align:right;max-width:440px}
    .mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}
    .mini{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px}
    .mini b{display:block;color:var(--navy);font-size:18px}
    .mini span{display:block;font-size:14px;font-weight:900;color:#526b82}
    .mini p{margin:6px 0 0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .bad{color:var(--red)!important;font-weight:900}
    .empty{color:#7d8790;font-weight:900}
    .download{display:inline-block;text-decoration:none;border:2px solid var(--blue);border-radius:10px;background:#fff;color:var(--navy);padding:10px 14px;margin-top:8px}
    @media(max-width:980px){main{padding:12px}.cards,.rule-grid,.mini-grid{grid-template-columns:1fr}body{font-size:17px}.group-head{display:block}.status{text-align:left;margin-top:8px}}
    @media print{body{background:#fff}header,section,.group{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px}}
  </style>
</head>
<body>
<header>
  <h1>財務・質的テーマ 高優先入力ワークベンチ</h1>
  <p>6月の購入判断に進む前に、未確認の財務値と質的テーマを「入力値・出所・資料日付・反映可否」までそろえるための実務画面です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    ${summaryCards()}
  </section>

  <section>
    <p class="notice">この画面は買付候補を増やすための作業台です。入力値・資料名・資料日付・URLがそろうまで、ランキング、買付比率、買付上限には反映しません。</p>
  </section>

  <section>
    <h2>反映ルール</h2>
    <div class="rule-grid">
      <div class="rule"><b>財務データ</b><p>PER/PBR/ROE/EPS/BPS/営業利益率は、公式資料または計算式が確認できた場合だけ反映します。出所のない数値は候補評価に使いません。</p></div>
      <div class="rule"><b>質的テーマ</b><p>半導体、AIインフラ、金利などは、仮説だけでは加点しません。受注、利益、会社コメント、イベント後反応のいずれかに接続できた場合だけ補助評価にします。</p></div>
      <div class="rule"><b>購入判断</b><p>この作業が進んでも、6月イベント、NISA口座、本人操作、注文前確認が未通過なら、買付上限は0円のままです。</p></div>
    </div>
  </section>

  <section>
    <h2>財務データ 高優先</h2>
    <p>まずP1復帰の可能性に関係する三菱電機とTDKを優先します。ここが埋まると「条件付き候補」から再判定に進められます。</p>
    ${groupCards('財務入力')}
  </section>

  <section>
    <h2>質的テーマ 高優先</h2>
    <p>テーマは単純加点ではなく、仮説・実績・反証を分けます。ニュースや連想材料を使う場合も、過去反応または業績接続がない限り補助扱いです。</p>
    ${groupCards('質的テーマ検証')}
  </section>

  <section>
    <h2>入力テンプレート</h2>
    <p>下のCSVに実数、単位、対象期間、資料名、資料日付、URLを入れます。入力後に検算ページへ接続し、反映可能かを判定します。</p>
    <a class="download" href="${h(outCsv)}">高優先入力CSVを開く</a>
    ${inputTable()}
  </section>
</main>
</body>
</html>
`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  highPriority: highRows.length,
  financial: financialRows.length,
  qualitative: qualitativeRows.length,
}, null, 2));
