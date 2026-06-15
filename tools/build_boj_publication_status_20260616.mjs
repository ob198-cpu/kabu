import fs from 'node:fs';

const outHtml = 'boj_publication_status_20260616.html';
const outCsv = 'boj_publication_status_20260616.csv';
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
    作成時刻: generatedAt,
    ID: 'T01',
    項目: '公式一覧ページ',
    確認状態: '接続確認済',
    確認内容: '日本銀行の「金融政策に関する決定事項等」ページをT01の公式確認先として使う。',
    公式URL: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    買付判断への扱い: '未使用',
    次アクション: '該当日の公表文リンクを確認し、日銀結果入力シートへ進む。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T01',
    項目: '2026年6月16日の個別公表文URL',
    確認状態: '自動特定未完了',
    確認内容: '検索・公式一覧の確認だけでは、該当日の個別公表文URLを確定入力する段階ではない。',
    公式URL: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    買付判断への扱い: '未使用',
    次アクション: '公表文の個別URL、政策内容、出所時刻を手動確認してから入力する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T01',
    項目: '市場反応',
    確認状態: '未入力',
    確認内容: 'ドル円、日経平均、TOPIX代替ETFのイベント後反応はまだ結果入力台帳へ入っていない。',
    公式URL: 'boj_result_input_sheet_20260616.html',
    買付判断への扱い: '未使用',
    次アクション: '日銀公表文と同じ基準で市場反応を入力し、CSV反映ヘルパーで検証する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T01',
    項目: '購入前ゲート',
    確認状態: '停止継続',
    確認内容: 'T01が未入力のため、6月イベント入力ゲートは未通過のまま。',
    公式URL: 'prebuy_master_gate_20260615.html',
    買付判断への扱い: '買付上限0円',
    次アクション: 'T01、T02、T03、T04、T05が揃うまで購入判断へ進めない。',
  },
];

const headers = ['作成時刻', 'ID', '項目', '確認状態', '確認内容', '公式URL', '買付判断への扱い', '次アクション'];
writeCsv(outCsv, headers, rows);

const tableRows = rows.map((row) => `<tr>
  <td class="id">${h(row.ID)}</td>
  <td>${h(row.項目)}</td>
  <td class="${row.確認状態.includes('済') ? 'ok' : row.確認状態.includes('停止') ? 'bad' : 'warn'}">${h(row.確認状態)}</td>
  <td>${h(row.確認内容)}</td>
  <td><a href="${h(row.公式URL)}">${h(row.公式URL)}</a></td>
  <td class="bad">${h(row.買付判断への扱い)}</td>
  <td>${h(row.次アクション)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>T01 日銀公表確認ステータス</title>
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
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    a{color:#075c94;font-weight:900}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;text-align:center}
    @media(max-width:900px){main{padding:12px}.links{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>T01 日銀公表確認ステータス</h1>
  <p>日銀会合結果について、公式確認先、個別公表文の特定状況、市場反応、購入前ゲートへの扱いを分けた確認ログです。</p>
</header>
<main>
  <section>
    <p class="notice">このページは「確認状況」の記録です。日銀の結果値を確定入力したページではありません。個別公表文URL、出所時刻、市場反応が揃うまで、購入判断・P1復帰・買付比率には使いません。</p>
  </section>
  <section>
    <h2>確認ステータス</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>項目</th><th>確認状態</th><th>確認内容</th><th>確認先</th><th>買付判断への扱い</th><th>次アクション</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>次に使う画面</h2>
    <div class="links">
      <a href="boj_result_input_sheet_20260616.html">日銀結果入力シート</a>
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
