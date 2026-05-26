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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const boardRows = readCsv('419_june_test_10_selection_board.csv');
const workRows = readCsv('423_candidate_10_completion_work_queue.csv');
const eventRows = readCsv('427_candidate_10_event_evidence_summary.csv');
const eventByTicker = new Map(eventRows.map((row) => [row.ticker, row]));

function categorize(row) {
  const missing = row.missing_area || '';
  const treatment = row.treatment || '';
  if (missing.includes('決算後反応')) return '決算後反応';
  if (missing.includes('財務指標')) return '財務指標';
  if (missing.includes('業種別補正')) return '業種別補正';
  if (treatment.includes('仮説') || missing.includes('イベント')) return 'イベント実績層';
  return 'その他';
}

function statusText(row) {
  if ((row.treatment || '').includes('待つ')) return '待つ';
  if ((row.treatment || '').includes('仮説')) return '実績層待ち';
  return '2日以内に補完';
}

const taskRows = [];
for (const candidate of boardRows) {
  const related = workRows.filter((row) => row.ticker === candidate.ticker);
  const event = eventByTicker.get(candidate.ticker) || {};
  const categories = ['財務指標', '業種別補正', '決算後反応', 'イベント実績層'];
  for (const category of categories) {
    const rows = related.filter((row) => categorize(row) === category);
    const status = category === 'イベント実績層'
      ? '6月イベント後に入力'
      : rows.some((row) => statusText(row) === '待つ')
        ? '待つ'
        : rows.length
          ? '2日以内に補完'
          : '確認済み';
    const priority = category === '財務指標' ? 1 : category === '決算後反応' ? 2 : category === '業種別補正' ? 3 : 4;
    taskRows.push({
      updated_at: generatedAt,
      ticker: candidate.ticker,
      company: candidate.company,
      lane: candidate.lane,
      task_category: category,
      status,
      task_count: category === 'イベント実績層' ? event.evidence_pending || 0 : rows.length,
      priority,
      action: category === '財務指標'
        ? 'PER/PBR/ROE、売上成長率、利益成長率を公式資料または信頼できるデータで埋める'
        : category === '業種別補正'
          ? '同業比較の中央値・レンジを入れ、PER/PBR/ROEの単純比較を避ける'
          : category === '決算後反応'
            ? '決算後1日/5日/20日の対指数超過リターンを記録する。20営業日未到達は待つ'
            : 'イベント日、公式ソース、株価反応、指数反応を入力しS〜C判定する',
      output: category === 'イベント実績層'
        ? '428/433系CSV'
        : '10社選定表・補完作業表',
    });
  }
}

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象候補',
    value: `${boardRows.length}社`,
    meaning: '6月テストの候補として作業する銘柄数。購入確定ではない。',
  },
  {
    updated_at: generatedAt,
    item: 'タスク総数',
    value: `${taskRows.length}件`,
    meaning: '10社×主要4カテゴリで進捗を管理。',
  },
  {
    updated_at: generatedAt,
    item: '2日以内に補完',
    value: `${taskRows.filter((row) => row.status === '2日以内に補完').length}件`,
    meaning: '財務指標や業種補正など、今すぐ表に入れられる作業。',
  },
  {
    updated_at: generatedAt,
    item: '待つ/6月後入力',
    value: `${taskRows.filter((row) => row.status === '待つ' || row.status === '6月イベント後に入力').length}件`,
    meaning: '20営業日反応や6月イベントなど、実績発生後にしか埋まらない作業。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    meaning: '現時点ではテスト候補確定前。購入判断は6月イベント実数後。',
  },
];

const acceptanceRows = [
  {
    updated_at: generatedAt,
    gate: 'データ信頼度',
    condition: '主要財務・株価・出典がそろい、未取得を点数に混ぜていない',
    fail_action: '未取得項目を空欄のまま残し、スコアへ入れない',
  },
  {
    updated_at: generatedAt,
    gate: '決算後反応',
    condition: '1日/5日反応は記録、20営業日未到達は未到達として扱う',
    fail_action: '20営業日を勝手に推測せず、購入判断に使わない',
  },
  {
    updated_at: generatedAt,
    gate: 'イベント実績層',
    condition: 'イベント日・公式ソース・個別株反応・指数反応が入力済み',
    fail_action: '仮説だけでは加点しない',
  },
  {
    updated_at: generatedAt,
    gate: '+1%目標',
    condition: '候補全体で日経平均/TOPIX/S&P500等を1%以上上回る見込みを説明できる',
    fail_action: '個別株比率を下げ、指数・現金比率を上げる',
  },
];

const twoDayRows = [
  {
    updated_at: generatedAt,
    day: 'Day 1',
    work: '10社のPER/PBR/ROE、売上成長率、利益成長率、配当・還元の空欄を補完',
    deliverable: '財務指標補完済みCSV',
  },
  {
    updated_at: generatedAt,
    day: 'Day 1',
    work: '同業比較グループを設定し、PER/PBR/ROEの業種別補正を入れる',
    deliverable: '業種別補正表',
  },
  {
    updated_at: generatedAt,
    day: 'Day 2',
    work: '決算後1日/5日反応、20営業日未到達フラグ、イベント実績層テンプレートを結合',
    deliverable: '10社再判定表',
  },
  {
    updated_at: generatedAt,
    day: 'Day 2',
    work: 'A/B/C/D区分を更新し、6月イベント後に見る項目を銘柄別に固定',
    deliverable: '6月テスト候補10社の暫定版',
  },
];

const riskRows = [
  {
    updated_at: generatedAt,
    risk: '20営業日反応が未到達',
    impact: '決算後反応の信頼性が不足',
    control: '未到達として明記し、1日/5日だけで購入判断しない',
  },
  {
    updated_at: generatedAt,
    risk: 'イベント仮説の過信',
    impact: 'ニュースの説得力だけで候補が残る',
    control: '実績層が未入力なら加点0',
  },
  {
    updated_at: generatedAt,
    risk: '業種をまたいだPER比較',
    impact: '銀行・食品・半導体を同じ物差しで誤判定',
    control: '業種別中央値・レンジで補正',
  },
  {
    updated_at: generatedAt,
    risk: '6月イベントで市場全体が急変',
    impact: '個別株選定より地合いが支配的になる',
    control: 'CPI・日銀・FOMC後に個別株比率を再判定',
  },
];

writeCsv('437_june_10_finalization_sprint_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'meaning']);
writeCsv('438_june_10_finalization_task_board.csv', taskRows, [
  'updated_at',
  'ticker',
  'company',
  'lane',
  'task_category',
  'status',
  'task_count',
  'priority',
  'action',
  'output',
]);
writeCsv('439_june_10_finalization_acceptance_criteria.csv', acceptanceRows, ['updated_at', 'gate', 'condition', 'fail_action']);
writeCsv('440_june_10_finalization_two_day_plan.csv', twoDayRows, ['updated_at', 'day', 'work', 'deliverable']);
writeCsv('441_june_10_finalization_risk_register.csv', riskRows, ['updated_at', 'risk', 'impact', 'control']);

const statusCounts = taskRows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月テスト10社 確定スプリント</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --green: #087a4d;
      --red: #b42318;
      --orange: #b65c00;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      letter-spacing: 0;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 24px;
      color: var(--navy);
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .kpi {
      background: white;
      color: var(--ink);
      border: 1px solid #c9def3;
      border-radius: 12px;
      padding: 12px;
    }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table {
      width: 100%;
      min-width: 940px;
      border-collapse: collapse;
      table-layout: fixed;
      background: white;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th {
      background: #e8f4ff;
      color: #073b63;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f8fbff;
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    }
    .badge.green { color: var(--green); background: #edf9f3; border-color: #bce7d2; }
    .badge.red { color: var(--red); background: #fff1f1; border-color: #ffd1d1; }
    .badge.orange { color: var(--orange); background: #fff3e2; border-color: #ffd7a3; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      table { min-width: 780px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>6月テスト10社 確定スプリント</h1>
      <p>100社前後の母集団から絞った10社について、6月テスト候補として残せるかを確定するための作業ボードです。購入確定ではなく、データ補完・イベント実績入力・+1%目標への接続を管理します。</p>
      <div class="actions">
        <a class="button" href="june_test_10_selection_board_20260526.html">10社選定表</a>
        <a class="button" href="candidate_10_event_evidence_workbench_20260526.html">イベント実績層</a>
        <a class="button" href="438_june_10_finalization_task_board.csv">タスクCSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${boardRows.length}</b><span>対象候補</span></div>
        <div class="kpi"><b>${taskRows.length}</b><span>管理タスク</span></div>
        <div class="kpi"><b>${statusCounts['2日以内に補完'] || 0}</b><span>2日以内に補完</span></div>
        <div class="kpi"><b>${(statusCounts['待つ'] || 0) + (statusCounts['6月イベント後に入力'] || 0)}</b><span>待つ/6月後入力</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      現時点の目的は、テスト候補10社を根拠付きで確定することです。購入判断は6月のCPI・日銀・FOMC等の実数確認後に別途行います。
    </div>

    <section class="panel">
      <h2>銘柄別タスクボード</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">銘柄</th>
              <th style="width: 150px;">会社</th>
              <th style="width: 130px;">区分</th>
              <th style="width: 120px;">カテゴリ</th>
              <th style="width: 130px;">状態</th>
              <th>作業内容</th>
              <th style="width: 120px;">出力先</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows.map((row) => `
              <tr>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.lane)}</td>
                <td>${esc(row.task_category)}</td>
                <td><span class="badge ${row.status === '確認済み' ? 'green' : row.status === '2日以内に補完' ? 'orange' : 'red'}">${esc(row.status)}</span></td>
                <td>${esc(row.action)}</td>
                <td>${esc(row.output)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <h2>合格条件</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 150px;">ゲート</th>
                <th>条件</th>
                <th>未達時</th>
              </tr>
            </thead>
            <tbody>
              ${acceptanceRows.map((row) => `
                <tr>
                  <td>${esc(row.gate)}</td>
                  <td>${esc(row.condition)}</td>
                  <td>${esc(row.fail_action)}</td>
                </tr>`).join('\n')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <h2>2日作業計画</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 90px;">日程</th>
                <th>作業</th>
                <th>成果物</th>
              </tr>
            </thead>
            <tbody>
              ${twoDayRows.map((row) => `
                <tr>
                  <td>${esc(row.day)}</td>
                  <td>${esc(row.work)}</td>
                  <td>${esc(row.deliverable)}</td>
                </tr>`).join('\n')}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>主要リスクと制御</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 220px;">リスク</th>
              <th>影響</th>
              <th>制御方法</th>
            </tr>
          </thead>
          <tbody>
            ${riskRows.map((row) => `
              <tr>
                <td>${esc(row.risk)}</td>
                <td>${esc(row.impact)}</td>
                <td>${esc(row.control)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <a class="button" href="437_june_10_finalization_sprint_summary.csv">概要CSV</a>
        <a class="button" href="438_june_10_finalization_task_board.csv">タスクCSV</a>
        <a class="button" href="439_june_10_finalization_acceptance_criteria.csv">合格条件CSV</a>
        <a class="button" href="440_june_10_finalization_two_day_plan.csv">2日計画CSV</a>
        <a class="button" href="441_june_10_finalization_risk_register.csv">リスクCSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'june_10_finalization_sprint_20260526.html'), html, 'utf8');

console.log('created june_10_finalization_sprint_20260526.html');
console.log(`tasks=${taskRows.length}`);
