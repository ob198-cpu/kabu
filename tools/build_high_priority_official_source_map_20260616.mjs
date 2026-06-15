import fs from 'node:fs';

const queueCsv = 'financial_qualitative_high_priority_input_template_20260616.csv';
const sourceCsv = 'p1_financial_direct_document_candidates_20260614.csv';
const outCsv = 'financial_qualitative_high_priority_source_map_20260616.csv';
const outHtml = 'financial_qualitative_high_priority_source_map_20260616.html';
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

function sourceForTicker(ticker) {
  const rows = sourceRows.filter((row) => row.ticker === ticker);
  if (!rows.length) return null;
  const directPdf = rows.find((row) => row['候補区分']?.includes('PDF'));
  return directPdf ?? rows[0];
}

function sourceForTheme(theme) {
  if (theme.includes('半導体')) {
    return {
      URL: 'theme_event_validation_ledger_20260614.html',
      資料扱い: '既存テーマ検証台帳と、SOX・WFE・候補銘柄反応の確認',
      入力へ使う条件: 'テーマ後の指数超過、受注・利益率・会社コメントのいずれかで接続できること',
    };
  }
  if (theme.includes('AIインフラ')) {
    return {
      URL: 'theme_event_validation_ledger_20260614.html',
      資料扱い: 'AIインフラ・データセンター需要の検証台帳',
      入力へ使う条件: 'データセンター投資、電力需要、電線・重電・冷却関連の受注または利益寄与が確認できること',
    };
  }
  if (theme.includes('金利')) {
    return {
      URL: 'june_event_execution_flow_20260615.html',
      資料扱い: '日銀・FOMC・長期金利・銀行株反応の確認',
      入力へ使う条件: '金利上昇が利ざや・運用益へ効く一方、信用コスト悪化が限定的であること',
    };
  }
  return {
    URL: 'qualitative_theme_evidence_gate_20260613.html',
    資料扱い: '質的テーマ検証ゲート',
    入力へ使う条件: '仮説、実績、反証を分けて確認すること',
  };
}

if (!fs.existsSync(queueCsv)) throw new Error(`${queueCsv} が見つかりません。`);
if (!fs.existsSync(sourceCsv)) throw new Error(`${sourceCsv} が見つかりません。`);

const queueRows = parseCsv(fs.readFileSync(queueCsv, 'utf8'));
const sourceRows = parseCsv(fs.readFileSync(sourceCsv, 'utf8'));

const rows = queueRows.map((row) => {
  const isFinance = row['キュー種別'] === '財務入力';
  const source = isFinance ? sourceForTicker(row.ticker) : sourceForTheme(row['銘柄またはテーマ']);
  return {
    作成時刻: generatedAt,
    入力ID: row['入力ID'],
    キュー種別: row['キュー種別'],
    優先度: row['優先度'],
    ticker: row.ticker,
    銘柄またはテーマ: row['銘柄またはテーマ'],
    入力項目: row['入力項目'],
    公式確認先: source?.URL ?? '',
    資料扱い: source?.['資料扱い'] ?? '未設定',
    入力へ使う条件: source?.['入力へ使う条件'] ?? '未設定',
    反映前確認: isFinance
      ? '資料名・資料日付・対象期間・入力値・計算式を残す。PER/PBRは株価基準日を必ず分ける。'
      : '仮説だけでは反映しない。過去反応または業績接続を記録する。',
    現在の扱い: '反映禁止',
  };
});

const headers = [
  '作成時刻',
  '入力ID',
  'キュー種別',
  '優先度',
  'ticker',
  '銘柄またはテーマ',
  '入力項目',
  '公式確認先',
  '資料扱い',
  '入力へ使う条件',
  '反映前確認',
  '現在の扱い',
];
writeCsv(outCsv, headers, rows);

function table(sectionRows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>入力ID</th>
            <th>対象</th>
            <th>項目</th>
            <th>公式確認先</th>
            <th>資料扱い</th>
            <th>入力へ使う条件</th>
            <th>反映前確認</th>
            <th>現在の扱い</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows.map((row) => `
            <tr>
              <td>${h(row['入力ID'])}</td>
              <td><b>${h(row.ticker)}</b><br>${h(row['銘柄またはテーマ'])}</td>
              <td>${h(row['入力項目'])}</td>
              <td><a href="${h(row['公式確認先'])}" target="_blank" rel="noopener">${h(row['公式確認先'])}</a></td>
              <td>${h(row['資料扱い'])}</td>
              <td>${h(row['入力へ使う条件'])}</td>
              <td>${h(row['反映前確認'])}</td>
              <td class="bad">${h(row['現在の扱い'])}</td>
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
  <title>高優先 公式確認先マップ</title>
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
    p{margin:0 0 10px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:32px;color:var(--blue);line-height:1.25}
    .card span{display:block;font-weight:900;color:#263e55}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#004f86;font-weight:900}
    .bad{color:var(--red)!important;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px}}
  </style>
</head>
<body>
<header>
  <h1>高優先 公式確認先マップ</h1>
  <p>高優先17件について、どの公式資料・既存検証台帳を見て、何を入力条件にするかを固定します。確認先があっても、数値入力までは反映禁止です。</p>
</header>
<main>
  <section>
    <h2>確認対象</h2>
    <div class="cards">
      <div class="card"><b>高優先</b><strong>${rows.length}件</strong><span>公式確認先を接続</span></div>
      <div class="card"><b>財務</b><strong>${rows.filter((row) => row['キュー種別'] === '財務入力').length}件</strong><span>三菱電機・TDK</span></div>
      <div class="card"><b>質的テーマ</b><strong>${rows.filter((row) => row['キュー種別'] === '質的テーマ検証').length}件</strong><span>半導体、AIインフラ、金利</span></div>
      <div class="card"><b>現在の扱い</b><strong class="bad">反映禁止</strong><span>入力完了前は買付判断へ使わない</span></div>
    </div>
  </section>

  <section>
    <p class="notice">このページは「見る場所」を固定するためのページです。数値の入力、資料日付、対象期間、確認者がそろうまで、候補順位・比率・買付上限には反映しません。</p>
    <p>CSV: <a href="${h(outCsv)}">${h(outCsv)}</a></p>
  </section>

  <section>
    <h2>財務データ 公式確認先</h2>
    ${table(rows.filter((row) => row['キュー種別'] === '財務入力'))}
  </section>

  <section>
    <h2>質的テーマ 確認先</h2>
    ${table(rows.filter((row) => row['キュー種別'] === '質的テーマ検証'))}
  </section>
</main>
</body>
</html>
`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  rows: rows.length,
}, null, 2));
