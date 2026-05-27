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
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
}

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function gradeToNumber(grade) {
  if (grade === 'A') return 85;
  if (grade === 'B') return 70;
  if (grade === 'C') return 55;
  return 45;
}

function themeStrength(themes) {
  const text = themes || '';
  let score = 50;
  if (text.includes('AI半導体') || text.includes('HBM') || text.includes('データセンター')) score += 20;
  if (text.includes('金利') || text.includes('自社株買い') || text.includes('資本効率')) score += 15;
  if (text.includes('食品') || text.includes('円高') || text.includes('原油')) score += 10;
  if (text.includes('防衛') || text.includes('人手不足')) score += 10;
  return Math.min(score, 95);
}

function confidence(row, buffett) {
  let score = 55;
  if (['A', 'B'].includes(row.integrated_grade)) score += 15;
  if (row.priority === '最優先確認') score += 12;
  if (row.priority === '条件付き確認') score += 8;
  if (buffett.qualitative_gate === '確認条件') score += 4;
  if (buffett.qualitative_gate === '警戒条件') score -= 4;
  if (row.priority === 'データ補完') score -= 15;
  return Math.max(20, Math.min(95, score));
}

function selectionStatus(row, total) {
  if (total >= 78 && row.priority === '最優先確認') return 'テスト中心候補';
  if (total >= 70 && ['最優先確認', '条件付き確認'].includes(row.priority)) return '条件付きテスト候補';
  if (total >= 62) return '比較・観察候補';
  return '補完後に再判定';
}

function buyRule(status) {
  if (status === 'テスト中心候補') {
    return '6月イベント後に市場条件が悪化せず、公式決算・PER/PBR/ROE・決算後反応が確認できた場合だけ少額テストを検討。';
  }
  if (status === '条件付きテスト候補') {
    return '不足データ補完後、指数比較と同業比較で劣後しない場合だけ候補に残す。';
  }
  return '購入検討には使わず、比較・観察または補完対象として扱う。';
}

function sellRule(row, buffett) {
  const rules = [
    '決算後20営業日で日経平均/TOPIXに明確に劣後した場合は優先度を下げる。',
    '下方修正、利益率悪化、テーマ接続の否定が出た場合は中心候補から外す。',
    '購入後に-5%下落した場合は理由を確認し、指数連動か個別悪材料かを分類する。',
    '購入後に-10%下落し、かつ個別悪材料が確認された場合は縮小または撤退を検討する。',
  ];
  if (buffett.qualitative_gate === '警戒条件') {
    rules.push('バークシャー関連・同業関連で大幅売却や信用不安が出た場合は追加確認まで新規買いを止める。');
  }
  if (row.qualitative_themes.includes('AI半導体') || row.qualitative_themes.includes('HBM')) {
    rules.push('SOX指数や主要顧客投資計画が悪化した場合は半導体テーマの上限を下げる。');
  }
  return rules.join(' ');
}

const candidates = readCsv('590_candidate_10_final_checklist_detail.csv');
const buffettRows = readCsv('606_buffett_candidate10_bridge_detail.csv');
const buffettByTicker = new Map(buffettRows.map((row) => [row.ticker, row]));

const workflowRows = [
  {
    step: '1. 監視',
    input: 'AI半導体、金利、原油、TOB、バフェット売買、FRB/日銀、決算、新商品など',
    process: '出来事を登録し、対象業種・候補銘柄・確認数字・否定条件に分解する。',
    output: '質的監視イベント',
    decision: 'この段階では買い判断に使わない',
  },
  {
    step: '2. 仮説',
    input: '監視イベント',
    process: '需要連鎖を作る。例: AI投資増 -> HBM需要 -> 電子部品/検査/材料需要。',
    output: '銘柄別の追い風・逆風仮説',
    decision: '仮説は点数へ直接足さない',
  },
  {
    step: '3. 検証',
    input: '売上、受注、利益率、PER/PBR/ROE、決算後反応、指数比較',
    process: 'イベントスタディに近い形で、日経平均/TOPIXを引いた超過反応を確認する。',
    output: '通過、保留、除外',
    decision: '数字に出ない仮説は落とす',
  },
  {
    step: '4. 銘柄選出',
    input: '量的評価、質的確認、警戒条件、データ信頼度',
    process: '量的評価を主、質的評価を補助として統合する。未取得データは点数に混ぜない。',
    output: 'テスト候補、比較候補、補完対象',
    decision: '10社候補へ分類',
  },
  {
    step: '5. 売買ルール',
    input: '分類結果、6月イベント結果、最新決算',
    process: '買う条件、待つ条件、下げる条件、撤退条件を銘柄別に作る。',
    output: '売買ルール',
    decision: '購入可否は6月イベント後に再判定',
  },
  {
    step: '6. 運用記録',
    input: '予測、実績、下落理由、イベント結果',
    process: '予測と実績の差を記録し、モデルの重みと除外条件を修正する。',
    output: '改善ログ',
    decision: '次回候補選定へ反映',
  },
];

const selectionRows = candidates.map((row) => {
  const buffett = buffettByTicker.get(row.ticker) || { qualitative_gate: '対象外', buffett_relation: '対象外' };
  const quant = Number(row.quantitative_score || 0);
  const theme = themeStrength(row.qualitative_themes);
  const conf = confidence(row, buffett);
  const qualGate = buffett.qualitative_gate === '警戒条件' ? -5 : buffett.qualitative_gate === '確認条件' ? 3 : 0;
  const baseGrade = gradeToNumber(row.integrated_grade);
  const total = Math.round((quant * 0.55 + baseGrade * 0.15 + theme * 0.15 + conf * 0.15 + qualGate) * 10) / 10;
  const status = selectionStatus(row, total);
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    quantitative_score: row.quantitative_score,
    integrated_grade: row.integrated_grade,
    qualitative_themes: row.qualitative_themes,
    theme_strength_score: theme,
    data_confidence_score: conf,
    buffett_gate: buffett.qualitative_gate,
    system_score: total,
    status,
    buy_rule: buyRule(status),
    sell_risk_rule: sellRule(row, buffett),
    operation_plan: status.includes('テスト') ? '6月イベント後に少額・分割・記録前提で再判定。購入前に証券会社画面と最新決算を確認。' : '購入候補ではなく、比較・補完・警戒条件の確認に使う。',
  };
});

const tradingRuleRows = [
  {
    rule_type: '買う前の必須条件',
    rule: '6月の米CPI、日銀、FOMC後に、日経平均/TOPIXが大きく崩れていないことを確認する。',
    action: '条件未達なら購入検討を延期。',
  },
  {
    rule_type: '買う前の必須条件',
    rule: '候補銘柄の公式決算、PER/PBR/ROE、決算後反応、同業比較を確認する。',
    action: '未取得データが重要項目に残る銘柄は購入候補にしない。',
  },
  {
    rule_type: '5%下落時',
    rule: '購入後に-5%となった場合、指数連動、業種連動、個別悪材料のどれかを分類する。',
    action: '指数連動なら保留、個別悪材料なら縮小候補。',
  },
  {
    rule_type: '10%下落時',
    rule: '購入後に-10%となり、個別悪材料または決算悪化が確認された場合。',
    action: '縮小または撤退を検討。NISA枠のため安易な回転売買は避け、理由を記録する。',
  },
  {
    rule_type: '上方確認',
    rule: '決算後20営業日で指数を上回り、かつ売上・利益・受注がテーマ仮説に沿っている場合。',
    action: '候補順位を上げる。ただし過熱・PER上限を確認する。',
  },
  {
    rule_type: '質的警戒',
    rule: 'TOB不成立、バフェット関連の大幅売却、主要顧客投資延期、原油急落、金利急変などが発生。',
    action: '新規買い停止。量的データ再確認まで候補を保留する。',
  },
];

const methodologyRows = [
  {
    view: '学術的な扱い',
    method: 'イベントスタディ',
    implementation: 'イベント前後の株価を、日経平均/TOPIXなどの市場リターンと比較し、超過リターンを見る。',
    reason: '単純な株価上昇ではなく、市場全体の上昇を差し引いてイベントの影響を確認するため。',
  },
  {
    view: '学術的な扱い',
    method: '反証条件の明文化',
    implementation: '売上・受注・利益率・決算後反応に出ない場合、質的仮説を落とす。',
    reason: '後付け説明や雰囲気による銘柄選定を避けるため。',
  },
  {
    view: '証券会社的な扱い',
    method: '投資テーマと銘柄評価の分離',
    implementation: 'AI、金利、原油、バフェット売買などは投資テーマとして管理し、銘柄評価は決算・株価・バリュエーションで確認する。',
    reason: 'テーマだけで推奨に見えることを避け、説明責任を残すため。',
  },
  {
    view: '証券会社的な扱い',
    method: '適合性・リスク管理',
    implementation: 'NISA 1年保有前提、分割、損失時の確認、イベント後再判定を明示する。',
    reason: '購入候補と実行判断を分け、リスクを事前に説明するため。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '実装内容',
    detail: '質的監視、仮説、量的検証、銘柄選出、売買ルール、運用記録までを1つの流れに接続。',
  },
  {
    updated_at: generatedAt,
    item: '基本方針',
    detail: '質的データは直接加点しない。量的データを主軸に、確認条件・警戒条件として反映する。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    detail: '本資料は購入確定資料ではない。6月イベント後、最新決算と証券会社画面を確認して再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '実装済み出力',
    detail: 'ワークフロー表、銘柄別システムスコア、売買ルール、運用プランを出力。',
  },
];

writeCsv('607_qual_quant_operation_system_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('608_qual_quant_operation_workflow.csv', workflowRows, ['step', 'input', 'process', 'output', 'decision']);
writeCsv('609_candidate_selection_operation_rules.csv', selectionRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'quantitative_score',
  'integrated_grade',
  'qualitative_themes',
  'theme_strength_score',
  'data_confidence_score',
  'buffett_gate',
  'system_score',
  'status',
  'buy_rule',
  'sell_risk_rule',
  'operation_plan',
]);
writeCsv('610_trading_rule_master.csv', tradingRuleRows, ['rule_type', 'rule', 'action']);
writeCsv('611_academic_practical_governance.csv', methodologyRows, ['view', 'method', 'implementation', 'reason']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的×量的 銘柄選出・売買ルール運用システム 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#0c7a43; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1320px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1040px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:14px 0; }
    .card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    .card small { display:block; color:#334155; font-weight:700; }
    .card b { display:block; font-size:24px; margin-top:4px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1900px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { .cards { grid-template-columns:1fr; } main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>質的×量的 銘柄選出・売買ルール運用システム</h1>
      <p class="lead">時流・ニュース・イベントを監視し、仮説を作り、数字で検証し、テスト銘柄・売買ルール・運用プランへ接続するための実装版です。</p>
    </header>
    <div class="cards">
      <div class="card"><small>対象銘柄</small><b>${selectionRows.length}社</b></div>
      <div class="card"><small>テスト中心候補</small><b>${selectionRows.filter((row) => row.status === 'テスト中心候補').length}社</b></div>
      <div class="card"><small>条件付き候補</small><b>${selectionRows.filter((row) => row.status === '条件付きテスト候補').length}社</b></div>
      <div class="card"><small>売買ルール</small><b>${tradingRuleRows.length}件</b></div>
    </div>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">質的データは直接加点しません。確認条件・警戒条件として使い、量的データで検証できたものだけ候補に残します。</div>
    </section>
    <section>
      <h2>2. システムの流れ</h2>
      ${table([
        { key: 'step', label: '段階' },
        { key: 'input', label: '入力' },
        { key: 'process', label: '処理' },
        { key: 'output', label: '出力' },
        { key: 'decision', label: '判定' },
      ], workflowRows, 'wide')}
    </section>
    <section>
      <h2>3. 銘柄別 選出・売買ルール</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'qualitative_themes', label: '質的テーマ' },
        { key: 'theme_strength_score', label: 'テーマ点' },
        { key: 'data_confidence_score', label: '信頼度' },
        { key: 'buffett_gate', label: 'バフェット項目' },
        { key: 'system_score', label: 'システム点' },
        { key: 'status', label: '分類' },
        { key: 'buy_rule', label: '買い条件' },
        { key: 'sell_risk_rule', label: '下げる・売る条件' },
        { key: 'operation_plan', label: '運用プラン' },
      ], selectionRows, 'wide')}
    </section>
    <section>
      <h2>4. 共通売買ルール</h2>
      ${table([
        { key: 'rule_type', label: '種類' },
        { key: 'rule', label: '条件' },
        { key: 'action', label: 'アクション' },
      ], tradingRuleRows, 'wide')}
    </section>
    <section>
      <h2>5. 学術的・実務的な運用統制</h2>
      ${table([
        { key: 'view', label: '観点' },
        { key: 'method', label: '方法' },
        { key: 'implementation', label: '実装' },
        { key: 'reason', label: '理由' },
      ], methodologyRows, 'wide')}
      <div class="actions">
        <a href="607_qual_quant_operation_system_summary.csv">概要CSV</a>
        <a href="608_qual_quant_operation_workflow.csv">流れCSV</a>
        <a href="609_candidate_selection_operation_rules.csv">銘柄別ルールCSV</a>
        <a href="610_trading_rule_master.csv">売買ルールCSV</a>
        <a href="611_academic_practical_governance.csv">運用統制CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qual_quant_operation_system_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  candidates: selectionRows.length,
  testCore: selectionRows.filter((row) => row.status === 'テスト中心候補').length,
  conditional: selectionRows.filter((row) => row.status === '条件付きテスト候補').length,
  output: 'qual_quant_operation_system_20260527.html',
}, null, 2));
