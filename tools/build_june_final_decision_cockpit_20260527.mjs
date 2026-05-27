import fs from 'fs';

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

const candidates = [
  ['8316.T', '三井住友FG', '中心確認', '銀行・金利上昇', 60, '銀行株全体、利ざや、信用コスト'],
  ['6762.T', 'TDK', '中心確認', '電子部品・AIサーバー周辺', 60, 'SOX、AIサーバー、HDD/電源周辺部材'],
  ['8053.T', '住友商事', '中心確認', '商社・資源・株主還元', 60, '資源価格、為替、還元姿勢'],
  ['2802.T', '味の素', '条件付き中心', '食品・ABF・ヘルスケア', 55, '高PER説明、ABF、ヘルスケア、原材料'],
  ['8306.T', '三菱UFJ FG', '補欠比較', '銀行・金利上昇', 48, '三井住友FGとの差、銀行枠重複'],
  ['7173.T', '東京きらぼしFG', '監視', '地銀・金利上昇', 45, '割安、出来高、地銀株反応'],
  ['9984.T', 'ソフトバンクG', '別評価監視', 'AI投資・保有資産', 43, 'NAV、Arm、AI関連株、過熱'],
  ['7735.T', 'SCREEN HD', '監視', '半導体製造装置', 45, '受注、利益成長、SOX耐性'],
  ['6146.T', 'ディスコ', '反応検算', '半導体工程・高シェア技術', 43, '高PER/PBR、受注、利益率、20営業日反応'],
  ['7011.T', '三菱重工業', '反応検算', '防衛・重工・発電', 43, '200日線、60日最大下落、重工同業比較']
];

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
}

writeCsv('713_june_final_decision_cockpit_summary.csv', [
  ['作成', '項目', '内容'],
  [generatedAt, '目的', '6月イベント後に候補10社を同じ条件で再判定する入力画面を作成。'],
  [generatedAt, '対象', '中心確認3社、条件付き中心1社、補欠・監視・検算6社。'],
  [generatedAt, '判定', '残す、保留、外すをスコアと停止条件で表示。'],
  [generatedAt, '注意', '同業比較や質的材料は直接加点せず、説明条件・警戒条件として反映。']
]);

writeCsv('714_june_final_decision_cockpit_input_rows.csv', [
  ['作成', '銘柄', '会社名', '初期区分', '質的テーマ', '基礎点', '確認項目'],
  ...candidates.map(row => [generatedAt, ...row])
]);

writeCsv('715_june_final_decision_cockpit_formula.csv', [
  ['作成', '要素', '点数ルール'],
  [generatedAt, '基礎点', '中心確認60、条件付き中心55、補欠比較48、監視45、別評価監視43、反応検算43。'],
  [generatedAt, '市場イベント', 'CPI、日銀、FOMCは良好+5、注意0、悪化-20、未入力-3。'],
  [generatedAt, '20営業日反応', '良好+10、中立+3、悪化-15、未到来-3。'],
  [generatedAt, '同業・割高説明', '説明可能+8、要確認0、説明不足-12。'],
  [generatedAt, '質的根拠', '確認+8、要確認0、否定-20。'],
  [generatedAt, 'ベンチマーク根拠', '確認+8、要確認0、弱い-15。'],
  [generatedAt, '重大停止', 'ありの場合は外す。'],
  [generatedAt, '判定', '78点以上は残す、55点以上は保留、55点未満は外す。重大停止ありは点数に関わらず外す。']
]);

const options = {
  event: ['未入力', '良好', '注意', '悪化'],
  reaction: ['未到来', '良好', '中立', '悪化'],
  peer: ['要確認', '説明可能', '説明不足'],
  qualitative: ['要確認', '確認', '否定'],
  benchmark: ['要確認', '確認', '弱い'],
  stop: ['なし', 'あり']
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月最終再判定 入力コックピット</title>
  <style>
    :root { --ink:#071f3a; --muted:#4c6178; --line:#d7e4f2; --blue:#0b5f96; --green:#087f5b; --amber:#ad5a00; --red:#b42318; --soft:#f6f9fc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif; color:var(--ink); background:#eef4fa; line-height:1.65; }
    main { max-width:1280px; margin:0 auto; padding:28px 18px 56px; }
    .hero { background:#123d63; color:white; border-radius:8px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:23px; }
    .note { color:#e8f4ff; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .label { color:var(--muted); font-size:13px; }
    .value { font-size:26px; font-weight:900; margin-top:4px; }
    .ok { color:var(--green); }
    .hold { color:var(--amber); }
    .out { color:var(--red); }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin:12px 0 18px; }
    button, .linkbtn { border:0; border-radius:8px; background:#0b5f96; color:#fff; padding:10px 14px; font-weight:800; cursor:pointer; text-decoration:none; display:inline-block; }
    button.secondary { background:#eef6ff; color:#0b3b62; border:1px solid var(--line); }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); table-layout:fixed; }
    th, td { border:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; font-size:12.5px; }
    th { background:#e6f1fb; text-align:left; }
    select { width:100%; min-width:92px; padding:7px 6px; border:1px solid #bfd2e6; border-radius:6px; background:white; color:#071f3a; font-size:12px; }
    .decision { font-weight:900; font-size:14px; }
    .decision.keep { color:var(--green); }
    .decision.hold { color:var(--amber); }
    .decision.remove { color:var(--red); }
    .formula { background:white; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .formula code { display:block; background:#f4f7fb; border:1px solid var(--line); border-radius:6px; padding:9px; margin-bottom:8px; white-space:normal; overflow-wrap:anywhere; color:#111; }
    .footer { margin-top:24px; color:var(--muted); font-size:13px; }
    a { color:#064f88; font-weight:700; }
    .wide th:nth-child(1), .wide td:nth-child(1) { width:8%; }
    .wide th:nth-child(2), .wide td:nth-child(2) { width:11%; }
    .wide th:nth-child(3), .wide td:nth-child(3) { width:9%; }
    .wide th:nth-child(4), .wide td:nth-child(4) { width:12%; }
    .wide th:nth-child(5), .wide td:nth-child(5) { width:14%; }
    .wide th:nth-child(14), .wide td:nth-child(14) { width:9%; }
    .wide th:nth-child(15), .wide td:nth-child(15) { width:12%; }
    @media (max-width:1000px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } h1 { font-size:24px; } }
    @media (max-width:640px) { .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>6月最終再判定 入力コックピット</h1>
    <div class="note">作成: ${generatedAt} / 目的: 6月イベント後に実数を入れ、候補10社を同じ条件で残す・保留・外すへ整理する。</div>
  </section>

  <section class="grid">
    <div class="card"><div class="label">残す</div><div id="keepCount" class="value ok">0</div><div>6月テスト候補に残す</div></div>
    <div class="card"><div class="label">保留</div><div id="holdCount" class="value hold">0</div><div>追加確認または市場待ち</div></div>
    <div class="card"><div class="label">外す</div><div id="removeCount" class="value out">0</div><div>初回候補から外す</div></div>
    <div class="card"><div class="label">判定基準</div><div class="value">+1%</div><div>S&P500投信・日経平均/TOPIXを1年で上回る根拠</div></div>
  </section>

  <div class="toolbar">
    <button type="button" onclick="setAllDefault()">初期状態へ戻す</button>
    <button type="button" class="secondary" onclick="setMarketGood()">市場イベント良好を入力</button>
    <button type="button" class="secondary" onclick="downloadCsv()">表示結果CSVを出力</button>
    <a class="linkbtn" href="711_june_action_plan_peer_detail.csv">銘柄別ルールCSV</a>
  </div>

  <h2>1. 入力表</h2>
  <table class="wide" id="decisionTable">
    <thead>
      <tr>
        <th>銘柄</th><th>会社名</th><th>初期区分</th><th>質的テーマ</th><th>確認項目</th>
        <th>CPI</th><th>日銀</th><th>FOMC</th><th>20営業日反応</th><th>同業・割高説明</th><th>質的根拠</th><th>ベンチ根拠</th><th>重大停止</th><th>点数</th><th>判定</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <h2>2. 判定式</h2>
  <div class="formula">
    <code>判定点 = 基礎点 + CPI + 日銀 + FOMC + 20営業日反応 + 同業・割高説明 + 質的根拠 + ベンチマーク根拠</code>
    <code>CPI・日銀・FOMC: 良好+5 / 注意0 / 悪化-20 / 未入力-3</code>
    <code>20営業日反応: 良好+10 / 中立+3 / 悪化-15 / 未到来-3</code>
    <code>同業・割高説明: 説明可能+8 / 要確認0 / 説明不足-12</code>
    <code>質的根拠: 確認+8 / 要確認0 / 否定-20</code>
    <code>ベンチマーク根拠: 確認+8 / 要確認0 / 弱い-15</code>
    <code>78点以上: 残す / 55点以上: 保留 / 55点未満: 外す / 重大停止あり: 外す</code>
  </div>

  <h2>3. 使い方</h2>
  <table>
    <thead><tr><th>順番</th><th>入力するもの</th><th>意味</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>CPI、日銀、FOMC</td><td>6月の市場イベント後に、市場全体が個別株テストに耐える状態か確認する。</td></tr>
      <tr><td>2</td><td>20営業日反応</td><td>決算後の株価が日経平均/TOPIXと比べて弱くないか確認する。</td></tr>
      <tr><td>3</td><td>同業・割高説明</td><td>PER/PBR/ROEが同業と比べて説明できるか確認する。</td></tr>
      <tr><td>4</td><td>質的根拠</td><td>AI、金利、商社、食品、半導体などの質的材料が数字で否定されていないか確認する。</td></tr>
      <tr><td>5</td><td>ベンチ根拠</td><td>S&P500投信・日経平均/TOPIXを1年で+1%以上上回る説明があるか確認する。</td></tr>
    </tbody>
  </table>

  <div class="footer">
    CSV: <a href="713_june_final_decision_cockpit_summary.csv">要約</a> /
    <a href="714_june_final_decision_cockpit_input_rows.csv">入力行</a> /
    <a href="715_june_final_decision_cockpit_formula.csv">計算式</a>
  </div>
</main>
<script>
const candidates = ${JSON.stringify(candidates.map(([ticker, company, status, theme, base, watch]) => ({ ticker, company, status, theme, base, watch })))};
const optionSets = ${JSON.stringify(options)};

function optionHtml(values, selected) {
  return values.map(v => '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + v + '</option>').join('');
}

function eventScore(v) {
  return v === '良好' ? 5 : v === '注意' ? 0 : v === '悪化' ? -20 : -3;
}
function reactionScore(v) {
  return v === '良好' ? 10 : v === '中立' ? 3 : v === '悪化' ? -15 : -3;
}
function peerScore(v) {
  return v === '説明可能' ? 8 : v === '説明不足' ? -12 : 0;
}
function qualitativeScore(v) {
  return v === '確認' ? 8 : v === '否定' ? -20 : 0;
}
function benchmarkScore(v) {
  return v === '確認' ? 8 : v === '弱い' ? -15 : 0;
}

function buildTable() {
  const tbody = document.querySelector('#decisionTable tbody');
  tbody.innerHTML = candidates.map((c, i) => {
    return '<tr data-index="' + i + '">' +
      '<td>' + c.ticker + '</td><td>' + c.company + '</td><td>' + c.status + '</td><td>' + c.theme + '</td><td>' + c.watch + '</td>' +
      '<td><select class="cpi">' + optionHtml(optionSets.event, '未入力') + '</select></td>' +
      '<td><select class="boj">' + optionHtml(optionSets.event, '未入力') + '</select></td>' +
      '<td><select class="fomc">' + optionHtml(optionSets.event, '未入力') + '</select></td>' +
      '<td><select class="reaction">' + optionHtml(optionSets.reaction, '未到来') + '</select></td>' +
      '<td><select class="peer">' + optionHtml(optionSets.peer, '要確認') + '</select></td>' +
      '<td><select class="qualitative">' + optionHtml(optionSets.qualitative, '要確認') + '</select></td>' +
      '<td><select class="benchmark">' + optionHtml(optionSets.benchmark, '要確認') + '</select></td>' +
      '<td><select class="stop">' + optionHtml(optionSets.stop, 'なし') + '</select></td>' +
      '<td class="score"></td><td class="decision"></td>' +
    '</tr>';
  }).join('');
  tbody.querySelectorAll('select').forEach(s => s.addEventListener('change', recalc));
  recalc();
}

function evaluateRow(tr) {
  const c = candidates[Number(tr.dataset.index)];
  const cpi = tr.querySelector('.cpi').value;
  const boj = tr.querySelector('.boj').value;
  const fomc = tr.querySelector('.fomc').value;
  const reaction = tr.querySelector('.reaction').value;
  const peer = tr.querySelector('.peer').value;
  const qualitative = tr.querySelector('.qualitative').value;
  const benchmark = tr.querySelector('.benchmark').value;
  const stop = tr.querySelector('.stop').value;
  let score = c.base + eventScore(cpi) + eventScore(boj) + eventScore(fomc) + reactionScore(reaction) + peerScore(peer) + qualitativeScore(qualitative) + benchmarkScore(benchmark);
  let decision = score >= 78 ? '残す' : score >= 55 ? '保留' : '外す';
  if (stop === 'あり') decision = '外す';
  if (qualitative === '否定') decision = '外す';
  if (peer === '説明不足' && score < 78) decision = '保留';
  if (benchmark === '弱い') decision = score >= 78 ? '保留' : '外す';
  return { score, decision };
}

function recalc() {
  let counts = { '残す': 0, '保留': 0, '外す': 0 };
  document.querySelectorAll('#decisionTable tbody tr').forEach(tr => {
    const result = evaluateRow(tr);
    const scoreCell = tr.querySelector('.score');
    const decisionCell = tr.querySelector('.decision');
    scoreCell.textContent = result.score + '点';
    decisionCell.textContent = result.decision;
    decisionCell.className = 'decision ' + (result.decision === '残す' ? 'keep' : result.decision === '保留' ? 'hold' : 'remove');
    counts[result.decision] += 1;
  });
  document.getElementById('keepCount').textContent = counts['残す'];
  document.getElementById('holdCount').textContent = counts['保留'];
  document.getElementById('removeCount').textContent = counts['外す'];
}

function setAllDefault() {
  document.querySelectorAll('select').forEach(sel => {
    if (sel.className === 'reaction') sel.value = '未到来';
    else if (sel.className === 'stop') sel.value = 'なし';
    else if (sel.className === 'peer') sel.value = '要確認';
    else if (sel.className === 'qualitative') sel.value = '要確認';
    else if (sel.className === 'benchmark') sel.value = '要確認';
    else sel.value = '未入力';
  });
  recalc();
}

function setMarketGood() {
  document.querySelectorAll('.cpi,.boj,.fomc').forEach(sel => sel.value = '良好');
  recalc();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function downloadCsv() {
  const header = ['銘柄','会社名','初期区分','CPI','日銀','FOMC','20営業日反応','同業・割高説明','質的根拠','ベンチ根拠','重大停止','点数','判定'];
  const lines = [header];
  document.querySelectorAll('#decisionTable tbody tr').forEach(tr => {
    const c = candidates[Number(tr.dataset.index)];
    const result = evaluateRow(tr);
    lines.push([
      c.ticker, c.company, c.status,
      tr.querySelector('.cpi').value,
      tr.querySelector('.boj').value,
      tr.querySelector('.fomc').value,
      tr.querySelector('.reaction').value,
      tr.querySelector('.peer').value,
      tr.querySelector('.qualitative').value,
      tr.querySelector('.benchmark').value,
      tr.querySelector('.stop').value,
      result.score,
      result.decision
    ]);
  });
  const csv = lines.map(row => row.map(csvEscape).join(',')).join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'june_final_decision_output.csv';
  a.click();
  URL.revokeObjectURL(url);
}

buildTable();
</script>
</body>
</html>`;

fs.writeFileSync('june_final_decision_cockpit_20260527.html', html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'june_final_decision_cockpit_20260527.html',
  rows: candidates.length
}, null, 2));
