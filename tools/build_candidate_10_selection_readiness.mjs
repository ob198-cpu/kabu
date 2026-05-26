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

function toNumber(value) {
  const text = String(value ?? '').replace(/[%点倍,円]/g, '').trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const perRows = readCsv('488_candidate_10_per_estimate_detail.csv');
const reactionRows = readCsv('500_candidate_10_reaction_due_detail.csv');

const perByTicker = new Map(perRows.map((row) => [row.ticker, row]));
const reactionByTicker = new Map(reactionRows.map((row) => [row.ticker, row]));

function perStatus(row) {
  if (present(row.per)) return { label: '採点用PERあり', type: 'score', note: `${row.per}倍` };
  const bridge = perByTicker.get(row.ticker);
  if (bridge && present(bridge.actual_per_estimate)) {
    return { label: '実績PER試算あり', type: 'assist', note: `${bridge.actual_per_estimate}倍、採点未接続` };
  }
  return { label: 'PER未取得', type: 'gap', note: '追加取得が必要' };
}

function reactionStatus(row) {
  const reaction = reactionByTicker.get(row.ticker);
  if (!reaction) return { label: '未接続', type: 'gap', note: '決算後反応データが未接続' };
  if (reaction.due_status === '20営業日確定済み') return { label: '20営業日確定済み', type: 'score', note: `20日超過 ${reaction.excess_20d_pct || ''}` };
  if (reaction.reconstruction_status === '1日/5日接続済み' || reaction.reconstruction_status === '1日/5日復元済み') {
    return { label: '1日/5日暫定', type: 'assist', note: '20営業日未到達' };
  }
  if (reaction.reconstruction_status === '1日接続済み・5日未到達') {
    return { label: '1日暫定', type: 'partial', note: '5日/20営業日未到達' };
  }
  if (reaction.reconstruction_status === '既存反応点のみ') return { label: '既存スコアのみ', type: 'assist', note: '内訳確認待ち' };
  return { label: '未接続', type: 'gap', note: reaction.reason || '追加取得が必要' };
}

function readiness(row, p, r) {
  let score = 0;
  const details = [];
  if (present(row.per) && present(row.pbr) && present(row.roe_pct)) {
    score += 25;
    details.push('PER/PBR/ROEそろい');
  } else if (p.type === 'assist' && present(row.pbr) && present(row.roe_pct)) {
    score += 17;
    details.push('PERは試算、PBR/ROEあり');
  } else details.push('財務指標不足');

  if (present(row.revenue_yoy_pct) && present(row.profit_yoy_pct)) {
    score += 25;
    details.push('売上/利益成長あり');
  } else details.push('成長率不足');

  if (present(row.ret1y_pct) && present(row.max_drawdown60_pct)) {
    score += 20;
    details.push('株価推移/下落率あり');
  } else details.push('株価リスク不足');

  if (r.type === 'score') score += 20;
  else if (r.type === 'assist') score += 10;
  else if (r.type === 'partial') score += 5;
  else details.push('決算後反応不足');

  const confidence = toNumber(row.data_confidence);
  if (confidence !== null && confidence >= 90) score += 10;
  else if (confidence !== null && confidence >= 70) score += 6;

  return { score, details: details.join(' / ') };
}

function nextAction(p, r, row) {
  if (p.type === 'gap') return 'PERの公式取得またはEPS基準の確認を優先する。';
  if (p.type === 'assist') return '実績PERと予想PERの扱いを固定し、採点へ戻すか判断する。';
  if (r.label === '未接続') return '決算日、基準株価、1日/5日/20営業日反応を追加する。';
  if (r.label === '既存スコアのみ') return '既存反応点の内訳を確認し、イベント日と指数比較を復元する。';
  if (r.label === '1日暫定') return '5営業日到達後に対指数反応を再計算する。';
  if (r.label === '1日/5日暫定') return '20営業日到達後に対指数反応を再計算する。';
  if (String(row.data_gap || '').includes('イベント因果')) return 'イベント実績層を追加して、質的仮説を別枠で確認する。';
  return '6月イベント後の市場データで再確認する。';
}

const detailRows = quantRows.map((row) => {
  const p = perStatus(row);
  const r = reactionStatus(row);
  const ready = readiness(row, p, r);
  return {
    updated_at: generatedAt,
    rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    nisa_score_reference: row.nisa_score,
    quantitative_grade: row.quantitative_grade,
    data_confidence: row.data_confidence,
    per_status: p.label,
    per_note: p.note,
    reaction_status: r.label,
    reaction_note: r.note,
    data_readiness_score: ready.score,
    readiness_basis: ready.details,
    score_use: 'データ準備状況。投資判断スコアではない',
    next_action: nextAction(p, r, row),
  };
}).sort((a, b) => Number(b.data_readiness_score) - Number(a.data_readiness_score));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '比較対象',
    value: `${detailRows.length}社`,
    interpretation: '候補10社を、投資判断ではなくデータ準備状況として再整理。',
  },
  {
    updated_at: generatedAt,
    item: '採点用PERあり',
    value: `${detailRows.filter((row) => row.per_status === '採点用PERあり').length}社`,
    interpretation: '既存のPERをそのまま比較材料にできる銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '実績PER試算あり',
    value: `${detailRows.filter((row) => row.per_status === '実績PER試算あり').length}社`,
    interpretation: '説明補助には使えるが、採点へは未接続の銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '20営業日反応確定',
    value: `${detailRows.filter((row) => row.reaction_status === '20営業日確定済み').length}社`,
    interpretation: '20営業日まで到達した銘柄数。結果の良し悪しは別途検算する。',
  },
];

const taskRows = [
  {
    priority: 1,
    task: '20営業日反応の検算と接続可否確認',
    reason: 'ディスコは20営業日反応がそろったが、対日経-19.66%のため、基準日・終値・指数比較を確認してから扱いを決める。',
    output: '20営業日反応の検算記録と採点接続可否',
  },
  {
    priority: 2,
    task: '既存反応点の内訳確認',
    reason: 'TDK、三菱UFJ FGなどは反応点だけでは説明が弱いため、イベント日と指数比較を復元する。',
    output: 'イベント日、1日/5日/20日、指数比較の復元',
  },
  {
    priority: 3,
    task: 'PER種別の固定',
    reason: '実績PERと予想PERを混ぜると比較基準が崩れる。',
    output: '採用PERルールの確定',
  },
  {
    priority: 4,
    task: 'イベント実績層の追加',
    reason: '質的仮説は加点ではなく、過去反応と照合してから評価する必要がある。',
    output: 'イベント日と株価反応の対応表',
  },
];

writeCsv('493_candidate_10_selection_readiness_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('494_candidate_10_selection_readiness_detail.csv', detailRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'nisa_score_reference',
  'quantitative_grade',
  'data_confidence',
  'per_status',
  'per_note',
  'reaction_status',
  'reaction_note',
  'data_readiness_score',
  'readiness_basis',
  'score_use',
  'next_action',
]);

writeCsv('495_candidate_10_selection_next_tasks.csv', taskRows, [
  'priority',
  'task',
  'reason',
  'output',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 選出準備状況 2026年5月26日</title>
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
    table { width: 100%; border-collapse: collapse; min-width: 1160px; }
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
    <h1>候補10社 選出準備状況</h1>
    <p>候補10社を確定する前に、PER、決算成長率、株価リスク、決算後反応がどこまでそろっているかを整理します。ここでの点数はデータ準備状況であり、投資判断スコアではありません。</p>
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
      <p class="notice">結論: 10社の比較表は作れます。20営業日反応はディスコ1社が到達済みですが、対日経-19.66%のため、現時点では購入候補を強める材料ではなく検算対象として扱います。</p>
      <div class="toolbar">
        <a class="button" href="493_candidate_10_selection_readiness_summary.csv">493 要約CSV</a>
        <a class="button" href="494_candidate_10_selection_readiness_detail.csv">494 詳細CSV</a>
        <a class="button" href="495_candidate_10_selection_next_tasks.csv">495 次タスクCSV</a>
        <a class="button" href="candidate_10_reaction_due_reconstruction_20260526.html">決算後反応確認へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>銘柄別の準備状況</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>準備順位</th><th>銘柄</th><th>参考NISA点</th><th>量的評価</th><th>信頼度</th><th>PER状態</th><th>決算後反応</th><th>データ準備点</th><th>準備根拠</th><th>次の作業</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td>${esc(row.nisa_score_reference)}</td>
              <td>${esc(row.quantitative_grade)}</td>
              <td>${esc(row.data_confidence)}</td>
              <td>${esc(row.per_status)}<br><small>${esc(row.per_note)}</small></td>
              <td>${esc(row.reaction_status)}<br><small>${esc(row.reaction_note)}</small></td>
              <td><b>${esc(row.data_readiness_score)}点</b><br><small>${esc(row.score_use)}</small></td>
              <td>${esc(row.readiness_basis)}</td>
              <td>${esc(row.next_action)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>次の優先タスク</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>優先</th><th>タスク</th><th>理由</th><th>成果物</th></tr></thead>
          <tbody>
            ${taskRows.map((row) => `
            <tr><td>${esc(row.priority)}</td><td>${esc(row.task)}</td><td>${esc(row.reason)}</td><td>${esc(row.output)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_selection_readiness_20260526.html'), html, 'utf8');

console.log(`created candidate_10_selection_readiness_20260526.html, rows=${detailRows.length}`);
