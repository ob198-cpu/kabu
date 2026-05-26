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

const taskRows = readCsv('438_june_10_finalization_task_board.csv');
const immediateRows = taskRows.filter((row) => row.status === '2日以内に補完');

const sourceByCategory = {
  '財務指標': {
    primary: '企業IRの決算短信・決算説明資料、EDINET有価証券報告書',
    secondary: 'J-Quants API、JPX上場会社情報、Yahoo等の株価指標',
    automation: '半自動。APIが使える項目は自動、PDF内の注記は確認入力。',
    requiredColumns: 'PER、PBR、ROE、売上成長率、利益成長率、EPS成長率、出典URL、更新日',
  },
  '業種別補正': {
    primary: '同業候補のPER/PBR/ROE、業種指数、同業2〜5社の公開指標',
    secondary: 'JPX業種、J-Quants、各社IR、Yahoo等の株価指標',
    automation: '半自動。候補同業の設定は人間確認、数値取得は自動化余地あり。',
    requiredColumns: 'peer_group、peer_PER_median、peer_PBR_median、peer_ROE_median、sector_adjustment、出典URL',
  },
};

const fieldMap = {
  '8306.T': {
    focus: 'PER未取得の補完、銀行業内でのPBR/ROE比較',
    peerGroup: '三井住友FG、みずほFG、りそなHD',
  },
  '6146.T': {
    focus: 'PER未取得の補完、半導体製造装置・精密加工同業との比較',
    peerGroup: '東京エレクトロン、SCREEN、レーザーテック、アドバンテスト',
  },
  '4385.T': {
    focus: 'PER未取得の補完、ネットサービス/EC/FinTech同業との比較',
    peerGroup: 'ZOZO、楽天G、BASE、マネーフォワード',
  },
  '2802.T': {
    focus: '高PERの妥当性を食品・ヘルスケア・半導体材料のどの枠で見るか整理',
    peerGroup: 'キッコーマン、日清食品HD、明治HD、信越化学の材料比較を別枠で確認',
  },
  '5020.T': {
    focus: '資源・精製マージン影響が強いため、PER/PBRだけでなく原油・マージン連動を補正',
    peerGroup: '出光興産、コスモエネルギーHD、INPEX',
  },
};

const inputMapRows = immediateRows.map((row, index) => {
  const source = sourceByCategory[row.task_category] || sourceByCategory['財務指標'];
  const extra = fieldMap[row.ticker] || { focus: '未入力項目の補完', peerGroup: '同業2〜5社' };
  return {
    updated_at: generatedAt,
    work_no: index + 1,
    ticker: row.ticker,
    company: row.company,
    lane: row.lane,
    task_category: row.task_category,
    input_target: source.requiredColumns,
    focus: extra.focus,
    peer_group: extra.peerGroup,
    primary_source: source.primary,
    secondary_source: source.secondary,
    automation_level: source.automation,
    output_table: row.output,
    status: '未入力',
    score_policy: '未入力の間はスコアに混ぜない',
  };
});

const sourceRows = [
  {
    updated_at: generatedAt,
    source: '企業IR',
    trust_level: '高',
    use_for: '決算短信、決算説明資料、通期見通し、セグメント説明',
    limitation: 'PDF表の自動抽出は崩れることがあるため、重要項目は確認が必要',
  },
  {
    updated_at: generatedAt,
    source: 'EDINET',
    trust_level: '高',
    use_for: '有価証券報告書、XBRL財務データ',
    limitation: '提出後データ中心。速報性は決算短信より遅い',
  },
  {
    updated_at: generatedAt,
    source: 'J-Quants / JPX系',
    trust_level: '高',
    use_for: '上場銘柄情報、財務、株価、業種分類',
    limitation: 'APIキーや利用条件の確認が必要',
  },
  {
    updated_at: generatedAt,
    source: 'Yahoo等の株価指標',
    trust_level: '中',
    use_for: 'PER/PBR/ROEの補助確認、株価・出来高',
    limitation: '公式値との突合が必要。単独の最終根拠にしない',
  },
];

const columnRows = [
  {
    updated_at: generatedAt,
    column: 'PER/PBR/ROE',
    purpose: '割高・資本効率の確認',
    scoring_rule: '取得済みのみ点数化。未取得は0点ではなく空欄扱い',
  },
  {
    updated_at: generatedAt,
    column: '売上成長率/利益成長率/EPS成長率',
    purpose: '1年保有で利益が伸びる根拠の確認',
    scoring_rule: '前年比と会社計画を分けて記録',
  },
  {
    updated_at: generatedAt,
    column: 'peer_group',
    purpose: '業種をまたぐ単純比較を避ける',
    scoring_rule: '同業中央値との差で補正',
  },
  {
    updated_at: generatedAt,
    column: 'source_url/source_note',
    purpose: '計算したふりを防ぐ',
    scoring_rule: '出典がない数値は説明資料に採用しない',
  },
];

const orderRows = inputMapRows.map((row) => ({
  updated_at: generatedAt,
  order: row.work_no,
  ticker: row.ticker,
  company: row.company,
  next_operation: row.task_category === '財務指標'
    ? '公式IRまたはEDINET/J-QuantsでPER/PBR/ROEと成長率を入力'
    : '同業グループを固定し、同業中央値との差を入力',
  done_condition: row.task_category === '財務指標'
    ? 'PER/PBR/ROE、売上成長率、利益成長率、出典が入る'
    : 'peer_group、同業中央値、補正理由が入る',
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '即時補完対象',
    value: `${inputMapRows.length}件`,
    meaning: '今すぐ入力欄レベルまで落とした作業数',
  },
  {
    updated_at: generatedAt,
    item: '財務指標',
    value: `${inputMapRows.filter((row) => row.task_category === '財務指標').length}件`,
    meaning: 'PER/PBR/ROEや成長率の補完',
  },
  {
    updated_at: generatedAt,
    item: '業種別補正',
    value: `${inputMapRows.filter((row) => row.task_category === '業種別補正').length}件`,
    meaning: '同業比較で割高度・質を補正',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    meaning: '入力作業の段階。売買判断ではない',
  },
];

writeCsv('442_immediate_completion_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'meaning']);
writeCsv('443_immediate_completion_input_map.csv', inputMapRows, [
  'updated_at',
  'work_no',
  'ticker',
  'company',
  'lane',
  'task_category',
  'input_target',
  'focus',
  'peer_group',
  'primary_source',
  'secondary_source',
  'automation_level',
  'output_table',
  'status',
  'score_policy',
]);
writeCsv('444_immediate_completion_source_priority.csv', sourceRows, [
  'updated_at',
  'source',
  'trust_level',
  'use_for',
  'limitation',
]);
writeCsv('445_immediate_completion_column_definition.csv', columnRows, [
  'updated_at',
  'column',
  'purpose',
  'scoring_rule',
]);
writeCsv('446_immediate_completion_execution_order.csv', orderRows, [
  'updated_at',
  'order',
  'ticker',
  'company',
  'next_operation',
  'done_condition',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>即時補完8件 入力マップ</title>
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
      min-width: 960px;
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
      border: 1px solid #ffd7a3;
      color: var(--orange);
      background: #fff3e2;
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    }
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
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      table { min-width: 780px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>即時補完8件 入力マップ</h1>
      <p>6月テスト10社確定スプリントで「2日以内に補完」となった項目を、具体的な入力欄、取得元、同業比較対象まで分解した作業表です。未入力の数値はスコアに混ぜません。</p>
      <div class="actions">
        <a class="button" href="june_10_finalization_sprint_20260526.html">確定スプリントへ戻る</a>
        <a class="button" href="443_immediate_completion_input_map.csv">入力マップCSV</a>
        <a class="button" href="446_immediate_completion_execution_order.csv">実行順CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${inputMapRows.length}</b><span>即時補完対象</span></div>
        <div class="kpi"><b>${inputMapRows.filter((row) => row.task_category === '財務指標').length}</b><span>財務指標</span></div>
        <div class="kpi"><b>${inputMapRows.filter((row) => row.task_category === '業種別補正').length}</b><span>業種別補正</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      このページは入力作業の地図です。ここにあるデータが埋まるまで、該当項目は点数に入れません。
    </div>

    <section class="panel">
      <h2>入力対象</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 70px;">順</th>
              <th style="width: 100px;">銘柄</th>
              <th style="width: 150px;">会社</th>
              <th style="width: 120px;">カテゴリ</th>
              <th>入力欄</th>
              <th>焦点</th>
              <th>同業比較</th>
              <th style="width: 120px;">状態</th>
            </tr>
          </thead>
          <tbody>
            ${inputMapRows.map((row) => `
              <tr>
                <td>${esc(row.work_no)}</td>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.task_category)}</td>
                <td>${esc(row.input_target)}</td>
                <td>${esc(row.focus)}</td>
                <td>${esc(row.peer_group)}</td>
                <td><span class="badge">${esc(row.status)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>取得元の優先順位</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 180px;">取得元</th>
              <th style="width: 80px;">信頼度</th>
              <th>用途</th>
              <th>限界</th>
            </tr>
          </thead>
          <tbody>
            ${sourceRows.map((row) => `
              <tr>
                <td>${esc(row.source)}</td>
                <td>${esc(row.trust_level)}</td>
                <td>${esc(row.use_for)}</td>
                <td>${esc(row.limitation)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>CSV</h2>
      <div class="actions">
        <a class="button" href="442_immediate_completion_summary.csv">概要CSV</a>
        <a class="button" href="443_immediate_completion_input_map.csv">入力マップCSV</a>
        <a class="button" href="444_immediate_completion_source_priority.csv">取得元CSV</a>
        <a class="button" href="445_immediate_completion_column_definition.csv">列定義CSV</a>
        <a class="button" href="446_immediate_completion_execution_order.csv">実行順CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'immediate_completion_input_map_20260526.html'), html, 'utf8');

console.log('created immediate_completion_input_map_20260526.html');
console.log(`immediate rows=${inputMapRows.length}`);
