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
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function num(value) {
  const text = String(value ?? '').replace(/[%,倍点円]/g, '').replace(/,/g, '').trim();
  if (!text || text === '未取得' || text === '未算出') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function reactionScore(row) {
  if (row.reaction_layer.includes('D')) return 20;
  if (row.reaction_layer.includes('1日')) return 45;
  if (row.reaction_layer.includes('暫定A')) return 70;
  if (row.reaction_layer.includes('暫定B')) return 58;
  return 50;
}

function qualitativeUse(row) {
  if (row.qualitative_layer === '仮説のみ') return '補助仮説';
  return row.qualitative_layer || '未整理';
}

function draftStatus(row, score) {
  if (row.role === '検算対象') return '検算優先';
  if (row.role === '反応待ち') return '反応更新待ち';
  if (row.role === '補完対象') return '補完後に再判定';
  if (row.role === '比較候補') return '比較維持';
  if (row.role === '優先候補') return '説明優先';
  if (score >= 62) return '説明優先';
  if (score >= 54) return '比較維持';
  return '控え';
}

function cappedGrade(row, score, status) {
  if (status === '検算優先') return score >= 45 ? 'C' : 'D';
  if (status === '補完後に再判定') return score >= 62 ? 'B' : 'C';
  if (status === '反応更新待ち') return score >= 62 ? 'B' : 'C';
  if (status === '比較維持') return score >= 62 ? 'B' : 'C';
  if (status === '説明優先' && row.sector_adjustment_status !== '補正参考可') return score >= 62 ? 'A' : 'B';
  if (score >= 70) return 'S';
  if (score >= 62) return 'A';
  if (score >= 54) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function reasonText(row) {
  const pieces = [];
  pieces.push(`量的評価${row.quantitative_grade}`);
  pieces.push(`信頼度${row.data_confidence}`);
  pieces.push(`PER ${row.per}`);
  pieces.push(`ROE ${row.roe_pct}`);
  pieces.push(`売上成長${row.revenue_yoy_pct}`);
  pieces.push(`利益成長${row.profit_yoy_pct}`);
  pieces.push(`決算後反応 ${row.reaction_note}`);
  if (row.sector_adjustment_status === '補正参考可') pieces.push(`同業比較は使用可`);
  else pieces.push(`同業比較は未接続`);
  return pieces.join('、');
}

const evidenceRows = readCsv('514_candidate_10_evidence_pack_detail.csv');

const draftRows = evidenceRows.map((row) => {
  const dataConfidence = num(row.data_confidence) ?? 0;
  const dataReadiness = num(row.data_readiness_score) ?? 0;
  const nisaReference = num(row.nisa_score_reference) ?? 0;
  const reaction = reactionScore(row);
  const sector = row.sector_adjustment_status === '補正参考可' ? 100 : 45;
  const hardPenalty =
    (row.role === '検算対象' ? 18 : 0)
    + (row.role === '補完対象' ? 10 : 0)
    + (row.role === '反応待ち' ? 8 : 0);
  const score = Math.max(0, Math.min(100,
    dataConfidence * 0.22
    + dataReadiness * 0.18
    + nisaReference * 0.25
    + reaction * 0.25
    + sector * 0.10
    - hardPenalty));
  const status = draftStatus(row, score);
  return {
    updated_at: generatedAt,
    draft_rank: '',
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    work_status: status,
    draft_grade: cappedGrade(row, score, status),
    draft_score: score.toFixed(1),
    role_from_gate: row.role,
    quantitative_grade: row.quantitative_grade,
    data_confidence: row.data_confidence,
    nisa_score_reference: row.nisa_score_reference,
    reaction_layer: row.reaction_layer,
    reaction_note: row.reaction_note,
    qualitative_treatment: qualitativeUse(row),
    sector_adjustment_status: row.sector_adjustment_status,
    score_formula: '信頼度22% + データ準備18% + NISA参照25% + 決算後反応25% + 同業比較10% - ハード減点',
    evidence_summary: reasonText(row),
    remaining_issue: row.caution,
    treatment: 'テスト対象選定の作業順位。投資実行判断ではない。',
  };
});

draftRows.sort((a, b) => Number(b.draft_score) - Number(a.draft_score));
draftRows.forEach((row, index) => {
  row.draft_rank = String(index + 1);
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '説明優先',
    value: `${draftRows.filter((row) => row.work_status === '説明優先').length}社`,
    meaning: '現時点の数値で優先して根拠整理する対象。実行判断ではない。',
  },
  {
    updated_at: generatedAt,
    item: '比較維持',
    value: `${draftRows.filter((row) => row.work_status === '比較維持').length}社`,
    meaning: '10社内で比較を続ける対象。上位との差や弱点を説明する。',
  },
  {
    updated_at: generatedAt,
    item: '反応更新待ち',
    value: `${draftRows.filter((row) => row.work_status === '反応更新待ち').length}社`,
    meaning: '決算後5日または20営業日の到達後に再分類する対象。',
  },
  {
    updated_at: generatedAt,
    item: '検算・補完',
    value: `${draftRows.filter((row) => ['検算優先', '補完後に再判定'].includes(row.work_status)).length}社`,
    meaning: '弱い実績反応または不足値により、説明前に注意書きが必要な対象。',
  },
];

writeCsv('518_candidate_10_selection_draft_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('519_candidate_10_selection_draft_detail.csv', draftRows, [
  'updated_at',
  'draft_rank',
  'ticker',
  'company',
  'sector',
  'work_status',
  'draft_grade',
  'draft_score',
  'role_from_gate',
  'quantitative_grade',
  'data_confidence',
  'nisa_score_reference',
  'reaction_layer',
  'reaction_note',
  'qualitative_treatment',
  'sector_adjustment_status',
  'score_formula',
  'evidence_summary',
  'remaining_issue',
  'treatment',
]);

const ruleRows = [
  {
    rule_id: 'D01',
    rule: '質的仮説は単独加点しない',
    detail: '時流やイベントは説明補助として残すが、実績反応や量的データが弱い場合は順位を上げない。',
  },
  {
    rule_id: 'D02',
    rule: '未到達反応は接続しない',
    detail: '決算後20営業日が到達していない銘柄は、反応層を暫定扱いにする。',
  },
  {
    rule_id: 'D03',
    rule: '同業比較不足は点数へ混ぜない',
    detail: '同業3社以上かつ候補側2項目以上の条件を満たさない場合、同業比較は未接続にする。',
  },
  {
    rule_id: 'D04',
    rule: '実績反応が弱い銘柄は検算へ回す',
    detail: '構造仮説が強く見えても、決算後反応が弱い場合は検算優先にする。',
  },
];

writeCsv('520_candidate_10_selection_draft_rules.csv', ruleRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'rule_id',
  'rule',
  'detail',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 選定ドラフト 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #3f5168;
      --line: #c9d9ea;
      --bg: #f4f8fc;
      --navy: #0d3658;
      --blue: #0b6fa4;
      --soft: #eef7ff;
      --amber: #b45309;
      --green: #087f5b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.72;
      letter-spacing: 0;
    }
    header { background: var(--navy); color: #fff; padding: 34px clamp(18px, 4vw, 58px); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1120px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 122px; }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 30px; line-height: 1.2; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border-radius: 8px; border: 1px solid #9cc8ec; background: #fff; color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px; }
    .rule-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .rule { border: 1px solid var(--line); border-radius: 8px; padding: 13px; background: #fff; }
    .rule b { color: var(--green); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1420px; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1240px); }
      .summary, .rule-grid { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 選定ドラフト</h1>
    <p>明日、根拠付きで10社を説明するための作業順位です。質的仮説は補助扱いにし、量的データと実績反応を主軸にしています。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.meaning)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">この順位はテスト対象を説明するための作業順位です。投資実行判断ではありません。</p>
      <div class="toolbar">
        <a class="button" href="518_candidate_10_selection_draft_summary.csv">518 要約CSV</a>
        <a class="button" href="519_candidate_10_selection_draft_detail.csv">519 詳細CSV</a>
        <a class="button" href="520_candidate_10_selection_draft_rules.csv">520 ルールCSV</a>
        <a class="button" href="candidate_10_evidence_pack_20260526.html">根拠パックへ</a>
        <a class="button" href="candidate_10_completion_closure_20260526.html">完了状況へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>判定ルール</h2>
      <div class="rule-grid">
        ${ruleRows.map((row) => `
        <div class="rule"><b>${esc(row.rule)}</b><br>${esc(row.detail)}</div>`).join('')}
      </div>
    </section>

    <section>
      <h2>10社ドラフト順位</h2>
      ${table(
        [
          { key: 'draft_rank', label: '順位' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'work_status', label: '状態' },
          { key: 'draft_grade', label: '評価' },
          { key: 'draft_score', label: '作業点' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'data_confidence', label: '信頼度' },
          { key: 'nisa_score_reference', label: 'NISA参照' },
          { key: 'reaction_layer', label: '反応層' },
          { key: 'sector_adjustment_status', label: '同業比較' },
          { key: 'qualitative_treatment', label: '質的情報' },
          { key: 'evidence_summary', label: '根拠' },
          { key: 'remaining_issue', label: '残課題' },
          { key: 'treatment', label: '扱い' },
        ],
        draftRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_selection_draft_20260526.html'), html, 'utf8');

console.log(`created candidate_10_selection_draft_20260526.html rows=${draftRows.length}`);
