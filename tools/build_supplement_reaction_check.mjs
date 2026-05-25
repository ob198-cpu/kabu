import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.resolve(ROOT, '..', 'reports');
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 supplement-reaction-check';

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const EVENTS = {
  '8766.T': {
    company: '東京海上HD',
    event_date: '2026-05-20',
    period: '2026年3月期',
    source: '公式決算短信',
    source_url:
      'https://www.tokiomarinehd.com/ir/event/presentation/2025/gi58a8000000246z-att/4Q_FY2025_Summary_Report_j.pdf',
    sales_yoy_pct: '5.1',
    profit_metric: '経常利益',
    profit_yoy_pct: '-7.6',
    eps_yoy_pct: '-4.9',
    note: '金利上昇・保険運用テーマの予備候補。経常利益は前年比マイナスのため、株価反応と還元方針の確認が必要。',
  },
  '6367.T': {
    company: 'ダイキン工業',
    event_date: '2026-05-12',
    period: '2026年3月期',
    source: '公式決算短信',
    source_url:
      'https://www.daikin.co.jp/-/media/Project/Daikin/daikin_co_jp/investor/data/kessan/2026/4Q_brief_report_jp-pdf.pdf',
    sales_yoy_pct: '5.5',
    profit_metric: '営業利益',
    profit_yoy_pct: '3.3',
    eps_yoy_pct: '3.9',
    note: 'AIデータセンター冷却テーマの予備候補。ただし全社業績の伸びは強くないため、テーマが業績に入っているか確認が必要。',
  },
};

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
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
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
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  for (const dir of [ROOT, REPORT_DIR]) {
    try {
      fs.writeFileSync(path.join(dir, name), `\uFEFF${body}\n`, 'utf8');
    } catch (error) {
      console.warn(`skip write ${path.join(dir, name)}: ${error.message}`);
    }
  }
}

function writeHtml(name, html) {
  for (const dir of [ROOT, REPORT_DIR]) {
    try {
      fs.writeFileSync(path.join(dir, name), html, 'utf8');
    } catch (error) {
      console.warn(`skip write ${path.join(dir, name)}: ${error.message}`);
    }
  }
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-' || raw === '---' || raw === '未取得') return null;
  const n = Number(raw.replaceAll(',', '').replaceAll('%', ''));
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number(n.toFixed(digits));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(current, base) {
  const c = num(current);
  const b = num(base);
  if (c === null || b === null || b === 0) return null;
  return ((c / b) - 1) * 100;
}

function averageWeighted(parts) {
  let total = 0;
  let weight = 0;
  for (const [value, w] of parts) {
    if (value !== null && value !== undefined && value !== '') {
      total += Number(value) * w;
      weight += w;
    }
  }
  return weight ? total / weight : null;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&includePrePost=false`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  return timestamps
    .map((ts, index) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: quote.close?.[index],
      volume: quote.volume?.[index],
    }))
    .filter((row) => Number.isFinite(row.close));
}

function locateRows(rows, eventDate) {
  const sorted = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
  let baseIndex = sorted.findIndex((row) => row.date >= eventDate);
  if (baseIndex === -1) baseIndex = sorted.length - 1;
  if (sorted[baseIndex]?.date !== eventDate && sorted[baseIndex]?.date > eventDate) {
    baseIndex -= 1;
  }
  if (baseIndex < 0) return { base: null, after: {} };
  return {
    base: sorted[baseIndex],
    after: {
      1: sorted[baseIndex + 1],
      5: sorted[baseIndex + 5],
      20: sorted[baseIndex + 20],
    },
  };
}

function reactionFor(priceRows, benchmarkRows, eventDate) {
  const p = locateRows(priceRows, eventDate);
  const b = locateRows(benchmarkRows, eventDate);
  const out = { base_date: p.base?.date ?? '', base_close: round(p.base?.close, 2) };
  for (const n of [1, 5, 20]) {
    const pr = p.after[n];
    const br = b.after[n];
    const ret = pr && p.base ? pct(pr.close, p.base.close) : null;
    const bench = br && b.base ? pct(br.close, b.base.close) : null;
    out[`after_${n}d_date`] = pr?.date ?? '';
    out[`return_${n}d_pct`] = round(ret, 2);
    out[`nikkei_${n}d_pct`] = round(bench, 2);
    out[`excess_${n}d_pct`] = ret === null || bench === null ? '' : round(ret - bench, 2);
  }
  return out;
}

function reactionScore(row) {
  const e1 = num(row.excess_1d_pct);
  const e5 = num(row.excess_5d_pct);
  const e20 = num(row.excess_20d_pct);
  if (e1 === null && e5 === null && e20 === null) {
    return { score: '', status: '未計算' };
  }
  const parts = e20 === null
    ? [[e1, 0.40], [e5, 0.60]]
    : [[e1, 0.34], [e5, 0.51], [e20, 0.15]];
  const weighted = averageWeighted(parts);
  return {
    score: round(clamp(50 + 2 * weighted), 1),
    status: e20 === null ? '暫定: 20営業日未到達' : '確定: 20営業日到達',
  };
}

function classifyAfterReaction(planRow, reaction) {
  const score = num(reaction.earnings_reaction_score);
  if (score === null) return '予備';
  if (score < 35) return '要確認';
  return '予備';
}

function rowClass(category) {
  if (category === '残す') return 'ok';
  if (category === '予備') return 'reserve';
  return 'watch';
}

const planRows = readCsv('277_nisa_test_10_candidate_plan.csv');
const benchmarkRows = await fetchChart('^N225');
const reactionRows = [];
const chartErrors = [];

for (const [ticker, event] of Object.entries(EVENTS)) {
  try {
    const priceRows = await fetchChart(ticker);
    const reaction = reactionFor(priceRows, benchmarkRows, event.event_date);
    const score = reactionScore(reaction);
    reactionRows.push({
      updated_at: generatedAt,
      ticker,
      company: event.company,
      period: event.period,
      event_date: event.event_date,
      source: event.source,
      sales_yoy_pct: event.sales_yoy_pct,
      profit_metric: event.profit_metric,
      profit_yoy_pct: event.profit_yoy_pct,
      eps_yoy_pct: event.eps_yoy_pct,
      base_date: reaction.base_date,
      base_close: reaction.base_close,
      after_1d_date: reaction.after_1d_date,
      return_1d_pct: reaction.return_1d_pct,
      nikkei_1d_pct: reaction.nikkei_1d_pct,
      excess_1d_pct: reaction.excess_1d_pct,
      after_5d_date: reaction.after_5d_date,
      return_5d_pct: reaction.return_5d_pct,
      nikkei_5d_pct: reaction.nikkei_5d_pct,
      excess_5d_pct: reaction.excess_5d_pct,
      after_20d_date: reaction.after_20d_date,
      return_20d_pct: reaction.return_20d_pct,
      nikkei_20d_pct: reaction.nikkei_20d_pct,
      excess_20d_pct: reaction.excess_20d_pct,
      earnings_reaction_score: score.score,
      reaction_status: score.status,
      source_url: event.source_url,
      note: event.note,
    });
  } catch (error) {
    chartErrors.push({ updated_at: generatedAt, ticker, status: '取得失敗', message: error.message });
  }
}

const reactionByTicker = new Map(reactionRows.map((row) => [row.ticker, row]));
const updatedPlanRows = planRows.map((row) => {
  const reaction = reactionByTicker.get(row.ticker);
  if (!reaction) return row;
  const category = classifyAfterReaction(row, reaction);
  return {
    ...row,
    category,
    earnings_reaction_score: reaction.earnings_reaction_score,
    data_confidence: category === '要確認' ? Math.min(95, num(row.data_confidence) ?? 80) : row.data_confidence,
    score_basis: `${row.score_basis} / 決算後反応を追加接続`,
    hard_gate: `${row.hard_gate} / ${reaction.reaction_status}${category === '要確認' ? ` / 決算後反応${reaction.earnings_reaction_score}点` : ''}`,
    reaction_score: reaction.earnings_reaction_score,
    hold_reason:
      category === '要確認'
        ? `決算後反応が弱いため、10社候補案からは要確認へ移す。反応点${reaction.earnings_reaction_score}、1日超過${reaction.excess_1d_pct}%、5日超過${reaction.excess_5d_pct || '未到達'}%。`
        : `予備検証候補。反応点${reaction.earnings_reaction_score}、1日超過${reaction.excess_1d_pct}%、5日超過${reaction.excess_5d_pct || '未到達'}%。20営業日未到達のため購入候補ではない。`,
    next_check:
      category === '要確認'
        ? '次回は公式決算説明資料の要因、還元方針、20営業日反応を確認。初回購入候補には上げない。'
        : '20営業日反応、6月CPI/FOMC/日銀後の地合い、公式決算説明資料のセグメント要因を確認して昇格可否を判断。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '反応接続対象',
    value: `${Object.keys(EVENTS).length}社`,
    note: '東京海上HD、ダイキン工業の予備候補2社。',
  },
  {
    updated_at: generatedAt,
    item: '予備維持',
    value: `${updatedPlanRows.filter((row) => row.category === '予備').length}社`,
    note: '20営業日未到達のため、購入候補ではなく追加検証対象。',
  },
  {
    updated_at: generatedAt,
    item: '要確認',
    value: `${updatedPlanRows.filter((row) => row.category === '要確認').length}社`,
    note: '決算後反応が弱い、または条件未達で購入候補へ進めない。',
  },
];

const reactionHeaders = [
  'updated_at',
  'ticker',
  'company',
  'period',
  'event_date',
  'source',
  'sales_yoy_pct',
  'profit_metric',
  'profit_yoy_pct',
  'eps_yoy_pct',
  'base_date',
  'base_close',
  'after_1d_date',
  'return_1d_pct',
  'nikkei_1d_pct',
  'excess_1d_pct',
  'after_5d_date',
  'return_5d_pct',
  'nikkei_5d_pct',
  'excess_5d_pct',
  'after_20d_date',
  'return_20d_pct',
  'nikkei_20d_pct',
  'excess_20d_pct',
  'earnings_reaction_score',
  'reaction_status',
  'source_url',
  'note',
];

const planHeaders = [
  'nisa_rank',
  'updated_at',
  'ticker',
  'company',
  'sector',
  'theme',
  'category',
  'expanded_rank',
  'prior_category',
  'nisa_score',
  'raw_nisa_score',
  'growth_quality_score',
  'downside_safety_score',
  'valuation_score',
  'medium_trend_score',
  'earnings_reaction_score',
  'data_confidence',
  'score_basis',
  'hard_gate',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'adjusted_score',
  'base_score',
  'reaction_score',
  'hold_reason',
  'next_check',
];

writeCsv('279_supplement_earnings_reaction_check.csv', reactionRows, reactionHeaders);
writeCsv('280_nisa_test_10_candidate_plan_reaction_updated.csv', updatedPlanRows, planHeaders);
writeCsv('281_supplement_reaction_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'note']);
if (chartErrors.length) writeCsv('282_supplement_reaction_fetch_errors.csv', chartErrors, ['updated_at', 'ticker', 'status', 'message']);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>予備候補 決算後反応チェック</title>
  <style>
    body { font-family: "Yu Gothic", Meiryo, sans-serif; color:#111; margin:0; line-height:1.65; background:#f4f8fb; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 48px; }
    h1 { color:#073a5a; font-size:28px; margin:0 0 10px; }
    h2 { border-left:8px solid #0b6f9f; padding-left:10px; color:#073a5a; margin-top:30px; }
    .lead, .card { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi b { display:block; font-size:28px; color:#073a5a; }
    table { border-collapse:collapse; width:100%; background:#fff; margin-top:12px; table-layout:fixed; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; font-size:13px; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e4f1fa; color:#073a5a; }
    .ok { color:#007a3d; font-weight:700; }
    .reserve { color:#b45f00; font-weight:700; }
    .watch { color:#7a2c00; font-weight:700; }
    .formula { font-family:Consolas, monospace; background:#f7fbff; border:1px solid #cbddeb; border-radius:8px; padding:12px; }
    @media print { table, tr, td, th, .lead, .card { break-inside:avoid; page-break-inside:avoid; } }
  </style>
</head>
<body>
<main>
  <h1>予備候補 決算後反応チェック</h1>
  <div class="lead">
    <b>目的:</b> 10社候補案に追加した予備2社について、決算後の株価反応が日経平均を上回ったかを確認する。<br>
    <b>注意:</b> 20営業日がまだ到達していないため、ここでの反応点は暫定です。購入判断ではなく、6月テスト候補に残せるかの確認材料です。
  </div>
  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>決算後反応</h2>
  <table>
    <thead>
      <tr>
        <th>銘柄</th><th>発表日</th><th>業績</th><th>1日超過</th><th>5日超過</th><th>20日超過</th><th>反応点</th><th>状態</th><th>メモ</th>
      </tr>
    </thead>
    <tbody>
      ${reactionRows.map((row) => `<tr>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td>${esc(row.event_date)}<br>${esc(row.source)}</td>
        <td>売上 ${esc(row.sales_yoy_pct)}%<br>${esc(row.profit_metric)} ${esc(row.profit_yoy_pct)}%<br>EPS ${esc(row.eps_yoy_pct)}%</td>
        <td>${esc(row.excess_1d_pct || '未到達')}%</td>
        <td>${esc(row.excess_5d_pct || '未到達')}%</td>
        <td>${esc(row.excess_20d_pct || '未到達')}%</td>
        <td>${esc(row.earnings_reaction_score || '未計算')}</td>
        <td>${esc(row.reaction_status)}</td>
        <td>${esc(row.note)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>10社候補案への反映</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">順位</th><th style="width:17%">銘柄</th><th style="width:8%">分類</th><th style="width:8%">NISA点</th><th style="width:8%">反応点</th><th style="width:13%">ゲート</th><th>次の確認</th>
      </tr>
    </thead>
    <tbody>
      ${updatedPlanRows.map((row) => `<tr>
        <td>${esc(row.nisa_rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td class="${rowClass(row.category)}">${esc(row.category)}</td>
        <td>${esc(row.nisa_score)}</td>
        <td>${esc(row.earnings_reaction_score || '未接続')}</td>
        <td>${esc(row.hard_gate)}</td>
        <td>${esc(row.next_check)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>計算式</h2>
  <div class="card">
    <div class="formula">
      決算後超過リターン = 銘柄リターン - 日経平均リターン<br>
      20営業日未到達時: 反応点 = clamp(0,100, 50 + 2 × (1日超過40% + 5日超過60%))<br>
      20営業日到達後: 反応点 = clamp(0,100, 50 + 2 × (1日超過34% + 5日超過51% + 20日超過15%))
    </div>
  </div>
</main>
</body>
</html>`;

writeHtml('supplement_reaction_check.html', html);

console.log(`reaction rows: ${reactionRows.length}`);
for (const row of reactionRows) {
  console.log(`${row.ticker} ${row.company} score=${row.earnings_reaction_score} status=${row.reaction_status} e1=${row.excess_1d_pct} e5=${row.excess_5d_pct} e20=${row.excess_20d_pct}`);
}
