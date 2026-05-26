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
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
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

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

const evidenceRows = readCsv('514_candidate_10_evidence_pack_detail.csv');
const gateRows = readCsv('509_candidate_10_test_selection_gate_detail.csv');
const perRows = readCsv('488_candidate_10_per_estimate_detail.csv');
const sectorRows = readCsv('300_candidate_sector_adjustment.csv');
const reactionRows = readCsv('500_candidate_10_reaction_due_detail.csv');

const candidateCount = evidenceRows.length || gateRows.length || 10;
const perSupportCount = count(perRows, (row) => row.actual_per_estimate && row.score_connection !== '接続済み');
const sectorReadyCount = count(sectorRows, (row) => row.adjustment_status === '補正参考可');
const reaction20ReadyCount = count(reactionRows, (row) => row.due_status === '20営業日確定済み');
const reactionWaitingCount = count(reactionRows, (row) => row.due_status !== '20営業日確定済み');
const priorityCount = count(evidenceRows, (row) => row.role === '優先候補');
const holdCount = count(evidenceRows, (row) => ['検算対象', '補完対象', '反応待ち'].includes(row.role));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '候補10社の説明準備',
    status: '当日完了',
    value: `${candidateCount}社`,
    meaning: '量的データ、質的層、決算後反応、注意点を1枚の根拠パックに統合。',
  },
  {
    updated_at: generatedAt,
    item: '優先整理対象',
    status: '当日完了',
    value: `${priorityCount}社`,
    meaning: '現時点で根拠を優先して説明できる対象。実行判断ではない。',
  },
  {
    updated_at: generatedAt,
    item: 'PER補助値',
    status: '当日完了',
    value: `${perSupportCount}社`,
    meaning: '未取得だった一部銘柄に、公式EPSと既存株価から説明補助値を追加。',
  },
  {
    updated_at: generatedAt,
    item: '同業比較',
    status: '部分完了',
    value: `${sectorReadyCount}/${candidateCount}社`,
    meaning: '銀行、半導体装置、電子部品、保険は同業中央値で比較可能。比較数不足の業種は点数に混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '決算後20営業日反応',
    status: '日付待ち',
    value: `${reaction20ReadyCount}/${candidateCount}社`,
    meaning: 'ディスコのみ到達済み。多くは6月上旬から中旬まで20営業日に未到達。',
  },
  {
    updated_at: generatedAt,
    item: '追加確認対象',
    status: '明日継続',
    value: `${holdCount}社`,
    meaning: '反応待ち、検算対象、補完対象は根拠整理と不足確認を継続。',
  },
];

const detailRows = [
  {
    updated_at: generatedAt,
    category: '今日閉じた作業',
    item: '候補10社 根拠パック',
    status: '完了',
    count: `${candidateCount}社`,
    remaining: 'なし',
    blocker: 'なし',
    next_action: '明日の候補説明に使う根拠表として更新継続',
    file: 'candidate_10_evidence_pack_20260526.html',
  },
  {
    updated_at: generatedAt,
    category: '今日閉じた作業',
    item: 'PER補助値',
    status: '完了',
    count: `${perSupportCount}社`,
    remaining: '採点接続は未実施',
    blocker: '通期PERではない値が含まれるため、説明補助に限定',
    next_action: '公式通期予想EPSがそろう銘柄から検算',
    file: 'candidate_10_per_estimate_bridge_20260526.html',
  },
  {
    updated_at: generatedAt,
    category: '今日前進した作業',
    item: '同業比較',
    status: '部分完了',
    count: `${sectorReadyCount}/${candidateCount}社`,
    remaining: `${candidateCount - sectorReadyCount}社`,
    blocker: '同業3社以上、PER/PBR/ROE中央値がそろわない業種がある',
    next_action: '比較可能銘柄は説明に使い、比較数不足銘柄は別ルートで確認',
    file: 'sector_adjustment_20260525.html',
  },
  {
    updated_at: generatedAt,
    category: '日付で止まる作業',
    item: '決算後20営業日反応',
    status: '日付待ち',
    count: `${reaction20ReadyCount}/${candidateCount}社`,
    remaining: `${reactionWaitingCount}社`,
    blocker: '20営業日がまだ来ていない',
    next_action: '到達日ごとに対日経平均超過リターンを追加',
    file: 'candidate_10_reaction_due_reconstruction_20260526.html',
  },
  {
    updated_at: generatedAt,
    category: '明日やる作業',
    item: '10社説明の根拠整理',
    status: '継続',
    count: `${candidateCount}社`,
    remaining: '銘柄別の説明文と確認項目',
    blocker: '未到達反応と業種比較不足は明記して扱う',
    next_action: '優先候補、比較候補、検算対象、補完対象に分けて説明可能な状態へ寄せる',
    file: 'candidate_10_tomorrow_finalization_queue_20260526.html',
  },
];

const dueRows = reactionRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  event_date: row.event_date,
  after_1d: row.excess_1d_pct || '未到達',
  after_5d: row.excess_5d_pct || '未到達',
  estimated_20bd_date: row.estimated_20bd_date,
  after_20d: row.excess_20d_pct || '未到達',
  score_connection: row.score_connection,
  reason: row.reason,
}));

writeCsv('515_candidate_10_completion_closure_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'status',
  'value',
  'meaning',
]);

writeCsv('516_candidate_10_completion_closure_detail.csv', detailRows, [
  'updated_at',
  'category',
  'item',
  'status',
  'count',
  'remaining',
  'blocker',
  'next_action',
  'file',
]);

writeCsv('517_candidate_10_reaction_due_for_closure.csv', dueRows, [
  'updated_at',
  'ticker',
  'company',
  'event_date',
  'after_1d',
  'after_5d',
  'estimated_20bd_date',
  'after_20d',
  'score_connection',
  'reason',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 完了状況 2026年5月26日</title>
  <style>
    :root {
      --ink: #07192f;
      --muted: #39536c;
      --line: #c6d8e9;
      --bg: #f4f8fc;
      --navy: #0b3457;
      --blue: #0b6fa4;
      --soft: #eef7ff;
      --green: #087f5b;
      --amber: #b45309;
      --red: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.72;
      letter-spacing: 0;
    }
    header { background: var(--navy); color: #fff; padding: 34px clamp(18px, 4vw, 58px); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1120px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 136px; }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 28px; line-height: 1.2; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 9px; border-radius: 999px; border: 1px solid #b6cee5; font-weight: 900; font-size: 12px; color: var(--navy); background: #fff; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .step { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; position: relative; min-height: 142px; }
    .step:not(:last-child)::after { content: "→"; position: absolute; right: -15px; top: 46%; color: var(--blue); font-size: 22px; font-weight: 900; }
    .step b { color: var(--blue); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border-radius: 8px; border: 1px solid #9cc8ec; background: #fff; color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1180px; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1240px); }
      .grid, .flow { grid-template-columns: 1fr; }
      .step:not(:last-child)::after { content: "↓"; right: 50%; top: auto; bottom: -24px; transform: translateX(50%); }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 完了状況</h1>
    <p>今日できる処理と、日付・データ到達待ちで残る処理を分けた確認表です。明日の10社根拠整理へつなげます。</p>
  </header>
  <main>
    <section>
      <h2>結論</h2>
      <div class="grid">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <p><span class="badge">${esc(row.status)}</span></p>
          <small>${esc(row.meaning)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">今日の到達点は「10社の根拠説明パックを作り、足りない値を点数へ混ぜない状態にした」ことです。6月の再判定までは、実行判断ではありません。</p>
      <div class="toolbar">
        <a class="button" href="515_candidate_10_completion_closure_summary.csv">515 要約CSV</a>
        <a class="button" href="516_candidate_10_completion_closure_detail.csv">516 詳細CSV</a>
        <a class="button" href="517_candidate_10_reaction_due_for_closure.csv">517 反応到達CSV</a>
        <a class="button" href="candidate_10_evidence_pack_20260526.html">根拠パックへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>処理の流れ</h2>
      <div class="flow">
        <div class="step"><b>1. 10社を固定</b><br>母集団から選んだ候補10社を、優先・比較・検算・補完に分ける。</div>
        <div class="step"><b>2. 数値を接続</b><br>PER/PBR/ROE、成長率、株価反応、同業比較を確認する。</div>
        <div class="step"><b>3. 未接続を止める</b><br>不足値や20営業日未到達は点数へ混ぜず、理由を表示する。</div>
        <div class="step"><b>4. 明日説明へ</b><br>使える根拠と残件を分けて、10社の説明資料へ仕上げる。</div>
      </div>
    </section>

    <section>
      <h2>完了・残件一覧</h2>
      ${table(
        [
          { key: 'category', label: '区分' },
          { key: 'item', label: '項目' },
          { key: 'status', label: '状態' },
          { key: 'count', label: '件数' },
          { key: 'remaining', label: '残り' },
          { key: 'blocker', label: '止まる理由' },
          { key: 'next_action', label: '次の処理' },
          { key: 'file', label: '確認ファイル' },
        ],
        detailRows,
      )}
    </section>

    <section>
      <h2>決算後反応の到達予定</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'event_date', label: '決算日' },
          { key: 'after_1d', label: '1日反応' },
          { key: 'after_5d', label: '5日反応' },
          { key: 'estimated_20bd_date', label: '20営業日到達予定' },
          { key: 'after_20d', label: '20営業日反応' },
          { key: 'score_connection', label: '採点接続' },
          { key: 'reason', label: '理由' },
        ],
        dueRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_completion_closure_20260526.html'), html, 'utf8');

console.log(`created candidate_10_completion_closure_20260526.html rows=${detailRows.length}`);
