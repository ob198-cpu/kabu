import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FILES = {
  candidates: '280_nisa_test_10_candidate_plan_reaction_updated.csv',
  eventReturnDetail: '37_event_return_detail.csv',
  eventReturnSummary: '38_event_return_summary.csv',
  tdnetClassification: '39_tdnet_action_classification.csv',
  compositeSignal: '92_composite_condition_signal.csv',
  plus1Gate: '310_candidate_plus1_gate.csv',
};

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

function readCsv(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, 'utf8'));
}

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  const nums = values.filter((value) => value !== null && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${round(value, 2)}%`;
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

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || '未分類';
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function validationLevel(recordCount, hasReturn) {
  if (!hasReturn) return recordCount >= 10 ? '分類のみ' : '分類少数';
  if (recordCount >= 30) return '統計参考';
  if (recordCount >= 8) return '暫定参考';
  return '件数不足';
}

function signalPriority(row) {
  const signal = row?.signal || '';
  const edge = numericValue(row?.best_edge_vs_baseline_3m_pct) ?? -999;
  if (signal.includes('改善候補')) return 1000 + edge;
  if (signal.includes('参考')) return 500 + edge;
  return edge;
}

function chooseComposite(rows) {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => signalPriority(b) - signalPriority(a))[0];
}

function hardGateText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === 'なし') return '';
  return text;
}

function decisionFor(row, eventSummary, composite, plus1) {
  const hardGate = hardGateText(row.hard_gate);
  const eventCount = numericValue(eventSummary?.event_count_calculated) ?? 0;
  const hasComposite = Boolean(composite);
  const plus1Status = plus1?.plus1_status || '';
  if (hardGate) return '保留: ゲート残存';
  if (eventCount >= 4 && hasComposite && plus1Status.includes('有力')) return '検証優先';
  if (eventCount >= 4 || hasComposite) return '追加検証';
  return '根拠不足';
}

const candidates = readCsv(FILES.candidates).slice(0, 10);
const eventReturnDetail = readCsv(FILES.eventReturnDetail);
const eventReturnSummary = readCsv(FILES.eventReturnSummary);
const tdnetClassification = readCsv(FILES.tdnetClassification);
const compositeSignal = readCsv(FILES.compositeSignal);
const plus1Gate = readCsv(FILES.plus1Gate);

const eventSummaryByTicker = new Map(eventReturnSummary.map((row) => [row.ticker, row]));
const compositeByTicker = groupBy(compositeSignal, 'ticker');
const plus1ByTicker = new Map(plus1Gate.map((row) => [row.ticker, row]));

const returnTypeRows = [...groupBy(eventReturnDetail, 'event_type').entries()].map(([eventType, rows]) => ({
  updated_at: generatedAt,
  event_type: eventType,
  source_layer: '株価反応接続済み',
  event_record_count: rows.length,
  return_record_count: rows.length,
  avg_excess_1d_pct: round(mean(rows.map((row) => numericValue(row.excess_1d_pct))), 2),
  avg_excess_5d_pct: round(mean(rows.map((row) => numericValue(row.excess_5d_pct))), 2),
  avg_excess_20d_pct: round(mean(rows.map((row) => numericValue(row.excess_20d_pct))), 2),
  validation_level: validationLevel(rows.length, true),
  score_treatment: rows.length >= 8 ? '参考検証に使用。単独加点はしない。' : '件数不足。点数に混ぜない。',
}));

const tdnetTypeRows = [...groupBy(tdnetClassification, 'action_class').entries()].map(([eventType, rows]) => ({
  updated_at: generatedAt,
  event_type: eventType,
  source_layer: 'イベント分類のみ',
  event_record_count: rows.length,
  return_record_count: 0,
  avg_excess_1d_pct: '',
  avg_excess_5d_pct: '',
  avg_excess_20d_pct: '',
  validation_level: validationLevel(rows.length, false),
  score_treatment: '株価反応未接続。候補発見には使うが、購入検討用スコアには入れない。',
}));

const eventTypeRows = [...returnTypeRows, ...tdnetTypeRows]
  .sort((a, b) => String(a.source_layer).localeCompare(String(b.source_layer), 'ja') || Number(b.event_record_count) - Number(a.event_record_count));

const candidateRows = candidates.map((row) => {
  const eventSummary = eventSummaryByTicker.get(row.ticker);
  const composite = chooseComposite(compositeByTicker.get(row.ticker) || []);
  const plus1 = plus1ByTicker.get(row.ticker);
  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    nisa_score: row.nisa_score,
    plus1_status: plus1?.plus1_status || '未接続',
    event_return_records: eventSummary?.event_count_calculated || 0,
    event_avg_excess_5d_pct: eventSummary?.avg_excess_5d_pct || '',
    event_avg_excess_20d_pct: eventSummary?.avg_excess_20d_pct || '',
    composite_signal: composite?.signal || '未接続',
    composite_condition: composite?.best_condition_label || '',
    composite_observations: composite?.best_observations || '',
    composite_win_rate_3m_pct: composite?.best_win_rate_3m_pct || '',
    composite_avg_return_3m_pct: composite?.best_avg_return_3m_pct || '',
    composite_edge_3m_pct: composite?.best_edge_vs_baseline_3m_pct || '',
    hard_gate: row.hard_gate || '',
    causality_status: decisionFor(row, eventSummary, composite, plus1),
    treatment: decisionFor(row, eventSummary, composite, plus1) === '検証優先'
      ? '複数根拠あり。ただし売買判断ではなく6月テスト候補の優先度。'
      : '不足またはゲートあり。購入検討用スコアには混ぜない。',
  };
});

const ruleRows = [
  {
    rule_id: 'C01',
    rule: '単独イベント加点禁止',
    reason: 'イベントが起きたことと株価上昇は別。イベント名だけで点数に足すと誤判定になる。',
    pass_condition: 'イベント後リターン、指数超過、複合条件、ゲートを別々に確認。',
  },
  {
    rule_id: 'C02',
    rule: '指数影響を分ける',
    reason: '相場全体が上がっただけの可能性を除くため。',
    pass_condition: '1日/5日/20日の対日経平均超過リターンを見る。',
  },
  {
    rule_id: 'C03',
    rule: '複合条件で見る',
    reason: '業界統計、個別株トレンド、市場地合いが同時にそろうかで、単独条件の弱さを補正する。',
    pass_condition: '業界・個別・市場の条件が記録され、観測数も表示されている。',
  },
  {
    rule_id: 'C04',
    rule: '分類のみイベントは購入検討へ使わない',
    reason: 'TDnet分類だけでは、株価反応が確認されていない。',
    pass_condition: '候補発見には使うが、スコアには入れない。',
  },
  {
    rule_id: 'C05',
    rule: 'ゲート優先',
    reason: '良いイベントや強い過去反応があっても、決算未到達、過熱、データ不足があれば止める。',
    pass_condition: 'hard_gate が空欄または「なし」であること。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '株価反応接続済みイベント種類',
    value: `${returnTypeRows.length}種類`,
    interpretation: '現状は主に日銀イベント。TOB、新商品、M&A等の長期反応DBは未完成。',
  },
  {
    updated_at: generatedAt,
    item: 'TDnet分類済みイベント種類',
    value: `${tdnetTypeRows.length}種類`,
    interpretation: '自社株買い、増配、M&A等は分類できるが、株価反応とは未接続。',
  },
  {
    updated_at: generatedAt,
    item: '候補10社の複合条件接続',
    value: `${candidateRows.filter((row) => row.composite_signal !== '未接続').length}社`,
    interpretation: '業界統計・個別株トレンド・市場トレンドの接続状況。',
  },
  {
    updated_at: generatedAt,
    item: '検証優先',
    value: `${candidateRows.filter((row) => row.causality_status === '検証優先').length}社`,
    interpretation: '複数根拠があり、かつゲートが残っていない候補。購入判断ではない。',
  },
];

const nextRows = [
  {
    priority: 1,
    action: 'TOB・上方修正・自社株買い・新商品・M&Aのイベント後リターンDBを作る',
    reason: '分類だけでは株価への実績影響がわからない。',
    output: 'イベント種類別1/5/20/60日超過リターン',
  },
  {
    priority: 2,
    action: '候補10社に複合条件を接続する',
    reason: 'イベント仮説、業界統計、個別株トレンド、市場地合いを同じ表で見られるようにする。',
    output: '候補別イベント・複合条件チェック表',
  },
  {
    priority: 3,
    action: 'イベント仮説を点数ではなくゲートにする',
    reason: '仮説を直接加点すると、また単純足し算モデルになる。',
    output: '仮説S/A/B/C、実績S/A/B/C、量的スコアの三段階判定',
  },
];

writeCsv('313_event_causality_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('314_event_type_evidence_status.csv', eventTypeRows, [
  'updated_at',
  'event_type',
  'source_layer',
  'event_record_count',
  'return_record_count',
  'avg_excess_1d_pct',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'validation_level',
  'score_treatment',
]);

writeCsv('315_candidate_causality_gate.csv', candidateRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'nisa_score',
  'plus1_status',
  'event_return_records',
  'event_avg_excess_5d_pct',
  'event_avg_excess_20d_pct',
  'composite_signal',
  'composite_condition',
  'composite_observations',
  'composite_win_rate_3m_pct',
  'composite_avg_return_3m_pct',
  'composite_edge_3m_pct',
  'hard_gate',
  'causality_status',
  'treatment',
]);

writeCsv('316_causality_guard_rules.csv', ruleRows, [
  'rule_id',
  'rule',
  'reason',
  'pass_condition',
]);

writeCsv('317_causality_next_actions.csv', nextRows, [
  'priority',
  'action',
  'reason',
  'output',
]);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>イベント因果・複合条件チェック 2026年5月25日</title>
  <style>
    :root {
      --ink: #111;
      --blue: #073a5a;
      --line: #bed3e5;
      --bg: #f5f8fb;
      --card: #fff;
      --ok: #eaf7ef;
      --warn: #fff5df;
      --stop: #fdecec;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", Meiryo, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-block;
      padding: 8px 12px;
      border: 1px solid #9fc1db;
      border-radius: 8px;
      background: #fff;
      color: var(--blue);
      text-decoration: none;
      font-weight: 700;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
    }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; font-size: 25px; color: var(--blue); }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .flow div {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      min-height: 86px;
    }
    .flow b { color: var(--blue); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      overflow-wrap: anywhere;
      color: #111;
    }
    th { background: #e4f1fa; color: var(--blue); }
    .badge {
      display: inline-block;
      min-width: 90px;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 12px;
    }
    .ok { background: var(--ok); color: #007a3d; }
    .warn { background: var(--warn); color: #8a5200; }
    .stop { background: var(--stop); color: #b00020; }
    .note { color: #333; font-size: 13px; }
    @media (max-width: 900px) { .kpis, .flow { grid-template-columns: 1fr; } }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi, .flow div { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>イベント因果・複合条件チェック</h1>
  <div class="lead">
    <p><b>目的:</b> 「イベントがあったから株価が上がる」と決めつけないため、イベント分類、イベント後リターン、指数超過、業界統計、個別株トレンド、市場地合いを分けて確認します。</p>
    <p><b>重要:</b> これは因果証明ではありません。現段階では、仮説を直接点数に足さず、購入検討用スコアへ混ぜる前のゲートとして扱います。</p>
    <div class="toolbar">
      <a class="button" href="313_event_causality_summary.csv">313 要約CSV</a>
      <a class="button" href="314_event_type_evidence_status.csv">314 イベント種類CSV</a>
      <a class="button" href="315_candidate_causality_gate.csv">315 候補別CSV</a>
      <a class="button" href="316_causality_guard_rules.csv">316 ルールCSV</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
    <div class="flow">
      <div><b>1. 仮説</b><br>戦争、TOB、新商品などの材料を仮説にする。</div>
      <div><b>2. 公式確認</b><br>TDnet、IR、公式資料で確認する。</div>
      <div><b>3. 反応確認</b><br>1/5/20日後の対指数超過を確認する。</div>
      <div><b>4. 複合条件</b><br>業界・個別・市場がそろうかを見る。</div>
      <div><b>5. ゲート</b><br>不足や過熱があれば点数に混ぜない。</div>
    </div>
  </div>

  <div class="kpis">
    ${summaryRows.map((row) => `
      <div class="kpi">
        <small>${esc(row.item)}</small>
        <b>${esc(row.value)}</b>
        <span>${esc(row.interpretation)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. イベント種類別の証拠状況</h2>
  <div class="card">
    <p class="note">「分類のみ」は、ニュースや開示を整理しただけです。株価反応と接続されるまで、購入検討用スコアには入れません。</p>
    <table>
      <thead><tr><th>イベント種類</th><th>レイヤー</th><th>件数</th><th>反応件数</th><th>5日超過</th><th>20日超過</th><th>検証度</th><th>扱い</th></tr></thead>
      <tbody>
        ${eventTypeRows.map((row) => `
          <tr>
            <td>${esc(row.event_type)}</td>
            <td>${esc(row.source_layer)}</td>
            <td>${esc(row.event_record_count)}</td>
            <td>${esc(row.return_record_count)}</td>
            <td>${pct(numericValue(row.avg_excess_5d_pct))}</td>
            <td>${pct(numericValue(row.avg_excess_20d_pct))}</td>
            <td><span class="badge ${row.validation_level.includes('統計') || row.validation_level.includes('暫定') ? 'warn' : 'stop'}">${esc(row.validation_level)}</span></td>
            <td>${esc(row.score_treatment)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 候補10社の因果ゲート</h2>
  <div class="card">
    <table>
      <thead><tr><th>順位</th><th>銘柄</th><th>+1%状態</th><th>イベント反応</th><th>複合条件</th><th>観測数</th><th>3か月平均との差</th><th>ゲート</th><th>扱い</th></tr></thead>
      <tbody>
        ${candidateRows.map((row) => `
          <tr>
            <td>${esc(row.rank)}</td>
            <td>${esc(row.ticker)} ${esc(row.company)}</td>
            <td>${esc(row.plus1_status)}</td>
            <td>${esc(row.event_return_records)}件 / 5日 ${pct(numericValue(row.event_avg_excess_5d_pct))} / 20日 ${pct(numericValue(row.event_avg_excess_20d_pct))}</td>
            <td>${esc(row.composite_signal)}<br><span class="note">${esc(row.composite_condition)}</span></td>
            <td>${esc(row.composite_observations || '-')}</td>
            <td>${pct(numericValue(row.composite_edge_3m_pct))}</td>
            <td>${esc(row.hard_gate || 'なし')}</td>
            <td><span class="badge ${row.causality_status === '検証優先' ? 'ok' : row.causality_status.includes('保留') ? 'stop' : 'warn'}">${esc(row.causality_status)}</span><br>${esc(row.treatment)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 誤判定防止ルール</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:10%">ID</th><th style="width:22%">ルール</th><th>理由</th><th>通過条件</th></tr></thead>
      <tbody>
        ${ruleRows.map((row) => `
          <tr>
            <td>${esc(row.rule_id)}</td>
            <td>${esc(row.rule)}</td>
            <td>${esc(row.reason)}</td>
            <td>${esc(row.pass_condition)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>4. 次の作業</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:8%">優先</th><th style="width:30%">作業</th><th>理由</th><th style="width:24%">成果物</th></tr></thead>
      <tbody>
        ${nextRows.map((row) => `
          <tr>
            <td>${esc(row.priority)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.reason)}</td>
            <td>${esc(row.output)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'event_causality_validation_20260525.html'), html, 'utf8');

console.log('generated event_causality_validation_20260525.html');
