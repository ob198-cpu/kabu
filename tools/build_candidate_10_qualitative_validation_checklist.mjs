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

const validationMap = {
  '6762.T': {
    driver: 'AIサーバー、HDD/電源周辺部材、電池・磁性材料',
    confirm: '電子部品セグメントの売上・利益、受注または会社コメント、AIサーバー関連需要の継続、為替影響を確認。',
    reject: 'AI関連コメントが弱い、利益率が悪化、在庫調整や顧客需要鈍化が明記される。',
    data: '公式決算説明資料、セグメント売上、営業利益率、受注・在庫コメント、SOX/NASDAQ比較。',
  },
  '2802.T': {
    driver: '食品値上げ耐性、ABF、ヘルスケア、原材料・為替',
    confirm: 'ABF/ヘルスケアの成長、値上げ後の数量維持、原材料費の吸収、通期見通しの維持を確認。',
    reject: 'PERの高さに対して成長鈍化、原材料費再上昇、値上げ後の数量減、下方修正。',
    data: '公式決算短信、事業別売上・利益、通期見通し、原材料・為替感応度、同業比較。',
  },
  '8316.T': {
    driver: '日銀政策、利ざや、信用コスト、株主還元',
    confirm: '資金利益増加、信用コスト抑制、自己株式取得・増配、日銀イベント後の銀行株反応を確認。',
    reject: '信用コスト急増、金利上昇が景気悪化扱いになる、日銀後に銀行株が市場劣後。',
    data: '公式決算、資金利益、与信費用、自己株式取得、日銀会合後の銀行指数と日経比較。',
  },
  '6367.T': {
    driver: 'データセンター冷却、地域別空調需要、中国・為替',
    confirm: 'データセンター/大型空調関連の受注・売上、地域別利益、為替影響、通期見通しを確認。',
    reject: '中国・欧州の需要鈍化、利益率低下、データセンター需要が数字に出ない。',
    data: '公式決算説明資料、地域別売上、空調事業利益率、設備投資・データセンター関連コメント。',
  },
  '6503.T': {
    driver: '電力・データセンター、FA、設備投資、防衛・宇宙',
    confirm: 'インフラ・FA・防衛関連の受注または利益改善、電力設備需要の継続を確認。',
    reject: 'FA市況低迷、受注鈍化、コスト増、政策テーマが業績に接続しない。',
    data: '公式決算、セグメント別受注・売上・利益、設備投資統計、防衛/宇宙関連IR。',
  },
  '5020.T': {
    driver: '原油、精製マージン、中東・海上輸送、脱炭素投資',
    confirm: '精製マージン、在庫影響、油価、為替、通期見通しの感応度を確認。',
    reject: '油価下落で在庫評価損、精製マージン悪化、脱炭素投資負担の増加。',
    data: '公式決算、原油価格、精製マージン、在庫影響、為替、エネルギー市況。',
  },
  '8766.T': {
    driver: '保険料率、金利、自然災害、政策保有株売却',
    confirm: '保険引受利益、資産運用益、政策保有株売却、自然災害損害率を確認。',
    reject: '自然災害損失の増加、保険引受悪化、決算後反応の弱さが継続。',
    data: '公式決算、コンバインドレシオ、資産運用損益、災害損害、5日/20営業日反応。',
  },
  '6146.T': {
    driver: 'AI半導体、HBM、半導体設備投資、高シェア製造工程',
    confirm: 'AI/HBM向け需要、受注・出荷、利益率、同業比較、SOXに対する下落耐性を確認。',
    reject: '20営業日反応の弱さが継続、高PER調整、半導体設備投資の鈍化。',
    data: '公式決算、装置需要コメント、SOX/日経比較、20営業日反応、PER同業比較。',
  },
  '8306.T': {
    driver: '日銀政策、海外金利、株主還元、与信費用',
    confirm: '資金利益、ROE、自己株式取得、与信費用、日銀後の銀行株反応を確認。',
    reject: '信用コスト増加、PERが同業より高い状態、金利上昇が景気悪化へ転ぶ。',
    data: '公式決算、EPS、資金利益、与信費用、自己株式取得、同業銀行比較。',
  },
  '4385.T': {
    driver: '国内消費、FinTech、広告、規制・競争',
    confirm: 'GMV、MAU、FinTech収益、広告収益、利益率改善、規制リスクの有無を確認。',
    reject: '競争激化、成長鈍化、3Q累計PERを通期PERのように扱えない、同業比較不足。',
    data: '公式決算、GMV/MAU、セグメント利益、通期見通し、同業ネット企業比較。',
  },
};

const evidenceRows = readCsv('514_candidate_10_evidence_pack_detail.csv');

const checklistRows = evidenceRows.map((row) => {
  const item = validationMap[row.ticker] || {
    driver: row.qualitative_note,
    confirm: '公式資料で、仮説が売上・利益・受注・利益率に接続しているか確認。',
    reject: '仮説が数字に接続しない、または決算後反応が弱い。',
    data: '公式決算、関連業界統計、株価反応、同業比較。',
  };
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    current_role: row.role,
    qualitative_driver: item.driver,
    required_confirmation: item.confirm,
    reject_condition: item.reject,
    required_data: item.data,
    current_numeric_status: `量的評価${row.quantitative_grade} / 反応${row.reaction_layer} / 同業${row.sector_adjustment_status}`,
    treatment: '仮説確認用。単独では点数へ加えない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${checklistRows.length}社`,
    meaning: '候補10社それぞれに、質的仮説の確認条件を設定。',
  },
  {
    updated_at: generatedAt,
    item: '確認方針',
    value: '非加点',
    meaning: '質的仮説は、数字や実績反応で裏付けるまで点数へ混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '明日使う用途',
    value: '根拠整理',
    meaning: 'なぜその銘柄を見るのか、何が崩れたら外すのかを説明する材料にする。',
  },
];

const ruleRows = [
  {
    rule_id: 'Q01',
    rule: '質的仮説は入口',
    detail: '時流・イベント・新商品・政策テーマは候補を探す入口であり、単独で評価を上げない。',
  },
  {
    rule_id: 'Q02',
    rule: '数字への接続を要求',
    detail: '売上、利益、受注、利益率、決算後反応、同業比較のどれかで確認できた場合だけ説明根拠として強める。',
  },
  {
    rule_id: 'Q03',
    rule: '反証条件を先に置く',
    detail: '仮説が崩れる条件を先に決め、都合のよいニュースだけで候補を残さない。',
  },
];

writeCsv('521_candidate_10_qualitative_validation_checklist.csv', checklistRows, [
  'updated_at',
  'ticker',
  'company',
  'sector',
  'current_role',
  'qualitative_driver',
  'required_confirmation',
  'reject_condition',
  'required_data',
  'current_numeric_status',
  'treatment',
]);

writeCsv('522_candidate_10_qualitative_validation_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('523_candidate_10_qualitative_validation_rules.csv', ruleRows.map((row) => ({ updated_at: generatedAt, ...row })), [
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
  <title>候補10社 質的仮説チェック 2026年5月26日</title>
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
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.72; letter-spacing: 0; }
    header { background: var(--navy); color: #fff; padding: 34px clamp(18px, 4vw, 58px); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1120px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 118px; }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 30px; line-height: 1.2; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border-radius: 8px; border: 1px solid #9cc8ec; background: #fff; color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1360px; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1240px); }
      .summary { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 質的仮説チェック</h1>
    <p>時流・イベント・新商品・政策テーマを、数字で確認するためのチェック表です。仮説だけで評価を上げない設計にしています。</p>
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
      <p class="notice">この表は質的データの検証入口です。確認データがそろうまでテスト判定用スコアには混ぜません。</p>
      <div class="toolbar">
        <a class="button" href="521_candidate_10_qualitative_validation_checklist.csv">521 チェックCSV</a>
        <a class="button" href="522_candidate_10_qualitative_validation_summary.csv">522 要約CSV</a>
        <a class="button" href="523_candidate_10_qualitative_validation_rules.csv">523 ルールCSV</a>
        <a class="button" href="candidate_10_selection_draft_20260526.html">選定ドラフトへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>チェック表</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'current_role', label: '現在の役割' },
          { key: 'qualitative_driver', label: '質的仮説' },
          { key: 'required_confirmation', label: '確認できたら強くなる条件' },
          { key: 'reject_condition', label: '崩れる条件' },
          { key: 'required_data', label: '必要データ' },
          { key: 'current_numeric_status', label: '現在の数値状態' },
          { key: 'treatment', label: '扱い' },
        ],
        checklistRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_qualitative_validation_checklist_20260526.html'), html, 'utf8');

console.log(`created candidate_10_qualitative_validation_checklist_20260526.html rows=${checklistRows.length}`);
