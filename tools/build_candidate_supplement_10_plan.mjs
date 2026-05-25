import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.resolve(ROOT, '..', 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const NAME_FIX = {
  '8766.T': ['東京海上HD', '保険', '金利上昇・保険運用'],
  '6367.T': ['ダイキン工業', '空調', 'AIデータセンター冷却・空調'],
  '8750.T': ['第一生命HD', '保険', '金利上昇・保険運用'],
  '8725.T': ['MS&AD', '保険', '金利上昇・保険運用'],
  '8411.T': ['みずほFG', '銀行', '金利上昇・大手銀行'],
  '7735.T': ['SCREEN HD', '半導体装置', '洗浄装置'],
  '6098.T': ['リクルートHD', '人材・IT', '求人・HRテック'],
  '9434.T': ['ソフトバンク', '通信', '通信・配当'],
  '6902.T': ['デンソー', '自動車部品', '車載・電動化'],
  '6702.T': ['富士通', 'IT', 'DX・AI・サービス'],
  '6701.T': ['NEC', 'IT・防衛', 'AI・官公庁・防衛'],
};

const OFFICIAL_SOURCE_TICKERS = new Set(['8766.T', '6367.T']);
const TREND_EVIDENCE_TICKERS = new Set(['8766.T', '6367.T', '8411.T', '8750.T', '8725.T', '9434.T']);

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

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(ROOT, file), 'utf8'));
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
  if (!raw || raw === '-' || raw === '---') return null;
  const n = Number(raw.replaceAll(',', '').replaceAll('%', ''));
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : '';
}

function scale(value, min, max) {
  const n = num(value);
  if (n === null) return null;
  return clamp(((n - min) / (max - min)) * 100);
}

function inverseScale(value, good, bad) {
  const n = num(value);
  if (n === null) return null;
  return clamp(((bad - n) / (bad - good)) * 100);
}

function average(parts) {
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

function healthyTrendScore(ret1y) {
  const r = num(ret1y);
  if (r === null) return null;
  if (r < -20) return 15;
  if (r < 0) return 30 + ((r + 20) / 20) * 20;
  if (r <= 80) return 55 + (r / 80) * 30;
  if (r <= 150) return 80 - ((r - 80) / 70) * 15;
  if (r <= 250) return 55 - ((r - 150) / 100) * 25;
  return 15;
}

function dataConfidence(row) {
  let score = 0;
  if (row.quote_status) score += 10;
  if (row.performance_status) score += 10;
  if (row.chart_status) score += 10;
  if (num(row.per_forecast) !== null) score += 10;
  if (num(row.pbr_actual) !== null) score += 10;
  if (num(row.roe_actual_pct) !== null) score += 10;
  if (num(row.revenue_yoy_pct) !== null) score += 10;
  if (num(row.profit_yoy_pct) !== null) score += 10;
  if (num(row.ret1y_pct) !== null && num(row.max_drawdown60_pct) !== null) score += 10;
  if (OFFICIAL_SOURCE_TICKERS.has(row.ticker)) score += 10;
  return clamp(score);
}

function hardGates(row) {
  const gates = [];
  const required = [
    ['PER', row.per_forecast],
    ['PBR', row.pbr_actual],
    ['ROE', row.roe_actual_pct],
    ['売上前年比', row.revenue_yoy_pct],
    ['利益前年比', row.profit_yoy_pct],
    ['1年騰落率', row.ret1y_pct],
    ['60日最大下落率', row.max_drawdown60_pct],
  ];
  const missing = required.filter(([, value]) => num(value) === null).map(([label]) => label);
  if (missing.length) gates.push(`未取得: ${missing.join('/')}`);
  const per = num(row.per_forecast);
  const pbr = num(row.pbr_actual);
  const roe = num(row.roe_actual_pct);
  const revenue = num(row.revenue_yoy_pct);
  const profit = num(row.profit_yoy_pct);
  const ret1y = num(row.ret1y_pct);
  const dd60 = num(row.max_drawdown60_pct);
  if (per !== null && per >= 45) gates.push(`PER高め ${per}倍`);
  if (pbr !== null && pbr >= 8) gates.push(`PBR高め ${pbr}倍`);
  if (roe !== null && roe < 5) gates.push(`ROE低め ${roe}%`);
  if (revenue !== null && revenue < -10) gates.push(`売上減少 ${revenue}%`);
  if (profit !== null && profit < -10) gates.push(`利益減少 ${profit}%`);
  if (ret1y !== null && ret1y > 150) gates.push(`1年上昇率過熱 ${ret1y}%`);
  if (dd60 !== null && dd60 <= -25) gates.push(`60日下落大 ${dd60}%`);
  return gates;
}

function classifySupplement(row) {
  const gates = hardGates(row);
  if (gates.some((gate) => gate.startsWith('未取得'))) return '要確認';
  if (gates.some((gate) => /過熱|下落大|PER高め|PBR高め|利益減少|ROE低め/.test(gate))) return '要確認';
  if (!TREND_EVIDENCE_TICKERS.has(row.ticker) && !OFFICIAL_SOURCE_TICKERS.has(row.ticker)) return '要確認';
  return '予備検証候補';
}

function fixedIdentity(row) {
  const fixed = NAME_FIX[row.ticker];
  if (!fixed) {
    return [row.company, row.sector, row.theme];
  }
  return fixed;
}

function buildSupplementRows(existingTickers) {
  const universeRows = readCsv('199_universe100_screening.csv');
  const candidates = universeRows
    .filter((row) => !existingTickers.has(row.ticker))
    .map((row) => {
      const [company, sector, theme] = fixedIdentity(row);
      const growthQuality = average([
        [scale(row.revenue_yoy_pct, -5, 20), 0.25],
        [scale(row.profit_yoy_pct, -10, 40), 0.30],
        [scale(row.roe_actual_pct, 5, 25), 0.25],
        [scale(row.profit_cagr_3period_pct, 0, 30), 0.20],
      ]);
      const valuation = average([
        [inverseScale(row.per_forecast, 8, 35), 0.45],
        [inverseScale(row.pbr_actual, 0.8, 5), 0.30],
        [scale(row.dividend_yield_pct, 0, 4), 0.10],
        [scale(row.roe_actual_pct, 5, 25), 0.15],
      ]);
      const downside = average([
        [inverseScale(row.max_drawdown60_pct, -8, -30), 0.55],
        [healthyTrendScore(row.ret1y_pct), 0.25],
        [scale(row.volume_ratio20, 0.4, 1.2), 0.20],
      ]);
      const trend = average([
        [healthyTrendScore(row.ret1y_pct), 0.55],
        [scale(row.ret60_pct, -20, 30), 0.25],
        [scale(row.above_ma200_pct, -15, 35), 0.20],
      ]);
      const confidence = dataConfidence(row);
      const score = average([
        [growthQuality, 0.35],
        [downside, 0.25],
        [valuation, 0.20],
        [trend, 0.10],
        [confidence, 0.10],
      ]);
      const gates = hardGates(row);
      const status = classifySupplement(row);
      return {
        updated_at: generatedAt,
        ticker: row.ticker,
        company,
        sector,
        theme,
        source_rank: row.screening_rank,
        universe_score_100: row.universe_score_100,
        supplement_score: round(score),
        growth_quality_score: round(growthQuality),
        downside_safety_score: round(downside),
        valuation_score: round(valuation),
        medium_trend_score: round(trend),
        data_confidence: confidence,
        per: row.per_forecast,
        pbr: row.pbr_actual,
        roe_pct: row.roe_actual_pct,
        revenue_yoy_pct: row.revenue_yoy_pct,
        profit_yoy_pct: row.profit_yoy_pct,
        ret1y_pct: row.ret1y_pct,
        max_drawdown60_pct: row.max_drawdown60_pct,
        supplement_status: status,
        hard_gate: gates.join(' / ') || 'なし',
        official_source_status: OFFICIAL_SOURCE_TICKERS.has(row.ticker) ? '公式IR/PDF取得済み' : '公式IR未接続',
        evidence_status: TREND_EVIDENCE_TICKERS.has(row.ticker) ? '時流テーマ資料あり' : '時流テーマ資料未接続',
        note: status === '予備検証候補'
          ? '決算後反応を未接続のため購入判断には使わず、6月テスト候補の補充枠として扱う。'
          : '数値不足またはハードゲートにより、補充候補には上げない。',
      };
    })
    .sort((a, b) => Number(b.supplement_score || 0) - Number(a.supplement_score || 0));

  return candidates.map((row, index) => ({ supplement_rank: index + 1, ...row }));
}

function toPlanRow(row, rank, sourceType) {
  return {
    nisa_rank: rank,
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    theme: row.theme,
    category: sourceType === 'current' ? row.category : '予備',
    expanded_rank: rank,
    prior_category: sourceType === 'current' ? row.prior_category : '母集団補充',
    nisa_score: sourceType === 'current' ? row.nisa_score : row.supplement_score,
    raw_nisa_score: sourceType === 'current' ? row.raw_nisa_score : row.supplement_score,
    growth_quality_score: row.growth_quality_score,
    downside_safety_score: row.downside_safety_score,
    valuation_score: row.valuation_score,
    medium_trend_score: sourceType === 'current' ? row.medium_trend_score : row.medium_trend_score,
    earnings_reaction_score: sourceType === 'current' ? row.earnings_reaction_score : '',
    data_confidence: row.data_confidence,
    score_basis: sourceType === 'current' ? row.score_basis : '母集団補充スコア。決算後反応は未接続。',
    hard_gate: sourceType === 'current' ? row.hard_gate : `決算後反応未接続 / ${row.hard_gate}`,
    per: row.per,
    pbr: row.pbr,
    roe_pct: row.roe_pct,
    revenue_yoy_pct: row.revenue_yoy_pct,
    profit_yoy_pct: row.profit_yoy_pct,
    ret1y_pct: row.ret1y_pct,
    max_drawdown60_pct: row.max_drawdown60_pct,
    adjusted_score: sourceType === 'current' ? row.adjusted_score : row.supplement_score,
    base_score: sourceType === 'current' ? row.base_score : row.supplement_score,
    reaction_score: sourceType === 'current' ? row.reaction_score : '',
    hold_reason: sourceType === 'current'
      ? row.hold_reason
      : `予備検証候補。母集団スコア${row.supplement_score}、信頼度${row.data_confidence}、業績/質${row.growth_quality_score}、下落耐性${row.downside_safety_score}、割安${row.valuation_score}。決算後反応が未接続のため購入候補ではない。`,
    next_check: sourceType === 'current'
      ? row.next_check
      : '公式決算数値の再確認、決算後1日/5日/20日反応、6月CPI/FOMC/日銀後の地合いを確認して候補継続可否を判断。',
  };
}

const currentRows = readCsv('245_nisa_1year_hold_score_top20.csv');
const currentKeep = currentRows.filter((row) => row.category === '残す');
const existingTickers = new Set(currentRows.map((row) => row.ticker));
const supplementRows = buildSupplementRows(existingTickers);
const supplementPicks = supplementRows
  .filter((row) => row.supplement_status === '予備検証候補')
  .filter((row) => ['8766.T', '6367.T'].includes(row.ticker))
  .sort((a, b) => {
    const order = { '8766.T': 1, '6367.T': 2 };
    return order[a.ticker] - order[b.ticker];
  });

const planRows = currentKeep.map((row, index) => toPlanRow(row, index + 1, 'current'))
  .concat(supplementPicks.map((row, index) => toPlanRow(row, currentKeep.length + index + 1, 'supplement')));

const screeningHeaders = [
  'supplement_rank',
  'updated_at',
  'ticker',
  'company',
  'sector',
  'theme',
  'source_rank',
  'universe_score_100',
  'supplement_score',
  'growth_quality_score',
  'downside_safety_score',
  'valuation_score',
  'medium_trend_score',
  'data_confidence',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'supplement_status',
  'hard_gate',
  'official_source_status',
  'evidence_status',
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

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '現在の検証候補',
    value: `${currentKeep.length}社`,
    note: '決算後反応まで接続済み、または20営業日未到達を明示した深掘り候補。',
  },
  {
    updated_at: generatedAt,
    item: '補充予備候補',
    value: `${supplementPicks.length}社`,
    note: '100社母集団から、公式IR取得済み・数値条件通過・時流テーマ接続ありの銘柄だけを補充。',
  },
  {
    updated_at: generatedAt,
    item: '10社候補案',
    value: `${planRows.length}社`,
    note: '購入確定ではない。予備候補は決算後反応を接続するまで購入候補には上げない。',
  },
];

writeCsv('276_candidate_supplement_screening.csv', supplementRows, screeningHeaders);
writeCsv('277_nisa_test_10_candidate_plan.csv', planRows, planHeaders);
writeCsv('278_candidate_supplement_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'note']);

const statusClass = (category) => {
  if (category === '残す') return 'ok';
  if (category === '予備') return 'reserve';
  return 'watch';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>NISA 1年保有テスト 10社候補案</title>
  <style>
    body { font-family: "Yu Gothic", Meiryo, sans-serif; color:#111; margin:0; line-height:1.65; background:#f4f8fb; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 48px; }
    h1 { font-size:28px; margin:0 0 10px; color:#073a5a; }
    h2 { border-left:8px solid #0b6f9f; padding-left:10px; margin-top:30px; color:#073a5a; }
    .lead, .card { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0, 40, 80, .06); }
    .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi b { display:block; font-size:28px; color:#073a5a; }
    table { border-collapse:collapse; width:100%; margin-top:12px; background:#fff; table-layout:fixed; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; font-size:13px; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e4f1fa; color:#073a5a; }
    .ok { color:#007a3d; font-weight:700; }
    .reserve { color:#b45f00; font-weight:700; }
    .watch { color:#7a2c00; font-weight:700; }
    .formula { font-family:Consolas, monospace; background:#f7fbff; border:1px solid #cbddeb; padding:12px; border-radius:8px; }
    .small { font-size:12px; color:#222; }
    @media print {
      body { background:#fff; }
      .lead, .card, .kpi { box-shadow:none; }
      table, tr, td, th, .card, .lead { break-inside:avoid; page-break-inside:avoid; }
    }
  </style>
</head>
<body>
<main>
  <h1>NISA 1年保有テスト 10社候補案</h1>
  <div class="lead">
    <b>目的:</b> すでに深掘り対象になった8社に、100社母集団から条件を通過した予備候補を追加し、6月テストで比較できる候補群を10社まで広げる。<br>
    <b>重要:</b> 予備候補は購入候補ではありません。決算後反応、公式決算数値の再確認、6月の市場イベント後の地合い確認を通すまでは、購入判断に使いません。
  </div>
  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>10社候補案</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">順位</th>
        <th style="width:16%">銘柄</th>
        <th style="width:8%">分類</th>
        <th style="width:9%">点数</th>
        <th style="width:9%">信頼度</th>
        <th style="width:9%">PER</th>
        <th style="width:9%">PBR</th>
        <th style="width:9%">ROE</th>
        <th style="width:13%">ゲート</th>
        <th style="width:13%">次の確認</th>
      </tr>
    </thead>
    <tbody>
      ${planRows.map((row) => `<tr>
        <td>${esc(row.nisa_rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b><br><span class="small">${esc(row.sector)} / ${esc(row.theme)}</span></td>
        <td class="${statusClass(row.category)}">${esc(row.category)}</td>
        <td>${esc(row.nisa_score)}点</td>
        <td>${esc(row.data_confidence)}</td>
        <td>${esc(row.per || '未取得')}</td>
        <td>${esc(row.pbr || '未取得')}</td>
        <td>${esc(row.roe_pct || '未取得')}</td>
        <td>${esc(row.hard_gate || 'なし')}</td>
        <td>${esc(row.next_check)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>予備候補の選び方</h2>
  <div class="card">
    <p>補充候補は、100社母集団の中から、既存20社に含まれていない銘柄だけを対象にしました。未取得データを点数に混ぜず、PER/PBR/ROE、売上前年比、利益前年比、1年騰落率、60日最大下落率がそろうものを優先しています。</p>
    <div class="formula">
      補充スコア = 業績/質35% + 下落耐性25% + 割安度20% + 中期トレンド10% + データ信頼度10%
    </div>
    <p>ただし、時流テーマは点数へ単純加点していません。東京海上HDは金利上昇・保険運用の検証対象、ダイキン工業はAIデータセンター冷却の検証対象として、数値スクリーニングを通過したものだけを予備候補にしています。</p>
  </div>

  <h2>補充候補スクリーニング上位</h2>
  <table>
    <thead>
      <tr>
        <th>順位</th><th>銘柄</th><th>補充点</th><th>状態</th><th>PER</th><th>PBR</th><th>ROE</th><th>売上</th><th>利益</th><th>1年</th><th>下落</th><th>理由</th>
      </tr>
    </thead>
    <tbody>
      ${supplementRows.slice(0, 18).map((row) => `<tr>
        <td>${esc(row.supplement_rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td>${esc(row.supplement_score)}</td>
        <td class="${row.supplement_status === '予備検証候補' ? 'reserve' : 'watch'}">${esc(row.supplement_status)}</td>
        <td>${esc(row.per || '未取得')}</td>
        <td>${esc(row.pbr || '未取得')}</td>
        <td>${esc(row.roe_pct || '未取得')}</td>
        <td>${esc(row.revenue_yoy_pct || '未取得')}</td>
        <td>${esc(row.profit_yoy_pct || '未取得')}</td>
        <td>${esc(row.ret1y_pct || '未取得')}</td>
        <td>${esc(row.max_drawdown60_pct || '未取得')}</td>
        <td>${esc(row.hard_gate)} / ${esc(row.official_source_status)} / ${esc(row.evidence_status)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</main>
</body>
</html>`;

writeHtml('candidate_supplement_10_plan.html', html);

console.log(`generated ${planRows.length} candidate plan rows`);
console.log(planRows.map((row) => `${row.nisa_rank}. ${row.ticker} ${row.company} ${row.category} ${row.nisa_score}`).join('\n'));
