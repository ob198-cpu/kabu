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

const candidates = readCsv('628_nisa_test_operation_plan.csv');

const inputRows = candidates.map((row) => ({
  generated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  sector: row.sector,
  base_priority_score: row.test_priority_score,
  current_class: row.test_priority_class,
  cpi_result: '未入力',
  boj_result: '未入力',
  fomc_result: '未入力',
  us10y_change_bp: '',
  usd_jpy_change_pct: '',
  nikkei_75d_position: '未入力',
  post20d_excess_return_pct: '',
  company_revision: '未確認',
  qualitative_alert: '未確認',
  final_class: '未判定',
  memo: '',
}));

const formulaRows = [
  {
    item: '再判定点',
    formula: '基礎優先度 + 市場イベント補正 + 日経75日線補正 + 決算後20営業日反応補正 + 会社予想補正 + 質的警戒補正 - 未入力控除',
    reason: '6月イベント後の実数で、候補維持・保留・除外候補を同じ条件で判定するため。',
  },
  {
    item: '市場イベント補正',
    formula: 'CPI、日銀、FOMCが良好なら各+2、警戒なら各-3、悪化なら各-8',
    reason: '市場全体の金利・為替・リスク許容度を反映する。',
  },
  {
    item: '日経75日線補正',
    formula: '75日線より上なら+3、近辺なら0、明確に下なら-12',
    reason: '日本株全体の地合いが悪い時に個別候補だけを上げすぎないため。',
  },
  {
    item: '決算後20営業日反応',
    formula: '対指数超過リターンが+5%以上なら+6、0〜+5%なら+2、-5〜0%なら-4、-5%未満なら-12',
    reason: '決算内容が実際に株価へ評価されたかを確認する。',
  },
  {
    item: '会社予想補正',
    formula: '上方修正+6、据置0、下方修正-18、未確認-4',
    reason: '1年保有では会社側の業績見通しを重視する。',
  },
  {
    item: '質的警戒補正',
    formula: '警戒なし+2、警戒-8、重大警戒-18、未確認-3',
    reason: '質的材料を直接加点せず、警戒・確認条件として使う。',
  },
  {
    item: '判定',
    formula: '75点以上は候補維持、62〜74.9点は追加確認、50〜61.9点は保留、50点未満は除外候補。ただし下方修正・75日線割れ・重大警戒は上限を保留以下に制限。',
    reason: '点数だけでなく、明確な危険条件を優先するため。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '目的',
    detail: '6月イベント後の実数を入力し、候補維持・追加確認・保留・除外候補を同じルールで再判定する。',
  },
  {
    generated_at: generatedAt,
    item: '入力対象',
    detail: 'CPI、日銀、FOMC、米10年金利、為替、日経平均75日線、決算後20営業日反応、会社予想、質的警戒。',
  },
  {
    generated_at: generatedAt,
    item: '注意',
    detail: '本画面は購入対象の確定ではない。再判定結果をもとに、最終確認資料へ進めるかを決める。',
  },
];

writeCsv('632_june_redecision_input_template.csv', inputRows, [
  'generated_at',
  'ticker',
  'company',
  'sector',
  'base_priority_score',
  'current_class',
  'cpi_result',
  'boj_result',
  'fomc_result',
  'us10y_change_bp',
  'usd_jpy_change_pct',
  'nikkei_75d_position',
  'post20d_excess_return_pct',
  'company_revision',
  'qualitative_alert',
  'final_class',
  'memo',
]);
writeCsv('633_june_redecision_formula.csv', formulaRows, ['item', 'formula', 'reason']);
writeCsv('634_june_redecision_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);

const embedded = JSON.stringify(inputRows.map((row) => ({
  ticker: row.ticker,
  company: row.company,
  sector: row.sector,
  base: Number(row.base_priority_score),
  currentClass: row.current_class,
})));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月再判定 入力画面 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; --red:#a82424; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1420px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1100px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .metric b { display:block; font-size:28px; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:1180px; }
    .wide table { min-width:2400px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px 9px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    select,input { width:100%; min-width:86px; min-height:34px; border:1px solid #b8cadb; border-radius:7px; padding:5px 7px; font:inherit; color:#061e38; background:#fff; }
    .score { font-weight:800; color:var(--blue); }
    .class-keep { color:var(--green); font-weight:800; }
    .class-check { color:var(--blue); font-weight:800; }
    .class-hold { color:var(--orange); font-weight:800; }
    .class-remove { color:var(--red); font-weight:800; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a,.actions button { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; border:0; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; cursor:pointer; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .grid { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>6月再判定 入力画面</h1>
      <p class="lead">6月の市場イベントと銘柄別の実数を入力し、候補維持・追加確認・保留・除外候補を同じルールで判定します。入力前の値は仮判定ではなく、未入力状態として扱います。</p>
    </header>

    <section>
      <h2>1. 位置づけ</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">この画面は投資実行判断ではありません。6月イベント後に同じ条件で候補を比較するための入力・再判定画面です。</div>
    </section>

    <section>
      <h2>2. 判定サマリー</h2>
      <div class="grid">
        <div class="metric"><b id="countKeep">0</b><span>候補維持</span></div>
        <div class="metric"><b id="countCheck">0</b><span>追加確認</span></div>
        <div class="metric"><b id="countHold">0</b><span>保留</span></div>
        <div class="metric"><b id="countRemove">0</b><span>除外候補</span></div>
      </div>
    </section>

    <section>
      <h2>3. 入力して再判定</h2>
      <div class="table-wrap wide">
        <table id="decisionTable">
          <thead>
            <tr>
              <th>銘柄</th><th>会社名</th><th>現在分類</th><th>基礎優先度</th>
              <th>CPI</th><th>日銀</th><th>FOMC</th><th>米10年金利bp</th><th>ドル円%</th>
              <th>日経75日線</th><th>20営業日超過%</th><th>会社予想</th><th>質的警戒</th>
              <th>再判定点</th><th>判定</th><th>理由</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="actions">
        <button type="button" id="recalc">再計算</button>
        <a href="632_june_redecision_input_template.csv">入力テンプレートCSV</a>
        <a href="633_june_redecision_formula.csv">判定式CSV</a>
        <a href="candidate_selection_explanation_20260527.html">候補説明へ</a>
      </div>
    </section>

    <section>
      <h2>4. 判定式</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'formula', label: '式・ルール' },
        { key: 'reason', label: '理由' },
      ], formulaRows, 'wide')}
    </section>
  </main>
  <script>
    const rows = ${embedded};
    const tbody = document.querySelector('#decisionTable tbody');
    const options = {
      macro: ['未入力','良好','警戒','悪化'],
      line: ['未入力','上','近辺','下'],
      revision: ['未確認','上方修正','据置','下方修正'],
      alert: ['未確認','警戒なし','警戒','重大警戒'],
    };
    function select(name, list) {
      return '<select data-field="' + name + '">' + list.map((item) => '<option value="' + item + '">' + item + '</option>').join('') + '</select>';
    }
    function render() {
      tbody.innerHTML = rows.map((row, index) => '<tr data-index="' + index + '">' +
        '<td>' + row.ticker + '</td><td>' + row.company + '</td><td>' + row.currentClass + '</td><td class="score">' + row.base + '</td>' +
        '<td>' + select('cpi', options.macro) + '</td>' +
        '<td>' + select('boj', options.macro) + '</td>' +
        '<td>' + select('fomc', options.macro) + '</td>' +
        '<td><input data-field="rate" type="number" step="1" placeholder="例 15"></td>' +
        '<td><input data-field="fx" type="number" step="0.1" placeholder="例 -1.2"></td>' +
        '<td>' + select('line', options.line) + '</td>' +
        '<td><input data-field="reaction" type="number" step="0.1" placeholder="例 3.5"></td>' +
        '<td>' + select('revision', options.revision) + '</td>' +
        '<td>' + select('alert', options.alert) + '</td>' +
        '<td class="score resultScore">-</td><td class="resultClass">未判定</td><td class="reason">未入力</td>' +
        '</tr>').join('');
      recalc();
    }
    function macroAdj(value) {
      if (value === '良好') return 2;
      if (value === '警戒') return -3;
      if (value === '悪化') return -8;
      return -2;
    }
    function lineAdj(value) {
      if (value === '上') return 3;
      if (value === '近辺') return 0;
      if (value === '下') return -12;
      return -3;
    }
    function reactionAdj(value) {
      if (Number.isNaN(value)) return -4;
      if (value >= 5) return 6;
      if (value >= 0) return 2;
      if (value >= -5) return -4;
      return -12;
    }
    function revisionAdj(value) {
      if (value === '上方修正') return 6;
      if (value === '据置') return 0;
      if (value === '下方修正') return -18;
      return -4;
    }
    function alertAdj(value) {
      if (value === '警戒なし') return 2;
      if (value === '警戒') return -8;
      if (value === '重大警戒') return -18;
      return -3;
    }
    function classify(score, hardBlock) {
      if (hardBlock) return '保留';
      if (score >= 75) return '候補維持';
      if (score >= 62) return '追加確認';
      if (score >= 50) return '保留';
      return '除外候補';
    }
    function recalc() {
      let counts = { '候補維持':0, '追加確認':0, '保留':0, '除外候補':0 };
      document.querySelectorAll('#decisionTable tbody tr').forEach((tr) => {
        const row = rows[Number(tr.dataset.index)];
        const get = (field) => tr.querySelector('[data-field="' + field + '"]').value;
        const rate = Number(get('rate'));
        const fx = Number(get('fx'));
        const reaction = Number(get('reaction'));
        const cpi = get('cpi');
        const boj = get('boj');
        const fomc = get('fomc');
        const line = get('line');
        const revision = get('revision');
        const alert = get('alert');
        let score = row.base + macroAdj(cpi) + macroAdj(boj) + macroAdj(fomc) + lineAdj(line) + reactionAdj(reaction) + revisionAdj(revision) + alertAdj(alert);
        if (!Number.isNaN(rate) && rate >= 25) score -= 5;
        if (!Number.isNaN(fx) && Math.abs(fx) >= 3) score -= 4;
        const hardBlock = line === '下' || revision === '下方修正' || alert === '重大警戒' || reaction < -5;
        score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
        const klass = classify(score, hardBlock);
        counts[klass] += 1;
        const reasons = [];
        if (line === '下') reasons.push('日経75日線下回り');
        if (revision === '下方修正') reasons.push('会社予想下方修正');
        if (alert === '重大警戒') reasons.push('質的重大警戒');
        if (reaction < -5) reasons.push('決算後反応が弱い');
        if (!reasons.length) reasons.push('入力条件で再判定');
        tr.querySelector('.resultScore').textContent = score;
        const classCell = tr.querySelector('.resultClass');
        classCell.textContent = klass;
        classCell.className = 'resultClass ' + (klass === '候補維持' ? 'class-keep' : klass === '追加確認' ? 'class-check' : klass === '保留' ? 'class-hold' : 'class-remove');
        tr.querySelector('.reason').textContent = reasons.join(' / ');
      });
      document.getElementById('countKeep').textContent = counts['候補維持'];
      document.getElementById('countCheck').textContent = counts['追加確認'];
      document.getElementById('countHold').textContent = counts['保留'];
      document.getElementById('countRemove').textContent = counts['除外候補'];
    }
    render();
    document.getElementById('decisionTable').addEventListener('input', recalc);
    document.getElementById('decisionTable').addEventListener('change', recalc);
    document.getElementById('recalc').addEventListener('click', recalc);
  </script>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'june_redecision_input_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: inputRows.length,
  output: 'june_redecision_input_20260527.html',
}, null, 2));
