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

function missingType(row) {
  if (row.missing_area.includes('決算後反応')) return '待つ';
  if (row.missing_area.includes('財務指標')) return '埋める';
  if (row.missing_area.includes('業種別補正')) return '埋める';
  if (row.missing_area.includes('イベント後リターン')) return '仮説と実績を分ける';
  return '確認';
}

function sourceFor(row) {
  if (row.missing_area.includes('決算後反応')) return '株価時系列、日経平均/TOPIX、決算日。20営業日が未到達なら未到達として記録。';
  if (row.missing_area.includes('財務指標')) return '公式決算短信、有価証券報告書、既存CSV。未取得値は空欄のままにする。';
  if (row.missing_area.includes('業種別補正')) return '同業2社以上のPER/PBR/ROE、売上成長、利益成長。';
  if (row.missing_area.includes('イベント後リターン')) return 'イベント日、関連指数、対象銘柄の1/5/20営業日後リターン。';
  return '既存CSVと公式資料。';
}

function acceptanceFor(row) {
  if (row.missing_area.includes('決算後反応')) return '1日/5日反応は記録。20営業日未到達は「未到達」と明記し、点数に混ぜない。';
  if (row.missing_area.includes('財務指標')) return 'PER/PBR/ROE、売上成長、利益成長のうち欠けている項目を埋める。出典欄を残す。';
  if (row.missing_area.includes('業種別補正')) return '候補銘柄を同業平均または同業中央値と比較できる状態にする。';
  if (row.missing_area.includes('イベント後リターン')) return '仮説層と実績層を別列にする。実績がない場合は加点せず、検証待ちにする。';
  return '不足の有無と出典を記録する。';
}

function hypothesisFor(ticker) {
  const map = {
    '6762.T': {
      trigger: 'AIサーバー、電源、電子部品、為替',
      hypothesis: 'AIサーバーと電源・受動部品需要が伸びるとTDKの電子部品需要へ接続する可能性。',
      evidenceNeed: 'AIサーバー関連ニュース、電子部品受注、同業電子部品株の反応、決算コメント。',
    },
    '2802.T': {
      trigger: '食品値上げ、ヘルスケア、原材料、円安',
      hypothesis: '食品の値上げ耐性とABF/ヘルスケア成長が利益率を支えれば評価される可能性。',
      evidenceNeed: '原材料価格、値上げ浸透、同業食品のPER、ABF/ヘルスケア売上コメント。',
    },
    '8766.T': {
      trigger: '金利、保険料率、自然災害、政策保有株売却',
      hypothesis: '金利上昇と政策保有株売却・還元が評価されやすい一方、災害損失で揺れる。',
      evidenceNeed: '日銀/米金利、損害率、保険料率、還元方針、同業保険株の反応。',
    },
    '8316.T': {
      trigger: '日銀、金利、利ざや、信用コスト',
      hypothesis: '金利上昇は利ざや改善に効くが、急な景気悪化や信用コスト上昇で相殺される。',
      evidenceNeed: '日銀会合、長短金利、銀行株指数、信用コスト、決算説明資料。',
    },
    '8306.T': {
      trigger: '日銀、金利、利ざや、海外金利',
      hypothesis: '金利正常化・海外金利環境が利益に接続しやすいが、急変時は相場全体の下落も受ける。',
      evidenceNeed: '日銀会合、米金利、銀行株指数、PER/PBR/ROE補完、信用コスト。',
    },
    '6367.T': {
      trigger: 'データセンター冷却、猛暑、設備投資、為替',
      hypothesis: '空調・冷却需要とデータセンター投資が追い風。ただし中国・住宅・為替で鈍化もある。',
      evidenceNeed: 'データセンター投資、空調需要、地域別売上、受注・利益率、同業比較。',
    },
    '6503.T': {
      trigger: '電力、FA、防衛、データセンター、設備投資',
      hypothesis: '電力制御・FA・インフラ需要が伸びれば追い風。ただし設備投資循環の影響を受ける。',
      evidenceNeed: '受注、FA市況、電力投資、データセンター関連、決算コメント。',
    },
    '5020.T': {
      trigger: '原油、精製マージン、為替、中東情勢',
      hypothesis: '原油・精製マージンが利益に直結。地政学や原油急落で逆方向にも大きく振れる。',
      evidenceNeed: '原油価格、精製マージン、在庫評価、為替、エネルギー株指数。',
    },
    '6146.T': {
      trigger: 'AI半導体、HBM、SiC、半導体設備投資',
      hypothesis: '切断・研削・精密加工の構造需要は強いが、半導体設備投資サイクルと高評価に注意。',
      evidenceNeed: 'PER補完、同業半導体装置比較、SOX、受注/出荷、HBM/AI関連コメント。',
    },
    '4385.T': {
      trigger: '国内消費、FinTech、広告、規制',
      hypothesis: '利益成長は魅力だが、事業構成・競争・規制・消費感応度の確認が不足。',
      evidenceNeed: 'PER補完、事業別利益、GMV、広告/FinTech進捗、同業ネット株比較。',
    },
  };
  return map[ticker] || {
    trigger: '未設定',
    hypothesis: '仮説未設定。',
    evidenceNeed: 'イベント日、株価反応、公式資料。',
  };
}

const boardRows = readCsv('419_june_test_10_selection_board.csv');
const missingRowsRaw = readCsv('414_candidate_10_missing_data_resolution.csv');
const boardByTicker = new Map(boardRows.map((row) => [row.ticker, row]));

const workRows = missingRowsRaw.map((row, index) => {
  const b = boardByTicker.get(row.ticker) || {};
  const treatment = missingType(row);
  return {
    updated_at: generatedAt,
    work_id: index + 1,
    ticker: row.ticker,
    company: row.company,
    lane: b.lane || '',
    missing_area: row.missing_area,
    treatment,
    priority: row.priority,
    can_resolve_in_48h: treatment === '待つ' ? '完全解消不可。未到達として記録する。' : row.can_resolve_in_48h,
    source_or_data: sourceFor(row),
    acceptance_rule: acceptanceFor(row),
    effect: treatment === '待つ'
      ? '購入判断には使わず、短期反応ログと未到達フラグだけ残す。'
      : treatment === '仮説と実績を分ける'
        ? '仮説だけでは加点しない。実績層が取れたら候補説明に使う。'
        : '補完後に候補レーンの維持・昇格・保留を再判定する。',
  };
});

const hypothesisRows = boardRows.map((row) => {
  const h = hypothesisFor(row.ticker);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    lane: row.lane,
    event_trigger: h.trigger,
    hypothesis_layer: h.hypothesis,
    evidence_layer_needed: h.evidenceNeed,
    score_policy: '仮説層は購入点へ直接加点しない。実績層が確認できた場合のみ説明材料・ゲート材料にする。',
  };
});

const readinessRows = boardRows.map((row) => {
  const works = workRows.filter((w) => w.ticker === row.ticker);
  const canDo = works.filter((w) => w.treatment !== '待つ').length;
  const mustWait = works.filter((w) => w.treatment === '待つ').length;
  const hypothesis = works.filter((w) => w.treatment === '仮説と実績を分ける').length;
  const nextStatus = row.lane.startsWith('A')
    ? '6月実数入力待ち'
    : row.lane.startsWith('B')
      ? '補完後に6月判定へ'
      : row.lane.startsWith('C')
        ? '補完結果で昇格可否'
        : '補欠のまま比較対象';
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    current_lane: row.lane,
    actionable_items: canDo,
    wait_items: mustWait,
    hypothesis_items: hypothesis,
    next_status: nextStatus,
    purchase_status: '購入判断不可',
    reason: row.purchase_reason,
  };
});

const ruleRows = [
  {
    updated_at: generatedAt,
    rule: '待つ項目を埋めたふりしない',
    detail: '決算後20営業日反応は、20営業日が経過するまで完全値にしない。1日/5日反応だけ暫定記録。',
  },
  {
    updated_at: generatedAt,
    rule: '仮説層と実績層を分ける',
    detail: 'イベントからの演繹仮説は有用だが、それだけで点数加算しない。過去反応・同業反応・指数反応が取れたら実績層にする。',
  },
  {
    updated_at: generatedAt,
    rule: '未取得は空欄で残す',
    detail: 'PERなどが未取得の場合、推測値やAI補完値を入れない。出典がある場合だけ入力。',
  },
  {
    updated_at: generatedAt,
    rule: '6月イベント前は購入判断不可',
    detail: 'CPI、日銀、FOMC、指数ゲートが未入力の間は候補抽出・補完作業まで。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '補完作業件数',
    value: `${workRows.length}件`,
    interpretation: '10社に残る不足項目を作業単位へ分解。',
  },
  {
    updated_at: generatedAt,
    item: '48時間内に初期対応可能',
    value: `${workRows.filter((row) => row.treatment !== '待つ').length}件`,
    interpretation: '財務、同業補正、イベント因果の初期整理は進められる。',
  },
  {
    updated_at: generatedAt,
    item: '待つ項目',
    value: `${workRows.filter((row) => row.treatment === '待つ').length}件`,
    interpretation: '20営業日未到達など、時間が来るまで完全解消できない項目。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: 'この作業ボードでも購入判断には進めない。6月イベント実数入力後に再判定。',
  },
];

writeCsv('422_candidate_10_completion_workbench_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('423_candidate_10_completion_work_queue.csv', workRows, [
  'updated_at',
  'work_id',
  'ticker',
  'company',
  'lane',
  'missing_area',
  'treatment',
  'priority',
  'can_resolve_in_48h',
  'source_or_data',
  'acceptance_rule',
  'effect',
]);

writeCsv('424_candidate_10_event_hypothesis_layers.csv', hypothesisRows, [
  'updated_at',
  'ticker',
  'company',
  'lane',
  'event_trigger',
  'hypothesis_layer',
  'evidence_layer_needed',
  'score_policy',
]);

writeCsv('425_candidate_10_readiness_after_work.csv', readinessRows, [
  'updated_at',
  'ticker',
  'company',
  'current_lane',
  'actionable_items',
  'wait_items',
  'hypothesis_items',
  'next_status',
  'purchase_status',
  'reason',
]);

writeCsv('426_candidate_10_completion_rules.csv', ruleRows, [
  'updated_at',
  'rule',
  'detail',
]);

function table(headers, rows, cells) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function badge(text) {
  let cls = 'muted';
  if (text === '埋める') cls = 'good';
  else if (text === '待つ') cls = 'warn';
  else if (text.includes('仮説')) cls = 'blue';
  else if (text.includes('不可')) cls = 'bad';
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 補完作業ボード</title>
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
    <h1>候補10社 補完作業ボード</h1>
    <p>10社選定ボードから、不足データを「埋める」「待つ」「仮説と実績を分ける」に分解した作業ページです。</p>
    <div class="notice">未到達データや仮説だけの材料は点数に混ぜません。購入判断は6月イベント実数入力後です。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="june_test_10_selection_board_20260526.html">6月テスト10社選定</a>
      <a href="candidate_10_priority_completion_20260526.html">候補10社優先補完</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
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

    <h2>1. 補完作業キュー</h2>
    <p class="small">「待つ」はサボりではなく、未来データを捏造しないための扱いです。</p>
    <section>
      ${table(
        ['ID', '銘柄', '不足領域', '扱い', '48時間内の扱い', '必要データ', '合格条件', '効果'],
        workRows,
        [
          (row) => esc(row.work_id),
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.lane)}`,
          (row) => esc(row.missing_area),
          (row) => badge(row.treatment),
          (row) => esc(row.can_resolve_in_48h),
          (row) => esc(row.source_or_data),
          (row) => esc(row.acceptance_rule),
          (row) => esc(row.effect),
        ],
      )}
    </section>

    <h2>2. イベント仮説層と実績層</h2>
    <p class="small">質的データはここで扱います。仮説だけでは加点せず、実績層が取れたら説明材料にします。</p>
    <section>
      ${table(
        ['銘柄', '見るイベント', '仮説層', '実績層に必要なデータ', '点数ルール'],
        hypothesisRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.lane)}`,
          (row) => esc(row.event_trigger),
          (row) => esc(row.hypothesis_layer),
          (row) => esc(row.evidence_layer_needed),
          (row) => esc(row.score_policy),
        ],
      )}
    </section>

    <h2>3. 補完後の扱い</h2>
    <section>
      ${table(
        ['銘柄', '現在の扱い', 'すぐ作業できる数', '待つ数', '仮説/実績数', '次の状態', '購入判断'],
        readinessRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong>`,
          (row) => esc(row.current_lane),
          (row) => esc(row.actionable_items),
          (row) => esc(row.wait_items),
          (row) => esc(row.hypothesis_items),
          (row) => esc(row.next_status),
          (row) => badge(row.purchase_status),
        ],
      )}
    </section>

    <h2>4. グランドルール</h2>
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

    <h2>5. CSV</h2>
    <section>
      ${table(
        ['ファイル', '内容'],
        [
          ['422_candidate_10_completion_workbench_summary.csv', '要約'],
          ['423_candidate_10_completion_work_queue.csv', '補完作業キュー'],
          ['424_candidate_10_event_hypothesis_layers.csv', 'イベント仮説層/実績層'],
          ['425_candidate_10_readiness_after_work.csv', '補完後の扱い'],
          ['426_candidate_10_completion_rules.csv', 'グランドルール'],
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

fs.writeFileSync(path.join(ROOT, 'candidate_10_completion_workbench_20260526.html'), html, 'utf8');
