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

function num(value) {
  const text = String(value ?? '').replace(/[%,倍点円]/g, '').replace(/,/g, '').trim();
  if (!text || text === '未取得') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function gradeScore(grade) {
  if (grade === 'A') return 30;
  if (grade === 'B') return 24;
  if (grade === 'C') return 16;
  return 6;
}

function qualitativeStatus(row) {
  if (!row) return { label: '未接続', point: 0, note: '質的情報は未接続' };
  if (String(row.qualitative_status || '').startsWith('実績確認あり')) {
    return { label: '実績確認あり', point: 10, note: row.qualitative_themes || '実績確認あり' };
  }
  if (Number(row.event_theme_count || 0) > 0) {
    return { label: '仮説のみ', point: 4, note: row.qualitative_themes || '仮説のみ。採点ではなく調査理由' };
  }
  return { label: '未接続', point: 0, note: '質的情報は未接続' };
}

function reactionStatus(row) {
  if (!row) return { label: '未接続', point: 0, className: 'gap', note: '決算後反応データなし', hardFlag: '' };
  const excess20 = num(row.excess_20d_pct);
  const excess5 = num(row.excess_5d_pct);
  const excess1 = num(row.excess_1d_pct);

  if (row.due_status === '20営業日確定済み' && excess20 !== null) {
    if (excess20 >= 5) return { label: 'A 実績強い', point: 25, className: 'ok', note: `20営業日 対日経 ${row.excess_20d_pct}`, hardFlag: '' };
    if (excess20 >= 0) return { label: 'B 実績やや強い', point: 18, className: 'ok', note: `20営業日 対日経 ${row.excess_20d_pct}`, hardFlag: '' };
    if (excess20 >= -5) return { label: 'C 実績中立', point: 10, className: 'warn', note: `20営業日 対日経 ${row.excess_20d_pct}`, hardFlag: '' };
    return { label: 'D 実績弱い', point: 0, className: 'bad', note: `20営業日 対日経 ${row.excess_20d_pct}`, hardFlag: '20営業日反応が弱いため、検算まで候補強化しない' };
  }

  if (excess5 !== null) {
    if (excess5 >= 5) return { label: '暫定A', point: 12, className: 'tentative', note: `5日 対日経 ${row.excess_5d_pct}、20営業日待ち`, hardFlag: '' };
    if (excess5 >= 0) return { label: '暫定B', point: 9, className: 'tentative', note: `5日 対日経 ${row.excess_5d_pct}、20営業日待ち`, hardFlag: '' };
    return { label: '暫定C', point: 5, className: 'tentative', note: `5日 対日経 ${row.excess_5d_pct}、20営業日待ち`, hardFlag: '' };
  }

  if (excess1 !== null) {
    return { label: '1日暫定', point: 3, className: 'tentative', note: `1日 対日経 ${row.excess_1d_pct}、5日/20営業日待ち`, hardFlag: '' };
  }

  return { label: '未接続', point: 0, className: 'gap', note: row.reason || '反応未接続', hardFlag: '' };
}

function gate(row, q, r, readinessScore) {
  const confidence = num(row.data_confidence) ?? 0;
  const missing = String(row.data_gap || '');
  if (r.hardFlag) return { label: '要検算', reason: r.hardFlag };
  if (r.label === '1日暫定') {
    return { label: '反応待ち', reason: '1日反応のみで、5営業日と20営業日の確認が未到達' };
  }
  if (missing.includes('財務指標未完了') || row.per === '未取得') {
    return { label: '補完待ち', reason: 'PERまたは財務指標の不足が残るため、候補確定前に補完する' };
  }
  if ((row.quantitative_grade === 'A' || row.quantitative_grade === 'B') && confidence >= 95 && readinessScore >= 85) {
    return { label: '継続確認', reason: '量的データと信頼度は候補比較に使える。20営業日反応の到達後に再判定する' };
  }
  if (row.quantitative_grade === 'C' && readinessScore >= 80) {
    return { label: '比較対象', reason: 'データはそろいつつあるが、量的評価は上位候補より弱い' };
  }
  if (q.label === '仮説のみ') return { label: '調査継続', reason: '質的仮説はあるが、実績層が未接続のため採点へ加えない' };
  return { label: '保留', reason: '追加データまたは検算後に扱いを決める' };
}

const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const qualitativeRows = fs.existsSync(path.join(ROOT, '467_candidate_10_qualitative_evidence.csv'))
  ? readCsv('467_candidate_10_qualitative_evidence.csv')
  : [];
const readinessRows = readCsv('494_candidate_10_selection_readiness_detail.csv');
const reactionRows = readCsv('500_candidate_10_reaction_due_detail.csv');

const qualitativeByTicker = byTicker(qualitativeRows);
const readinessByTicker = byTicker(readinessRows);
const reactionByTicker = byTicker(reactionRows);

const detailRows = quantRows.map((row) => {
  const q = qualitativeStatus(qualitativeByTicker.get(row.ticker));
  const r = reactionStatus(reactionByTicker.get(row.ticker));
  const readinessScore = num(readinessByTicker.get(row.ticker)?.data_readiness_score) ?? 0;
  const base = gradeScore(row.quantitative_grade) + Math.min(20, Math.max(0, readinessScore / 5));
  const evidencePoint = Math.min(15, q.point + r.point);
  const testReadiness = Math.round(base + evidencePoint);
  const g = gate(row, q, r, readinessScore);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    quantitative_grade: row.quantitative_grade,
    nisa_score_reference: row.nisa_score,
    data_confidence: row.data_confidence,
    data_readiness_score: readinessScore,
    qualitative_layer: q.label,
    qualitative_note: q.note,
    reaction_layer: r.label,
    reaction_note: r.note,
    test_readiness_score: testReadiness,
    gate_result: g.label,
    gate_reason: g.reason,
    score_policy: '量的データを主軸。質的情報と反応実績は別層で確認し、未到達値は最終採点へ混ぜない。',
  };
}).sort((a, b) => {
  const order = ['継続確認', '比較対象', '反応待ち', '要検算', '補完待ち', '調査継続', '保留'];
  const byGate = order.indexOf(a.gate_result) - order.indexOf(b.gate_result);
  if (byGate !== 0) return byGate;
  return Number(b.test_readiness_score) - Number(a.test_readiness_score);
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '確認対象',
    value: `${detailRows.length}社`,
    interpretation: '100社前後の母集団から一段絞った候補10社を確認。',
  },
  {
    updated_at: generatedAt,
    item: '継続確認',
    value: `${detailRows.filter((row) => row.gate_result === '継続確認').length}社`,
    interpretation: '量的データと信頼度が比較に使える銘柄。20営業日反応で再判定。',
  },
  {
    updated_at: generatedAt,
    item: '要検算',
    value: `${detailRows.filter((row) => row.gate_result === '要検算').length}社`,
    interpretation: '重要データはそろったが、結果が弱く検算が必要な銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '反応待ち',
    value: `${detailRows.filter((row) => row.gate_result === '反応待ち').length}社`,
    interpretation: '決算後反応が1日分だけで、5日/20営業日を待つ銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: 'この表はテスト候補の選別補助であり、購入判断ではない。',
  },
];

const ruleRows = [
  {
    rule: '量的データ主軸',
    detail: 'PER/PBR/ROE、売上成長、利益成長、下落率、出来高、決算後反応を優先する。',
  },
  {
    rule: '質的情報は別層',
    detail: 'AI、半導体、金利、原油、新商品などは調査理由に使い、実績確認前は単純加点しない。',
  },
  {
    rule: '決算後反応は到達確認',
    detail: '1日/5日は暫定。20営業日まで到達した銘柄だけを検算後に採点接続候補にする。',
  },
  {
    rule: '弱い実績は警告',
    detail: '構造仮説が強くても、20営業日の対指数反応が弱い場合は候補強化せず、検算対象にする。',
  },
];

writeCsv('508_candidate_10_test_selection_gate_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);
writeCsv('509_candidate_10_test_selection_gate_detail.csv', detailRows, [
  'updated_at',
  'ticker',
  'company',
  'sector',
  'quantitative_grade',
  'nisa_score_reference',
  'data_confidence',
  'data_readiness_score',
  'qualitative_layer',
  'qualitative_note',
  'reaction_layer',
  'reaction_note',
  'test_readiness_score',
  'gate_result',
  'gate_reason',
  'score_policy',
]);
writeCsv('510_candidate_10_test_selection_gate_rules.csv', ruleRows, ['rule', 'detail']);

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
  <title>候補10社 テスト選定ゲート 2026年5月26日</title>
  <style>
    :root {
      --ink: #071b31;
      --muted: #3f5168;
      --line: #c9d9ea;
      --bg: #f4f8fc;
      --navy: #0d3658;
      --blue: #0b6fa4;
      --green: #087f5b;
      --amber: #b45309;
      --red: #b42318;
      --soft: #eef7ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.75;
      letter-spacing: 0;
    }
    header {
      background: var(--navy);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1100px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 18px 0;
      break-inside: avoid;
    }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 128px; }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 30px; line-height: 1.2; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1220px; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #9cc8ec;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1240px); }
      .summary { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 テスト選定ゲート</h1>
    <p>量的データを主軸に、質的情報と決算後反応を別層で確認します。強い仮説があっても、実績反応が弱い場合は候補を強めず、検算対象として扱います。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.interpretation)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">現時点ではテスト候補の優先確認表です。購入判断ではなく、明日までに10社を根拠付きで説明するための検算順を決める資料です。</p>
      <div class="toolbar">
        <a class="button" href="508_candidate_10_test_selection_gate_summary.csv">508 要約CSV</a>
        <a class="button" href="509_candidate_10_test_selection_gate_detail.csv">509 詳細CSV</a>
        <a class="button" href="510_candidate_10_test_selection_gate_rules.csv">510 ルールCSV</a>
        <a class="button" href="candidate_10_selection_readiness_20260526.html">選出準備状況へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>テスト候補ゲート</h2>
      ${table(
        [
          { key: 'gate_result', label: '扱い' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'nisa_score_reference', label: '参考点' },
          { key: 'data_confidence', label: '信頼度' },
          { key: 'data_readiness_score', label: 'データ準備点' },
          { key: 'qualitative_layer', label: '質的層' },
          { key: 'reaction_layer', label: '実績反応層' },
          { key: 'reaction_note', label: '反応根拠' },
          { key: 'gate_reason', label: '扱いの理由' },
        ],
        detailRows,
      )}
    </section>

    <section>
      <h2>運用ルール</h2>
      ${table(
        [
          { key: 'rule', label: 'ルール' },
          { key: 'detail', label: '内容' },
        ],
        ruleRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_test_selection_gate_20260526.html'), html, 'utf8');

console.log(`created candidate_10_test_selection_gate_20260526.html rows=${detailRows.length}`);
