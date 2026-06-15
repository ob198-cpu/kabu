import fs from 'node:fs';

const ticketsCsv = 'june_event_input_tickets_20260615.csv';
const baselineCsv = 'event_pre_baseline_20260615.csv';
const outputCsv = 'june_event_source_checklist_20260615.csv';
const htmlFile = 'june_event_source_checklist_20260615.html';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

const sourceRoutes = {
  T01: {
    primarySource: '日本銀行 金融政策に関する決定事項等',
    primaryUrl: 'https://www.boj.or.jp/mopo/mpmdeci/index.htm',
    marketSource: 'Yahoo Finance chart API: JPY=X, ^N225, 1306.T',
    marketUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    officialCheck: '政策変更、声明文、国債買入方針、必要に応じて総裁会見の要旨を確認する',
    numericCheck: 'ドル円、日経平均、TOPIX代替ETFのイベント前後変化',
    stopRule: 'ドル円-3.5%以上、日経/TOPIX代替ETF-5%以上なら買付停止候補',
  },
  T02: {
    primarySource: 'Federal Reserve FOMC calendars and information',
    primaryUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    marketSource: 'Yahoo Finance chart API: ^TNX, ^IXIC, ^SOX, ^VIX',
    marketUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    officialCheck: '声明文、政策金利見通し、Summary of Economic Projections、議長会見の方向感を確認する',
    numericCheck: '米10年金利、NASDAQ、SOX、VIXのイベント前後変化',
    stopRule: '米10年金利+25bp以上、NASDAQ/SOX-5%以上、VIX+35%以上なら買付停止候補',
  },
  T03: {
    primarySource: '指数・為替・VIXの時系列データ',
    primaryUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    marketSource: 'event_pre_baseline_20260615.csv とイベント後取得値',
    marketUrl: 'event_pre_baseline_20260615.html',
    officialCheck: '同じ基準日、同じ終値または同じ取得時刻で比較する',
    numericCheck: '日経平均、TOPIX代替ETF、S&P500、NASDAQ、SOX、VIXの変化率',
    stopRule: '指数が弱い場合は個別株比率を下げ、現金比率を上げる',
  },
  T04: {
    primarySource: '候補銘柄と比較指数の時系列データ',
    primaryUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    marketSource: '6503.T, 8035.T, ^N225, 1306.T, ^SOX',
    marketUrl: 'event_post_reaction_workbench_20260615.html',
    officialCheck: '候補銘柄の1日、5日、出来高変化を指数と比較する',
    numericCheck: '候補銘柄の下落率、指数との差、出来高変化',
    stopRule: '候補銘柄-7%以上、または指数に明確に劣後した場合はP1復帰見送り',
  },
  T05: {
    primarySource: '証券会社画面・本人確認・NISA口座画面',
    primaryUrl: 'nisa_account_execution_gate_20260614.html',
    marketSource: '本人別チェック表',
    marketUrl: 'nisa_account_execution_gate_20260614.html',
    officialCheck: '本人スマホ、本人ログイン、NISA区分、NISA残枠、入金、注文画面を確認する',
    numericCheck: '本人別のNISA残枠、口座別買付上限、注文金額',
    stopRule: '本人操作未確認、NISA口座区分不明、証券会社画面未確認なら買付上限0円',
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

function baselineSummary(rows, symbols) {
  return symbols
    .map((symbol) => rows.find((row) => row.シンボル === symbol))
    .filter(Boolean)
    .map((row) => `${row.名称} ${row.基準値} (${row.基準値日時})`)
    .join(' / ');
}

const tickets = parseCsv(fs.readFileSync(ticketsCsv, 'utf8'));
const baselines = fs.existsSync(baselineCsv) ? parseCsv(fs.readFileSync(baselineCsv, 'utf8')) : [];

const rows = tickets.map((ticket) => {
  const route = sourceRoutes[ticket.ID] ?? {};
  const symbols = ticket.ID === 'T01'
    ? ['JPY=X', '^N225', '1306.T']
    : ticket.ID === 'T02'
      ? ['^TNX', '^IXIC', '^SOX', '^VIX']
      : ticket.ID === 'T04'
        ? ['6503.T', '8035.T', '^N225', '1306.T', '^SOX']
        : [];
  return {
    作成時刻: generatedAt,
    ID: ticket.ID,
    確認時期: ticket.確認時期,
    イベント: ticket.チケット,
    公式確認先: route.primarySource || ticket.取得元,
    公式URL: route.primaryUrl || '',
    市場データ確認先: route.marketSource || ticket.取得元,
    市場データURL: route.marketUrl || '',
    確認する内容: route.officialCheck || ticket.入力するもの,
    入力する数値: route.numericCheck || ticket.入力するもの,
    既存基準値: baselineSummary(baselines, symbols) || '該当する基準値なし、または本人別確認',
    停止条件: route.stopRule || ticket.停止条件,
    完了条件: ticket.完了条件,
    反映先: ticket.反映先,
    現在状態: ticket.状態,
  };
});

const headers = ['作成時刻', 'ID', '確認時期', 'イベント', '公式確認先', '公式URL', '市場データ確認先', '市場データURL', '確認する内容', '入力する数値', '既存基準値', '停止条件', '完了条件', '反映先', '現在状態'];
writeCsv(outputCsv, [headers, ...rows.map((row) => headers.map((header) => row[header]))]);

const tableRows = rows.map((row) => `<tr>
  <td class="id">${h(row.ID)}</td>
  <td>${h(row.確認時期)}</td>
  <td>${h(row.イベント)}</td>
  <td><b>${h(row.公式確認先)}</b><br><a href="${h(row.公式URL)}">${h(row.公式URL)}</a></td>
  <td><b>${h(row.市場データ確認先)}</b><br><a href="${h(row.市場データURL)}">${h(row.市場データURL)}</a></td>
  <td>${h(row.確認する内容)}</td>
  <td>${h(row.入力する数値)}</td>
  <td>${h(row.既存基準値)}</td>
  <td class="stop">${h(row.停止条件)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント公式ソース確認表</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1360px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#064f80;font-weight:800}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .stop{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント公式ソース確認表</h1>
  <p>6/16以降に、どこを見て、何を入力し、どの条件で止めるかを確認するための実務表です。</p>
</header>
<main>
  <section>
    <p class="notice">この表は結果の予想ではありません。公式発表と市場データを取得した後、結果入力台帳に出所・取得日時付きで入力するための確認表です。</p>
  </section>
  <section>
    <h2>確認ルート</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>確認時期</th><th>イベント</th><th>公式確認先</th><th>市場データ確認先</th><th>確認する内容</th><th>入力する数値</th><th>既存基準値</th><th>停止条件</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_ticket_validator_20260615.html">入力検証</a>
      <a href="june_event_reflection_preview_20260615.html">反映プレビュー</a>
      <a href="prebuy_master_gate_20260615.html">購入前統合ゲート</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  outputCsv,
  rows: rows.length,
  generatedAt,
}, null, 2));
