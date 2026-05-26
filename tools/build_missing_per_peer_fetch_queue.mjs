import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
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
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `\uFEFF${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

const gateRows = readCsv('450_immediate_score_connection_gate.csv');

const perRows = gateRows
  .filter((row) => row.missing_or_limit === 'per')
  .map((row, index) => ({
    updated_at: generatedAt,
    priority: index + 1,
    ticker: row.ticker,
    company: row.company,
    missing_item: 'PER',
    required_basis: '予想PERまたは同一基準の実績PER',
    acceptable_source_1: '会社IR/決算短信のEPS予想 + 同日株価で計算',
    acceptable_source_2: 'J-Quants/JPX系の公式・準公式データ',
    acceptable_source_3: 'EDINET有報の実績EPSは補助。予想PERとは分けて記録',
    calculation_rule: 'PER = 基準株価 ÷ 1株利益。予想EPSと実績EPSを混在させない',
    score_rule: '値が入るまで割安スコアへ接続しない',
    status: '未補完',
  }));

const peerRows = gateRows
  .filter((row) => row.missing_or_limit === 'peer median')
  .map((row, index) => ({
    updated_at: generatedAt,
    priority: index + 1,
    ticker: row.ticker,
    company: row.company,
    missing_item: '同業中央値',
    required_basis: '同業2社以上のPER/PBR/ROE中央値',
    acceptable_source_1: '同業会社IR/決算短信 + 株価',
    acceptable_source_2: 'J-Quants/JPX系データ',
    acceptable_source_3: 'EDINET有報は実績財務の補助。株価と基準日を合わせる',
    calculation_rule: '同業2社未満なら中央値として使わない。欠損値を0扱いしない',
    score_rule: '中央値が成立するまで業種補正へ接続しない',
    status: '未補完',
  }));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: 'PER不足',
    count: `${perRows.length}件`,
    meaning: '割安性スコアへ直結できない主因。予想PERと実績PERを分けて補完する。',
  },
  {
    updated_at: generatedAt,
    item: '同業中央値不足',
    count: `${peerRows.length}件`,
    meaning: '業種別補正へ直結できない主因。同業2社以上の同一基準データが必要。',
  },
  {
    updated_at: generatedAt,
    item: '説明補助まで',
    count: `${gateRows.filter((row) => row.score_connection === '説明補助まで').length}件`,
    meaning: '一部数値はあるが、まだ購入候補スコアには混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    count: '0社',
    meaning: 'この工程は不足データ補完。6月イベント後の再判定前に購入判断へ進めない。',
  },
];

const scheduleRows = [
  {
    updated_at: generatedAt,
    step: '1',
    timing: '即時',
    task: '不足値をPER不足と同業中央値不足に分離',
    output: '451〜455 CSV、HTMLキュー',
    pass_condition: '欠損値を0扱いせず、スコア接続不可を明示',
  },
  {
    updated_at: generatedAt,
    step: '2',
    timing: '次作業',
    task: '8306/6146/4385のPERを同一基準で補完',
    output: 'PER入力欄、基準日、出典URL、計算式',
    pass_condition: '予想PERと実績PERを混在させない',
  },
  {
    updated_at: generatedAt,
    step: '3',
    timing: '次作業',
    task: '2802/5020/4385の同業中央値を再構成',
    output: '同業2社以上のPER/PBR/ROE中央値',
    pass_condition: '同業2社未満は未接続のまま残す',
  },
  {
    updated_at: generatedAt,
    step: '4',
    timing: '補完後',
    task: '探索スコアと購入候補スコアを再計算',
    output: '候補増加可否、信頼度、除外理由',
    pass_condition: '信頼度70点以上かつハード除外なし',
  },
  {
    updated_at: generatedAt,
    step: '5',
    timing: '6月イベント後',
    task: 'CPI、FOMC、日銀後の実数を入れて再判定',
    output: 'NISA 1年保有テスト候補10社',
    pass_condition: '購入判断はこの段階まで出さない',
  },
];

const reentryRows = [
  {
    updated_at: generatedAt,
    rule: '欠損値',
    decision: 'NULLとして扱う',
    reason: '0にすると低PER・低PBRのように誤って有利になるため。',
  },
  {
    updated_at: generatedAt,
    rule: 'PER',
    decision: '予想PERと実績PERを分ける',
    reason: '成長株・景気敏感株では基準混在で評価が歪むため。',
  },
  {
    updated_at: generatedAt,
    rule: '同業中央値',
    decision: '同業2社以上で成立',
    reason: '1社だけでは比較ではなく単一事例になり、業種補正として弱いため。',
  },
  {
    updated_at: generatedAt,
    rule: '部分接続',
    decision: '説明補助まで',
    reason: '候補理由の説明には使えるが、点数化にはまだ不足があるため。',
  },
  {
    updated_at: generatedAt,
    rule: '購入判断',
    decision: '6月イベント後まで0社',
    reason: '現在は候補選定の検算段階で、売買実行判断ではないため。',
  },
];

writeCsv('451_missing_per_peer_queue_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'count',
  'meaning',
]);

writeCsv('452_per_fetch_queue.csv', perRows, [
  'updated_at',
  'priority',
  'ticker',
  'company',
  'missing_item',
  'required_basis',
  'acceptable_source_1',
  'acceptable_source_2',
  'acceptable_source_3',
  'calculation_rule',
  'score_rule',
  'status',
]);

writeCsv('453_peer_median_fetch_queue.csv', peerRows, [
  'updated_at',
  'priority',
  'ticker',
  'company',
  'missing_item',
  'required_basis',
  'acceptable_source_1',
  'acceptable_source_2',
  'acceptable_source_3',
  'calculation_rule',
  'score_rule',
  'status',
]);

writeCsv('454_missing_data_resolution_schedule.csv', scheduleRows, [
  'updated_at',
  'step',
  'timing',
  'task',
  'output',
  'pass_condition',
]);

writeCsv('455_score_reentry_rules.csv', reentryRows, [
  'updated_at',
  'rule',
  'decision',
  'reason',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>不足PER・同業中央値 補完キュー</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --red: #b42318;
      --orange: #b65c00;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 24px;
      color: var(--navy);
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .kpi {
      background: white;
      color: var(--ink);
      border: 1px solid #c9def3;
      border-radius: 12px;
      padding: 12px;
    }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0 4px;
    }
    .step {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f8fbff;
      padding: 12px;
      min-height: 120px;
      position: relative;
    }
    .step b { color: var(--navy); display: block; margin-bottom: 6px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
      table-layout: fixed;
      background: white;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th {
      background: #e8f4ff;
      color: #073b63;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      .flow { grid-template-columns: 1fr; }
      table { min-width: 820px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>不足PER・同業中央値 補完キュー</h1>
      <p>即時補完8件のうち、点数へ接続できない理由をPER不足と同業中央値不足に分けました。ここで埋める対象、使える出典、点数へ戻す条件を固定します。</p>
      <div class="actions">
        <a class="button" href="immediate_completion_score_bridge_20260526.html">スコア接続状況へ戻る</a>
        <a class="button" href="452_per_fetch_queue.csv">PER補完CSV</a>
        <a class="button" href="453_peer_median_fetch_queue.csv">同業中央値CSV</a>
        <a class="button" href="455_score_reentry_rules.csv">再接続ルールCSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${perRows.length}</b><span>PER不足</span></div>
        <div class="kpi"><b>${peerRows.length}</b><span>同業中央値不足</span></div>
        <div class="kpi"><b>${gateRows.filter((row) => row.score_connection === '説明補助まで').length}</b><span>説明補助止まり</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      重要: 不足値は0点でも0倍でもなく「未接続」です。予想PER・実績PER・同業中央値の基準がそろうまで、購入候補スコアへは戻しません。
    </div>

    <section class="panel">
      <h2>解消までの流れ</h2>
      <div class="flow">
        ${scheduleRows
          .map(
            (row) => `<div class="step"><b>${esc(row.step)}. ${esc(row.timing)}</b><span>${esc(row.task)}</span></div>`,
          )
          .join('')}
      </div>
    </section>

    <section class="panel">
      <h2>PER補完キュー</h2>
      ${table(
        [
          { key: 'priority', label: '優先' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'required_basis', label: '必要な基準' },
          { key: 'acceptable_source_1', label: '第一候補' },
          { key: 'calculation_rule', label: '計算ルール' },
          { key: 'score_rule', label: '点数への扱い' },
          { key: 'status', label: '状態' },
        ],
        perRows,
      )}
    </section>

    <section class="panel">
      <h2>同業中央値補完キュー</h2>
      ${table(
        [
          { key: 'priority', label: '優先' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'required_basis', label: '必要な基準' },
          { key: 'acceptable_source_1', label: '第一候補' },
          { key: 'calculation_rule', label: '計算ルール' },
          { key: 'score_rule', label: '点数への扱い' },
          { key: 'status', label: '状態' },
        ],
        peerRows,
      )}
    </section>

    <section class="panel">
      <h2>点数へ戻す条件</h2>
      ${table(
        [
          { key: 'rule', label: 'ルール' },
          { key: 'decision', label: '扱い' },
          { key: 'reason', label: '理由' },
        ],
        reentryRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'missing_per_peer_fetch_queue_20260526.html'), html, 'utf8');

console.log('created missing_per_peer_fetch_queue_20260526.html');
console.log(`per=${perRows.length}, peer=${peerRows.length}`);
