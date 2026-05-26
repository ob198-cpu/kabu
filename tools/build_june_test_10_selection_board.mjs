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

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shortMetric(row) {
  const per = row.per || '未取得';
  const pbr = row.pbr || '未取得';
  const roe = row.roe_pct || '未取得';
  const revenue = row.revenue_yoy_pct || '未取得';
  const profit = row.profit_yoy_pct || '未取得';
  return `PER ${per} / PBR ${pbr} / ROE ${roe}% / 売上 ${revenue}% / 利益 ${profit}%`;
}

function role(row) {
  if (row.ticker === '6762.T') return '一次候補。データ完成度が最も高いが、イベント因果は未完了。';
  if (['2802.T', '8766.T', '8316.T', '8306.T', '6367.T', '6503.T'].includes(row.ticker)) {
    return '補完後候補。財務・+1%接続は概ねあるが、決算後反応または同業補正を確認する。';
  }
  if (['5020.T', '6146.T'].includes(row.ticker)) return '補完優先。テーマ性はあるが、残課題が多いため10社内では観察寄り。';
  return '補欠保留。点数は高いが不足が多く、候補確定にはまだ早い。';
}

function lane(row) {
  const score = num(row.priority_score);
  const completion = num(row.completion_score);
  const confidence = num(row.data_confidence);
  if (row.test_lane === '一次テスト候補') return 'A 先行観察';
  if (row.test_lane === '補完後テスト候補' && completion >= 83 && confidence >= 92) return 'B 補完後候補';
  if (row.test_lane === '補完優先') return 'C 補完優先';
  if (score >= 70) return 'D 補欠保留';
  return 'E 除外予備';
}

function decision(row) {
  const l = lane(row);
  if (l.startsWith('A')) return '6月実数入力後、最初に判定する';
  if (l.startsWith('B')) return '不足補完後、6月実数入力で判定する';
  if (l.startsWith('C')) return '補完が進めば候補、進まなければ観察のみ';
  return '現段階では補欠。10社枠の比較対象に残す';
}

function stopReason(row) {
  const issues = [];
  if (row.financial_ready !== '済') issues.push('財務指標未完了');
  if (row.reaction_ready !== '済') issues.push('決算後反応未完了または未到達');
  if (row.sector_adjustment_ready !== '済') issues.push('業種別補正未完了');
  if (row.event_causality_ready !== '済') issues.push('イベント因果未完了');
  if (!issues.length) return '6月イベント実数待ちのみ';
  return issues.join(' / ');
}

const matrixRows = readCsv('413_candidate_10_priority_matrix.csv');

const selectionRows = matrixRows.map((row, index) => ({
  updated_at: generatedAt,
  selection_rank: index + 1,
  ticker: row.ticker,
  company: row.company,
  sector: row.sector,
  lane: lane(row),
  action_status: decision(row),
  priority_score: row.priority_score,
  nisa_score: row.nisa_score,
  completion_score: row.completion_score,
  data_confidence: row.data_confidence,
  metrics: shortMetric(row),
  purchase_status: '購入判断不可',
  purchase_reason: '6月CPI・日銀・FOMC・指数ゲートの実数が未入力のため。',
  role_explanation: role(row),
  blocking_items: stopReason(row),
  next_action: row.next_48h_task,
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '6月テスト用ワークボード',
    value: `${selectionRows.length}社`,
    interpretation: '10社を比較対象として固定。ただし購入候補ではなく、6月イベント後に再判定するための観察・補完対象。',
  },
  {
    updated_at: generatedAt,
    item: 'A 先行観察',
    value: `${selectionRows.filter((row) => row.lane.startsWith('A')).length}社`,
    interpretation: '現時点で最もデータがそろっている。6月実数入力後に最初に判定する。',
  },
  {
    updated_at: generatedAt,
    item: 'B 補完後候補',
    value: `${selectionRows.filter((row) => row.lane.startsWith('B')).length}社`,
    interpretation: '48時間内の補完でテスト候補として扱いやすくなる銘柄群。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '現段階は候補選定工程。6月CPI・日銀・FOMC通過後の実数入力まで購入判断には進めない。',
  },
];

const ruleRows = [
  {
    updated_at: generatedAt,
    rule: '候補抽出と購入判断を分ける',
    detail: '候補補完優先スコアは作業順を決めるための点数であり、購入判断ではない。',
  },
  {
    updated_at: generatedAt,
    rule: '未取得データを点数化しない',
    detail: 'PERなどの未取得値は高得点にも低得点にもせず、blocking_itemsに残す。',
  },
  {
    updated_at: generatedAt,
    rule: '20営業日未到達は未完了として扱う',
    detail: '未来の決算後反応を埋めたふりはしない。1日/5日反応は別枠、20日反応は到達後に追記する。',
  },
  {
    updated_at: generatedAt,
    rule: '6月イベントゲート',
    detail: 'CPI、日銀、FOMC、指数トレンドの実数が悪い場合は、個別候補の点数にかかわらずテスト開始を延期または縮小する。',
  },
  {
    updated_at: generatedAt,
    rule: '+1%目標の扱い',
    detail: '日経平均/TOPIX/S&P500の同期間リターンを基準にし、前向きテストの実績で+1%超過を検証する。',
  },
];

const nextRows = [
  {
    updated_at: generatedAt,
    priority: 1,
    action: 'B候補の不足補完',
    detail: '味の素、東京海上、三井住友FG、三菱UFJ、ダイキン、三菱電機の未到達/未接続項目を整理する。',
  },
  {
    updated_at: generatedAt,
    priority: 2,
    action: 'C候補の継続可否',
    detail: 'ENEOS、ディスコは財務またはイベント因果の不足が残るため、48時間内に候補昇格できるか判定する。',
  },
  {
    updated_at: generatedAt,
    priority: 3,
    action: '補欠の扱い',
    detail: 'メルカリは点数は高いが不足が多いため、10社枠には残すが購入候補扱いはしない。',
  },
  {
    updated_at: generatedAt,
    priority: 4,
    action: '6月実数入力',
    detail: 'CPI、日銀、FOMC、指数ゲートの実数が出た後、コックピットへ入力して再判定する。',
  },
];

writeCsv('418_june_test_10_selection_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('419_june_test_10_selection_board.csv', selectionRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'sector',
  'lane',
  'action_status',
  'priority_score',
  'nisa_score',
  'completion_score',
  'data_confidence',
  'metrics',
  'purchase_status',
  'purchase_reason',
  'role_explanation',
  'blocking_items',
  'next_action',
]);

writeCsv('420_june_test_10_selection_rules.csv', ruleRows, [
  'updated_at',
  'rule',
  'detail',
]);

writeCsv('421_june_test_10_next_actions.csv', nextRows, [
  'updated_at',
  'priority',
  'action',
  'detail',
]);

function table(headers, rows, cells) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function badge(text) {
  let cls = 'muted';
  if (text.startsWith('A')) cls = 'good';
  else if (text.startsWith('B')) cls = 'blue';
  else if (text.startsWith('C')) cls = 'warn';
  else if (text.includes('不可')) cls = 'bad';
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月テスト候補10社 選定ボード</title>
  <style>
    :root {
      --ink: #071b33;
      --muted: #526272;
      --line: #d6e3f1;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #103a5c;
      --blue: #126392;
      --green: #087b53;
      --amber: #a85f00;
      --red: #b3261e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
    }
    header {
      padding: 28px;
      background: var(--navy);
      color: #fff;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 {
      margin: 28px 0 12px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 22px;
    }
    a { color: inherit; }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .toolbar a {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
      border: 1px solid #b9d3eb;
    }
    .notice {
      margin-top: 12px;
      padding: 12px;
      border-radius: 10px;
      background: #fff8e8;
      border: 1px solid #f0c46d;
      color: #3f2b00;
      font-weight: 900;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 8px 18px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .card h3 { margin: 0 0 8px; color: var(--navy); }
    .kpi { font-size: 28px; font-weight: 900; color: var(--blue); }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #fff;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 9px;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: var(--ink);
    }
    th { background: #e6f2fb; text-align: left; font-weight: 900; }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .badge {
      display: inline-flex;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f7fbff;
      font-weight: 900;
    }
    .good { color: var(--green); }
    .blue { color: var(--blue); }
    .warn { color: var(--amber); }
    .bad { color: var(--red); }
    .muted { color: var(--muted); }
    .small { color: var(--muted); font-size: 13px; }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      table { font-size: 13px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar { display: none; }
      .card { box-shadow: none; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>6月テスト候補10社 選定ボード</h1>
    <p>候補補完表をもとに、6月イベント後に判定する10社ワークボードを役割別に整理しました。</p>
    <div class="notice">現段階の購入判断は0社です。この表はテスト対象の比較・補完順を決めるためのものです。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="candidate_10_priority_completion_20260526.html">候補10社優先補完</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
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

    <h2>1. 10社の扱い</h2>
    <p class="small">A/B/C/Dはテスト準備上の扱いです。売買推奨ではありません。</p>
    <section>
      ${table(
        ['順位', '銘柄', '扱い', '次アクション', '優先点/完成度', '基礎数値', '止まっている理由', '役割'],
        selectionRows,
        [
          (row) => esc(row.selection_rank),
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.sector)}`,
          (row) => `${badge(row.lane)}<br>${badge(row.purchase_status)}`,
          (row) => esc(row.action_status),
          (row) => `優先 ${esc(row.priority_score)}点<br>NISA ${esc(row.nisa_score)}点<br>完成 ${esc(row.completion_score)}点<br>信頼 ${esc(row.data_confidence)}点`,
          (row) => esc(row.metrics),
          (row) => esc(row.blocking_items),
          (row) => esc(row.role_explanation),
        ],
      )}
    </section>

    <h2>2. 選定ルール</h2>
    <section>
      ${table(
        ['ルール', '内容'],
        ruleRows,
        [
          (row) => `<strong>${esc(row.rule)}</strong>`,
          (row) => esc(row.detail),
        ],
      )}
    </section>

    <h2>3. 次にやること</h2>
    <section>
      ${table(
        ['優先', '作業', '内容'],
        nextRows,
        [
          (row) => esc(row.priority),
          (row) => `<strong>${esc(row.action)}</strong>`,
          (row) => esc(row.detail),
        ],
      )}
    </section>

    <h2>4. CSV</h2>
    <section>
      ${table(
        ['ファイル', '内容'],
        [
          ['418_june_test_10_selection_summary.csv', '要約'],
          ['419_june_test_10_selection_board.csv', '10社選定ボード'],
          ['420_june_test_10_selection_rules.csv', '選定ルール'],
          ['421_june_test_10_next_actions.csv', '次アクション'],
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

fs.writeFileSync(path.join(ROOT, 'june_test_10_selection_board_20260526.html'), html, 'utf8');
