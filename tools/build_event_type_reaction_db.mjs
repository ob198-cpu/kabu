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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function numberValue(value) {
  const text = String(value ?? '').replaceAll(',', '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function rounded(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Math.round(value * 100) / 100;
}

function groupCount(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || '未分類';
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

const knownTypes = readCsv('268_known_stock_impact_event_types.csv');
const eventTypeBacktest = readCsv('307_event_type_backtest_summary.csv');
const eventReturnDetail = readCsv('37_event_return_detail.csv');
const tdnetClassified = readCsv('39_tdnet_action_classification.csv');
const candidateCausality = readCsv('315_candidate_causality_gate.csv');

const tdnetCounts = groupCount(tdnetClassified, 'original_group');
const backtestByType = new Map(eventTypeBacktest.map((row) => [row.event_type, row]));

const extraTypes = [
  {
    event_type: '決算短信/業績発表',
    impact_strength: 'S-A',
    typical_impact: '実績、会社予想、進捗率、ガイダンスで評価が変わる。',
    usable_for_nisa_1y: '高い',
    main_risk: '一過性要因と継続要因を取り違える。',
    score_use: '決算後反応と業績成長で正式反映',
  },
  {
    event_type: '月次業績',
    impact_strength: 'B-A',
    typical_impact: '小売、外食、不動産などで短期売上トレンドが見える。',
    usable_for_nisa_1y: '中',
    main_risk: '月次の季節性や一時要因に振られやすい。',
    score_use: '連続性を確認して補助指標にする',
  },
  {
    event_type: '株式分割',
    impact_strength: 'B',
    typical_impact: '流動性改善期待で買われる場合がある。',
    usable_for_nisa_1y: '低-中',
    main_risk: '企業価値そのものは変わらない。',
    score_use: '直接加点せず流動性確認に使う',
  },
];

const typeRows = [...knownTypes, ...extraTypes];

function tdnetEvidenceFor(eventType) {
  if (eventType.includes('TOB') || eventType.includes('買収')) return { count: tdnetCounts.get('M&A・資本提携') ?? 0, note: 'M&A・資本提携分類を代理。TOB/MBOだけの抽出は未分離。' };
  if (eventType.includes('上方修正') || eventType.includes('下方修正')) return { count: tdnetCounts.get('業績上方修正') ?? 0, note: '上方修正は分類済み。下方修正は追加分類が必要。' };
  if (eventType.includes('自社株買い') || eventType.includes('増配')) {
    const count = (tdnetCounts.get('自社株買い') ?? 0) + (tdnetCounts.get('配当・増配') ?? 0) + (tdnetCounts.get('減配') ?? 0);
    return { count, note: '自社株買い、配当・増配、減配を還元イベントとして集計。' };
  }
  if (eventType.includes('契約') || eventType.includes('提携')) return { count: tdnetCounts.get('M&A・資本提携') ?? 0, note: '提携分類を代理。大型契約/受注は未分離。' };
  if (eventType.includes('決算')) return { count: tdnetCounts.get('決算短信') ?? 0, note: 'TDnet決算短信分類を集計。株価反応結合は一部のみ。' };
  if (eventType.includes('月次')) return { count: tdnetCounts.get('月次') ?? 0, note: 'TDnet月次分類を集計。' };
  if (eventType.includes('株式分割')) return { count: tdnetCounts.get('株式分割') ?? 0, note: 'TDnet株式分割分類を集計。' };
  return { count: 0, note: 'TDnet分類は未接続。' };
}

function marketBacktestFor(eventType) {
  if (eventType.includes('金利') || eventType.includes('FOMC') || eventType.includes('日銀')) {
    const rows = ['FOMC', 'Monetary Policy Meeting']
      .map((type) => backtestByType.get(type))
      .filter(Boolean);
    const records = sum(rows.map((row) => numberValue(row.record_count) ?? 0));
    const weighted = (field) => {
      if (!records) return null;
      return sum(rows.map((row) => (numberValue(row.record_count) ?? 0) * (numberValue(row[field]) ?? 0))) / records;
    };
    return {
      count: records,
      avg1d: weighted('avg_excess_1d_pct'),
      avg5d: weighted('avg_excess_5d_pct'),
      avg20d: weighted('avg_excess_20d_pct'),
      note: 'FOMC 64件、日銀会合64件を接続済み。',
    };
  }
  const direct = backtestByType.get(eventType);
  if (!direct) return { count: 0, avg1d: null, avg5d: null, avg20d: null, note: 'イベント後リターンDBは未接続。' };
  return {
    count: numberValue(direct.record_count) ?? 0,
    avg1d: numberValue(direct.avg_excess_1d_pct),
    avg5d: numberValue(direct.avg_excess_5d_pct),
    avg20d: numberValue(direct.avg_excess_20d_pct),
    note: 'イベント後リターンDBに接続済み。',
  };
}

function evidenceLevel(returnCount, tdnetCount) {
  if (returnCount >= 30) return 'A: 株価反応DBあり';
  if (tdnetCount >= 10) return 'B: 分類DBあり・株価反応未結合';
  if (tdnetCount > 0) return 'C: 少数分類のみ';
  return 'D: 仮説/分類のみ';
}

function usablePolicy(level, eventType) {
  if (level.startsWith('A')) return '市場ゲート、セクター感応度、確認優先度に使用可。ただし銘柄固有判断には個別データを併用。';
  if (level.startsWith('B')) return '候補発見と確認優先度まで。株価反応を結合するまで本体スコアへ直接加点しない。';
  if (eventType.includes('CPI') || eventType.includes('為替') || eventType.includes('原油')) return 'マクロゲートとして手動/別系列で確認。銘柄点への直接加点はしない。';
  return '仮説発見のみ。量的データ、決算、株価反応で検証するまでスコアへ混ぜない。';
}

function nextAction(level, eventType) {
  if (level.startsWith('A')) return '候補10社への銘柄別感応度を増やす。FOMC/日銀以外のCPI・為替イベントを追加。';
  if (level.startsWith('B')) return 'TDnet分類済みイベントを株価時系列と結合し、1日/5日/20日超過リターンを計算。';
  if (eventType.includes('CPI') || eventType.includes('為替') || eventType.includes('原油')) return 'イベント日カレンダーと対象系列を作成し、株価時系列と結合。';
  return '公式イベント日、対象銘柄、比較指数を定義してから反応計算へ進める。';
}

const databaseRows = typeRows.map((type) => {
  const backtest = marketBacktestFor(type.event_type);
  const tdnet = tdnetEvidenceFor(type.event_type);
  const level = evidenceLevel(backtest.count, tdnet.count);
  return {
    updated_at: generatedAt,
    event_type: type.event_type,
    impact_strength: type.impact_strength,
    usable_for_nisa_1y: type.usable_for_nisa_1y,
    evidence_level: level,
    return_record_count: backtest.count,
    tdnet_classified_count: tdnet.count,
    avg_excess_1d_pct: rounded(backtest.avg1d),
    avg_excess_5d_pct: rounded(backtest.avg5d),
    avg_excess_20d_pct: rounded(backtest.avg20d),
    current_use: usablePolicy(level, type.event_type),
    next_action: nextAction(level, type.event_type),
    data_note: `${backtest.note} ${tdnet.note}`,
    score_use: type.score_use,
    main_risk: type.main_risk,
  };
});

const sourceRows = [
  {
    data_source: '37_event_return_detail.csv',
    records: eventReturnDetail.length,
    role: 'イベント日と株価を結合した明細。FOMC/日銀会合が中心。',
    current_limit: '企業イベントの株価反応はまだ少ない。',
  },
  {
    data_source: '307_event_type_backtest_summary.csv',
    records: eventTypeBacktest.length,
    role: 'イベント種別ごとの平均超過リターン。',
    current_limit: 'FOMC/日銀は統計参考、その他は件数不足。',
  },
  {
    data_source: '39_tdnet_action_classification.csv',
    records: tdnetClassified.length,
    role: 'TDnet直近開示をイベント分類した表。',
    current_limit: '分類済みだが、株価時系列との結合は未完了。',
  },
  {
    data_source: '268_known_stock_impact_event_types.csv',
    records: knownTypes.length,
    role: '株価に影響しやすいイベント種類の分類表。',
    current_limit: '分類は仮説であり、株価反応DBとの接続が必要。',
  },
  {
    data_source: '315_candidate_causality_gate.csv',
    records: candidateCausality.length,
    role: '候補10社へのイベント因果ゲート。',
    current_limit: '多くの銘柄はイベント後リターン/複合条件が未接続。',
  },
];

const gapRows = databaseRows
  .filter((row) => !row.evidence_level.startsWith('A'))
  .map((row) => ({
    updated_at: generatedAt,
    event_type: row.event_type,
    current_level: row.evidence_level,
    priority: row.evidence_level.startsWith('B') ? '高' : row.usable_for_nisa_1y.includes('高') ? '高' : '中',
    missing_work: row.next_action,
    score_policy: row.current_use,
  }));

const scorePolicyRows = [
  {
    rule: 'A: 株価反応DBあり',
    use: '市場ゲート・セクター感応度・確認優先度に使用可。',
    no_use: '銘柄固有の購入根拠として単独使用しない。',
  },
  {
    rule: 'B: 分類DBあり・株価反応未結合',
    use: '調査対象の優先順位、確認キュー、資料検索に使う。',
    no_use: '本体スコアへ直接加点しない。',
  },
  {
    rule: 'C: 少数分類のみ',
    use: '事例候補として保存し、件数を増やす。',
    no_use: '有利不利の結論にしない。',
  },
  {
    rule: 'D: 仮説/分類のみ',
    use: 'テーマ発見と仮説メモまで。',
    no_use: '購入検討用スコア、+1%期待値、勝率に混ぜない。',
  },
  {
    rule: 'イベントDBの合格ライン',
    use: '同一イベント種別で30件以上、かつ1日/5日/20日超過リターンを確認できる状態。',
    no_use: '30件未満の平均値を強い統計根拠として扱わない。',
  },
];

const returnReadyCount = databaseRows.filter((row) => row.evidence_level.startsWith('A')).length;
const tdnetReadyCount = databaseRows.filter((row) => row.evidence_level.startsWith('B')).length;
const totalReturnRecords = sum(databaseRows.map((row) => Number(row.return_record_count) || 0));
const totalTdnetClassified = sum([...tdnetCounts.values()]);

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '管理イベント種類',
    value: `${databaseRows.length}種類`,
    interpretation: '既知の株価影響イベント16種に、決算短信・月次・株式分割を追加。',
  },
  {
    updated_at: generatedAt,
    item: '株価反応DBあり',
    value: `${returnReadyCount}種類`,
    interpretation: '現時点で30件以上のイベント後リターンを持つイベント種別。',
  },
  {
    updated_at: generatedAt,
    item: '分類DBあり',
    value: `${tdnetReadyCount}種類`,
    interpretation: 'TDnet分類はあるが、株価反応との結合が必要なイベント種別。',
  },
  {
    updated_at: generatedAt,
    item: 'イベント後リターン明細',
    value: `${eventReturnDetail.length}件`,
    interpretation: `DB上の明細件数。重複用途を避けるため総合件数は${totalReturnRecords}件として管理。`,
  },
  {
    updated_at: generatedAt,
    item: 'TDnet分類済み',
    value: `${totalTdnetClassified}件`,
    interpretation: '企業イベントの分類母数。次工程で株価時系列と結合する。',
  },
  {
    updated_at: generatedAt,
    item: '未接続キュー',
    value: `${gapRows.length}件`,
    interpretation: '株価反応DBに上げるために追加作業が必要なイベント種別。',
  },
];

writeCsv('343_event_type_reaction_db_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('344_event_type_reaction_database.csv', databaseRows, [
  'updated_at',
  'event_type',
  'impact_strength',
  'usable_for_nisa_1y',
  'evidence_level',
  'return_record_count',
  'tdnet_classified_count',
  'avg_excess_1d_pct',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'current_use',
  'next_action',
  'data_note',
  'score_use',
  'main_risk',
]);

writeCsv('345_event_type_reaction_gap_queue.csv', gapRows, [
  'updated_at',
  'event_type',
  'current_level',
  'priority',
  'missing_work',
  'score_policy',
]);

writeCsv('346_event_type_score_policy.csv', scorePolicyRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'rule',
  'use',
  'no_use',
]);

writeCsv('347_event_type_reaction_sources.csv', sourceRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'data_source',
  'records',
  'role',
  'current_limit',
]);

const badgeClass = (level) => {
  if (String(level).startsWith('A')) return 'ok';
  if (String(level).startsWith('B')) return 'warn';
  return 'stop';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>イベント種類別 株価反応DB 2026年5月26日</title>
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
      color: var(--ink);
      background: var(--bg);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card, .kpi {
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
    .kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; color: var(--blue); font-size: 24px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      color: #111;
      overflow-wrap: anywhere;
    }
    th { background: #e4f1fa; color: var(--blue); }
    .badge {
      display: inline-block;
      min-width: 86px;
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
    @media (max-width: 1000px) { .kpis { grid-template-columns: 1fr; } }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>イベント種類別 株価反応DB</h1>
  <div class="lead">
    <p><b>目的:</b> TOB、自社株買い、上方修正、FOMC、日銀、CPIなど、株価に影響しやすいイベントを同じ基準で管理し、実績反応があるものと仮説段階のものを分けます。</p>
    <p><b>結論:</b> 現時点で株価反応DBとして使えるのは、FOMC・日銀会合を含む金利系イベントです。企業イベントはTDnet分類の母数はあるため、次は株価時系列と結合します。</p>
    <div class="toolbar">
      <a class="button" href="343_event_type_reaction_db_summary.csv">343 要約CSV</a>
      <a class="button" href="344_event_type_reaction_database.csv">344 イベントDB CSV</a>
      <a class="button" href="345_event_type_reaction_gap_queue.csv">345 未接続キューCSV</a>
      <a class="button" href="346_event_type_score_policy.csv">346 スコア方針CSV</a>
      <a class="button" href="347_event_type_reaction_sources.csv">347 取得元CSV</a>
      <a class="button" href="event_causality_validation_20260525.html">イベント因果チェックへ</a>
      <a class="button" href="candidate_data_completion_20260526.html">候補10社データ補完へ</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
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

  <h2>1. イベント種類別DB</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:18%">イベント種類</th><th style="width:9%">強度</th><th style="width:14%">現証拠</th><th style="width:9%">反応件数</th><th style="width:9%">TDnet分類</th><th style="width:9%">5日超過</th><th style="width:9%">20日超過</th><th>現在の使い方</th><th>次作業</th></tr></thead>
      <tbody>
        ${databaseRows.map((row) => `
          <tr>
            <td>${esc(row.event_type)}</td>
            <td>${esc(row.impact_strength)}</td>
            <td><span class="badge ${badgeClass(row.evidence_level)}">${esc(row.evidence_level)}</span></td>
            <td>${esc(row.return_record_count)}</td>
            <td>${esc(row.tdnet_classified_count)}</td>
            <td>${esc(row.avg_excess_5d_pct)}</td>
            <td>${esc(row.avg_excess_20d_pct)}</td>
            <td>${esc(row.current_use)}</td>
            <td>${esc(row.next_action)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 未接続キュー</h2>
  <div class="card">
    <p class="note">B以下は、イベント名だけで点数に足しません。株価反応DBへ上げるには、イベント日、対象銘柄、比較指数、1日/5日/20日超過リターンを結合します。</p>
    <table>
      <thead><tr><th style="width:20%">イベント種類</th><th style="width:18%">現在の段階</th><th style="width:8%">優先</th><th>足りない作業</th><th>スコア方針</th></tr></thead>
      <tbody>
        ${gapRows.map((row) => `
          <tr>
            <td>${esc(row.event_type)}</td>
            <td><span class="badge ${badgeClass(row.current_level)}">${esc(row.current_level)}</span></td>
            <td>${esc(row.priority)}</td>
            <td>${esc(row.missing_work)}</td>
            <td>${esc(row.score_policy)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. スコア方針と取得元</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:22%">段階</th><th>使う範囲</th><th>使わない範囲</th></tr></thead>
      <tbody>
        ${scorePolicyRows.map((row) => `
          <tr>
            <td><b>${esc(row.rule)}</b></td>
            <td>${esc(row.use)}</td>
            <td>${esc(row.no_use)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <table style="margin-top:14px">
      <thead><tr><th style="width:28%">取得元</th><th style="width:10%">件数</th><th>役割</th><th>限界</th></tr></thead>
      <tbody>
        ${sourceRows.map((row) => `
          <tr>
            <td>${esc(row.data_source)}</td>
            <td>${esc(row.records)}</td>
            <td>${esc(row.role)}</td>
            <td>${esc(row.current_limit)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'event_type_reaction_db_20260526.html'), cleanLines(html), 'utf8');

console.log(`generated event type reaction DB: ${databaseRows.length} event types, ${returnReadyCount} return-ready, ${gapRows.length} gaps`);
