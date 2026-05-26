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
    .filter((cells) => cells.some((cellValue) => String(cellValue ?? '').trim() !== ''))
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

function normalizeAction(text) {
  return String(text ?? '')
    .replaceAll('購入検討', '開始可否確認')
    .replaceAll('購入対象', '開始可否確認対象')
    .replaceAll('買い', '投入')
    .replaceAll('買う', '投入する');
}

function scoreNumber(value) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const marketEvents = readCsv('284_june_market_event_gates.csv');
const candidateActions = readCsv('286_june_candidate_action_matrix.csv');
const plus1Rows = readCsv('310_candidate_plus1_gate.csv');
const completionRows = readCsv('339_candidate_data_completion_matrix.csv');
const eventDbRows = readCsv('344_event_type_reaction_database.csv');
const eventSummaryRows = readCsv('343_event_type_reaction_db_summary.csv');

const plus1ByTicker = new Map(plus1Rows.map((row) => [row.ticker, row]));
const completionByTicker = new Map(completionRows.map((row) => [row.ticker, row]));

const candidates = candidateActions.map((row) => {
  const plus1 = plus1ByTicker.get(row.ticker) || {};
  const completion = completionByTicker.get(row.ticker) || {};
  const completionScore = scoreNumber(completion.completion_score);
  const confidence = scoreNumber(plus1.data_confidence ?? completion.data_confidence);
  const hardGate = plus1.hard_gate || '未接続';
  const plus1Status = plus1.plus1_status || completion.plus1_status || '未接続';
  let preRole = '保留';
  if (row.current_status === '予備') {
    preRole = '予備確認対象';
  } else if (String(plus1Status).includes('有力') && completionScore !== null && completionScore >= 80 && confidence !== null && confidence >= 85) {
    preRole = '主確認対象';
  } else if (String(plus1Status).includes('通過')) {
    preRole = '追加確認対象';
  } else if (String(plus1Status).includes('指数優位')) {
    preRole = '個別株比率を下げる確認対象';
  } else if (row.current_status === '残す') {
    preRole = '追加確認対象';
  }
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sector: plus1.sector || completion.sector || '',
    current_status: row.current_status,
    pre_test_role: preRole,
    nisa_score: plus1.nisa_score || completion.nisa_score || '',
    data_confidence: plus1.data_confidence || completion.data_confidence || '',
    completion_score: completion.completion_score || '',
    plus1_status: plus1Status,
    plus1_excess_pct: plus1.excess_vs_plus1_target_pct || '',
    hard_gate: hardGate,
    remaining_gaps: completion.remaining_gaps || '',
    june_first_check: row.first_action || '共通市場ゲート通過後に個別ゲートを確認',
    pass_condition: '共通市場ゲート通過、データ信頼度70点以上、+1%比較で指数優位ではない、停止条件なし',
    caution_condition: '決算後20営業日未到達、イベント後リターン未接続、業種補正不足、過熱・下落率の警戒が残る',
    fail_condition: '共通市場ゲート停止、下方修正、会計・流動性リスク、+1%比較で指数優位が明確',
    record_status: '6月イベント後に実績入力',
  };
});

const forwardEvents = marketEvents.map((row, index) => ({
  updated_at: generatedAt,
  event_no: index + 1,
  date: row.date,
  event: row.event,
  source: row.source,
  source_url: row.source_url,
  check_items: row.check,
  proceed_condition: row.proceed,
  caution_condition: row.caution,
  stop_condition: row.stop,
  planned_action: normalizeAction(row.action),
  actual_value_input: '未入力',
  gate_result: '未判定',
  record_points: 'イベント当日、1営業日後、5営業日後、20営業日後',
  next_record: '実績値が出たら入力し、候補別チェックへ接続',
}));

const resultTemplate = [];
for (const candidate of candidates) {
  for (const event of marketEvents) {
    resultTemplate.push({
      updated_at: generatedAt,
      ticker: candidate.ticker,
      company: candidate.company,
      event_date: event.date,
      event: event.event,
      before_event_price: '',
      event_day_price: '',
      return_1d_pct: '',
      return_5d_pct: '',
      return_20d_pct: '',
      benchmark_return_1d_pct: '',
      benchmark_return_5d_pct: '',
      benchmark_return_20d_pct: '',
      excess_1d_pct: '',
      excess_5d_pct: '',
      excess_20d_pct: '',
      pre_event_prediction: '',
      actual_result: '',
      prediction_error_note: '',
      next_model_fix: '',
    });
  }
}

const eventReturnReady = eventDbRows.filter((row) => String(row.evidence_level).startsWith('A')).length;
const eventGapCount = eventDbRows.length - eventReturnReady;
const mainCandidates = candidates.filter((row) => row.pre_test_role === '主確認対象').length;
const addCandidates = candidates.filter((row) => row.pre_test_role === '追加確認対象').length;
const reserveCandidates = candidates.filter((row) => row.pre_test_role === '予備確認対象').length;

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '6月イベント監視',
    value: `${forwardEvents.length}件`,
    interpretation: 'CPI、日銀、FOMC、一次判定週を事前ルールと実績入力欄に接続。',
  },
  {
    updated_at: generatedAt,
    item: '候補銘柄',
    value: `${candidates.length}社`,
    interpretation: `主確認対象${mainCandidates}社、追加確認対象${addCandidates}社、予備確認対象${reserveCandidates}社として扱う。`,
  },
  {
    updated_at: generatedAt,
    item: 'イベント実績入力',
    value: '0件',
    interpretation: '5月時点では未来イベントのため未入力。6月の実績値で上書きする。',
  },
  {
    updated_at: generatedAt,
    item: '株価反応DB',
    value: `${eventReturnReady}種類接続済み / ${eventGapCount}種類未接続`,
    interpretation: '反応DBがないイベントは候補発見まで。本体スコアには直接混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '現在の判定',
    value: '未判定',
    interpretation: '6月イベント後に市場ゲート、候補別ゲート、+1%比較、予実差を順に記録する。',
  },
];

const decisionRules = [
  {
    rule_id: 'R1',
    gate: '未来イベント未入力',
    condition: 'CPI、日銀、FOMCなどの実績値がまだ入っていない',
    action: '開始可否を確定しない',
    reason: '事前仮説と実績を混ぜると、判断したふりになるため。',
  },
  {
    rule_id: 'R2',
    gate: '市場ゲート',
    condition: '米金利急騰、円高ショック、NASDAQ/SOX急落、日経75日線割れが停止条件に該当',
    action: '個別株比率を下げる、または候補維持に戻す',
    reason: '個別銘柄の数字が良くても、地合い悪化で1年保有の初期損失が大きくなるため。',
  },
  {
    rule_id: 'R3',
    gate: '候補別ゲート',
    condition: 'データ信頼度70点未満、決算後20営業日反応未到達、下方修正、会計・流動性リスク',
    action: '開始可否確認へ進めず、追加確認対象または保留に戻す',
    reason: '不足データを点数に混ぜず、説明可能性を守るため。',
  },
  {
    rule_id: 'R4',
    gate: '+1%比較',
    condition: '候補の1年騰落率または期待値がS&P500/日経平均等の比較対象+1%を下回る',
    action: '個別株比率を下げる',
    reason: '既存の無難な運用を上回る目的に合わないため。',
  },
  {
    rule_id: 'R5',
    gate: 'イベント仮説',
    condition: 'TOB、自社株買い、新商品などの分類はあるが、株価反応DBと未結合',
    action: '候補発見までに限定し、本体スコアへ直接加点しない',
    reason: 'イベント名だけの単純加点を避けるため。',
  },
  {
    rule_id: 'R6',
    gate: '予実差記録',
    condition: 'イベント後1/5/20営業日の実績リターンが出た',
    action: '予測、実績、誤差、修正点を記録する',
    reason: 'モデルが外れた理由を残し、次回の重みや停止条件を修正するため。',
  },
];

const sources = [
  {
    source_name: '6月市場イベントゲート',
    file: '284_june_market_event_gates.csv',
    use: 'CPI、日銀、FOMC、一次判定週のチェック条件',
    status: '接続済み',
  },
  {
    source_name: '候補別6月アクション表',
    file: '286_june_candidate_action_matrix.csv',
    use: '候補10社の6月シナリオと初回確認',
    status: '接続済み',
  },
  {
    source_name: '+1%比較ゲート',
    file: '310_candidate_plus1_gate.csv',
    use: 'S&P500/日経平均等を+1%上回る目的との接続',
    status: '接続済み',
  },
  {
    source_name: '候補10社データ補完表',
    file: '339_candidate_data_completion_matrix.csv',
    use: 'データ信頼度、未接続項目、候補別の残課題',
    status: '接続済み',
  },
  {
    source_name: 'イベント種類別反応DB',
    file: '344_event_type_reaction_database.csv',
    use: 'イベントを本体スコアへ混ぜてよいかの判定',
    status: '接続済み',
  },
  {
    source_name: '今後の手入力',
    file: '352_forward_test_result_template.csv',
    use: 'イベント後1/5/20営業日の価格反応、指数超過、予実差',
    status: '6月以降入力',
  },
];

writeCsv('348_forward_test_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('349_forward_event_input_log.csv', forwardEvents, [
  'updated_at',
  'event_no',
  'date',
  'event',
  'source',
  'source_url',
  'check_items',
  'proceed_condition',
  'caution_condition',
  'stop_condition',
  'planned_action',
  'actual_value_input',
  'gate_result',
  'record_points',
  'next_record',
]);
writeCsv('350_forward_candidate_checklist.csv', candidates, [
  'updated_at',
  'ticker',
  'company',
  'sector',
  'current_status',
  'pre_test_role',
  'nisa_score',
  'data_confidence',
  'completion_score',
  'plus1_status',
  'plus1_excess_pct',
  'hard_gate',
  'remaining_gaps',
  'june_first_check',
  'pass_condition',
  'caution_condition',
  'fail_condition',
  'record_status',
]);
writeCsv('351_forward_decision_rules.csv', decisionRules, ['rule_id', 'gate', 'condition', 'action', 'reason']);
writeCsv('352_forward_test_result_template.csv', resultTemplate, [
  'updated_at',
  'ticker',
  'company',
  'event_date',
  'event',
  'before_event_price',
  'event_day_price',
  'return_1d_pct',
  'return_5d_pct',
  'return_20d_pct',
  'benchmark_return_1d_pct',
  'benchmark_return_5d_pct',
  'benchmark_return_20d_pct',
  'excess_1d_pct',
  'excess_5d_pct',
  'excess_20d_pct',
  'pre_event_prediction',
  'actual_result',
  'prediction_error_note',
  'next_model_fix',
]);
writeCsv('353_forward_test_sources.csv', sources, ['source_name', 'file', 'use', 'status']);

const summaryCards = summaryRows.map((row) => `
      <div class="kpi">
        <span>${esc(row.item)}</span>
        <b>${esc(row.value)}</b>
        <small>${esc(row.interpretation)}</small>
      </div>
`).join('');

const flowSteps = [
  ['1', '事前ルール', 'CPI・日銀・FOMCの条件を固定'],
  ['2', '実績入力', '発表後の数値・金利・為替・指数を入力'],
  ['3', '市場ゲート', '全体地合いが悪ければ候補維持へ戻す'],
  ['4', '候補別ゲート', '未接続、下方修正、過熱を確認'],
  ['5', '+1%比較', '指数・投信を上回る目的に合うか確認'],
  ['6', '予実差記録', '1/5/20営業日後に誤差を残す'],
];

const flowHtml = flowSteps.map((step, index) => `
        <div class="flow-step">
          <strong>${esc(step[0])}. ${esc(step[1])}</strong>
          <span>${esc(step[2])}</span>
        </div>
        ${index < flowSteps.length - 1 ? '<div class="arrow">→</div>' : ''}
`).join('');

function badge(text) {
  const t = String(text ?? '');
  let cls = 'mid';
  if (t.includes('主確認')) cls = 'ok';
  if (t.includes('下げる') || t.includes('保留')) cls = 'warn';
  if (t.includes('未判定') || t.includes('未入力')) cls = 'neutral';
  return `<span class="badge ${cls}">${esc(t)}</span>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月 前向きテスト記録台帳 2026年5月26日</title>
  <style>
    :root {
      --ink:#071f36;
      --muted:#49657f;
      --blue:#0b5d92;
      --light:#eef6fd;
      --line:#c9dceb;
      --ok:#057a55;
      --warn:#b76b00;
      --stop:#b42318;
      --bg:#f7fbff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      font-size: 15px;
    }
    header {
      background: linear-gradient(135deg, #07375e, #0c6b96);
      color: #fff;
      padding: 30px 24px;
    }
    main { max-width: 1220px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 {
      margin: 28px 0 12px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 22px;
    }
    p { margin: 8px 0; }
    .lead, .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top: 14px; }
    .button {
      display:inline-block;
      padding:8px 12px;
      border:1px solid #9fc1db;
      border-radius:8px;
      background:#fff;
      color:#07375e;
      text-decoration:none;
      font-weight:700;
    }
    .kpis {
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background:#fff;
      border:1px solid var(--line);
      border-radius:10px;
      padding:14px;
      min-height: 132px;
    }
    .kpi span { display:block; color:var(--muted); font-weight:700; }
    .kpi b { display:block; font-size:28px; color:#06456f; margin:4px 0; }
    .kpi small { display:block; color:#17324a; line-height:1.55; }
    .flow {
      display:grid;
      grid-template-columns: repeat(11, auto);
      align-items: stretch;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .flow-step {
      min-width: 150px;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }
    .flow-step strong { display:block; color:#07375e; }
    .flow-step span { display:block; color:#17324a; font-size: 13px; line-height:1.55; }
    .arrow {
      display:flex;
      align-items:center;
      justify-content:center;
      color:#0b5d92;
      font-size:24px;
      font-weight:900;
    }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; background:#fff; }
    table { width:100%; border-collapse:collapse; min-width: 980px; }
    th, td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    th { background:#e6f2fb; color:#06385d; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .badge { display:inline-block; padding:4px 8px; border-radius:999px; font-weight:700; white-space:nowrap; }
    .badge.ok { background:#e8f7ef; color:var(--ok); }
    .badge.mid { background:#eef6fd; color:#0b5d92; }
    .badge.warn { background:#fff4df; color:var(--warn); }
    .badge.neutral { background:#edf0f3; color:#293847; }
    .note { color:var(--muted); font-size:13px; }
    .warn-box {
      border-left: 7px solid var(--warn);
      background: #fff9ed;
      padding: 14px;
      border-radius: 8px;
      margin-top: 12px;
    }
    @media (max-width: 760px) {
      main { padding: 14px; }
      header { padding: 22px 16px; }
      h1 { font-size: 24px; }
      .flow { grid-template-columns: 1fr; }
      .arrow { transform: rotate(90deg); }
      table { min-width: 860px; }
    }
    @media print {
      body { background:#fff; font-size: 13px; }
      header { background:#07375e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card, .lead, .kpi { box-shadow:none; }
      h2, .card, .lead, .kpis, .table-wrap { break-inside: avoid; page-break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
<header>
  <h1>6月 前向きテスト記録台帳</h1>
  <p>5月時点の仮説を、6月の実績値・候補別ゲート・+1%比較・予実差記録へつなぐための運用ページです。</p>
</header>
<main>
  <section class="lead">
    <p><b>目的:</b> 6月のCPI、日銀、FOMCなどの結果が出た後に、事前条件と実績値を照合し、候補10社を同じ手順で再判定します。</p>
    <p><b>重要:</b> このページは、5月時点で結論を出すためのものではありません。未来イベントの実績値はまだ未入力なので、現段階の扱いは「事前ルール登録済み・未判定」です。</p>
    <div class="toolbar">
      <a class="button" href="348_forward_test_summary.csv">348 要約CSV</a>
      <a class="button" href="349_forward_event_input_log.csv">349 イベント入力CSV</a>
      <a class="button" href="350_forward_candidate_checklist.csv">350 候補別チェックCSV</a>
      <a class="button" href="351_forward_decision_rules.csv">351 判定ルールCSV</a>
      <a class="button" href="352_forward_test_result_template.csv">352 予実差テンプレートCSV</a>
      <a class="button" href="event_type_reaction_db_20260526.html">イベント種類別反応DBへ</a>
      <a class="button" href="candidate_data_completion_20260526.html">候補10社データ補完へ</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </section>

  <section class="kpis">
    ${summaryCards}
  </section>

  <h2>運用フロー</h2>
  <section class="card">
    <div class="flow">
      ${flowHtml}
    </div>
    <div class="warn-box">
      <b>混ぜてはいけないもの:</b> ニュースやイベント名だけの仮説は、候補発見には使えます。ただし、株価反応DBや決算・株価・+1%比較で確認するまで、本体スコアへ直接足しません。
    </div>
  </section>

  <h2>6月イベント入力欄</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>日付</th><th>イベント</th><th>見る数値</th><th>進める条件</th><th>注意条件</th><th>停止条件</th><th>実績入力</th><th>判定</th></tr></thead>
      <tbody>
        ${forwardEvents.map((row) => `
          <tr>
            <td>${esc(row.date)}</td>
            <td><b>${esc(row.event)}</b><br><span class="note">${esc(row.source)}</span></td>
            <td>${esc(row.check_items)}</td>
            <td>${esc(row.proceed_condition)}</td>
            <td>${esc(row.caution_condition)}</td>
            <td>${esc(row.stop_condition)}</td>
            <td>${badge(row.actual_value_input)}</td>
            <td>${badge(row.gate_result)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>候補10社への接続</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>銘柄</th><th>役割</th><th>NISAスコア</th><th>信頼度</th><th>補完度</th><th>+1%比較</th><th>残課題</th><th>6月の確認</th></tr></thead>
      <tbody>
        ${candidates.map((row) => `
          <tr>
            <td><b>${esc(row.ticker)}</b><br>${esc(row.company)}<br><span class="note">${esc(row.sector)}</span></td>
            <td>${badge(row.pre_test_role)}</td>
            <td>${esc(row.nisa_score)}</td>
            <td>${esc(row.data_confidence)}</td>
            <td>${esc(row.completion_score)}</td>
            <td>${esc(row.plus1_status)}<br><span class="note">+1%差: ${esc(row.plus1_excess_pct)}%</span></td>
            <td>${esc(row.remaining_gaps || 'なし')}</td>
            <td>${esc(row.june_first_check)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>判定ルール</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>ルール</th><th>ゲート</th><th>条件</th><th>対応</th><th>理由</th></tr></thead>
      <tbody>
        ${decisionRules.map((row) => `
          <tr>
            <td>${esc(row.rule_id)}</td>
            <td><b>${esc(row.gate)}</b></td>
            <td>${esc(row.condition)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>予実差記録</h2>
  <section class="card">
    <p>6月イベント後は、各候補についてイベント前価格、イベント当日、1営業日後、5営業日後、20営業日後のリターンと、指数超過リターンを記録します。</p>
    <p>記録先は <b>352_forward_test_result_template.csv</b> です。予測と実績の差を残し、外れた理由を次のモデル修正へ回します。</p>
  </section>

  <h2>接続元データ</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>データ</th><th>ファイル</th><th>用途</th><th>状態</th></tr></thead>
      <tbody>
        ${sources.map((row) => `
          <tr>
            <td>${esc(row.source_name)}</td>
            <td>${esc(row.file)}</td>
            <td>${esc(row.use)}</td>
            <td>${badge(row.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <p class="note">更新日時: ${esc(generatedAt)}</p>
</main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'june_forward_test_record_20260526.html'), html, 'utf8');

console.log(`generated june forward test record: ${forwardEvents.length} events, ${candidates.length} candidates, ${resultTemplate.length} template rows`);
