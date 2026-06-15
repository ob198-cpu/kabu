import fs from 'node:fs';

const outHtml = 'boj_result_input_sheet_20260616.html';
const outCsv = 'boj_result_input_sheet_20260616.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

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

const rows = [
  {
    区分: '公式結果',
    入力項目: '政策金利・金融市場調節方針',
    入力内容: '変更なし / 利上げ / 利下げ / その他変更を、公式文の表現に合わせて記録する。',
    必須: '必須',
    出所: '日本銀行 金融政策に関する決定事項等',
    URL: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    判定への使い方: '市場が想定外と受け取る内容なら、指数反応を見るまで買付を進めない。',
  },
  {
    区分: '公式結果',
    入力項目: '国債買入・QT方針',
    入力内容: '買入減額、減額ペース、先行き方針、次回会合への持ち越しがあれば記録する。',
    必須: '必須',
    出所: '日本銀行 公表文',
    URL: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    判定への使い方: '金利上昇・円高・銀行株反応・グロース株反応の前提として使う。',
  },
  {
    区分: '市場反応',
    入力項目: 'ドル円',
    入力内容: 'イベント前基準値 160.127 からの変化率を記録する。',
    必須: '必須',
    出所: 'Yahoo Finance chart API: JPY=X',
    URL: 'https://query1.finance.yahoo.com/v8/finance/chart/JPY=X',
    判定への使い方: 'ドル円が-3.5%以上の円高なら買付停止候補。',
  },
  {
    区分: '市場反応',
    入力項目: '日経平均',
    入力内容: 'イベント前基準値 69,317.5 からの変化率を記録する。',
    必須: '必須',
    出所: 'Yahoo Finance chart API: ^N225',
    URL: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EN225',
    判定への使い方: '日経平均が-5%以上なら買付停止候補。',
  },
  {
    区分: '市場反応',
    入力項目: 'TOPIX代替ETF 1306.T',
    入力内容: 'イベント前基準値 424.5 からの変化率を記録する。',
    必須: '必須',
    出所: 'Yahoo Finance chart API: 1306.T',
    URL: 'https://query1.finance.yahoo.com/v8/finance/chart/1306.T',
    判定への使い方: 'TOPIX代替ETFが-5%以上なら買付停止候補。',
  },
  {
    区分: '反映',
    入力項目: '結果入力台帳への反映',
    入力内容: 'T01を確認済にする場合は、結果値、市場反応、出所URL、出所時刻または対象期間、取得日時、反映先、反映状況を揃える。',
    必須: '必須',
    出所: '6月イベント手入力フォーム',
    URL: 'june_event_manual_input_form_20260615.html',
    判定への使い方: 'CSV反映ヘルパーで検証し、不備がなければ購入前統合ゲートへ反映する。',
  },
];

writeCsv(outCsv, ['作成時刻', '区分', '入力項目', '入力内容', '必須', '出所', 'URL', '判定への使い方'], rows.map((row) => ({
  作成時刻: generatedAt,
  ...row,
})));

const tableRows = rows.map((row) => `<tr>
  <td>${h(row.区分)}</td>
  <td><b>${h(row.入力項目)}</b></td>
  <td>${h(row.入力内容)}</td>
  <td class="required">${h(row.必須)}</td>
  <td><a href="${h(row.URL)}">${h(row.出所)}</a></td>
  <td>${h(row.判定への使い方)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>T01 日銀結果入力シート</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:19px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1320px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .required{color:var(--red);font-weight:900}
    a{color:#075c94;font-weight:900}
    .flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .flow a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;text-align:center}
    @media(max-width:900px){main{padding:12px}.flow{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>T01 日銀結果入力シート</h1>
  <p>日銀会合結果が公表された後、何をどの出所で確認し、どの条件で買付停止候補にするかをまとめた入力用シートです。</p>
</header>
<main>
  <section>
    <p class="notice">このページは入力準備です。日銀結果や市場反応を確定表示するものではありません。結果値・市場反応・出所URL・取得日時が揃うまで、購入判断には使いません。</p>
  </section>
  <section>
    <h2>入力項目</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>区分</th><th>入力項目</th><th>入力内容</th><th>必須</th><th>出所</th><th>判定への使い方</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>入力後の順番</h2>
    <div class="flow">
      <a href="june_event_source_checklist_20260615.html">公式ソース確認</a>
      <a href="june_event_manual_input_form_20260615.html">手入力フォーム</a>
      <a href="june_event_manual_input_apply_helper_20260615.html">CSV反映ヘルパー</a>
      <a href="prebuy_master_gate_20260615.html">購入前統合ゲート</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  rows: rows.length,
  generatedAt,
}, null, 2));
