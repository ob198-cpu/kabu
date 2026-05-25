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

const SOURCE = '280_nisa_test_10_candidate_plan_reaction_updated.csv';

const REQUIRED_FIELDS = [
  ['growth_quality_score', '業績/質スコア', '購入検討用スコア'],
  ['downside_safety_score', '下落耐性スコア', '購入検討用スコア'],
  ['valuation_score', '割安スコア', '購入検討用スコア'],
  ['earnings_reaction_score', '決算後反応スコア', '購入検討用スコア'],
  ['data_confidence', 'データ信頼度', '購入検討用スコア'],
  ['per', 'PER', '割高確認'],
  ['pbr', 'PBR', '割高確認'],
  ['roe_pct', 'ROE', '企業の質確認'],
  ['revenue_yoy_pct', '売上成長率', '業績確認'],
  ['profit_yoy_pct', '利益成長率', '業績確認'],
  ['ret1y_pct', '1年騰落率', '過熱確認'],
  ['max_drawdown60_pct', '60日最大下落率', '下落耐性確認'],
];

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

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
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

function point(value) {
  const n = numericValue(value);
  return n === null ? '-' : `${Number.isInteger(n) ? n : n.toFixed(1)}点`;
}

function purchaseScore(row) {
  return (
    numericValue(row.growth_quality_score) * 0.4 +
    numericValue(row.downside_safety_score) * 0.3 +
    numericValue(row.valuation_score) * 0.2 +
    numericValue(row.earnings_reaction_score) * 0.1
  );
}

function hardGateText(row) {
  const text = String(row.hard_gate ?? '').trim();
  return text && text !== 'なし' ? text : '';
}

const rows = readCsv(SOURCE);

const fieldRows = rows.flatMap((row) => REQUIRED_FIELDS.map(([field, label, purpose]) => {
  const value = row[field];
  const acquired = numericValue(value) !== null;
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    field,
    label,
    purpose,
    raw_value: value,
    status: acquired ? '取得済み' : '未取得',
    score_treatment: acquired ? '点数計算に使用可' : '点数計算に使用しない',
  };
}));

const gateRows = rows.map((row) => {
  const missing = REQUIRED_FIELDS
    .filter(([field]) => numericValue(row[field]) === null)
    .map(([, label]) => label);
  const hardGate = hardGateText(row);
  const confidence = numericValue(row.data_confidence);
  const allRequired = missing.length === 0;
  const referenceScore = allRequired ? purchaseScore(row) : null;

  let status = '算出可';
  let acceptedScore = referenceScore;
  let reason = '必須データ取得済み、ハードゲートなし。';
  if (!allRequired) {
    status = '未算出';
    acceptedScore = null;
    reason = `未取得データあり: ${missing.join('、')}`;
  } else if (confidence !== null && confidence < 70) {
    status = '算出停止';
    acceptedScore = null;
    reason = `データ信頼度${confidence}点で基準70点未満。`;
  } else if (hardGate) {
    status = '算出停止';
    acceptedScore = null;
    reason = `ハードゲート未通過: ${hardGate}`;
  }

  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    category: row.category,
    required_count: REQUIRED_FIELDS.length,
    acquired_count: REQUIRED_FIELDS.length - missing.length,
    missing_count: missing.length,
    missing_fields: missing.join('、') || 'なし',
    hard_gate: hardGate || 'なし',
    data_confidence: row.data_confidence,
    search_score: row.nisa_score,
    reference_purchase_score: referenceScore === null ? '' : referenceScore.toFixed(1),
    accepted_purchase_score: acceptedScore === null ? '' : acceptedScore.toFixed(1),
    calculation_status: status,
    reason,
    score_treatment: status === '算出可' ? '購入検討用スコアに表示' : '購入検討用スコアには混ぜない',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${gateRows.length}社`,
    note: SOURCE,
  },
  {
    updated_at: generatedAt,
    item: '購入検討用スコア算出可',
    value: `${gateRows.filter((row) => row.calculation_status === '算出可').length}社`,
    note: '必須データ取得済み、信頼度70点以上、ハードゲートなし。',
  },
  {
    updated_at: generatedAt,
    item: '未取得データあり',
    value: `${gateRows.filter((row) => Number(row.missing_count) > 0).length}社`,
    note: '未取得は0点や仮値にせず、購入検討用スコアから外す。',
  },
  {
    updated_at: generatedAt,
    item: 'ハードゲート停止',
    value: `${gateRows.filter((row) => row.hard_gate !== 'なし').length}社`,
    note: '20営業日未到達、決算後反応未接続などは非通過扱い。',
  },
];

writeCsv('290_missing_data_score_gate.csv', gateRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'category',
  'required_count',
  'acquired_count',
  'missing_count',
  'missing_fields',
  'hard_gate',
  'data_confidence',
  'search_score',
  'reference_purchase_score',
  'accepted_purchase_score',
  'calculation_status',
  'reason',
  'score_treatment',
]);

writeCsv('291_required_field_matrix.csv', fieldRows, [
  'updated_at',
  'ticker',
  'company',
  'field',
  'label',
  'purpose',
  'raw_value',
  'status',
  'score_treatment',
]);

writeCsv('292_missing_data_gate_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'note']);

const badge = (status) => {
  if (status === '算出可') return '<span class="badge ok">算出可</span>';
  if (status === '未算出') return '<span class="badge stop">未算出</span>';
  return '<span class="badge warn">算出停止</span>';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>未取得データ非加点チェック 2026年5月25日</title>
  <style>
    body { margin:0; font-family:"Yu Gothic", Meiryo, sans-serif; color:#111; background:#f5f8fb; line-height:1.65; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 54px; }
    h1 { margin:0 0 8px; color:#073a5a; font-size:28px; }
    h2 { margin:30px 0 12px; padding-left:10px; border-left:8px solid #0b6f9f; color:#073a5a; }
    .card, .lead { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi span { display:block; color:#42526b; font-size:13px; }
    .kpi b { display:block; color:#073a5a; font-size:28px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; vertical-align:top; overflow-wrap:anywhere; font-size:12.5px; }
    th { background:#e4f1fa; color:#073a5a; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-weight:800; }
    .ok { background:#e9f7ef; color:#007a3d; }
    .warn { background:#fff4df; color:#9a5b00; }
    .stop { background:#fdecec; color:#b00020; }
    .formula { font-family:Consolas, "Yu Gothic", Meiryo, sans-serif; background:#f7fbff; border:1px solid #cbddeb; border-radius:8px; padding:12px; }
    a { color:#075985; font-weight:700; }
  </style>
</head>
<body>
<main>
  <h1>未取得データ非加点チェック</h1>
  <div class="lead">
    <p><b>目的:</b> 空欄・未取得・未到達のデータを、0点や仮値として購入検討用スコアへ混ぜないための確認表です。</p>
    <p><b>結論:</b> 探索スコアは比較用として残しますが、購入検討用スコアは「必須データ取得済み」「信頼度70点以上」「ハードゲートなし」の場合だけ表示します。</p>
    <p><a href="index.html">メインページへ戻る</a> / <a href="issue_resolution_flowchart_20260525.html">課題解決フローへ戻る</a></p>
  </div>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>ルール</h2>
  <div class="card">
    <div class="formula">
      購入検討用スコア = 業績/質40% + 下落耐性30% + 割安20% + 決算後反応10%<br>
      ただし、必須データ未取得、信頼度70点未満、ハードゲートありの場合は未算出または算出停止。<br>
      未取得データは0点・平均値・AI推定値で埋めない。
    </div>
  </div>

  <h2>銘柄別チェック</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">順位</th>
        <th style="width:14%">銘柄</th>
        <th style="width:8%">分類</th>
        <th style="width:9%">取得数</th>
        <th style="width:13%">未取得</th>
        <th style="width:16%">ハードゲート</th>
        <th style="width:8%">探索点</th>
        <th style="width:9%">参考点</th>
        <th style="width:9%">採用点</th>
        <th style="width:9%">状態</th>
      </tr>
    </thead>
    <tbody>
      ${gateRows.map((row) => `<tr>
        <td>${esc(row.rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td>${esc(row.category)}</td>
        <td>${esc(row.acquired_count)} / ${esc(row.required_count)}</td>
        <td>${esc(row.missing_fields)}</td>
        <td>${esc(row.hard_gate)}</td>
        <td>${point(row.search_score)}</td>
        <td>${row.reference_purchase_score ? `${esc(row.reference_purchase_score)}点` : '-'}</td>
        <td>${row.accepted_purchase_score ? `${esc(row.accepted_purchase_score)}点` : '-'}</td>
        <td>${badge(row.calculation_status)}<br>${esc(row.reason)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>必須項目</h2>
  <table>
    <thead><tr><th>項目</th><th>用途</th><th>未取得時の扱い</th></tr></thead>
    <tbody>
      ${REQUIRED_FIELDS.map(([, label, purpose]) => `<tr><td>${esc(label)}</td><td>${esc(purpose)}</td><td>購入検討用スコアには混ぜない</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>次の工程</h2>
  <div class="card">
    <p>次は、100社母集団の条件固定へ進みます。どの条件で候補群を作ったかを固定し、後から都合よく入れ替えたように見えない構造にします。</p>
    <p>更新日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'missing_data_score_gate_20260525.html'), html, 'utf8');

console.log(`generated missing data gate: ${gateRows.length} tickers`);
