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

function num(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[+%,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

const operationRows = readCsv('628_nisa_test_operation_plan.csv');
const referenceRows = readCsv('643_professional_portfolio_candidate_reference.csv');
const importRows = readCsv('644_professional_portfolio_import_queue.csv');
const referenceMap = new Map(referenceRows.map((row) => [row.ticker, row]));

function gate(row, ref) {
  const baseClass = row.test_priority_class;
  const decision = row.operation_decision;
  const connection = ref?.connection || '未接続';
  const support = num(ref?.reference_support_score, 45);
  const highChase = String(ref?.copy_risk || '').includes('高い');

  if (connection === '未接続') {
    if (baseClass === '第1候補群') {
      return {
        gate: '独立候補',
        revised_class: baseClass,
        reference_effect: '補強なし',
        action: 'プロ参照では補強できないため、既存の量的根拠、決算、PER、数量・利益率を優先して確認する。',
      };
    }
    return {
      gate: '参照外',
      revised_class: baseClass,
      reference_effect: '補強なし',
      action: 'プロ参照では補強できない。6月再判定と既存スコアを優先する。',
    };
  }

  if (decision === '警戒') {
    return {
      gate: '再浮上候補',
      revised_class: '警戒解除待ち',
      reference_effect: '過去勝ち筋あり',
      action: 'プロ参照では強いが、現在は警戒区分。金利、バフェット売買、決算後反応、指数比較が改善した時だけ再浮上させる。',
    };
  }

  if (connection === '直接一致') {
    return {
      gate: highChase ? '直接一致・後追い注意' : '直接一致',
      revised_class: baseClass === '監視のみ' ? '追加確認' : baseClass,
      reference_effect: `参照点${support}`,
      action: '直接一致するため説明材料になる。ただし過去の成果を現在の買付理由にせず、最新PER、決算後反応、下落耐性で確認する。',
    };
  }

  if (connection === 'テーマ近似') {
    return {
      gate: highChase ? 'テーマ補強・後追い注意' : 'テーマ補強',
      revised_class: baseClass,
      reference_effect: `参照点${support}`,
      action: '同じ勝ち筋に近い可能性がある。売上、受注、利益率、同業株反応で、テーマが実際に業績へ接続しているか確認する。',
    };
  }

  return {
    gate: '参照確認',
    revised_class: baseClass,
    reference_effect: `参照点${support}`,
    action: '参照情報として記録し、6月再判定で確認する。',
  };
}

const integratedRows = operationRows.map((row) => {
  const ref = referenceMap.get(row.ticker) || {};
  const g = gate(row, ref);
  return {
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    current_class: row.test_priority_class,
    operation_decision: row.operation_decision,
    quant_score: row.quant_score,
    qualitative_score: row.qualitative_score,
    data_confidence: row.data_confidence,
    original_priority_score: row.test_priority_score,
    reference_connection: ref.connection || '未接続',
    reference_ticker: ref.reference_ticker || '',
    reference_theme: ref.reference_theme || '',
    reference_return_pct: ref.reference_return_pct || '',
    reference_role: ref.reference_role || '',
    reference_support_score: ref.reference_support_score || '45',
    copy_risk: ref.copy_risk || 'なし',
    reference_gate: g.gate,
    revised_class: g.revised_class,
    reference_effect: g.reference_effect,
    action: g.action,
    final_use: g.gate.includes('後追い') || g.revised_class === '警戒解除待ち'
      ? '購入検討へ直接進めない。確認優先。'
      : '既存の6月再判定へ接続。',
  };
});

const importScreenRows = importRows.map((row) => {
  const ret = num(row.source_return_pct);
  const contribution = num(row.estimated_total_contribution);
  const already = row.already_in_current_candidates === 'あり';
  let screeningStage = '追加候補B';
  if (already) screeningStage = '既存候補照合';
  else if (row.priority === 'A') screeningStage = '追加候補A';
  const chaseRisk = ret >= 200 ? '高' : ret >= 100 ? '中' : '低〜中';
  const requiredData = row.theme === '指数・ETF'
    ? '指数比較用。個別株比率を下げる判断の基準に使う。'
    : 'PER、PBR、ROE、直近決算成長率、決算後20営業日反応、60日最大下落率、200日線乖離、出来高倍率';
  return {
    generated_at: generatedAt,
    screening_stage: screeningStage,
    ticker: row.ticker,
    company: row.company,
    theme: row.theme,
    role: row.role,
    source_return_pct: row.source_return_pct,
    estimated_total_contribution: contribution,
    chase_risk: chaseRisk,
    required_data: requiredData,
    next_action: already
      ? '既存候補側の警戒条件と照合する。'
      : '追加データを取得して、現在候補12社と同じ式へ入れる。',
    use_for_june: row.theme === '指数・ETF'
      ? '比較基準'
      : '6月候補の追加検討枠',
  };
});

const rulesRows = [
  {
    rule: 'プロ参照は自動昇格に使わない',
    detail: '成果が出た事実は強い参考材料だが、買付時点と現在価格が違うため、候補点へ単純加点しない。',
  },
  {
    rule: '直接一致は説明力を上げる',
    detail: '既存候補と同じ銘柄が含まれる場合、なぜ過去に成果が出たかを確認し、現在も同じ条件が残るかを検証する。',
  },
  {
    rule: 'テーマ近似は業績接続で確認する',
    detail: '半導体・AI、重工、金利などのテーマが近いだけでは不十分。売上、受注、利益率、決算後株価反応で確認する。',
  },
  {
    rule: '後追いリスクを明示する',
    detail: '資料上の騰落率が大きい銘柄ほど、同じテーマでも現在の割高・過熱・反落リスクを強く見る。',
  },
  {
    rule: '候補外の高寄与銘柄は追加キューへ',
    detail: '三菱重工、東京きらぼしFG、住友商事、山洋電気、SCREEN HDなどは、同じ式で再スクリーニングする。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '目的',
    detail: 'プロが作成し成果が出ているポートフォリオを、既存候補判定に接続する。ただし直接買付判断には使わない。',
  },
  {
    generated_at: generatedAt,
    item: '既存候補への影響',
    detail: 'TDK・ディスコはテーマ補強、ソフトバンクG・三井住友FG・三菱UFJは直接一致。ただし後追いリスクと警戒条件を同時に表示する。',
  },
  {
    generated_at: generatedAt,
    item: '追加候補',
    detail: '三菱重工、東京きらぼしFG、住友商事、山洋電気、SCREEN HDなどを追加スクリーニングキューへ入れる。',
  },
  {
    generated_at: generatedAt,
    item: '使い方',
    detail: 'プロ参照は、候補の説明力と追加調査の優先順位を上げる材料。6月再判定では、最新データで同じ式へ入れて比較する。',
  },
];

writeCsv('646_professional_reference_integration_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('647_candidate_professional_reference_gate.csv', integratedRows, [
  'generated_at',
  'ticker',
  'company',
  'current_class',
  'operation_decision',
  'quant_score',
  'qualitative_score',
  'data_confidence',
  'original_priority_score',
  'reference_connection',
  'reference_ticker',
  'reference_theme',
  'reference_return_pct',
  'reference_role',
  'reference_support_score',
  'copy_risk',
  'reference_gate',
  'revised_class',
  'reference_effect',
  'action',
  'final_use',
]);
writeCsv('648_professional_reference_import_screen.csv', importScreenRows, [
  'generated_at',
  'screening_stage',
  'ticker',
  'company',
  'theme',
  'role',
  'source_return_pct',
  'estimated_total_contribution',
  'chase_risk',
  'required_data',
  'next_action',
  'use_for_june',
]);
writeCsv('649_professional_reference_integration_rules.csv', rulesRows, ['rule', 'detail']);

const gateCounts = [...new Set(integratedRows.map((row) => row.reference_gate))].map((gateName) => ({
  gate: gateName,
  count: integratedRows.filter((row) => row.reference_gate === gateName).length,
}));
const importCounts = [...new Set(importScreenRows.map((row) => row.screening_stage))].map((stage) => ({
  stage,
  count: importScreenRows.filter((row) => row.screening_stage === stage).length,
}));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>プロ参照 統合ゲート 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; --red:#a82424; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1400px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1120px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card b { display:block; font-size:28px; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:2400px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .cards { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      .wide table { min-width:0; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>プロ参照 統合ゲート</h1>
      <p class="lead">成果が出ているプロ作成ポートフォリオを、既存候補の説明力と追加調査の優先順位へ接続します。単純加点ではなく、補強、警戒解除待ち、後追い注意、追加スクリーニングに分けます。</p>
    </header>

    <section>
      <h2>1. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">プロ参照は有用ですが、現在価格・最新決算・6月イベントを通さずに購入対象へ昇格させません。</div>
    </section>

    <section>
      <h2>2. ゲート内訳</h2>
      <div class="cards">
        ${gateCounts.map((row) => `<div class="card"><b>${esc(row.count)}</b><span>${esc(row.gate)}</span></div>`).join('')}
      </div>
    </section>

    <section>
      <h2>3. 既存候補への統合結果</h2>
      ${table([
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'current_class', label: '現在分類' },
        { key: 'operation_decision', label: '運用区分' },
        { key: 'original_priority_score', label: '元優先度' },
        { key: 'reference_connection', label: 'プロ参照接続' },
        { key: 'reference_ticker', label: '参照銘柄' },
        { key: 'reference_theme', label: '参照テーマ' },
        { key: 'reference_return_pct', label: '参照騰落率' },
        { key: 'reference_role', label: '参照役割' },
        { key: 'copy_risk', label: '後追いリスク' },
        { key: 'reference_gate', label: '参照ゲート' },
        { key: 'revised_class', label: '統合後扱い' },
        { key: 'action', label: '反映方法' },
        { key: 'final_use', label: '6月での使い方' },
      ], integratedRows, 'wide')}
    </section>

    <section>
      <h2>4. 追加スクリーニング</h2>
      <div class="cards">
        ${importCounts.map((row) => `<div class="card"><b>${esc(row.count)}</b><span>${esc(row.stage)}</span></div>`).join('')}
      </div>
      ${table([
        { key: 'screening_stage', label: '区分' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'theme', label: 'テーマ' },
        { key: 'role', label: '参照役割' },
        { key: 'source_return_pct', label: '資料上騰落率' },
        { key: 'estimated_total_contribution', label: '推定寄与' },
        { key: 'chase_risk', label: '後追いリスク' },
        { key: 'required_data', label: '必要データ' },
        { key: 'next_action', label: '次アクション' },
        { key: 'use_for_june', label: '6月での使い方' },
      ], importScreenRows, 'wide')}
    </section>

    <section>
      <h2>5. 運用ルール</h2>
      ${table([
        { key: 'rule', label: 'ルール' },
        { key: 'detail', label: '内容' },
      ], rulesRows, 'wide')}
      <div class="actions">
        <a href="646_professional_reference_integration_summary.csv">要約CSV</a>
        <a href="647_candidate_professional_reference_gate.csv">統合ゲートCSV</a>
        <a href="648_professional_reference_import_screen.csv">追加スクリーニングCSV</a>
        <a href="649_professional_reference_integration_rules.csv">運用ルールCSV</a>
        <a href="professional_portfolio_deep_analysis_20260527.html">深掘り分析へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'professional_reference_integration_gate_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  integratedRows: integratedRows.length,
  importScreenRows: importScreenRows.length,
  output: 'professional_reference_integration_gate_20260527.html',
}, null, 2));
