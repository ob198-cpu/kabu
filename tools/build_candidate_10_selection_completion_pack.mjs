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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function testRole(row) {
  if (row.work_status === '説明優先') return '主候補';
  if (row.work_status === '比較維持') return '比較枠';
  if (row.work_status === '反応更新待ち') return '反応待ち';
  if (row.work_status === '補完後に再判定') return '補完待ち';
  if (row.work_status === '検算優先') return '検算枠';
  return '確認枠';
}

function completionStatus(row) {
  if (row.work_status === '説明優先') return '根拠説明可能';
  if (row.work_status === '比較維持') return '比較根拠はあるが主候補化は未定';
  if (row.work_status === '反応更新待ち') return '決算後反応の更新待ち';
  if (row.work_status === '補完後に再判定') return '財務または同業比較の補完待ち';
  if (row.work_status === '検算優先') return '弱い反応の原因検算が必要';
  return '確認中';
}

function selectionReason(row, qual, peer, task) {
  const parts = [
    row.evidence_summary,
    `質的仮説: ${qual.qualitative_hypothesis || row.qualitative_treatment}`,
    `確認条件: ${qual.confirmation_needed || '未設定'}`,
    `同業比較: ${peer.broad_peer_status || row.sector_adjustment_status}`,
    `次作業: ${task.data_task || row.remaining_issue}`,
  ];
  return parts.filter(Boolean).join(' / ');
}

function riskNote(row, qual) {
  const notes = [];
  if (row.reaction_layer.includes('D') || row.reaction_note.includes('-')) {
    notes.push(`決算後反応の注意: ${row.reaction_note}`);
  }
  if (row.remaining_issue.includes('未接続') || row.remaining_issue.includes('不足')) {
    notes.push(row.remaining_issue);
  }
  if (qual.reject_condition) notes.push(`除外条件: ${qual.reject_condition}`);
  return notes.join(' / ');
}

const draftRows = readCsv('519_candidate_10_selection_draft_detail.csv');
const qualitativeByTicker = byTicker(readCsv('521_candidate_10_qualitative_validation_checklist.csv'));
const peerByTicker = byTicker(readCsv('528_candidate_10_broad_peer_reference_detail.csv'));
const taskByTicker = byTicker(readCsv('532_candidate_10_next_data_tasks_detail.csv'));

const detailRows = draftRows.map((row) => {
  const qual = qualitativeByTicker.get(row.ticker) || {};
  const peer = peerByTicker.get(row.ticker) || {};
  const task = taskByTicker.get(row.ticker) || {};
  const role = testRole(row);
  return {
    updated_at: generatedAt,
    rank: row.draft_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    test_role: role,
    completion_status: completionStatus(row),
    grade: row.draft_grade,
    score: row.draft_score,
    quantitative_grade: row.quantitative_grade,
    data_confidence: row.data_confidence,
    nisa_score_reference: row.nisa_score_reference,
    reaction_layer: row.reaction_layer,
    reaction_note: row.reaction_note,
    peer_status: peer.broad_peer_status || row.sector_adjustment_status,
    qualitative_treatment: '仮説確認用。単独加点しない。',
    selection_reason: selectionReason(row, qual, peer, task),
    risk_note: riskNote(row, qual),
    next_trigger: task.next_trigger || '',
    next_action: task.data_task || '',
    june_treatment: role === '主候補'
      ? '6月イベント後に主候補として再判定'
      : role === '検算枠'
        ? '反応が弱い理由を検算し、改善根拠がなければ観察枠へ下げる'
        : '不足データまたは反応到達後に主候補化できるか再判定',
    investment_treatment: '投資実行判断ではない。NISA 1年保有テスト候補の説明整理。',
  };
});

const roleCounts = detailRows.reduce((acc, row) => {
  acc[row.test_role] = (acc[row.test_role] || 0) + 1;
  return acc;
}, {});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '候補整理',
    value: `${detailRows.length}社`,
    meaning: '100社前後の母集団から詳細確認へ進める候補10社を整理。',
  },
  {
    updated_at: generatedAt,
    item: '主候補',
    value: `${roleCounts['主候補'] || 0}社`,
    meaning: '現時点で数値根拠と説明の整合性が比較的高い銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '比較・待機・検算',
    value: `${detailRows.length - (roleCounts['主候補'] || 0)}社`,
    meaning: '比較枠、反応待ち、補完待ち、検算枠として扱う銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '判断の扱い',
    value: '購入確定なし',
    meaning: '6月のCPI・日銀・FOMC後に実数を入れて再判定する。',
  },
];

const ruleRows = [
  {
    rule: '量的データを主軸にする',
    detail: 'PER、ROE、売上成長、利益成長、データ信頼度、決算後反応を中心に扱う。',
  },
  {
    rule: '質的仮説は単独加点しない',
    detail: 'AI、金利、新商品、政策、原油などのテーマは、確認条件と除外条件を置く。点数へ直接足さない。',
  },
  {
    rule: '未到達データを混ぜない',
    detail: '20営業日反応が未来日の場合は、暫定評価として分離し、最終採点へ混ぜない。',
  },
  {
    rule: '10社の役割を分ける',
    detail: '主候補、比較枠、反応待ち、補完待ち、検算枠を分け、全銘柄を同じ意味の候補として扱わない。',
  },
  {
    rule: '+1%目標との接続',
    detail: '6月イベント後の再判定で、S&P500・日経平均・TOPIXを1%以上上回る見込みが弱い場合は、個別株比率を下げる。',
  },
];

writeCsv('533_candidate_10_selection_completion_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('534_candidate_10_selection_completion_detail.csv', detailRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'test_role',
  'completion_status',
  'grade',
  'score',
  'quantitative_grade',
  'data_confidence',
  'nisa_score_reference',
  'reaction_layer',
  'reaction_note',
  'peer_status',
  'qualitative_treatment',
  'selection_reason',
  'risk_note',
  'next_trigger',
  'next_action',
  'june_treatment',
  'investment_treatment',
]);

writeCsv('535_candidate_10_selection_completion_rules.csv', ruleRows, [
  'rule',
  'detail',
]);

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const roleCards = ['主候補', '比較枠', '反応待ち', '補完待ち', '検算枠'].map((role) => {
  const rows = detailRows.filter((row) => row.test_role === role);
  return `
    <div class="role-card">
      <h3>${esc(role)}</h3>
      <strong>${rows.length}社</strong>
      <p>${esc(rows.map((row) => `${row.company}（${row.ticker}）`).join('、') || '該当なし')}</p>
    </div>`;
}).join('');

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 選定完了パック 2026年5月26日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --green:#0f766e; --amber:#b45309; --red:#b91c1c; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1280px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:126px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:28px; line-height:1.2; }
    .roles { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .role-card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fff; }
    .role-card h3 { margin:0 0 4px; font-size:18px; color:var(--navy); }
    .role-card strong { display:block; font-size:28px; color:var(--green); }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1240px; border-collapse:collapse; table-layout:fixed; }
    .rules table { min-width:760px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:1000px) { .summary { grid-template-columns:repeat(2,minmax(0,1fr)); } .roles { grid-template-columns:1fr 1fr; } }
    @media (max-width:680px) { main { width:min(100% - 20px,1280px); } .summary,.roles { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 選定完了パック</h1>
    <p>候補10社を、主候補・比較枠・反応待ち・補完待ち・検算枠に分け、6月の再判定へつなげる資料です。</p>
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
      <p class="notice">この資料はNISA 1年保有テストに向けた候補整理です。投資実行判断ではありません。</p>
      <div class="toolbar">
        <a class="button" href="533_candidate_10_selection_completion_summary.csv">533 要約CSV</a>
        <a class="button" href="534_candidate_10_selection_completion_detail.csv">534 詳細CSV</a>
        <a class="button" href="535_candidate_10_selection_completion_rules.csv">535 ルールCSV</a>
        <a class="button" href="candidate_10_next_data_tasks_20260526.html">次データ確認タスクへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>10社の役割</h2>
      <div class="roles">${roleCards}</div>
    </section>

    <section>
      <h2>判断ルール</h2>
      ${table(
        [
          { key: 'rule', label: 'ルール' },
          { key: 'detail', label: '内容' },
        ],
        ruleRows,
        'rules',
      )}
    </section>

    <section>
      <h2>候補10社 詳細</h2>
      ${table(
        [
          { key: 'rank', label: '順位' },
          { key: 'ticker', label: 'コード' },
          { key: 'company', label: '銘柄' },
          { key: 'test_role', label: '役割' },
          { key: 'completion_status', label: '状態' },
          { key: 'grade', label: '評価' },
          { key: 'score', label: '点数' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'data_confidence', label: '信頼度' },
          { key: 'reaction_note', label: '決算後反応' },
          { key: 'selection_reason', label: '選定根拠' },
          { key: 'risk_note', label: '注意点' },
          { key: 'next_action', label: '次の作業' },
          { key: 'june_treatment', label: '6月の扱い' },
        ],
        detailRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_selection_completion_pack_20260526.html'), html, 'utf8');

console.log(`created candidate_10_selection_completion_pack_20260526.html rows=${detailRows.length}`);
