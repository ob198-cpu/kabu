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

const sampleRows = [
  {
    updated_at: generatedAt,
    ticker: '8035.T',
    company: '東京エレクトロン',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: '',
    pbr_after: 10.8,
    roe_after: 29.56,
    revenue_yoy_after: 0.5,
    profit_yoy_after: -10.4,
    downside_after: 37,
    event_5d_excess_after: '',
    sox_excess_after: '',
    guidance_improved: 'no',
    demand_comment: 'good',
    final_status: '保留',
    reason: 'ダミー: PER未取得、利益前年比マイナス、下落耐性55点未満のため保留。',
  },
  {
    updated_at: generatedAt,
    ticker: '7735.T',
    company: 'SCREEN HD',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: 20,
    pbr_after: 4.2,
    roe_after: 20,
    revenue_yoy_after: 1.2,
    profit_yoy_after: 0.4,
    downside_after: 58,
    event_5d_excess_after: 0.8,
    sox_excess_after: -1.2,
    guidance_improved: 'yes',
    demand_comment: 'good',
    final_status: 'テスト候補',
    reason: 'ダミー: PER25倍未満、売上/利益改善、下落耐性55点以上、SOX比-3%以上のためテスト候補。',
  },
  {
    updated_at: generatedAt,
    ticker: '6146.T',
    company: 'ディスコ',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: '',
    pbr_after: 12.32,
    roe_after: 25.15,
    revenue_yoy_after: 11.1,
    profit_yoy_after: 10.9,
    downside_after: 26,
    event_5d_excess_after: '',
    sox_excess_after: '',
    guidance_improved: 'yes',
    demand_comment: 'good',
    final_status: '保留',
    reason: 'ダミー: PER未取得、PBR高、下落耐性55点未満のため保留。',
  },
  {
    updated_at: generatedAt,
    ticker: '6920.T',
    company: 'レーザーテック',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: 47.95,
    pbr_after: 15.28,
    roe_after: 46.88,
    revenue_yoy_after: 17.8,
    profit_yoy_after: 51,
    downside_after: 52,
    event_5d_excess_after: '',
    sox_excess_after: '',
    guidance_improved: '',
    demand_comment: 'good',
    final_status: '除外継続',
    reason: 'ダミー: 既存除外。観察ログのみ。',
  },
  {
    updated_at: generatedAt,
    ticker: '6857.T',
    company: 'アドバンテスト',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: 42,
    pbr_after: 24.55,
    roe_after: 57.65,
    revenue_yoy_after: 44.7,
    profit_yoy_after: 118.8,
    downside_after: 37,
    event_5d_excess_after: '',
    sox_excess_after: '',
    guidance_improved: '',
    demand_comment: 'good',
    final_status: '除外継続',
    reason: 'ダミー: 既存除外。観察ログのみ。',
  },
  {
    updated_at: generatedAt,
    ticker: '6762.T',
    company: 'TDK',
    cpi_gate: '通過',
    boj_gate: '通過',
    fomc_gate: '通過',
    index_gate: '通過',
    per_after: 26.7,
    pbr_after: 2.75,
    roe_after: 9.81,
    revenue_yoy_after: 13.6,
    profit_yoy_after: 21.5,
    downside_after: 58,
    event_5d_excess_after: 0.5,
    sox_excess_after: '',
    guidance_improved: 'yes',
    demand_comment: 'good',
    final_status: 'テスト候補',
    reason: 'ダミー: 売上/利益成長、需要悪化なし、下落耐性55点以上のためテスト候補。',
  },
];

const decisionLogRows = sampleRows.map((row) => ({
  updated_at: generatedAt,
  decision_logged_at: row.updated_at,
  ticker: row.ticker,
  company: row.company,
  cpi_gate: row.cpi_gate,
  boj_gate: row.boj_gate,
  fomc_gate: row.fomc_gate,
  index_gate: row.index_gate,
  june_first_status: row.final_status,
  decision_reason: row.reason,
  next_record_due: '1営業日後 / 5営業日後 / 20営業日後',
  storage_note: 'ドライラン用ダミーデータ。実績値ではない。',
}));

const predictionRows = sampleRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  event_date: '2026-06-18〜2026-06-24',
  event: '半導体6月一次判定 ドライラン',
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
  pre_event_prediction: row.final_status,
  actual_result: '',
  prediction_error_note: row.reason,
  next_model_fix: '',
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    value: '本番前の動作確認',
    interpretation: '架空の6月イベント後データを使い、実績入力CSVから判定ログと予実差ログへ変換できるかを確認する。',
  },
  {
    updated_at: generatedAt,
    item: 'データ性質',
    value: 'ダミー',
    interpretation: '実績値ではない。購入判断・顧客向け実績報告には使わない。',
  },
  {
    updated_at: generatedAt,
    item: 'サンプル判定',
    value: 'テスト候補2社 / 保留2社 / 除外継続2社',
    interpretation: 'SCREENとTDKがテスト候補になる仮定。東京エレクトロンとディスコは保留のままにした。',
  },
  {
    updated_at: generatedAt,
    item: '確認できること',
    value: 'CSV変換',
    interpretation: 'コックピット出力と同じ列構造で、ログ接続ページが読み込めるサンプルを用意した。',
  },
];

const checklistRows = [
  {
    updated_at: generatedAt,
    check: 'サンプルCSVを開けるか',
    expected: '402_semiconductor_dry_run_sample_result_log.csvをダウンロードまたはリンクから確認できる。',
    result: '作成済み',
  },
  {
    updated_at: generatedAt,
    check: 'ログ接続ページに読み込めるか',
    expected: '半導体 判定ログ接続ページでファイル選択し、6件のプレビューが出る。',
    result: '手動確認対象',
  },
  {
    updated_at: generatedAt,
    check: '一次判定ログへ変換できるか',
    expected: 'semiconductor_june_decision_log.csvを出力できる。',
    result: '手動確認対象',
  },
  {
    updated_at: generatedAt,
    check: '予実差テンプレートへ変換できるか',
    expected: 'semiconductor_june_prediction_actual_log.csvを出力できる。',
    result: '手動確認対象',
  },
  {
    updated_at: generatedAt,
    check: '実績値と誤認しないか',
    expected: 'ページとCSVにダミーであることを明記している。',
    result: '作成済み',
  },
];

writeCsv('401_semiconductor_dry_run_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('402_semiconductor_dry_run_sample_result_log.csv', sampleRows, ['updated_at', 'ticker', 'company', 'cpi_gate', 'boj_gate', 'fomc_gate', 'index_gate', 'per_after', 'pbr_after', 'roe_after', 'revenue_yoy_after', 'profit_yoy_after', 'downside_after', 'event_5d_excess_after', 'sox_excess_after', 'guidance_improved', 'demand_comment', 'final_status', 'reason']);
writeCsv('403_semiconductor_dry_run_decision_log.csv', decisionLogRows, ['updated_at', 'decision_logged_at', 'ticker', 'company', 'cpi_gate', 'boj_gate', 'fomc_gate', 'index_gate', 'june_first_status', 'decision_reason', 'next_record_due', 'storage_note']);
writeCsv('404_semiconductor_dry_run_prediction_actual_template.csv', predictionRows, ['updated_at', 'ticker', 'company', 'event_date', 'event', 'before_event_price', 'event_day_price', 'return_1d_pct', 'return_5d_pct', 'return_20d_pct', 'benchmark_return_1d_pct', 'benchmark_return_5d_pct', 'benchmark_return_20d_pct', 'excess_1d_pct', 'excess_5d_pct', 'excess_20d_pct', 'pre_event_prediction', 'actual_result', 'prediction_error_note', 'next_model_fix']);
writeCsv('405_semiconductor_dry_run_checklist.csv', checklistRows, ['updated_at', 'check', 'expected', 'result']);

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
  <title>半導体 6月ドライラン確認</title>
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
      line-height: 1.75;
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
    .toolbar a, .button {
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
    .kpi { font-size: 28px; color: var(--blue); font-weight: 900; }
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
    th { background: #e7f2fb; text-align: left; font-weight: 900; }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .good { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .bad { color: var(--red); font-weight: 900; }
    @media (max-width: 860px) { table { font-size: 14px; } }
  </style>
</head>
<body>
  <header>
    <h1>半導体 6月ドライラン確認</h1>
    <p style="color:#e6f3ff">6月イベント後の実績入力から判定ログ保存まで、流れが切れていないかを架空データで確認するページです。</p>
    <div class="notice">このページの数値はドライラン用のダミーです。実績値でも購入判断でもありません。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
      <a href="semiconductor_forward_log_bridge_20260526.html">判定ログ接続</a>
      <a href="june_forward_test_record_20260526.html">6月前向きテスト記録</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      ${summaryRows.map((row) => `
        <div class="card">
          <h3>${esc(row.item)}</h3>
          <div class="kpi">${esc(row.value)}</div>
          <p>${esc(row.interpretation)}</p>
        </div>
      `).join('')}
    </section>

    <h2>1. ドライラン用サンプル判定</h2>
    <section class="section">
      ${table(
        ['銘柄', 'CPI/日銀/FOMC/指数', '入力例', '判定', '理由'],
        sampleRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong>`,
          (row) => `${esc(row.cpi_gate)} / ${esc(row.boj_gate)} / ${esc(row.fomc_gate)} / ${esc(row.index_gate)}`,
          (row) => `PER ${esc(row.per_after || '未取得')} / PBR ${esc(row.pbr_after)} / 売上 ${esc(row.revenue_yoy_after)}% / 利益 ${esc(row.profit_yoy_after)}% / 下落耐性 ${esc(row.downside_after)}点`,
          (row) => `<span class="${row.final_status === 'テスト候補' ? 'good' : row.final_status === '除外継続' ? 'bad' : 'warn'}">${esc(row.final_status)}</span>`,
          (row) => esc(row.reason),
        ],
      )}
    </section>

    <h2>2. 確認手順</h2>
    <section class="section">
      <ol>
        <li><a href="402_semiconductor_dry_run_sample_result_log.csv">402_semiconductor_dry_run_sample_result_log.csv</a> を使う。</li>
        <li><a href="semiconductor_forward_log_bridge_20260526.html">半導体 判定ログ接続</a> を開く。</li>
        <li>CSVを読み込む。</li>
        <li>一次判定ログCSVと予実差テンプレートCSVを出力する。</li>
        <li>本番時はダミーではなく、6月イベント後の実績CSVで同じ手順を行う。</li>
      </ol>
    </section>

    <h2>3. チェックリスト</h2>
    <section class="section">
      ${table(
        ['確認', '期待結果', '状態'],
        checklistRows,
        [
          (row) => esc(row.check),
          (row) => esc(row.expected),
          (row) => esc(row.result),
        ],
      )}
    </section>

    <h2>4. 出力ファイル</h2>
    <section class="section">
      ${table(
        ['ファイル', '内容'],
        [
          ['401_semiconductor_dry_run_summary.csv', '要約'],
          ['402_semiconductor_dry_run_sample_result_log.csv', 'ドライラン用サンプル判定CSV'],
          ['403_semiconductor_dry_run_decision_log.csv', '変換後の一次判定ログサンプル'],
          ['404_semiconductor_dry_run_prediction_actual_template.csv', '変換後の予実差テンプレートサンプル'],
          ['405_semiconductor_dry_run_checklist.csv', '確認チェックリスト'],
        ].map(([file, contents]) => ({ file, contents })),
        [
          (row) => `<a href="${esc(row.file)}">${esc(row.file)}</a>`,
          (row) => esc(row.contents),
        ],
      )}
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_june_dry_run_test_20260526.html'), html, 'utf8');
