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

function num(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replaceAll(',', '').replace('%', '').trim();
  if (!text || text === '-' || text === '未取得') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, unit = '') {
  const parsed = num(value);
  if (parsed === null) return '未取得';
  return `${Math.round(parsed * 100) / 100}${unit}`;
}

const recheckRows = readCsv('386_semiconductor_ticker_recheck_conditions.csv');
const commonGateRows = readCsv('385_semiconductor_common_gate_rules.csv');

const fieldRows = [
  {
    updated_at: generatedAt,
    group: 'CPI',
    field_id: 'cpi_yoy',
    field_name: '総合CPI前年比',
    unit: '%',
    pass: '3.8以下',
    caution: '3.9〜4.0',
    stop: '4.0超',
  },
  {
    updated_at: generatedAt,
    group: 'CPI',
    field_id: 'cpi_mom',
    field_name: '総合CPI前月比',
    unit: '%',
    pass: '0.4以下',
    caution: '0.5',
    stop: '0.5超',
  },
  {
    updated_at: generatedAt,
    group: 'CPI',
    field_id: 'core_cpi_mom',
    field_name: 'コアCPI前月比',
    unit: '%',
    pass: '0.4以下',
    caution: '0.5未満',
    stop: '0.5以上',
  },
  {
    updated_at: generatedAt,
    group: '金利',
    field_id: 'us10y_after_cpi',
    field_name: 'CPI後の米10年金利',
    unit: '%',
    pass: '4.60未満',
    caution: '4.60〜4.70',
    stop: '4.70以上',
  },
  {
    updated_at: generatedAt,
    group: '日銀',
    field_id: 'yen_strength_2d',
    field_name: '日銀後2営業日の円高率',
    unit: '%',
    pass: '3.0未満',
    caution: '2.0〜3.0',
    stop: '3.0以上',
  },
  {
    updated_at: generatedAt,
    group: '日銀',
    field_id: 'n225_ma75_gap',
    field_name: '日経平均の75日線乖離',
    unit: '%',
    pass: '-1.0以上',
    caution: '-2.0〜-1.0',
    stop: '-2.0未満',
  },
  {
    updated_at: generatedAt,
    group: 'FOMC',
    field_id: 'us10y_after_fomc',
    field_name: 'FOMC後の米10年金利',
    unit: '%',
    pass: '4.60未満',
    caution: '4.60〜4.70',
    stop: '4.70以上',
  },
  {
    updated_at: generatedAt,
    group: 'FOMC',
    field_id: 'sox_2d_return',
    field_name: 'SOX指数2営業日騰落率',
    unit: '%',
    pass: '-3.0以上',
    caution: '-5.0〜-3.0',
    stop: '-5.0未満',
  },
  {
    updated_at: generatedAt,
    group: 'FOMC',
    field_id: 'nasdaq_2d_return',
    field_name: 'NASDAQ2営業日騰落率',
    unit: '%',
    pass: '-3.0以上',
    caution: '-5.0〜-3.0',
    stop: '-5.0未満',
  },
];

const formulaRows = [
  {
    updated_at: generatedAt,
    target: '共通ゲート',
    formula: '停止条件が1つでもあれば全銘柄停止。注意条件が1つでもあれば候補昇格は保留。全て通過で銘柄別判定へ進む。',
    purpose: 'マクロ悪化時に半導体を無理に買わない。',
  },
  {
    updated_at: generatedAt,
    target: '8035.T 東京エレクトロン',
    formula: 'PER取得済み AND (利益前年比>=0 OR ガイダンス改善) AND (PBR<=10 OR ROE>=25 AND 利益前年比>=10) AND 下落耐性>=55 AND 5営業日対日経平均>=0',
    purpose: '高シェアでも、割高と減益が説明できる場合だけテスト候補へ残す。',
  },
  {
    updated_at: generatedAt,
    target: '7735.T SCREEN HD',
    formula: 'PER<25 AND (売上前年比>=0 OR 利益前年比>=0) AND 下落耐性>=55 AND SOX比悪化>=-3',
    purpose: '割高度が許容範囲でも、減収減益が改善しない場合は進めない。',
  },
  {
    updated_at: generatedAt,
    target: '6146.T ディスコ',
    formula: 'PER取得済み AND (PBR<=10 OR 利益前年比>=15) AND 下落耐性>=55 AND 最大下落率>=-25',
    purpose: '高PBRを利益成長で説明できるかを確認する。',
  },
  {
    updated_at: generatedAt,
    target: '6762.T TDK',
    formula: '売上前年比>=0 AND 利益前年比>=0 AND 下落耐性>=55 AND 需要コメント悪化なし AND 円高ショックなし',
    purpose: '半導体中核ではなく電子部品枠として、為替と需要悪化を避ける。',
  },
  {
    updated_at: generatedAt,
    target: '6920.T / 6857.T',
    formula: '除外継続。イベント反応DBの観察対象に限定し、通常候補へは戻さない。',
    purpose: '過熱・割高・反応弱さを構造材料で打ち消さない。',
  },
];

const logTemplateRows = recheckRows.map((row) => ({
  updated_at: generatedAt,
  check_date: '2026-06-18以降',
  ticker: row.ticker,
  company: row.company,
  cpi_gate: '',
  boj_gate: '',
  fomc_gate: '',
  index_gate: '',
  per_after: '',
  pbr_after: '',
  roe_after: '',
  revenue_yoy_after: '',
  profit_yoy_after: '',
  downside_after: '',
  event_5d_excess_after: '',
  sox_excess_after: '',
  guidance_improved: '',
  demand_comment: '',
  final_status: '',
  reason: '',
}));

const operationRows = [
  {
    updated_at: generatedAt,
    step: 1,
    timing: '2026-06-10 CPI発表後',
    action: 'CPI、コアCPI、米10年金利を入力',
    output: 'CPIゲートの通過・注意・停止を表示',
  },
  {
    updated_at: generatedAt,
    step: 2,
    timing: '2026-06-15〜16 日銀後2営業日',
    action: '円高率、日経平均75日線乖離を入力',
    output: '日銀・円高ゲートの通過・注意・停止を表示',
  },
  {
    updated_at: generatedAt,
    step: 3,
    timing: '2026-06-16〜17 FOMC後2営業日',
    action: '米10年金利、SOX、NASDAQを入力',
    output: 'FOMC・金利ゲートの通過・注意・停止を表示',
  },
  {
    updated_at: generatedAt,
    step: 4,
    timing: '2026-06-18〜24',
    action: '銘柄別のPER/PBR/ROE、売上・利益、下落耐性、5日反応を入力',
    output: '昇格・保留・除外を自動判定',
  },
  {
    updated_at: generatedAt,
    step: 5,
    timing: '判定後',
    action: 'CSV出力して予実差ログへ保管',
    output: '6月一次判定ログ',
  },
];

const sourceRows = [
  {
    updated_at: generatedAt,
    source: '385_semiconductor_common_gate_rules.csv',
    role: '共通ゲートの閾値',
  },
  {
    updated_at: generatedAt,
    source: '386_semiconductor_ticker_recheck_conditions.csv',
    role: '銘柄別の昇格・保留・除外条件',
  },
  {
    updated_at: generatedAt,
    source: '387_semiconductor_recheck_input_template.csv',
    role: '6月イベント後の入力項目',
  },
  {
    updated_at: generatedAt,
    source: 'BLS / FRB / BOJ official calendars',
    role: '6月イベント日程の確認',
  },
];

writeCsv('390_semiconductor_result_input_fields.csv', fieldRows, ['updated_at', 'group', 'field_id', 'field_name', 'unit', 'pass', 'caution', 'stop']);
writeCsv('391_semiconductor_result_formula_rules.csv', formulaRows, ['updated_at', 'target', 'formula', 'purpose']);
writeCsv('392_semiconductor_result_log_template.csv', logTemplateRows, ['updated_at', 'check_date', 'ticker', 'company', 'cpi_gate', 'boj_gate', 'fomc_gate', 'index_gate', 'per_after', 'pbr_after', 'roe_after', 'revenue_yoy_after', 'profit_yoy_after', 'downside_after', 'event_5d_excess_after', 'sox_excess_after', 'guidance_improved', 'demand_comment', 'final_status', 'reason']);
writeCsv('393_semiconductor_result_operation_steps.csv', operationRows, ['updated_at', 'step', 'timing', 'action', 'output']);
writeCsv('394_semiconductor_result_sources.csv', sourceRows, ['updated_at', 'source', 'role']);

function table(headers, rows, cells) {
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体 6月実績入力コックピット</title>
  <style>
    :root {
      --ink: #061d35;
      --muted: #334155;
      --blue: #0b5f92;
      --green: #047857;
      --amber: #b45309;
      --red: #b91c1c;
      --line: #cfe0f3;
      --panel: #fff;
      --soft: #f6fbff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--soft);
      line-height: 1.7;
    }
    header {
      background: linear-gradient(135deg, #082f49, #0b5f92);
      color: #fff;
      padding: 34px 26px 30px;
    }
    main {
      width: min(1180px, calc(100% - 28px));
      margin: 22px auto 60px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.35; }
    h1 { font-size: clamp(26px, 4vw, 42px); }
    h2 {
      margin-top: 34px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 24px;
    }
    p { color: var(--muted); margin: 8px 0; }
    a { color: #075985; font-weight: 800; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .toolbar a, button, .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 9px 14px;
      border-radius: 8px;
      background: #fff;
      color: #07385b;
      text-decoration: none;
      border: 1px solid #b8d4ee;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
      font-weight: 800;
      cursor: pointer;
    }
    button.primary {
      background: #0b5f92;
      color: #fff;
      border-color: #0b5f92;
    }
    .notice {
      margin-top: 16px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.35);
      padding: 14px 16px;
      border-radius: 10px;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .card, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .section { margin-top: 14px; }
    .kpi {
      font-size: 28px;
      color: var(--blue);
      font-weight: 900;
    }
    label {
      display: block;
      font-weight: 900;
      margin-top: 10px;
    }
    input, select {
      width: 100%;
      min-height: 38px;
      padding: 8px 9px;
      border: 1px solid #bfd7ee;
      border-radius: 8px;
      font: inherit;
      background: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      background: #fff;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #d5e4f4;
      padding: 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th {
      background: #e7f2fb;
      text-align: left;
      font-weight: 900;
    }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .good { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .bad { color: var(--red); font-weight: 900; }
    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #075985;
      font-weight: 900;
      white-space: nowrap;
    }
    .result-box {
      min-height: 42px;
      border: 1px solid #d5e4f4;
      border-radius: 8px;
      padding: 9px;
      background: #fbfdff;
      font-weight: 900;
    }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    @media (max-width: 860px) {
      table { font-size: 14px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar, .actions { display: none; }
      .card, .section { box-shadow: none; page-break-inside: avoid; }
      tr { page-break-inside: avoid; }
      th, td { color: #000; }
    }
  </style>
</head>
<body>
  <header>
    <h1>半導体 6月実績入力コックピット</h1>
    <p style="color:#e6f3ff">CPI、日銀、FOMC、指数反応、銘柄別データを入力し、候補へ残す・保留・停止を自動で表示します。</p>
    <div class="notice">今日作るのは入力・判定の器です。6月の実績値は未来なので、発表後に入力します。空欄のまま購入判断へ進めない設計です。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_june_recheck_checklist_20260526.html">6月再判定チェックリスト</a>
      <a href="semiconductor_forward_log_bridge_20260526.html">判定ログ接続</a>
      <a href="semiconductor_fundamental_completion_20260526.html">決算・割高補完</a>
      <a href="june_forward_test_record_20260526.html">6月前向きテスト記録</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      <div class="card">
        <h3>入力対象</h3>
        <div class="kpi">6社</div>
        <p>東京エレクトロン、SCREEN、ディスコ、TDK、レーザーテック、アドバンテスト。</p>
      </div>
      <div class="card">
        <h3>現在の即時候補</h3>
        <div class="kpi">0社</div>
        <p>6月イベント前は候補へ昇格しません。</p>
      </div>
      <div class="card">
        <h3>判定開始</h3>
        <div class="kpi">6/18以降</div>
        <p>CPI・日銀・FOMC後の実数を入れてから判定。</p>
      </div>
    </section>

    <h2>1. 共通ゲート入力</h2>
    <section class="section">
      <div class="grid">
        ${fieldRows.map((field) => `
          <div>
            <label for="${esc(field.field_id)}">${esc(field.field_name)} (${esc(field.unit)})</label>
            <input id="${esc(field.field_id)}" type="number" step="0.01" placeholder="発表後に入力">
            <p>通過: ${esc(field.pass)} / 注意: ${esc(field.caution)} / 停止: ${esc(field.stop)}</p>
          </div>
        `).join('')}
      </div>
      <div class="actions">
        <button class="primary" type="button" onclick="calculateAll()">判定を更新</button>
        <button type="button" onclick="downloadCsv()">判定結果CSVを出力</button>
      </div>
      <div class="grid">
        <div class="card"><h3>CPI</h3><div id="cpi_result" class="result-box">入力待ち</div></div>
        <div class="card"><h3>日銀・円高</h3><div id="boj_result" class="result-box">入力待ち</div></div>
        <div class="card"><h3>FOMC・金利</h3><div id="fomc_result" class="result-box">入力待ち</div></div>
        <div class="card"><h3>指数</h3><div id="index_result" class="result-box">入力待ち</div></div>
      </div>
    </section>

    <h2>2. 銘柄別入力</h2>
    <section class="section">
      <p>空欄がある銘柄は未判定です。レーザーテックとアドバンテストは除外継続のため、観察ログだけに使います。</p>
      <table>
        <thead>
          <tr>
            <th>銘柄</th>
            <th>PER/PBR/ROE</th>
            <th>売上/利益</th>
            <th>下落耐性/反応</th>
            <th>補助条件</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          ${recheckRows.map((row) => `
            <tr data-ticker="${esc(row.ticker)}">
              <td><strong>${esc(row.ticker)} ${esc(row.company)}</strong><br><span class="badge">${esc(row.current_status)}</span><br>${esc(row.current_issue)}</td>
              <td>
                <label>PER</label><input id="${esc(row.ticker)}_per" type="number" step="0.01" placeholder="${esc((row.current_key_numbers.match(/PER ([^ ]+)/) || [])[1] || '')}">
                <label>PBR</label><input id="${esc(row.ticker)}_pbr" type="number" step="0.01" placeholder="${esc((row.current_key_numbers.match(/PBR ([^ ]+)/) || [])[1] || '')}">
                <label>ROE %</label><input id="${esc(row.ticker)}_roe" type="number" step="0.01" placeholder="${esc((row.current_key_numbers.match(/ROE ([^ ]+)/) || [])[1] || '')}">
              </td>
              <td>
                <label>売上前年比 %</label><input id="${esc(row.ticker)}_revenue" type="number" step="0.01">
                <label>利益前年比 %</label><input id="${esc(row.ticker)}_profit" type="number" step="0.01">
              </td>
              <td>
                <label>下落耐性 点</label><input id="${esc(row.ticker)}_downside" type="number" step="1">
                <label>5日超過リターン %</label><input id="${esc(row.ticker)}_event5" type="number" step="0.01">
                <label>SOX比 %</label><input id="${esc(row.ticker)}_sox" type="number" step="0.01">
                <label>最大下落率 %</label><input id="${esc(row.ticker)}_maxdd" type="number" step="0.01">
              </td>
              <td>
                <label>ガイダンス改善</label>
                <select id="${esc(row.ticker)}_guidance"><option value="">未確認</option><option value="yes">改善</option><option value="no">改善なし</option></select>
                <label>需要コメント</label>
                <select id="${esc(row.ticker)}_demand"><option value="">未確認</option><option value="good">悪化なし</option><option value="bad">悪化あり</option></select>
              </td>
              <td><div id="${esc(row.ticker)}_status" class="result-box">未判定</div><p id="${esc(row.ticker)}_reason"></p></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <h2>3. 判定式</h2>
    <section class="section">
      ${table(
        ['対象', '数式', '目的'],
        formulaRows,
        [
          (row) => `<strong>${esc(row.target)}</strong>`,
          (row) => esc(row.formula),
          (row) => esc(row.purpose),
        ],
      )}
    </section>

    <h2>4. 作業手順</h2>
    <section class="section">
      ${table(
        ['手順', '時期', '作業', '出力'],
        operationRows,
        [
          (row) => esc(row.step),
          (row) => esc(row.timing),
          (row) => esc(row.action),
          (row) => esc(row.output),
        ],
      )}
    </section>

    <h2>5. 出力ファイル</h2>
    <section class="section">
      ${table(
        ['ファイル', '内容'],
        [
          ['390_semiconductor_result_input_fields.csv', '入力項目と閾値'],
          ['391_semiconductor_result_formula_rules.csv', '銘柄別判定式'],
          ['392_semiconductor_result_log_template.csv', '判定ログテンプレート'],
          ['393_semiconductor_result_operation_steps.csv', '作業手順'],
          ['394_semiconductor_result_sources.csv', '使用元'],
        ].map(([file, contents]) => ({ file, contents })),
        [
          (row) => `<a href="${esc(row.file)}">${esc(row.file)}</a>`,
          (row) => esc(row.contents),
        ],
      )}
    </section>
  </main>

  <script>
    const tickers = ${JSON.stringify(recheckRows.map((row) => ({ ticker: row.ticker, company: row.company, status: row.current_status })))};

    function n(id) {
      const value = document.getElementById(id)?.value;
      if (value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function s(id) {
      return document.getElementById(id)?.value || '';
    }

    function setBox(id, status, reason) {
      const box = document.getElementById(id);
      box.textContent = status + (reason ? ' / ' + reason : '');
      box.className = 'result-box ' + (status.includes('停止') || status.includes('除外') ? 'bad' : status.includes('注意') || status.includes('保留') || status.includes('未') ? 'warn' : 'good');
      return { status, reason };
    }

    function gateStatus() {
      const cpiYoy = n('cpi_yoy');
      const cpiMom = n('cpi_mom');
      const coreMom = n('core_cpi_mom');
      const us10Cpi = n('us10y_after_cpi');
      const yen = n('yen_strength_2d');
      const n225 = n('n225_ma75_gap');
      const us10Fomc = n('us10y_after_fomc');
      const sox = n('sox_2d_return');
      const nasdaq = n('nasdaq_2d_return');

      const missingCpi = [cpiYoy, cpiMom, coreMom, us10Cpi].some((v) => v === null);
      const missingBoj = [yen, n225].some((v) => v === null);
      const missingFomc = [us10Fomc, sox, nasdaq].some((v) => v === null);

      const cpiStop = !missingCpi && (cpiYoy > 4.0 || coreMom >= 0.5 || us10Cpi >= 4.70);
      const cpiWarn = !missingCpi && !cpiStop && (cpiYoy >= 3.9 || cpiMom >= 0.5 || us10Cpi >= 4.60);
      const bojStop = !missingBoj && (yen >= 3.0 || n225 < -2.0);
      const bojWarn = !missingBoj && !bojStop && (yen >= 2.0 || n225 < -1.0);
      const fomcStop = !missingFomc && (us10Fomc >= 4.70 || sox < -5.0 || nasdaq < -5.0);
      const fomcWarn = !missingFomc && !fomcStop && (us10Fomc >= 4.60 || sox < -3.0 || nasdaq < -3.0);
      const indexStop = n225 !== null && n225 < -2.0;
      const indexWarn = n225 !== null && !indexStop && n225 < -1.0;

      const cpi = missingCpi ? setBox('cpi_result', '未判定', 'CPI・金利を入力') : cpiStop ? setBox('cpi_result', '停止', 'インフレまたは金利が停止条件') : cpiWarn ? setBox('cpi_result', '注意', '半導体候補は保留寄り') : setBox('cpi_result', '通過', 'CPIゲート通過');
      const boj = missingBoj ? setBox('boj_result', '未判定', '円高率・75日線乖離を入力') : bojStop ? setBox('boj_result', '停止', '円高または指数トレンドが停止条件') : bojWarn ? setBox('boj_result', '注意', '輸出・半導体は保留寄り') : setBox('boj_result', '通過', '日銀ゲート通過');
      const fomc = missingFomc ? setBox('fomc_result', '未判定', 'FOMC後の金利・指数を入力') : fomcStop ? setBox('fomc_result', '停止', '金利またはハイテク指数が停止条件') : fomcWarn ? setBox('fomc_result', '注意', '高PER株は保留寄り') : setBox('fomc_result', '通過', 'FOMCゲート通過');
      const index = n225 === null ? setBox('index_result', '未判定', '75日線乖離を入力') : indexStop ? setBox('index_result', '停止', '日経75日線を大きく下回る') : indexWarn ? setBox('index_result', '注意', '指数トレンド弱い') : setBox('index_result', '通過', '指数ゲート通過');

      const statuses = [cpi.status, boj.status, fomc.status, index.status];
      return {
        cpi,
        boj,
        fomc,
        index,
        commonStop: statuses.some((x) => x === '停止'),
        commonWarn: statuses.some((x) => x === '注意' || x === '未判定'),
      };
    }

    function tickerDecision(ticker, gates) {
      if (ticker === '6920.T' || ticker === '6857.T') {
        return { status: '除外継続', reason: '既存除外。観察ログのみ。' };
      }
      if (gates.commonStop) {
        return { status: '停止', reason: '共通ゲートに停止条件あり。' };
      }

      const per = n(ticker + '_per');
      const pbr = n(ticker + '_pbr');
      const roe = n(ticker + '_roe');
      const revenue = n(ticker + '_revenue');
      const profit = n(ticker + '_profit');
      const downside = n(ticker + '_downside');
      const event5 = n(ticker + '_event5');
      const sox = n(ticker + '_sox');
      const maxdd = n(ticker + '_maxdd');
      const guidance = s(ticker + '_guidance');
      const demand = s(ticker + '_demand');

      let pass = false;
      let missing = false;
      let reason = '';

      if (ticker === '8035.T') {
        missing = per === null || pbr === null || roe === null || profit === null || downside === null || event5 === null;
        pass = !missing && (profit >= 0 || guidance === 'yes') && (pbr <= 10 || (roe >= 25 && profit >= 10)) && downside >= 55 && event5 >= 0;
        reason = 'TEL条件: PER取得、利益/ガイダンス改善、PBR説明、下落耐性55点以上、5日対日経0%以上。';
      } else if (ticker === '7735.T') {
        missing = per === null || revenue === null || profit === null || downside === null || sox === null;
        pass = !missing && per < 25 && (revenue >= 0 || profit >= 0) && downside >= 55 && sox >= -3;
        reason = 'SCREEN条件: PER25倍未満、売上/利益どちらか改善、下落耐性55点以上、SOX比-3%以上。';
      } else if (ticker === '6146.T') {
        missing = per === null || pbr === null || profit === null || downside === null || maxdd === null;
        pass = !missing && (pbr <= 10 || profit >= 15) && downside >= 55 && maxdd >= -25;
        reason = 'DISCO条件: PER取得、PBR高を利益成長で説明、下落耐性55点以上、最大下落率-25%以上。';
      } else if (ticker === '6762.T') {
        missing = revenue === null || profit === null || downside === null || demand === '';
        pass = !missing && revenue >= 0 && profit >= 0 && downside >= 55 && demand !== 'bad';
        reason = 'TDK条件: 売上/利益成長維持、下落耐性55点以上、需要悪化なし。';
      }

      if (missing) return { status: '未判定', reason: '必要項目が未入力。' };
      if (gates.commonWarn) return { status: '保留', reason: '共通ゲートに注意または未判定あり。' };
      if (pass) return { status: 'テスト候補', reason };
      return { status: '保留', reason };
    }

    function calculateAll() {
      const gates = gateStatus();
      for (const item of tickers) {
        const result = tickerDecision(item.ticker, gates);
        setBox(item.ticker + '_status', result.status, '');
        document.getElementById(item.ticker + '_reason').textContent = result.reason;
      }
    }

    function csvEscape(value) {
      const text = String(value ?? '');
      return /[",\\n\\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
    }

    function downloadCsv() {
      const gates = gateStatus();
      const headers = ['updated_at','ticker','company','cpi_gate','boj_gate','fomc_gate','index_gate','per_after','pbr_after','roe_after','revenue_yoy_after','profit_yoy_after','downside_after','event_5d_excess_after','sox_excess_after','guidance_improved','demand_comment','final_status','reason'];
      const rows = tickers.map((item) => {
        const result = tickerDecision(item.ticker, gates);
        return {
          updated_at: new Date().toISOString(),
          ticker: item.ticker,
          company: item.company,
          cpi_gate: gates.cpi.status,
          boj_gate: gates.boj.status,
          fomc_gate: gates.fomc.status,
          index_gate: gates.index.status,
          per_after: n(item.ticker + '_per') ?? '',
          pbr_after: n(item.ticker + '_pbr') ?? '',
          roe_after: n(item.ticker + '_roe') ?? '',
          revenue_yoy_after: n(item.ticker + '_revenue') ?? '',
          profit_yoy_after: n(item.ticker + '_profit') ?? '',
          downside_after: n(item.ticker + '_downside') ?? '',
          event_5d_excess_after: n(item.ticker + '_event5') ?? '',
          sox_excess_after: n(item.ticker + '_sox') ?? '',
          guidance_improved: s(item.ticker + '_guidance'),
          demand_comment: s(item.ticker + '_demand'),
          final_status: result.status,
          reason: result.reason,
        };
      });
      const csv = [headers.join(',')].concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))).join('\\n');
      const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'semiconductor_june_result_log.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    calculateAll();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_june_result_input_cockpit_20260526.html'), html, 'utf8');
