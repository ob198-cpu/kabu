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

function num(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replaceAll(',', '').replace('%', '').trim();
  if (!text || text === '-' || text === '未取得') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, unit = '') {
  const n = num(value);
  if (n === null) return '未取得';
  return `${Math.round(n * 100) / 100}${unit}`;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = num(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstText(...values) {
  for (const value of values) {
    if (String(value ?? '').trim()) return String(value).trim();
  }
  return '';
}

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusClass(text) {
  if (/除外|不可|不足|弱い|未取得|待ち/.test(text)) return 'bad';
  if (/保留|注意|補完|確認|一部/.test(text)) return 'warn';
  if (/通過|完了|有力|残す/.test(text)) return 'good';
  return '';
}

function valuationGate(per, pbr) {
  if (per === null && pbr === null) return '未取得';
  if (per === null && pbr !== null && pbr >= 10) return 'PER未取得・PBR高';
  if ((per !== null && per >= 45) || (pbr !== null && pbr >= 10)) return '割高強め';
  if ((per !== null && per >= 35) || (pbr !== null && pbr >= 6)) return '割高注意';
  return '確認可';
}

function earningsGate(revenueYoy, profitYoy) {
  if (revenueYoy === null && profitYoy === null) return '未取得';
  if (revenueYoy !== null && revenueYoy < 0 && profitYoy !== null && profitYoy < 0) return '直近減収減益';
  if (profitYoy !== null && profitYoy < 0) return '利益減';
  if (revenueYoy !== null && revenueYoy < 0) return '売上減';
  return '成長確認';
}

function dataConnection(per, pbr, roe, revenueYoy, profitYoy) {
  const items = [per, pbr, roe, revenueYoy, profitYoy];
  const count = items.filter((value) => value !== null).length;
  if (count === items.length) return '完全接続';
  if (count >= 3) return '一部接続';
  return '未接続';
}

function connectionScore(per, pbr, roe, revenueYoy, profitYoy, reactionScore) {
  const weights = [
    [per, 15],
    [pbr, 15],
    [roe, 15],
    [revenueYoy, 20],
    [profitYoy, 20],
    [reactionScore, 15],
  ];
  return weights.reduce((sum, [value, weight]) => sum + (value !== null ? weight : 0), 0);
}

function completionDecision(row) {
  if (row.previous_integrated_status === '除外継続') return '除外継続';
  if (row.ticker === '6762.T') return '追加確認対象';
  if (/未取得|高|割高/.test(row.valuation_gate) || /減|未取得/.test(row.earnings_gate)) {
    return '補完完了・保留';
  }
  if (num(row.downside_resilience_score) !== null && num(row.downside_resilience_score) < 55) {
    return '補完完了・保留';
  }
  return '追加確認対象';
}

const structural = readCsv('355_structural_advantage_candidates.csv');
const downsideMap = byTicker(readCsv('360_downside_resilience_by_stock.csv'));
const quantMap = byTicker(readCsv('366_semiconductor_quant_gate_matrix.csv'));
const universeMap = byTicker(readCsv('199_universe100_screening.csv'));
const nisaMap = byTicker(readCsv('245_nisa_1year_hold_score_top20.csv'));
const plus1Rows = readCsv('309_benchmark_plus1_reference.csv');

const semiconTickers = ['8035.T', '7735.T', '6146.T', '6920.T', '6857.T', '6762.T'];

const matrixRows = semiconTickers.map((ticker) => {
  const s = structural.find((row) => row.ticker === ticker) ?? {};
  const d = downsideMap.get(ticker) ?? {};
  const q = quantMap.get(ticker) ?? {};
  const u = universeMap.get(ticker) ?? {};
  const n = nisaMap.get(ticker) ?? {};

  const per = firstNumber(n.per, q.per, u.per, u.per_forecast);
  const pbr = firstNumber(n.pbr, q.pbr, u.pbr, u.pbr_actual);
  const roe = firstNumber(n.roe_pct, q.roe_pct, u.roe_pct, u.roe_actual_pct);
  const revenueYoy = firstNumber(n.revenue_yoy_pct, q.revenue_yoy_pct, u.revenue_yoy_pct);
  const profitYoy = firstNumber(n.profit_yoy_pct, q.profit_yoy_pct, u.profit_yoy_pct);
  const reactionScore = firstNumber(n.earnings_reaction_score, q.earnings_reaction_score);
  const maxDd = firstNumber(d.max_drawdown_1y_pct, q.max_drawdown_1y_pct, n.max_drawdown60_pct, u.max_drawdown60_pct);
  const ret1y = firstNumber(d.ret1y_pct, q.ret1y_pct, n.ret1y_pct, u.ret1y_pct);
  const downsideScore = firstNumber(d.downside_resilience_score, q.downside_resilience_score);
  const mainPlus1 = firstNumber(q.main_plus1_excess_pt);
  const themePlus1 = firstNumber(q.theme_smh_plus1_excess_pt);

  const sourceUsed = n.ticker ? '245_nisa_1year_hold_score_top20.csv' : u.ticker ? '199_universe100_screening.csv' : q.ticker ? '366_semiconductor_quant_gate_matrix.csv' : '未接続';
  const connection = dataConnection(per, pbr, roe, revenueYoy, profitYoy);
  const valuation = valuationGate(per, pbr);
  const earnings = earningsGate(revenueYoy, profitYoy);
  const connScore = connectionScore(per, pbr, roe, revenueYoy, profitYoy, reactionScore);

  const row = {
    updated_at: generatedAt,
    ticker,
    company: firstText(s.company, q.company, d.company, n.company, u.company),
    structural_rating: firstText(s.structural_rating, q.structural_rating),
    structural_score: firstText(s.structural_score, q.structural_score),
    source_used: sourceUsed,
    data_connection: connection,
    data_connection_score: connScore,
    per: per ?? '',
    pbr: pbr ?? '',
    roe_pct: roe ?? '',
    revenue_yoy_pct: revenueYoy ?? '',
    profit_yoy_pct: profitYoy ?? '',
    revenue_cagr_pct: firstNumber(u.revenue_cagr_3period_pct, u.revenue_cagr_pct, n.revenue_cagr_pct) ?? '',
    profit_cagr_pct: firstNumber(u.profit_cagr_3period_pct, u.profit_cagr_pct, n.profit_cagr_pct) ?? '',
    dividend_yield_pct: firstNumber(u.dividend_yield_pct, n.dividend_yield_pct) ?? '',
    ret1y_pct: ret1y ?? '',
    max_drawdown_pct: maxDd ?? '',
    downside_resilience_score: downsideScore ?? '',
    earnings_reaction_score: reactionScore ?? '',
    main_plus1_excess_pt: mainPlus1 ?? '',
    theme_smh_plus1_excess_pt: themePlus1 ?? '',
    valuation_gate: valuation,
    earnings_gate: earnings,
    downside_gate: firstText(q.downside_gate, d.downside_resilience_status),
    previous_integrated_status: firstText(q.integrated_status),
    completion_status: '',
    decision_reason: '',
  };
  row.completion_status = completionDecision(row);
  row.decision_reason = [
    `${connection}（接続点${connScore}点）`,
    `割高度: ${valuation}`,
    `決算伸び: ${earnings}`,
    `下落耐性: ${fmt(downsideScore, '点')}`,
    mainPlus1 !== null ? `日経/S&P500+1比較: ${fmt(mainPlus1, 'pt')}` : '日経/S&P500+1比較: 未接続',
  ].join(' / ');
  return row;
});

const completedCount = matrixRows.filter((row) => row.data_connection !== '未接続').length;
const fullCount = matrixRows.filter((row) => row.data_connection === '完全接続').length;
const newlyConnected = matrixRows.filter((row) => row.source_used === '199_universe100_screening.csv' && row.previous_integrated_status === '補完待ち').length;
const purchaseReady = matrixRows.filter((row) => row.completion_status === '購入候補').length;
const followCount = matrixRows.filter((row) => /追加確認|保留/.test(row.completion_status)).length;
const excludedCount = matrixRows.filter((row) => row.completion_status === '除外継続').length;

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '補完対象',
    value: `${semiconTickers.length}社`,
    interpretation: '構造優位で拾った半導体関連6社を、既存のNISAスコア表・100社母集団・下落耐性表へ接続した。',
  },
  {
    updated_at: generatedAt,
    item: '新規に穴を埋めた銘柄',
    value: `${newlyConnected}社`,
    interpretation: '東京エレクトロンとSCREENは、候補スコア表では未接続だったが、100社母集団側のPER/PBR/ROE・成長率を接続できた。',
  },
  {
    updated_at: generatedAt,
    item: '完全接続',
    value: `${fullCount}/${semiconTickers.length}社`,
    interpretation: 'PER・PBR・ROE・売上前年比・利益前年比がそろった銘柄数。未取得項目は点数に混ぜず、別途表示した。',
  },
  {
    updated_at: generatedAt,
    item: '即時購入候補',
    value: `${purchaseReady}社`,
    interpretation: '現段階では0社。構造的に強い企業でも、割高・減益・下落耐性不足が残る場合は購入候補にしない。',
  },
  {
    updated_at: generatedAt,
    item: '次の確認対象',
    value: `${followCount}社`,
    interpretation: '保留または追加確認対象。6月イベント後と次決算で、成長率・受注・PER/PBR/ROE・指数比較を再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '除外継続',
    value: `${excludedCount}社`,
    interpretation: '既存スコア表で落とした銘柄は、構造材料だけでは復活させない。',
  },
];

const bridgeRows = matrixRows.map((row, index) => ({
  updated_at: generatedAt,
  rank: index + 1,
  ticker: row.ticker,
  company: row.company,
  structural_rating: row.structural_rating,
  source_used: row.source_used,
  data_connection_score: row.data_connection_score,
  valuation_gate: row.valuation_gate,
  earnings_gate: row.earnings_gate,
  downside_resilience_score: row.downside_resilience_score,
  completion_status: row.completion_status,
  next_action: row.completion_status === '除外継続'
    ? '通常候補へ戻さない。イベント反応DBの観察対象に限定。'
    : row.ticker === '8035.T'
      ? 'PER取得、PBR高の妥当性、受注・利益回復、6月市場イベント後の株価反応を確認。'
      : row.ticker === '7735.T'
        ? '次決算で減収減益が改善するか、PER18倍台の妥当性、下落耐性の改善を確認。'
        : '6月イベント後に再判定。追加投入ではなく候補維持か除外かを決める。',
}));

const gapRows = matrixRows.flatMap((row) => {
  const gaps = [];
  if (row.per === '') gaps.push(['PER', '未取得', '割高度を過信しないため、次回のYahoo/公式/有報で取得する。']);
  if (row.pbr === '') gaps.push(['PBR', '未取得', '資産に対する割高度を比較できないため、候補昇格不可。']);
  if (row.roe_pct === '') gaps.push(['ROE', '未取得', '資本効率の比較ができないため、候補昇格不可。']);
  if (row.revenue_yoy_pct === '') gaps.push(['売上前年比', '未取得', '決算成長の確認ができないため、成長判定に使わない。']);
  if (row.profit_yoy_pct === '') gaps.push(['利益前年比', '未取得', '利益成長の確認ができないため、成長判定に使わない。']);
  if (row.earnings_reaction_score === '') gaps.push(['決算後反応スコア', '未取得', '決算が株価に効いたかをまだ判定できない。']);
  return gaps.map(([field, status, action]) => ({
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    missing_field: field,
    status,
    action,
  }));
});

const ruleRows = [
  {
    updated_at: generatedAt,
    rule: '構造材料は直接加点しない',
    detail: '世界シェア・技術優位・AI需要との接続は、候補に入れる理由にはなるが、購入候補への直接加点にはしない。',
  },
  {
    updated_at: generatedAt,
    rule: '未取得データは点数に混ぜない',
    detail: 'PER・PBR・ROE・成長率・決算後反応が未取得の場合は、空欄または未取得として表示し、補完対象に送る。',
  },
  {
    updated_at: generatedAt,
    rule: '割高・減益・下落耐性不足は保留',
    detail: '構造優位がS/Aでも、PBR高、利益減、下落耐性不足がある場合は、即時候補ではなく6月イベント後・次決算後の再判定に回す。',
  },
  {
    updated_at: generatedAt,
    rule: '+1%目標との接続',
    detail: '日経平均またはS&P500の強い方を1%pt以上上回る見込みを検証する。通過しても、割高・減益・下落耐性不足があれば候補昇格しない。',
  },
  {
    updated_at: generatedAt,
    rule: '今回の出力は補完結果',
    detail: '購入リストではなく、半導体構造本命をNISA 1年保有スコアへ接続するための補完表である。',
  },
];

const sourceRows = [
  {
    updated_at: generatedAt,
    source: '355_structural_advantage_candidates.csv',
    role: '半導体構造優位・質的根拠',
    reliability: '公式サイト等の構造情報をもとに作成',
  },
  {
    updated_at: generatedAt,
    source: '199_universe100_screening.csv',
    role: '100社母集団のPER/PBR/ROE・成長率・株価指標',
    reliability: '既存取得済みデータ。最新更新時点を明記して使う。',
  },
  {
    updated_at: generatedAt,
    source: '245_nisa_1year_hold_score_top20.csv',
    role: '既存トップ20のNISA 1年保有スコア',
    reliability: '決算後反応まで接続済みの銘柄は優先利用。',
  },
  {
    updated_at: generatedAt,
    source: '360_downside_resilience_by_stock.csv',
    role: '下落耐性・1年リターン・最大下落率',
    reliability: 'Yahoo Finance系の株価時系列から計算済み。',
  },
  {
    updated_at: generatedAt,
    source: '366_semiconductor_quant_gate_matrix.csv',
    role: '構造材料と量的ゲートの前回接続表',
    reliability: '前工程の統合結果。未接続箇所の特定に利用。',
  },
  {
    updated_at: generatedAt,
    source: '309_benchmark_plus1_reference.csv',
    role: '+1%目標の比較対象',
    reliability: 'S&P500・日経平均の12か月リターン確認用。',
  },
];

writeCsv('377_semiconductor_fundamental_completion_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('378_semiconductor_fundamental_completion_matrix.csv', matrixRows, [
  'updated_at',
  'ticker',
  'company',
  'structural_rating',
  'structural_score',
  'source_used',
  'data_connection',
  'data_connection_score',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'revenue_cagr_pct',
  'profit_cagr_pct',
  'dividend_yield_pct',
  'ret1y_pct',
  'max_drawdown_pct',
  'downside_resilience_score',
  'earnings_reaction_score',
  'main_plus1_excess_pt',
  'theme_smh_plus1_excess_pt',
  'valuation_gate',
  'earnings_gate',
  'downside_gate',
  'previous_integrated_status',
  'completion_status',
  'decision_reason',
]);
writeCsv('379_semiconductor_fundamental_score_bridge.csv', bridgeRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'structural_rating',
  'source_used',
  'data_connection_score',
  'valuation_gate',
  'earnings_gate',
  'downside_resilience_score',
  'completion_status',
  'next_action',
]);
writeCsv('380_semiconductor_fundamental_gap_queue.csv', gapRows, [
  'updated_at',
  'ticker',
  'company',
  'missing_field',
  'status',
  'action',
]);
writeCsv('381_semiconductor_fundamental_rules.csv', ruleRows, ['updated_at', 'rule', 'detail']);
writeCsv('382_semiconductor_fundamental_sources.csv', sourceRows, ['updated_at', 'source', 'role', 'reliability']);

const mainBenchmark = plus1Rows
  .filter((row) => row.comparison_group === '主比較' && row.data_status === '取得済み')
  .sort((a, b) => (num(b.trailing_12m_return_pct) ?? -Infinity) - (num(a.trailing_12m_return_pct) ?? -Infinity))[0];
const plus1Line = mainBenchmark
  ? `${mainBenchmark.benchmark_name} ${fmt(mainBenchmark.trailing_12m_return_pct, '%')} + 1%pt = ${fmt((num(mainBenchmark.trailing_12m_return_pct) ?? 0) + 1, '%')}`
  : '主比較ベンチマーク未取得';

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体 決算・割高データ補完</title>
  <style>
    :root {
      --ink: #061d35;
      --muted: #334155;
      --blue: #0b5f92;
      --green: #047857;
      --amber: #b45309;
      --red: #b91c1c;
      --line: #cfe0f3;
      --soft: #f4f9ff;
      --panel: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: #f6fbff;
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #07385b, #0b5f92);
      color: #fff;
      padding: 34px 26px 30px;
    }
    main {
      width: min(1180px, calc(100% - 28px));
      margin: 22px auto 60px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.35; }
    h1 { font-size: clamp(26px, 4vw, 42px); }
    h2 {
      margin-top: 34px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 24px;
    }
    p { margin: 8px 0; color: var(--muted); }
    a { color: #075985; font-weight: 700; }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .toolbar a, .button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #fff;
      color: #07385b;
      text-decoration: none;
      border: 1px solid #b8d4ee;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
    }
    .notice {
      margin-top: 16px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.35);
      padding: 14px 16px;
      border-radius: 10px;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 6px 20px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .kpi {
      font-size: 28px;
      font-weight: 800;
      color: var(--blue);
      margin-top: 4px;
    }
    .pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-weight: 800;
      background: #e0f2fe;
      color: #075985;
      white-space: nowrap;
    }
    .good { color: var(--green); font-weight: 800; }
    .warn { color: var(--amber); font-weight: 800; }
    .bad { color: var(--red); font-weight: 800; }
    .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      margin-top: 14px;
      box-shadow: 0 6px 20px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      background: #fff;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #d5e4f4;
      padding: 10px 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: #061d35;
    }
    th {
      background: #e7f2fb;
      text-align: left;
      font-weight: 800;
    }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .narrow { width: 88px; }
    .wide { width: 28%; }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .step {
      position: relative;
      min-height: 96px;
      border: 2px solid #b7d7ef;
      border-radius: 10px;
      padding: 12px;
      background: #f8fcff;
      font-weight: 800;
    }
    .step small {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-weight: 500;
    }
    .step:not(:last-child)::after {
      content: "→";
      position: absolute;
      right: -17px;
      top: 34px;
      color: var(--blue);
      font-size: 26px;
      font-weight: 900;
      z-index: 2;
    }
    details {
      border: 1px solid #d5e4f4;
      border-radius: 10px;
      padding: 12px 14px;
      background: #fbfdff;
      margin-top: 10px;
    }
    summary { cursor: pointer; font-weight: 800; color: #07385b; }
    @media (max-width: 860px) {
      .flow { grid-template-columns: 1fr; }
      .step:not(:last-child)::after { display: none; }
      table { font-size: 14px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar { display: none; }
      .section, .card { box-shadow: none; page-break-inside: avoid; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { color: #000; }
    }
  </style>
</head>
<body>
  <header>
    <h1>半導体 決算・割高データ補完</h1>
    <p style="color:#e6f3ff">構造的に強い半導体銘柄を、購入候補へ直結せず、PER/PBR/ROE・決算伸び・下落耐性へ接続して検査するページです。</p>
    <div class="notice">結論: 東京エレクトロンとSCREENの未接続データは補完できました。ただし、現時点では購入候補への昇格ではなく、6月イベント後・次決算後の再判定対象です。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_quant_gate_connection_20260526.html">半導体 量的接続</a>
      <a href="semiconductor_downside_resilience_20260526.html">下落耐性</a>
      <a href="ipo_special_watch_corner_20260526.html">IPO特別枠</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      ${summaryRows.map((row) => `
        <div class="card">
          <h3>${esc(row.item)}</h3>
          <div class="kpi">${esc(row.value)}</div>
          <p>${esc(row.interpretation)}</p>
        </div>
      `).join('')}
    </section>

    <h2>1. 今回の位置づけ</h2>
    <section class="section">
      <div class="flow">
        <div class="step">構造材料<small>世界シェア・技術優位・AI需要との接続を見る</small></div>
        <div class="step">数値接続<small>PER/PBR/ROE・成長率・株価反応へ接続</small></div>
        <div class="step">停止条件<small>割高、減益、下落耐性不足を切り分ける</small></div>
        <div class="step">6月再判定<small>CPI、FOMC、日銀、次決算を確認</small></div>
        <div class="step">候補判断<small>NISA 1年保有の候補に残すか決める</small></div>
      </div>
      <p><strong>今回の作業は2段目です。</strong> 半導体構造材料を直接加点せず、既存の100社母集団・NISAスコア表・下落耐性表に接続しました。</p>
      <p>+1%目標の主比較線: <strong>${esc(plus1Line)}</strong></p>
    </section>

    <h2>2. 補完後の一覧</h2>
    <section class="section">
      <table>
        <thead>
          <tr>
            <th class="narrow">銘柄</th>
            <th>会社</th>
            <th class="narrow">構造</th>
            <th class="narrow">接続</th>
            <th class="narrow">PER</th>
            <th class="narrow">PBR</th>
            <th class="narrow">ROE</th>
            <th>決算伸び</th>
            <th class="narrow">下落耐性</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          ${matrixRows.map((row) => `
            <tr>
              <td><strong>${esc(row.ticker)}</strong></td>
              <td>${esc(row.company)}</td>
              <td><span class="pill">${esc(row.structural_rating)}</span></td>
              <td class="${statusClass(row.data_connection)}">${esc(row.data_connection)}<br>${esc(row.data_connection_score)}点</td>
              <td>${esc(fmt(row.per, '倍'))}</td>
              <td>${esc(fmt(row.pbr, '倍'))}</td>
              <td>${esc(fmt(row.roe_pct, '%'))}</td>
              <td>${esc(row.earnings_gate)}<br>売上 ${esc(fmt(row.revenue_yoy_pct, '%'))} / 利益 ${esc(fmt(row.profit_yoy_pct, '%'))}</td>
              <td class="${statusClass(row.downside_gate)}">${esc(fmt(row.downside_resilience_score, '点'))}<br>${esc(row.downside_gate)}</td>
              <td class="${statusClass(row.completion_status)}">${esc(row.completion_status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <h2>3. 重要銘柄の読み方</h2>
    <section class="grid">
      ${matrixRows.filter((row) => ['8035.T', '7735.T', '6762.T', '6146.T'].includes(row.ticker)).map((row) => `
        <div class="card">
          <h3>${esc(row.ticker)} ${esc(row.company)}</h3>
          <p><strong>結論:</strong> <span class="${statusClass(row.completion_status)}">${esc(row.completion_status)}</span></p>
          <p>${esc(row.decision_reason)}</p>
          <p><strong>次の確認:</strong> ${esc(bridgeRows.find((bridge) => bridge.ticker === row.ticker)?.next_action ?? '')}</p>
        </div>
      `).join('')}
    </section>

    <h2>4. 残っている穴</h2>
    <section class="section">
      ${gapRows.length ? `
        <table>
          <thead>
            <tr>
              <th class="narrow">銘柄</th>
              <th>会社</th>
              <th>未取得項目</th>
              <th>扱い</th>
            </tr>
          </thead>
          <tbody>
            ${gapRows.map((row) => `
              <tr>
                <td><strong>${esc(row.ticker)}</strong></td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.missing_field)}</td>
                <td>${esc(row.action)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>主要項目の未取得はありません。</p>'}
    </section>

    <h2>5. ルール</h2>
    <section class="section">
      ${ruleRows.map((row) => `
        <details>
          <summary>${esc(row.rule)}</summary>
          <p>${esc(row.detail)}</p>
        </details>
      `).join('')}
    </section>

    <h2>6. 出力ファイル</h2>
    <section class="section">
      <table>
        <thead>
          <tr><th>ファイル</th><th>内容</th></tr>
        </thead>
        <tbody>
          <tr><td><a href="377_semiconductor_fundamental_completion_summary.csv">377_semiconductor_fundamental_completion_summary.csv</a></td><td>補完結果の要約</td></tr>
          <tr><td><a href="378_semiconductor_fundamental_completion_matrix.csv">378_semiconductor_fundamental_completion_matrix.csv</a></td><td>6社の補完後データ一覧</td></tr>
          <tr><td><a href="379_semiconductor_fundamental_score_bridge.csv">379_semiconductor_fundamental_score_bridge.csv</a></td><td>判定と次アクション</td></tr>
          <tr><td><a href="380_semiconductor_fundamental_gap_queue.csv">380_semiconductor_fundamental_gap_queue.csv</a></td><td>未取得項目の一覧</td></tr>
          <tr><td><a href="381_semiconductor_fundamental_rules.csv">381_semiconductor_fundamental_rules.csv</a></td><td>補完・判定ルール</td></tr>
          <tr><td><a href="382_semiconductor_fundamental_sources.csv">382_semiconductor_fundamental_sources.csv</a></td><td>使用データ元</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_fundamental_completion_20260526.html'), html, 'utf8');
