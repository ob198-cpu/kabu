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
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows
    .filter((cells) => cells.some((value) => String(value ?? '').trim() !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function readCsv(name) {
  const full = path.join(ROOT, name);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, 'utf8'));
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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, digits = 1, suffix = '') {
  const parsed = num(value);
  if (parsed === null) return '未取得';
  return `${parsed.toFixed(digits)}${suffix}`;
}

function pct(value, digits = 1) {
  return fmt(value, digits, '%');
}

function gateClass(text) {
  if (/除外|停止|不可|不足|未接続|課題/.test(text)) return 'bad';
  if (/保留|注意|補完|弱い/.test(text)) return 'warn';
  if (/通過|有力|追加確認|確認可/.test(text)) return 'good';
  return '';
}

const structuralRows = readCsv('355_structural_advantage_candidates.csv');
const downsideRows = readCsv('360_downside_resilience_by_stock.csv');
const nisaRows = readCsv('245_nisa_1year_hold_score_top20.csv');
const plus1Rows = readCsv('310_candidate_plus1_gate.csv');
const completionRows = readCsv('339_candidate_data_completion_matrix.csv');
const sectorRows = readCsv('300_candidate_sector_adjustment.csv');
const benchmarkRows = readCsv('309_benchmark_plus1_reference.csv');

const structuralByTicker = new Map(structuralRows.map((row) => [row.ticker, row]));
const nisaByTicker = new Map(nisaRows.map((row) => [row.ticker, row]));
const plus1ByTicker = new Map(plus1Rows.map((row) => [row.ticker, row]));
const completionByTicker = new Map(completionRows.map((row) => [row.ticker, row]));
const sectorByTicker = new Map(sectorRows.map((row) => [row.ticker, row]));

const primaryBenchmark = benchmarkRows
  .filter((row) => row.comparison_group === '主比較' && row.data_status === '取得済み')
  .sort((a, b) => (num(b.trailing_12m_return_pct) ?? -Infinity) - (num(a.trailing_12m_return_pct) ?? -Infinity))[0] || {};
const smhBenchmark = benchmarkRows.find((row) => row.benchmark_symbol === 'SMH') || {};
const primaryTargetPct = (num(primaryBenchmark.trailing_12m_return_pct) ?? 0) + 1;
const themeTargetPct = (num(smhBenchmark.trailing_12m_return_pct) ?? 0) + 1;

function valuationGate(row) {
  if (!row) return { gate: '未接続', detail: 'NISAスコア表に未接続。PER/PBR/ROE、売上・利益成長の補完が必要。' };
  const per = num(row.per);
  const pbr = num(row.pbr);
  const roe = num(row.roe_pct);
  const missing = [];
  if (per === null) missing.push('PER');
  if (pbr === null) missing.push('PBR');
  if (roe === null) missing.push('ROE');
  if (missing.length) return { gate: '一部未取得', detail: `${missing.join('/')}が未取得。割高判定を確定しない。` };

  const flags = [];
  if (per >= 45) flags.push(`PER ${per.toFixed(2)}倍`);
  if (pbr >= 10) flags.push(`PBR ${pbr.toFixed(2)}倍`);
  if (flags.length) return { gate: '割高強め', detail: `${flags.join('、')}。1年保有では失望時の下落幅を優先確認。` };
  if (per >= 35 || pbr >= 6) return { gate: '割高注意', detail: `PER ${per.toFixed(2)}倍、PBR ${pbr.toFixed(2)}倍。業績成長と決算後反応で正当化できるか確認。` };
  return { gate: '確認可', detail: `PER ${per.toFixed(2)}倍、PBR ${pbr.toFixed(2)}倍、ROE ${roe.toFixed(2)}%。` };
}

function downsideGate(row) {
  const score = num(row?.downside_resilience_score);
  if (score === null) return { gate: '未接続', detail: '1年日次の下落局面テストが未接続。' };
  if (score >= 65) return { gate: '通過', detail: `下落耐性 ${score}点。指数下落日の相対反応は許容範囲。` };
  if (score >= 45) return { gate: '弱いが観察可', detail: `下落耐性 ${score}点。強いとは言えないため資金比率を抑える。` };
  return { gate: '下落耐性不足', detail: `下落耐性 ${score}点。構造優位があっても、下落日に耐える証拠は弱い。` };
}

function plus1Gate(row) {
  const ret1y = num(row?.ret1y_pct);
  if (ret1y === null) return { gate: '未接続', detail: '+1%比較に必要な1年騰落率が未接続。', excess: '', theme_excess: '' };
  const excess = ret1y - primaryTargetPct;
  const themeExcess = ret1y - themeTargetPct;
  const gate = excess >= 0 ? '主比較+1%通過' : '主比較未達';
  const theme = themeExcess >= 0 ? '半導体テーマ比も通過' : '半導体テーマ比は未達';
  return {
    gate,
    detail: `1年騰落率 ${ret1y.toFixed(1)}%。${primaryBenchmark.benchmark_name || '主比較'}+1%線 ${primaryTargetPct.toFixed(1)}% に対して ${excess.toFixed(1)}pt。参考SMH+1%線 ${themeTargetPct.toFixed(1)}% に対して ${themeExcess.toFixed(1)}pt。${theme}。`,
    excess: excess.toFixed(1),
    theme_excess: themeExcess.toFixed(1),
  };
}

function earningsGate(row) {
  if (!row) return { gate: '未接続', detail: '決算後反応、売上成長、利益成長が未接続。' };
  const reaction = num(row.earnings_reaction_score);
  const revenue = num(row.revenue_yoy_pct);
  const profit = num(row.profit_yoy_pct);
  if (reaction === null) return { gate: '決算反応未取得', detail: `売上前年比 ${pct(revenue)}、利益前年比 ${pct(profit)}。決算後反応が未取得。` };
  if (reaction < 40) return { gate: '決算反応弱い', detail: `決算後反応 ${reaction.toFixed(1)}点。決算数字が良くても株価反応が弱い。` };
  if (reaction >= 60) return { gate: '決算反応確認可', detail: `決算後反応 ${reaction.toFixed(1)}点。売上前年比 ${pct(revenue)}、利益前年比 ${pct(profit)}。` };
  return { gate: '決算反応中立', detail: `決算後反応 ${reaction.toFixed(1)}点。売上前年比 ${pct(revenue)}、利益前年比 ${pct(profit)}。` };
}

function integratedDecision({ structural, downside, nisa, valuation, downGate, plusGate, earnGate }) {
  if (!nisa) return {
    status: '補完待ち',
    reason: '構造優位は強いが、候補スコア表に未接続。決算・PER/PBR/ROE・決算後反応を補完するまで候補昇格は不可。',
  };
  const category = nisa.category || '';
  const hard = nisa.hard_gate || '';
  if (category === '落とす' || /PER|PBR|過熱|反応/.test(hard) || valuation.gate === '割高強め' || earnGate.gate === '決算反応弱い') {
    return {
      status: '除外継続',
      reason: `既存スコア表では「${category || '未分類'}」。停止理由: ${hard || valuation.detail || earnGate.detail}`,
    };
  }
  if (downGate.gate === '下落耐性不足') {
    return {
      status: '保留',
      reason: '主比較+1%は通っても、指数下落局面の相対反応が弱く、1年保有候補としては資金投入前に再確認が必要。',
    };
  }
  if (valuation.gate === '一部未取得') {
    return {
      status: '補完待ち',
      reason: 'PER/PBR/ROEの欠落があり、割高リスクを確定できない。',
    };
  }
  if (plusGate.gate !== '主比較+1%通過') {
    return {
      status: '保留',
      reason: 'S&P500/日経平均の強い方+1%を上回れていない。',
    };
  }
  if ((structural.structural_rating || '') === 'B') {
    return {
      status: '追加確認対象',
      reason: '量的には確認を続けられるが、半導体製造工程の高シェア本命ではなく周辺部品枠として扱う。',
    };
  }
  return {
    status: '追加確認対象',
    reason: '主比較+1%、決算、割高の最低確認は残るが、現時点では次工程で確認する価値がある。',
  };
}

const matrixRows = downsideRows.map((downside, index) => {
  const structural = structuralByTicker.get(downside.ticker) || {};
  const nisa = nisaByTicker.get(downside.ticker);
  const plus1 = plus1ByTicker.get(downside.ticker);
  const completion = completionByTicker.get(downside.ticker);
  const sector = sectorByTicker.get(downside.ticker);
  const valuation = valuationGate(nisa);
  const downGate = downsideGate(downside);
  const plusGate = plus1Gate(downside);
  const earnGate = earningsGate(nisa);
  const decision = integratedDecision({ structural, downside, nisa, valuation, downGate, plusGate, earnGate });
  const currentPlus1 = plus1?.plus1_status ? plus1.plus1_status : plusGate.gate;
  return {
    updated_at: generatedAt,
    priority_rank: index + 1,
    ticker: downside.ticker,
    company: downside.company || structural.company,
    structural_rating: structural.structural_rating || downside.structural_rating,
    structural_score: structural.structural_score || '',
    downside_resilience_score: downside.downside_resilience_score,
    downside_gate: downGate.gate,
    ret1y_pct: downside.ret1y_pct,
    max_drawdown_1y_pct: downside.max_drawdown_1y_pct,
    weighted_excess_5d_pct: downside.weighted_excess_5d_pct,
    per: nisa?.per || '',
    pbr: nisa?.pbr || '',
    roe_pct: nisa?.roe_pct || '',
    revenue_yoy_pct: nisa?.revenue_yoy_pct || '',
    profit_yoy_pct: nisa?.profit_yoy_pct || '',
    valuation_gate: valuation.gate,
    earnings_reaction_score: nisa?.earnings_reaction_score || '',
    earnings_gate: earnGate.gate,
    main_plus1_excess_pt: plusGate.excess,
    theme_smh_plus1_excess_pt: plusGate.theme_excess,
    plus1_gate: currentPlus1,
    nisa_category: nisa?.category || '未接続',
    nisa_score: nisa?.nisa_score || '',
    data_confidence: nisa?.data_confidence || '',
    completion_score: completion?.completion_score || '',
    sector_adjustment_status: sector?.adjustment_status || '未接続',
    integrated_status: decision.status,
    integrated_reason: decision.reason,
  };
});

const priorityRows = matrixRows.map((row) => {
  let next_action = '';
  if (row.integrated_status === '補完待ち') {
    next_action = '公式決算、PER/PBR/ROE、1年騰落、決算後反応を候補表へ接続する。';
  } else if (row.integrated_status === '除外継続') {
    next_action = 'すぐ候補へ戻さない。PER/PBR、過熱、決算後反応が改善した時だけ再評価する。';
  } else if (row.integrated_status === '保留') {
    next_action = '下落局面の再検証、SOX急落時の5営業日反応、6月イベント後の再判定を行う。';
  } else {
    next_action = '6月イベント後に、購入検討用チェックリストへ接続できるか確認する。';
  }
  return {
    updated_at: generatedAt,
    priority_rank: row.priority_rank,
    ticker: row.ticker,
    company: row.company,
    current_position: row.integrated_status,
    reason: row.integrated_reason,
    next_action,
  };
});

const gapRows = [];
for (const row of matrixRows) {
  if (row.nisa_category === '未接続') {
    gapRows.push({
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      gap_type: '候補スコア未接続',
      impact: '構造優位は評価できるが、購入候補の比較表には入れられない。',
      required_action: 'PER/PBR/ROE、売上・利益成長、決算後反応、1年騰落を候補表へ追加する。',
    });
  }
  if (row.valuation_gate === '一部未取得' || row.valuation_gate === '未接続') {
    gapRows.push({
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      gap_type: '割高確認不足',
      impact: '高シェア企業でも、価格が高すぎるか判断できない。',
      required_action: 'PER/PBR/ROEを公式資料、Yahoo等の取得済み候補表、または手入力で補完する。',
    });
  }
  if (row.downside_gate !== '通過') {
    gapRows.push({
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      gap_type: '下落耐性',
      impact: '半導体テーマ急落時に1年保有で耐えられる根拠が弱い。',
      required_action: 'SOX/NASDAQ/日経平均の下落イベント後1/5/20営業日反応を継続観察する。',
    });
  }
}

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '接続対象',
    value: `${matrixRows.length}社`,
    interpretation: '半導体・AI周辺の構造優位6社を、下落耐性、割高、決算、+1%比較へ接続。',
  },
  {
    updated_at: generatedAt,
    item: '主比較+1%通過',
    value: `${matrixRows.filter((row) => row.plus1_gate.includes('通過') || row.plus1_gate.includes('有力')).length}社`,
    interpretation: `日経平均/S&P500の強い方+1%線は ${primaryTargetPct.toFixed(1)}%。1年騰落だけなら多くが通過。ただし購入判断には使わない。`,
  },
  {
    updated_at: generatedAt,
    item: '半導体テーマ比も通過',
    value: `${matrixRows.filter((row) => num(row.theme_smh_plus1_excess_pt) !== null && num(row.theme_smh_plus1_excess_pt) >= 0).length}社`,
    interpretation: `参考SMH+1%線は ${themeTargetPct.toFixed(1)}%。半導体テーマの中でも勝てたかを見る補助指標。`,
  },
  {
    updated_at: generatedAt,
    item: '下落耐性通過',
    value: `${matrixRows.filter((row) => row.downside_gate === '通過').length}社`,
    interpretation: 'SOX/NASDAQ/日経平均の下落日に相対的に耐えた銘柄は現時点でなし。',
  },
  {
    updated_at: generatedAt,
    item: '追加確認対象',
    value: `${matrixRows.filter((row) => row.integrated_status === '追加確認対象').length}社`,
    interpretation: '購入候補確定ではない。6月イベント後に、購入検討用チェックリストへ進められるか再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '次工程',
    value: '決算・割高補完',
    interpretation: '東京エレクトロン、SCREENなど構造本命の未接続データを埋め、TDKは周辺部品枠として継続確認する。',
  },
];

const ruleRows = [
  {
    updated_at: generatedAt,
    rule: '構造優位',
    formula: '構造スコア = 技術/シェア/不可欠性/需要継続/収益接続を0〜100点化',
    treatment: '単独では加点しない。候補追加の入口にだけ使う。',
  },
  {
    updated_at: generatedAt,
    rule: '下落耐性',
    formula: '下落耐性 = 指数下落日の1/5/20営業日超過リターン + 5日勝率 + 最大ドローダウン',
    treatment: '65点以上で通過、45〜64点は観察、44点以下は保留または停止。',
  },
  {
    updated_at: generatedAt,
    rule: '+1%比較',
    formula: '主比較+1%差 = 銘柄1年騰落率 - max(S&P500, 日経平均) - 1%pt',
    treatment: '通過しても購入候補確定ではない。割高・決算・下落耐性で止める。',
  },
  {
    updated_at: generatedAt,
    rule: '半導体テーマ比較',
    formula: '参考テーマ差 = 銘柄1年騰落率 - SMH騰落率 - 1%pt',
    treatment: '参考値。半導体テーマの中でわざわざ個別株を選ぶ根拠があるかを見る。',
  },
  {
    updated_at: generatedAt,
    rule: '割高ゲート',
    formula: 'PER/PBR/ROEを確認。PER45倍以上またはPBR10倍以上は割高強め。',
    treatment: '割高強め、決算反応弱い、過熱ゲートありは候補昇格しない。',
  },
  {
    updated_at: generatedAt,
    rule: '統合判断',
    formula: '構造優位 → 下落耐性 → 決算/割高 → +1%比較 → 6月イベント後の最終確認',
    treatment: '足し算で一発採点しない。各ゲートを順番に通過したものだけ次工程へ進める。',
  },
];

const sourceRows = [
  {
    updated_at: generatedAt,
    source_name: '355_structural_advantage_candidates.csv',
    contents: '構造優位、シェア、需要接続、公式ソース',
    treatment: '質的仮説の入口。購入スコアへ直接加点しない。',
  },
  {
    updated_at: generatedAt,
    source_name: '360_downside_resilience_by_stock.csv',
    contents: '1年日次株価、指数下落日の相対反応',
    treatment: '下落耐性ゲートに使用。',
  },
  {
    updated_at: generatedAt,
    source_name: '245_nisa_1year_hold_score_top20.csv',
    contents: 'NISA 1年保有スコア、PER/PBR/ROE、売上/利益成長、決算反応',
    treatment: '接続済み銘柄のみ割高・決算ゲートに使用。',
  },
  {
    updated_at: generatedAt,
    source_name: '309_benchmark_plus1_reference.csv',
    contents: 'S&P500、日経平均、NASDAQ、SMHの1年騰落率',
    treatment: '+1%比較と半導体テーマ参考比較に使用。',
  },
  {
    updated_at: generatedAt,
    source_name: '300_candidate_sector_adjustment.csv',
    contents: 'PER/PBR/ROEの業種内比較',
    treatment: '参考。比較数不足や未反映のものは本体スコアへ混ぜない。',
  },
];

writeCsv('365_semiconductor_quant_gate_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('366_semiconductor_quant_gate_matrix.csv', matrixRows, [
  'updated_at',
  'priority_rank',
  'ticker',
  'company',
  'structural_rating',
  'structural_score',
  'downside_resilience_score',
  'downside_gate',
  'ret1y_pct',
  'max_drawdown_1y_pct',
  'weighted_excess_5d_pct',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'valuation_gate',
  'earnings_reaction_score',
  'earnings_gate',
  'main_plus1_excess_pt',
  'theme_smh_plus1_excess_pt',
  'plus1_gate',
  'nisa_category',
  'nisa_score',
  'data_confidence',
  'completion_score',
  'sector_adjustment_status',
  'integrated_status',
  'integrated_reason',
]);
writeCsv('367_semiconductor_quant_priority_queue.csv', priorityRows, [
  'updated_at',
  'priority_rank',
  'ticker',
  'company',
  'current_position',
  'reason',
  'next_action',
]);
writeCsv('368_semiconductor_quant_gap_queue.csv', gapRows, [
  'updated_at',
  'ticker',
  'company',
  'gap_type',
  'impact',
  'required_action',
]);
writeCsv('369_semiconductor_quant_gate_rules.csv', ruleRows, ['updated_at', 'rule', 'formula', 'treatment']);
writeCsv('370_semiconductor_quant_sources.csv', sourceRows, ['updated_at', 'source_name', 'contents', 'treatment']);

const table = (headers, rows) => `
  <div class="table-wrap">
    <table>
      <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${headers.map((header) => `<td${header.className ? ` class="${header.className(row)}"` : ''}>${esc(header.value ? header.value(row) : row[header.key])}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table>
  </div>`;

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体構造優位 量的ゲート接続</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cbd5e1;
      --bg: #f6f8fb;
      --panel: #ffffff;
      --navy: #12385f;
      --blue: #1f6f9f;
      --green: #047857;
      --green-bg: #ecfdf5;
      --amber: #b45309;
      --amber-bg: #fffbeb;
      --red: #b91c1c;
      --red-bg: #fef2f2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 26px 0 48px; }
    .hero {
      background: var(--navy);
      color: #fff;
      border-radius: 16px;
      padding: 26px;
      margin-bottom: 18px;
      box-shadow: 0 12px 28px rgba(17, 24, 39, .12);
    }
    h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.25; }
    h2 { margin: 0 0 12px; color: var(--navy); font-size: 22px; line-height: 1.35; }
    h3 { margin: 0 0 8px; color: var(--navy); font-size: 17px; }
    p { margin: 0 0 10px; }
    .lead { color: #e5eefb; max-width: 900px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #b8d5ef;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }
    .button.dark { background: transparent; color: #fff; border-color: #7eb3df; }
    section, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(17, 24, 39, .06);
    }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .kpi {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }
    .kpi span { display: block; color: var(--muted); font-size: 12px; }
    .kpi b { display: block; color: var(--navy); font-size: 22px; line-height: 1.2; margin-top: 4px; }
    .flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .step { border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #f8fbff; min-height: 112px; position: relative; }
    .step:not(:last-child)::after { content: "→"; position: absolute; right: -14px; top: 40%; color: var(--blue); font-weight: 800; }
    .step b { display: block; color: var(--navy); margin-bottom: 4px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; color: #111827; overflow-wrap: anywhere; }
    th { background: #eaf3fb; color: #0f3b63; font-size: 13px; white-space: nowrap; }
    td { font-size: 13px; }
    .good { color: var(--green); font-weight: 800; }
    .warn { color: var(--amber); font-weight: 800; }
    .bad { color: var(--red); font-weight: 800; }
    .note { border-left: 5px solid var(--blue); padding: 12px 14px; background: #f8fbff; border-radius: 10px; }
    .warning { border-color: #f59e0b; background: var(--amber-bg); }
    .danger { border-color: #ef4444; background: var(--red-bg); }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 3px 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); }
      .kpis, .flow { grid-template-columns: 1fr; }
      .step:not(:last-child)::after { display: none; }
    }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>半導体構造優位 量的ゲート接続</h1>
    <p class="lead">構造的に強そうな半導体・AI周辺銘柄を、下落耐性、割高、決算反応、S&P500/日経平均+1%比較へ接続しました。ここでは「質的に良いから買う」ではなく、数値ゲートを通ったか、どこで止まったかを表示します。</p>
    <div class="toolbar">
      <a class="button dark" href="semiconductor_downside_resilience_20260526.html">半導体下落耐性検証へ</a>
      <a class="button dark" href="semiconductor_structural_advantage_gate_20260526.html">構造優位ゲートへ</a>
      <a class="button dark" href="semiconductor_fundamental_completion_20260526.html">決算・割高補完へ</a>
      <a class="button dark" href="plus1_benchmark_connection_20260525.html">+1%比較へ</a>
      <a class="button dark" href="index.html">メインページへ</a>
      <a class="button" href="365_semiconductor_quant_gate_summary.csv">365 要約CSV</a>
      <a class="button" href="366_semiconductor_quant_gate_matrix.csv">366 接続表CSV</a>
      <a class="button" href="367_semiconductor_quant_priority_queue.csv">367 優先対応CSV</a>
      <a class="button" href="368_semiconductor_quant_gap_queue.csv">368 未接続CSV</a>
      <a class="button" href="369_semiconductor_quant_gate_rules.csv">369 ルールCSV</a>
    </div>
  </section>

  <div class="kpis">
    ${summaryRows.slice(0, 5).map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b></div>`).join('\n')}
  </div>

  <section>
    <h2>今回の結論</h2>
    <div class="note warning">
      <p><b>半導体テーマは強いが、即時に購入候補へ昇格できる状態ではありません。</b></p>
      <p>1年騰落率だけなら主比較+1%線を上回る銘柄が多い一方、SOX/NASDAQ/日経平均の下落日に強かったとは言えません。さらにレーザーテック、アドバンテストは割高・過熱・決算後反応のゲートで止まります。</p>
      <p>次に進める価値があるのは、データが揃っているTDKの継続確認と、構造本命である東京エレクトロン・SCREENの決算/割高データ補完です。</p>
    </div>
  </section>

  <section>
    <h2>接続フロー</h2>
    <div class="flow">
      <div class="step"><b>1. 構造優位</b><span>高シェア、不可欠工程、需要継続性を確認。ここでは加点しない。</span></div>
      <div class="step"><b>2. 下落耐性</b><span>SOX/NASDAQ/日経平均の下落日に、相対的に耐えたかを見る。</span></div>
      <div class="step"><b>3. 決算・割高</b><span>PER/PBR/ROE、売上・利益成長、決算後反応で止める。</span></div>
      <div class="step"><b>4. +1%比較</b><span>S&P500/日経平均の強い方を1%pt上回ったかを見る。</span></div>
      <div class="step"><b>5. 6月再判定</b><span>CPI、FOMC、日銀、日経75日線を見て、候補へ残すか決める。</span></div>
    </div>
  </section>

  <section>
    <h2>半導体6社 接続結果</h2>
    ${table([
      { label: '順位', key: 'priority_rank' },
      { label: '銘柄', value: (row) => `${row.ticker} ${row.company}` },
      { label: '構造', value: (row) => `${row.structural_rating} / ${row.structural_score || '未'}点` },
      { label: '下落耐性', value: (row) => `${row.downside_resilience_score}点 / ${row.downside_gate}`, className: (row) => gateClass(row.downside_gate) },
      { label: '1年騰落', value: (row) => pct(row.ret1y_pct) },
      { label: '+1%差', value: (row) => `${row.main_plus1_excess_pt || '未'}pt` },
      { label: 'SMH比差', value: (row) => `${row.theme_smh_plus1_excess_pt || '未'}pt` },
      { label: 'PER/PBR/ROE', value: (row) => `${row.per || '未'} / ${row.pbr || '未'} / ${row.roe_pct || '未'}%` },
      { label: '割高', key: 'valuation_gate', className: (row) => gateClass(row.valuation_gate) },
      { label: '決算反応', value: (row) => `${row.earnings_reaction_score || '未'}点 / ${row.earnings_gate}`, className: (row) => gateClass(row.earnings_gate) },
      { label: '統合', key: 'integrated_status', className: (row) => gateClass(row.integrated_status) },
    ], matrixRows)}
  </section>

  <section>
    <h2>なぜその扱いになるか</h2>
    ${table([
      { label: '順位', key: 'priority_rank' },
      { label: '銘柄', value: (row) => `${row.ticker} ${row.company}` },
      { label: '現在の扱い', key: 'current_position', className: (row) => gateClass(row.current_position) },
      { label: '理由', key: 'reason' },
      { label: '次の作業', key: 'next_action' },
    ], priorityRows)}
  </section>

  <section>
    <h2>未接続・課題</h2>
    ${table([
      { label: '銘柄', value: (row) => `${row.ticker} ${row.company}` },
      { label: '課題', key: 'gap_type' },
      { label: '影響', key: 'impact' },
      { label: '必要作業', key: 'required_action' },
    ], gapRows)}
  </section>

  <section>
    <h2>数式・ルール</h2>
    ${table([
      { label: '項目', key: 'rule' },
      { label: '計算式', key: 'formula' },
      { label: '扱い', key: 'treatment' },
    ], ruleRows)}
  </section>

  <section>
    <h2>取得元</h2>
    ${table([
      { label: 'データ', key: 'source_name' },
      { label: '内容', key: 'contents' },
      { label: '扱い', key: 'treatment' },
    ], sourceRows)}
  </section>
</main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'semiconductor_quant_gate_connection_20260526.html'), html, 'utf8');

console.log('built semiconductor quant gate connection');
