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

const sampleRows = [
  {
    event_id: 'SAMPLE-AI-HBM-001',
    source_type: '決算/会社IR/業界統計',
    qualitative_theme: 'AI半導体投資 / HBM・先端パッケージ',
    event_fact: 'AIサーバー投資やHBM需要の増加を示す公式数字・会社コメントが出た場合',
    hypothesis: 'AI投資増加が電子部品、検査、材料、後工程へ波及する可能性がある。',
    affected_ticker: '6762.T TDK / 6146.T ディスコ',
    expected_direction: '追い風',
    required_numbers: 'AI/HBM関連売上、受注、利益率、SOX/日経半導体指数との相対反応、PER妥当性',
    reject_condition: '受注や利益率に出ない、決算後20営業日で指数劣後、PER調整に耐えない',
    alert_level: '確認待ち',
    action_to_candidates: 'TDKは中心候補維持を検討。ディスコは反応弱さの理由を検算し、数字が弱ければ補完後再判定のまま。',
  },
  {
    event_id: 'SAMPLE-RATE-BOJ-001',
    source_type: '日銀/金利/株価',
    qualitative_theme: '金利上昇 / 自社株買い・増配・資本効率',
    event_fact: '日銀後に長期金利が上がり、銀行・保険株が指数を上回る場合',
    hypothesis: '資金利益、保険運用益、資本効率改善への期待が株価に反映される可能性がある。',
    affected_ticker: '8316.T 三井住友FG / 8766.T 東京海上HD / 8306.T 三菱UFJ FG',
    expected_direction: '追い風',
    required_numbers: '資金利益、信用コスト、保険引受利益、ROE/PBR、日銀後1日/5日/20営業日反応',
    reject_condition: '信用コスト悪化、自然災害損害率悪化、金利上昇でも指数劣後',
    alert_level: '通知',
    action_to_candidates: '三井住友FGと東京海上HDは条件付き候補として確認。三菱UFJは補完後再判定を維持。',
  },
  {
    event_id: 'SAMPLE-BUFFETT-SELL-001',
    source_type: '13F/SEC/報道',
    qualitative_theme: 'バフェット・バークシャー売買監視',
    event_fact: 'バークシャーが保有銘柄を20%以上売却、または全売却した場合',
    hypothesis: '業界見通し悪化、割高判断、資本配分変更、担当者変更などの可能性がある。',
    affected_ticker: '8766.T 東京海上HD / 8316.T 三井住友FG / 8306.T 三菱UFJ FG / 5020.T ENEOS HD',
    expected_direction: '逆風/警戒',
    required_numbers: '売却率、売却対象業界、同業株反応、対象候補の決算・株価反応',
    reject_condition: '売却理由を断定できない、13Fの開示遅れを補正できない',
    alert_level: '通知',
    action_to_candidates: '関連候補の新規買いを止め、量的データ再確認まで保留する。',
  },
  {
    event_id: 'SAMPLE-FOOD-COST-001',
    source_type: 'CPI/企業決算/原材料価格',
    qualitative_theme: '食品値上げ耐性 / 円高 / 原油・ナフサ下落',
    event_fact: '原材料価格が低下し、値上げ後も数量が維持されている場合',
    hypothesis: '価格転嫁後の粗利改善が食品企業の利益率に出る可能性がある。',
    affected_ticker: '2802.T 味の素',
    expected_direction: '追い風',
    required_numbers: '数量、単価、原材料費、営業利益率、ABF/ヘルスケア成長、PER妥当性',
    reject_condition: '数量減、原材料再上昇、PERが成長率に対して高すぎる',
    alert_level: '確認待ち',
    action_to_candidates: '味の素は条件付き候補として残し、PERと数量維持を確認する。',
  },
  {
    event_id: 'SAMPLE-DC-POWER-001',
    source_type: '業界統計/会社IR/設備投資',
    qualitative_theme: 'データセンター電力不足 / データセンター冷却',
    event_fact: 'データセンター向け電力・冷却投資の増加が公式数字に出た場合',
    hypothesis: '重電、空調、制御、電子部品へ需要が波及する可能性がある。',
    affected_ticker: '6503.T 三菱電機 / 6367.T ダイキン工業',
    expected_direction: '追い風',
    required_numbers: 'データセンター向け売上、受注残、利益率、地域別需要、設備投資計画',
    reject_condition: '寄与が小さい、利益率が伸びない、中国需要悪化、指数劣後',
    alert_level: '確認待ち',
    action_to_candidates: '三菱電機とダイキンは比較・観察候補として、数字が確認できた場合のみ上げる。',
  },
  {
    event_id: 'SAMPLE-OIL-MIDDLEEAST-001',
    source_type: '商品市況/地政学/決算',
    qualitative_theme: '原油・中東リスク',
    event_fact: '中東リスクや海上輸送リスクで原油価格・精製マージンが大きく変動した場合',
    hypothesis: 'エネルギー株には追い風と逆風が混在し、在庫影響やマージン次第で評価が変わる。',
    affected_ticker: '5020.T ENEOS HD',
    expected_direction: '追い風/逆風混在',
    required_numbers: '原油価格、精製マージン、在庫影響、セグメント利益、株価の指数比較',
    reject_condition: '原油急落、精製マージン悪化、在庫評価損、決算後指数劣後',
    alert_level: '保留',
    action_to_candidates: 'ENEOSは購入検討には使わず、比較・補完対象として扱う。',
  },
];

const scoringRows = [
  {
    layer: '事実スコア',
    input: '出典が公式資料・統計・決算・SEC等で確認できるか',
    score_rule: '公式確認あり=高、報道のみ=中、噂・SNSのみ=低',
    use: '低の場合はスコアに混ぜない。',
  },
  {
    layer: '関連性スコア',
    input: 'イベントが対象銘柄の売上・受注・利益率に接続するか',
    score_rule: '事業セグメントに直接接続=高、業界全体=中、連想のみ=低',
    use: '低の場合は候補抽出のみ。',
  },
  {
    layer: '実績反応スコア',
    input: 'イベント後1日/5日/20営業日の対指数反応',
    score_rule: '指数超過=通過、指数劣後=警戒',
    use: '購入候補への昇格・降格に使う。',
  },
  {
    layer: '反証スコア',
    input: '売上・受注・利益率・PER・同業比較で仮説が否定されるか',
    score_rule: '反証あり=下げる、反証なし=維持',
    use: '質的仮説を残すか落とすかに使う。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    detail: '監視台帳の実用例として、通年イベントを銘柄選出・売買ルールに反映するサンプルを作成。',
  },
  {
    updated_at: generatedAt,
    item: 'サンプル数',
    detail: `${sampleRows.length}件。AI/HBM、金利、バフェット売却、食品コスト、データセンター、原油を収録。`,
  },
  {
    updated_at: generatedAt,
    item: '運用',
    detail: 'サンプルをコピーして、実際のニュース・決算・統計の出典と数字を入力する。',
  },
  {
    updated_at: generatedAt,
    item: '注意',
    detail: 'サンプルは説明用であり、実際のイベント発生や購入判断を意味しない。',
  },
];

writeCsv('617_qual_event_sample_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('618_qual_event_sample_cases.csv', sampleRows, [
  'event_id',
  'source_type',
  'qualitative_theme',
  'event_fact',
  'hypothesis',
  'affected_ticker',
  'expected_direction',
  'required_numbers',
  'reject_condition',
  'alert_level',
  'action_to_candidates',
]);
writeCsv('619_qual_event_scoring_layers.csv', scoringRows, ['layer', 'input', 'score_rule', 'use']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的イベント反映サンプル 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1320px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1040px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:2000px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>質的イベント反映サンプル</h1>
      <p class="lead">実際にニュースやイベントが出た時、どのように記録し、候補銘柄や売買ルールへ反映するかを示すサンプル集です。</p>
    </header>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">このページは記入例です。実際のイベント発生や購入判断を意味しません。</div>
    </section>
    <section>
      <h2>2. イベント反映サンプル</h2>
      ${table([
        { key: 'event_id', label: 'ID' },
        { key: 'source_type', label: '出典種別' },
        { key: 'qualitative_theme', label: '質的項目' },
        { key: 'event_fact', label: '事実' },
        { key: 'hypothesis', label: '仮説' },
        { key: 'affected_ticker', label: '対象銘柄' },
        { key: 'expected_direction', label: '方向' },
        { key: 'required_numbers', label: '確認数字' },
        { key: 'reject_condition', label: '反証条件' },
        { key: 'alert_level', label: '通知区分' },
        { key: 'action_to_candidates', label: '候補への反映' },
      ], sampleRows, 'wide')}
    </section>
    <section>
      <h2>3. 客観化するための評価層</h2>
      ${table([
        { key: 'layer', label: '評価層' },
        { key: 'input', label: '入力' },
        { key: 'score_rule', label: '判定' },
        { key: 'use', label: '使い道' },
      ], scoringRows, 'wide')}
      <div class="actions">
        <a href="617_qual_event_sample_summary.csv">概要CSV</a>
        <a href="618_qual_event_sample_cases.csv">サンプルCSV</a>
        <a href="619_qual_event_scoring_layers.csv">評価層CSV</a>
        <a href="qual_event_monitor_ledger_20260527.html">監視台帳へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qual_event_sample_cases_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  samples: sampleRows.length,
  output: 'qual_event_sample_cases_20260527.html',
}, null, 2));
