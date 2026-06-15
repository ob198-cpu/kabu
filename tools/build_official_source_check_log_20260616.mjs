import fs from 'node:fs';

const outHtml = 'official_source_check_log_20260616.html';
const outCsv = 'official_source_check_log_20260616.csv';
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
    対象: '日銀会合結果',
    公式確認先: '日本銀行 金融政策に関する決定事項等',
    公式URL: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    確認状態: '接続確認済・結果確定待ち',
    確認できたこと: '公式確認先のページは確認対象として有効。ここから該当日の公表文を確認する。',
    まだ確定していないこと: '政策変更、国債買入方針、声明文、ドル円・日経平均・TOPIX代替ETFのイベント後反応は未入力。',
    買付判断への扱い: '未使用。結果値、出所URL、取得日時、市場反応が揃うまで購入判断には使わない。',
    次アクション: '公表文の該当URLと市場反応を手入力フォームへ入れ、CSV反映ヘルパーで検証する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T02',
    対象: 'FOMC結果',
    公式確認先: 'Federal Reserve FOMC calendars and information',
    公式URL: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    確認状態: '確認日待ち',
    確認できたこと: '確認ルートは定義済み。',
    まだ確定していないこと: '声明文、SEP、ドットプロット、議長会見、米10年金利・NASDAQ・SOX・VIXのイベント後反応は未入力。',
    買付判断への扱い: '未使用。FOMC後の市場反応が揃うまで購入判断には使わない。',
    次アクション: '2026-06-17以降に公式結果と市場反応を入力する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T03',
    対象: '指数の総合反応',
    公式確認先: 'イベント後の指数・為替・VIX時系列',
    公式URL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    確認状態: '確認日待ち',
    確認できたこと: 'イベント前基準値との比較対象は定義済み。',
    まだ確定していないこと: '日経平均、TOPIX代替ETF、S&P500、NASDAQ、SOX、VIXのイベント後変化率は未入力。',
    買付判断への扱い: '未使用。6/18以降の総合反応入力後に比率判断へ接続する。',
    次アクション: '6/18以降にイベント前基準値との差分を記録する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T04',
    対象: '候補銘柄の個別反応',
    公式確認先: '候補銘柄と比較指数の時系列',
    公式URL: 'event_post_reaction_workbench_20260615.html',
    確認状態: '確認日待ち',
    確認できたこと: '候補銘柄の反応検証先は定義済み。',
    まだ確定していないこと: '候補銘柄の1日、5日、出来高変化、指数との差は未入力。',
    買付判断への扱い: '未使用。候補銘柄が指数に明確に劣後した場合はP1復帰を見送る。',
    次アクション: '6/18以降に候補銘柄と指数の差を記録する。',
  },
  {
    作成時刻: generatedAt,
    ID: 'T05',
    対象: '本人別NISA・注文前確認',
    公式確認先: '証券会社画面・本人確認・NISA口座画面',
    公式URL: 'nisa_account_execution_gate_20260614.html',
    確認状態: '購入前確認待ち',
    確認できたこと: '本人別確認項目は定義済み。',
    まだ確定していないこと: '本人スマホ、本人ログイン、NISA区分、NISA残枠、入金、注文画面は未確認。',
    買付判断への扱い: '未使用。本人操作とNISA口座区分が未確認なら買付上限は0円。',
    次アクション: '本人別に証券会社画面を確認して、注文前チェックを完了させる。',
  },
];

const headers = ['作成時刻', 'ID', '対象', '公式確認先', '公式URL', '確認状態', '確認できたこと', 'まだ確定していないこと', '買付判断への扱い', '次アクション'];
writeCsv(outCsv, headers, rows);

const tableRows = rows.map((row) => `<tr>
  <td class="id">${h(row.ID)}</td>
  <td>${h(row.対象)}</td>
  <td>${h(row.確認状態)}</td>
  <td><a href="${h(row.公式URL)}">${h(row.公式確認先)}</a></td>
  <td>${h(row.確認できたこと)}</td>
  <td>${h(row.まだ確定していないこと)}</td>
  <td class="bad">${h(row.買付判断への扱い)}</td>
  <td>${h(row.次アクション)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>公式確認ログ 2026年6月16日</title>
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
    .id{font-weight:900;color:var(--navy);white-space:nowrap}.bad{color:var(--red);font-weight:900}
    a{color:#075c94;font-weight:900}
    @media(max-width:900px){main{padding:12px}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>公式確認ログ 2026年6月16日</h1>
  <p>公式ページへの確認状況と、まだ買付判断に使ってはいけない未確定項目を分けた記録です。</p>
</header>
<main>
  <section>
    <p class="notice">このログは結果入力ではありません。公式ページを確認しても、結果値・出所URL・取得日時・市場反応が揃うまでは、購入判断・P1復帰・買付比率に反映しません。</p>
  </section>
  <section>
    <h2>確認ログ</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>対象</th><th>確認状態</th><th>公式確認先</th><th>確認できたこと</th><th>未確定項目</th><th>買付判断への扱い</th><th>次アクション</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
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
