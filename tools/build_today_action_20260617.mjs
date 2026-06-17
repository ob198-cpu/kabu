import fs from 'node:fs';

const outHtml = 'today_action_20260617.html';
const outCsv = 'today_action_20260617.csv';
const prebuyCsv = 'prebuy_master_gate_20260615.csv';
const today = '2026-06-17';
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

const prebuyRows = fs.existsSync(prebuyCsv) ? parseCsv(fs.readFileSync(prebuyCsv, 'utf8')) : [];
const prebuyDecision = prebuyRows.find((row) => row.ゲート === '6月イベント入力')?.総合判定 || '購入判断不可';
const buyLimit = prebuyRows.find((row) => row.ゲート === '6月イベント入力')?.買付上限 || '0円';

const rows = [
  {
    作成時刻: generatedAt,
    今日: today,
    ID: 'T01',
    確認時期: '確認済み',
    イベント: '日銀会合結果',
    本日の扱い: '確認済み',
    判定: '確認済',
    今日の作業: 'BOJ公式公表は確認済み。必要ならドル円、日経平均、TOPIX代替ETFの当日反応を補足する。',
    見るページ: '102_june_event_result_input.csv / event_post_reaction_workbench_20260615.html',
    公式URL: 'https://www.boj.or.jp/mopo/mpmdeci/state_2026/index.htm',
    市場データURL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    入力する数値: '政策方針変更、無担保コールレート1.0%程度、6/17適用、ドル円・日経・TOPIX代替ETFの補足',
    停止条件: 'ドル円-3.5%以上、日経/TOPIX代替ETF-5%以上なら買付停止候補',
  },
  {
    作成時刻: generatedAt,
    今日: today,
    ID: 'T02',
    確認時期: '本日確認',
    イベント: 'FOMC結果',
    本日の扱い: '本日確認',
    判定: '待機',
    今日の作業: 'Fed公式ページに6月会合のStatement/HTML/PDFリンクが出たか確認する。まだ無ければ待機する。',
    見るページ: 'june_event_execution_flow_20260615.html',
    公式URL: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    市場データURL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    入力する数値: '声明文、政策金利見通し、米10年金利、NASDAQ、SOX、VIX、ドル円',
    停止条件: '米10年金利+25bp以上、NASDAQ/SOX-5%以上、VIX+35%以上なら買付停止候補',
  },
  {
    作成時刻: generatedAt,
    今日: today,
    ID: 'T03',
    確認時期: 'FOMC後',
    イベント: '指数の総合反応',
    本日の扱い: 'FOMC後',
    判定: '未完了',
    今日の作業: 'FOMC後に日経平均、TOPIX代替ETF、S&P500、NASDAQ、SOX、VIXを同一基準で比較する。',
    見るページ: 'event_pre_baseline_20260615.html / event_post_reaction_workbench_20260615.html',
    公式URL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    市場データURL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    入力する数値: '各指数の変化率、米10年金利、VIX',
    停止条件: '指数が弱い場合は個別株比率を下げ、現金比率を上げる',
  },
  {
    作成時刻: generatedAt,
    今日: today,
    ID: 'T04',
    確認時期: 'FOMC後',
    イベント: '候補銘柄の個別反応',
    本日の扱い: 'FOMC後',
    判定: '未完了',
    今日の作業: '候補銘柄の下落率、指数との差、出来高変化を確認する。',
    見るページ: 'event_post_reaction_workbench_20260615.html / p1_segment_next_gate_input_validator_20260615.html',
    公式URL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    市場データURL: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    入力する数値: '候補銘柄の1日反応、5日反応、指数との差、出来高変化',
    停止条件: '候補銘柄-7%以上、または指数に明確に劣後した場合はP1復帰見送り',
  },
  {
    作成時刻: generatedAt,
    今日: today,
    ID: 'T05',
    確認時期: '購入前',
    イベント: '本人別NISA・注文前確認',
    本日の扱い: '購入前',
    判定: '未完了',
    今日の作業: '本人スマホ、本人ログイン、NISA口座区分、残枠、入金、注文画面を確認する。',
    見るページ: 'nisa_account_execution_gate_20260614.html',
    公式URL: 'nisa_account_execution_gate_20260614.html',
    市場データURL: 'nisa_account_execution_gate_20260614.html',
    入力する数値: '本人別のNISA残枠、口座別買付上限、注文金額',
    停止条件: '本人操作未確認、NISA口座区分不明、証券会社画面未確認なら買付上限0円',
  },
];

writeCsv(outCsv, ['作成時刻', '今日', 'ID', '確認時期', 'イベント', '本日の扱い', '判定', '今日の作業', '見るページ', '公式URL', '市場データURL', '入力する数値', '停止条件'], rows);

const confirmedRows = rows.filter((row) => row.本日の扱い === '確認済み');
const todayRows = rows.filter((row) => row.本日の扱い === '本日確認');
const waitingRows = rows.filter((row) => !['確認済み', '本日確認'].includes(row.本日の扱い));

function table(list) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>イベント</th><th>扱い</th><th>今日の作業</th><th>入力する数値</th><th>停止条件</th><th>見るページ</th></tr></thead>
    <tbody>${list.map((row) => `<tr>
      <td class="id">${h(row.ID)}</td>
      <td>${h(row.イベント)}</td>
      <td class="${row.本日の扱い === '確認済み' ? 'ok' : row.本日の扱い === '本日確認' ? 'warn' : 'muted'}">${h(row.本日の扱い)}</td>
      <td>${h(row.今日の作業)}</td>
      <td>${h(row.入力する数値)}</td>
      <td>${h(row.停止条件)}</td>
      <td>${h(row.見るページ)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日の確認事項 2026年6月17日</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:20px;line-height:1.8}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:34px}
    header h1{margin:0 0 8px;font-size:clamp(36px,4vw,52px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1360px;margin:0 auto;padding:24px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:29px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:32px;color:var(--blue);line-height:1.25}
    .card span{display:block;font-weight:800;color:#263e55}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:12px 12px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}
    .warn{color:var(--amber);font-weight:900}
    .bad{color:var(--red);font-weight:900}
    .muted{color:#52677a;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:18px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>本日の確認事項 2026年6月17日</h1>
  <p>日銀は確認済み、FOMCは公表待ちです。今日は「何が終わったか」と「何をまだ買付判断に使わないか」を分けて見ます。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <div class="cards">
      <div class="card"><b>総合判定</b><strong class="bad">${h(prebuyDecision)}</strong><span>買付上限はまだ ${h(buyLimit)}</span></div>
      <div class="card"><b>確認済み</b><strong>${h(confirmedRows.length)}</strong><span>日銀結果は反映済み</span></div>
      <div class="card"><b>本日確認</b><strong>${h(todayRows.length)}</strong><span>FOMCの公式公表有無を確認</span></div>
      <div class="card"><b>残りの待機</b><strong>${h(waitingRows.length)}</strong><span>指数反応、個別反応、本人別確認</span></div>
    </div>
  </section>
  <section>
    <p class="notice">6月17日時点では、日銀は確認済みですが、FOMC結果、指数の総合反応、候補銘柄の個別反応、本人別NISA確認がそろっていません。したがって、新規買付の判定はまだ出しません。</p>
  </section>
  <section>
    <h2>確認済みの項目</h2>
    ${table(confirmedRows)}
  </section>
  <section>
    <h2>今日確認する項目</h2>
    ${table(todayRows)}
  </section>
  <section>
    <h2>FOMC後に確認する項目</h2>
    ${table(waitingRows)}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  rows: rows.length,
  prebuyDecision,
  buyLimit,
}, null, 2));
