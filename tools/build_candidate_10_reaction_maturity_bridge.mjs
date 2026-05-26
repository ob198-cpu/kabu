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

function present(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未接続';
}

function pct(value) {
  return present(value) ? `${value}%` : '';
}

const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const reactionRows = readCsv('273_top20_earnings_reaction_completed.csv');
const reactionByTicker = new Map(reactionRows.map((row) => [row.ticker, row]));

function classifyReaction(row) {
  if (!row || !row.ticker) {
    return {
      maturity: '未接続',
      connection: '未接続',
      reason: '対象銘柄の決算後反応データが見つからない。',
      className: 'gap',
    };
  }
  if (present(row.excess_20d_pct)) {
    return {
      maturity: '20営業日確定',
      connection: '接続候補',
      reason: '1日、5日、20営業日の対指数反応がそろっている。',
      className: 'ok',
    };
  }
  if (present(row.excess_1d_pct) && present(row.excess_5d_pct)) {
    return {
      maturity: '1日/5日暫定',
      connection: '未接続',
      reason: '短期反応はあるが、20営業日反応が未到達のため最終スコアへ接続しない。',
      className: 'pending',
    };
  }
  if (present(row.earnings_reaction_score)) {
    return {
      maturity: '既存スコアのみ',
      connection: '未接続',
      reason: '反応スコアはあるが、イベント日、1日、5日、20日の内訳確認が不足している。',
      className: 'pending',
    };
  }
  return {
    maturity: '未接続',
    connection: '未接続',
    reason: '通常決算反応として使えるデータがまだない。',
    className: 'gap',
  };
}

const detailRows = quantRows.map((candidate) => {
  const reaction = reactionByTicker.get(candidate.ticker) || {};
  const state = classifyReaction(reaction);
  return {
    updated_at: generatedAt,
    rank: candidate.selection_rank,
    ticker: candidate.ticker,
    company: candidate.company,
    sector: candidate.sector,
    event_date: reaction.event_date || '',
    event_type: reaction.event_type || '',
    event_usable: reaction.event_usable || '',
    excess_1d_pct: pct(reaction.excess_1d_pct),
    excess_5d_pct: pct(reaction.excess_5d_pct),
    excess_20d_pct: pct(reaction.excess_20d_pct),
    existing_reaction_score: reaction.earnings_reaction_score || '',
    maturity: state.maturity,
    score_connection: state.connection,
    reason: state.reason,
    source_url: reaction.event_url || '',
  };
});

const countBy = (label) => detailRows.filter((row) => row.maturity === label).length;
const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${detailRows.length}社`,
    interpretation: '候補10社すべてを対象に、決算後反応の成熟度を確認。',
  },
  {
    updated_at: generatedAt,
    item: '20営業日確定',
    value: `${countBy('20営業日確定')}社`,
    interpretation: '1年保有スコアへ戻す候補になりうる反応データ。',
  },
  {
    updated_at: generatedAt,
    item: '1日/5日暫定',
    value: `${countBy('1日/5日暫定')}社`,
    interpretation: '初動確認には使えるが、20営業日が未到達のため最終スコアへは入れない。',
  },
  {
    updated_at: generatedAt,
    item: '既存スコアのみ・未接続',
    value: `${countBy('既存スコアのみ') + countBy('未接続')}社`,
    interpretation: '内訳確認またはデータ取得が必要な対象。',
  },
];

const ruleRows = [
  {
    rule: '20営業日反応を優先',
    detail: '決算直後1日だけでは過剰反応になりやすいため、1年保有テストでは20営業日後の対指数反応を重視する。',
    action: '20営業日未満は最終スコアへ入れない。',
  },
  {
    rule: '既存スコアは内訳確認待ち',
    detail: '過去工程で反応スコアだけ存在する銘柄は、イベント日、基準株価、指数比較の内訳がそろうまで説明補助にとどめる。',
    action: '由来確認後に再接続を判断する。',
  },
  {
    rule: '短期反応は観察材料',
    detail: '1日/5日反応は市場の初動を見る材料になるが、6月イベント後の相場環境と合わせて確認する。',
    action: '候補10社の優先順位説明に限定する。',
  },
];

writeCsv('490_candidate_10_reaction_maturity_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('491_candidate_10_reaction_maturity_detail.csv', detailRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'event_date',
  'event_type',
  'event_usable',
  'excess_1d_pct',
  'excess_5d_pct',
  'excess_20d_pct',
  'existing_reaction_score',
  'maturity',
  'score_connection',
  'reason',
  'source_url',
]);

writeCsv('492_candidate_10_reaction_connection_rules.csv', ruleRows, [
  'rule',
  'detail',
  'action',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 決算後反応の成熟度確認 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #40536a;
      --line: #c8d9ea;
      --soft: #edf6ff;
      --blue: #0b66a0;
      --green: #087f5b;
      --amber: #b45309;
      --red: #b42318;
      --bg: #f6f9fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    header {
      background: linear-gradient(135deg, #062a4a, #0b668d);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #eaf5ff; font-weight: 800; max-width: 1060px; }
    main { width: min(1220px, calc(100% - 32px)); margin: 24px auto 56px; }
    section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 18px 0;
      break-inside: avoid;
    }
    h2 {
      margin: 0 0 14px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 24px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: var(--soft);
      min-height: 120px;
    }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; font-size: 30px; color: var(--blue); }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 900;
      margin-top: 14px;
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #9cc8ec;
      background: #fff;
      color: #062a4a;
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 1120px; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px;
      text-align: left;
      vertical-align: top;
      color: var(--ink);
      word-break: break-word;
    }
    th { background: #e6f1fb; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    .ok { color: var(--green); font-weight: 900; }
    .pending { color: var(--amber); font-weight: 900; }
    .gap { color: var(--red); font-weight: 900; }
    @media (max-width: 860px) {
      .summary { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 1220px); }
      section { padding: 16px; }
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 決算後反応の成熟度確認</h1>
    <p>決算後の株価反応を、1日・5日・20営業日に分けて確認します。20営業日が未到達のものや内訳が不足するものは、最終スコアへ接続しません。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.interpretation)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">重要: 現時点では20営業日確定データが0社のため、決算後反応をNISA 1年保有スコアへ強く反映する段階ではありません。</p>
      <div class="toolbar">
        <a class="button" href="490_candidate_10_reaction_maturity_summary.csv">490 要約CSV</a>
        <a class="button" href="491_candidate_10_reaction_maturity_detail.csv">491 詳細CSV</a>
        <a class="button" href="492_candidate_10_reaction_connection_rules.csv">492 接続ルールCSV</a>
        <a class="button" href="candidate_10_per_estimate_bridge_20260526.html">PER試算確認へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>銘柄別の成熟度</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順位</th><th>銘柄</th><th>イベント日</th><th>イベント</th><th>1日超過</th><th>5日超過</th><th>20日超過</th><th>既存反応点</th><th>成熟度</th><th>採点接続</th><th>理由</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => {
              const state = classifyReaction(reactionByTicker.get(row.ticker) || {});
              return `
            <tr>
              <td>${esc(row.rank)}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td>${esc(row.event_date || '未接続')}</td>
              <td>${esc(row.event_type || '未接続')}</td>
              <td>${esc(row.excess_1d_pct || '未接続')}</td>
              <td>${esc(row.excess_5d_pct || '未接続')}</td>
              <td>${esc(row.excess_20d_pct || '未接続')}</td>
              <td>${esc(row.existing_reaction_score || '未接続')}</td>
              <td class="${state.className}">${esc(row.maturity)}</td>
              <td class="pending">${esc(row.score_connection)}</td>
              <td>${esc(row.reason)}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>接続ルール</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ルール</th><th>内容</th><th>対応</th></tr></thead>
          <tbody>
            ${ruleRows.map((row) => `
            <tr><td>${esc(row.rule)}</td><td>${esc(row.detail)}</td><td>${esc(row.action)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_reaction_maturity_bridge_20260526.html'), html, 'utf8');

console.log(`created candidate_10_reaction_maturity_bridge_20260526.html, rows=${detailRows.length}`);
