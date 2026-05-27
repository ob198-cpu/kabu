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
  { ticker: '8316.T', company: '三井住友FG', status: '中心確認', base: 60, group: 'bank' },
  { ticker: '6762.T', company: 'TDK', status: '中心確認', base: 60, group: 'semi' },
  { ticker: '8053.T', company: '住友商事', status: '中心確認', base: 60, group: 'trading' },
  { ticker: '2802.T', company: '味の素', status: '条件付き中心', base: 55, group: 'food_growth' },
  { ticker: '8306.T', company: '三菱UFJ FG', status: '補欠比較', base: 48, group: 'bank' },
  { ticker: '7173.T', company: '東京きらぼしFG', status: '監視', base: 45, group: 'regional_bank' },
  { ticker: '9984.T', company: 'ソフトバンクG', status: '別評価監視', base: 43, group: 'ai_asset' },
  { ticker: '7735.T', company: 'SCREEN HD', status: '監視', base: 45, group: 'semi' },
  { ticker: '6146.T', company: 'ディスコ', status: '反応検算', base: 43, group: 'semi' },
  { ticker: '7011.T', company: '三菱重工業', status: '反応検算', base: 43, group: 'heavy' }
];

const scenarios = [
  {
    id: 'S0',
    name: '現在未入力',
    description: '6月イベントや20営業日反応がまだ入力されていない状態。最終判断ではなく入力待ちとして扱う。',
    event: '未入力',
    reaction: '未到来',
    peer: '要確認',
    qualitative: '要確認',
    benchmark: '要確認'
  },
  {
    id: 'S1',
    name: '標準通過',
    description: 'CPI・日銀・FOMCは大きく悪化せず、20営業日反応は中立。追加説明はまだ十分ではない状態。',
    event: '注意',
    boj: '良好',
    fomc: '注意',
    reaction: '中立',
    peer: '要確認',
    qualitative: '要確認',
    benchmark: '要確認'
  },
  {
    id: 'S2',
    name: '良好確認',
    description: '市場イベント、決算後反応、同業説明、質的根拠、ベンチマーク根拠がすべて確認できた上限ケース。',
    event: '良好',
    reaction: '良好',
    peer: '説明可能',
    qualitative: '確認',
    benchmark: '確認'
  },
  {
    id: 'S3',
    name: '金利・半導体逆風',
    description: 'FOMC後の金利上昇やSOX下落で半導体・AI関連に逆風が出るケース。銀行は相対的に保留へ残りやすいかを確認する。',
    custom: true
  },
  {
    id: 'S4',
    name: '悪化ケース',
    description: 'インフレ、金利、指数、同業説明、質的根拠がそろって悪化する下限ケース。',
    event: '悪化',
    reaction: '悪化',
    peer: '説明不足',
    qualitative: '否定',
    benchmark: '弱い'
  }
];

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

function inputsFor(scenario, candidate) {
  if (!scenario.custom) {
    return {
      cpi: scenario.event,
      boj: scenario.boj || scenario.event,
      fomc: scenario.fomc || scenario.event,
      reaction: scenario.reaction,
      peer: scenario.peer,
      qualitative: scenario.qualitative,
      benchmark: scenario.benchmark,
      stop: 'なし'
    };
  }
  if (candidate.group === 'bank' || candidate.group === 'regional_bank') {
    return { cpi: '注意', boj: '良好', fomc: '注意', reaction: '中立', peer: '要確認', qualitative: '要確認', benchmark: '要確認', stop: 'なし' };
  }
  if (candidate.group === 'semi' || candidate.group === 'ai_asset') {
    return { cpi: '注意', boj: '注意', fomc: '悪化', reaction: '悪化', peer: '要確認', qualitative: '要確認', benchmark: '弱い', stop: 'なし' };
  }
  return { cpi: '注意', boj: '注意', fomc: '悪化', reaction: '中立', peer: '要確認', qualitative: '要確認', benchmark: '要確認', stop: 'なし' };
}

function evaluate(candidate, input) {
  const score = candidate.base + eventScore(input.cpi) + eventScore(input.boj) + eventScore(input.fomc) + reactionScore(input.reaction) + peerScore(input.peer) + qualitativeScore(input.qualitative) + benchmarkScore(input.benchmark);
  const pending = input.cpi === '未入力' || input.boj === '未入力' || input.fomc === '未入力' || input.reaction === '未到来';
  let decision = score >= 78 ? '残す' : score >= 55 ? '保留' : '外す';
  if (pending) decision = '入力待ち';
  if (input.stop === 'あり') decision = '外す';
  if (input.qualitative === '否定') decision = '外す';
  if (input.peer === '説明不足' && score < 78) decision = '保留';
  if (input.benchmark === '弱い') decision = score >= 78 ? '保留' : '外す';
  return { score, decision };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
}

const detailRows = [['作成', 'シナリオ', '銘柄', '会社名', '初期区分', '点数', '判定', 'CPI', '日銀', 'FOMC', '20営業日反応', '同業説明', '質的根拠', 'ベンチ根拠']];
const summaryRows = [['作成', 'シナリオ', '残す', '保留', '外す', '入力待ち', '意味']];
for (const scenario of scenarios) {
  const counts = { '残す': 0, '保留': 0, '外す': 0, '入力待ち': 0 };
  for (const candidate of candidates) {
    const input = inputsFor(scenario, candidate);
    const result = evaluate(candidate, input);
    counts[result.decision] += 1;
    detailRows.push([
      generatedAt,
      scenario.name,
      candidate.ticker,
      candidate.company,
      candidate.status,
      result.score,
      result.decision,
      input.cpi,
      input.boj,
      input.fomc,
      input.reaction,
      input.peer,
      input.qualitative,
      input.benchmark
    ]);
  }
  summaryRows.push([
    generatedAt,
    scenario.name,
    counts['残す'],
    counts['保留'],
    counts['外す'],
    counts['入力待ち'],
    scenario.description
  ]);
}

writeCsv('716_june_scenario_simulation_summary.csv', summaryRows);
writeCsv('717_june_scenario_simulation_detail.csv', detailRows);
writeCsv('718_june_scenario_simulation_rules.csv', [
  ['作成', 'ルール', '内容'],
  [generatedAt, '目的', '6月イベント後の入力前に、候補がどの市場条件に弱いかを確認する。'],
  [generatedAt, '未入力状態', '最終判断ではなく入力待ち。候補を落としたとは扱わない。'],
  [generatedAt, '標準通過', 'イベントが大きく悪化しないだけでは、多くの銘柄は保留に残る。残すには同業説明、質的根拠、ベンチマーク根拠が必要。'],
  [generatedAt, '良好確認', '全条件が確認できた上限ケース。実際の判断ではこの条件を個別に確認する。'],
  [generatedAt, '逆風ケース', '半導体・AI関連は金利とSOXに敏感。銀行は金利上昇が追い風でも信用コスト確認が必要。'],
  [generatedAt, '悪化ケース', '市場と個別根拠が悪化した場合は、個別株比率を下げる。']
]);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月シナリオ別 候補10社シミュレーション</title>
  <style>
    :root { --ink:#071f3a; --muted:#4c6178; --line:#d7e4f2; --blue:#0b5f96; --green:#087f5b; --amber:#ad5a00; --red:#b42318; --soft:#f6f9fc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif; color:var(--ink); background:#eef4fa; line-height:1.7; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    .hero { background:#123d63; color:white; border-radius:8px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:23px; }
    .note { color:#e8f4ff; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); table-layout:fixed; }
    th, td { border:1px solid var(--line); padding:10px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; font-size:13px; }
    th { background:#e6f1fb; text-align:left; }
    .summary th:nth-child(1), .summary td:nth-child(1) { width:14%; }
    .summary th:nth-child(2), .summary td:nth-child(2),
    .summary th:nth-child(3), .summary td:nth-child(3),
    .summary th:nth-child(4), .summary td:nth-child(4),
    .summary th:nth-child(5), .summary td:nth-child(5) { width:8%; text-align:center; }
    .detail th:nth-child(1), .detail td:nth-child(1) { width:12%; }
    .detail th:nth-child(2), .detail td:nth-child(2) { width:8%; }
    .detail th:nth-child(3), .detail td:nth-child(3) { width:9%; }
    .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-weight:900; border:1px solid var(--line); background:#f5f9fd; }
    .keep { color:var(--green); }
    .hold { color:var(--amber); }
    .remove { color:var(--red); }
    .wait { color:var(--muted); }
    .box { background:white; border:1px solid var(--line); border-radius:8px; padding:16px; margin:14px 0; }
    .footer { margin-top:24px; color:var(--muted); font-size:13px; }
    a { color:#064f88; font-weight:700; }
    @media (max-width:900px) { table { table-layout:auto; } h1 { font-size:24px; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>6月シナリオ別 候補10社シミュレーション</h1>
    <div class="note">作成: ${generatedAt} / 目的: 6月イベント後に、どの条件で候補が残るか・保留になるかを事前に確認する。</div>
  </section>

  <h2>1. シナリオ別の全体像</h2>
  <table class="summary">
    <thead><tr><th>シナリオ</th><th>残す</th><th>保留</th><th>外す</th><th>入力待ち</th><th>意味</th></tr></thead>
    <tbody>
      ${summaryRows.slice(1).map(row => `<tr><td>${row[1]}</td><td class="keep">${row[2]}</td><td class="hold">${row[3]}</td><td class="remove">${row[4]}</td><td class="wait">${row[5]}</td><td>${row[6]}</td></tr>`).join('')}
    </tbody>
  </table>

  <div class="box">
    <strong>読み方:</strong> 現在未入力は最終判断ではありません。標準通過で多くが保留に残る場合は、6月イベントが悪くないだけでは不十分で、同業説明・質的根拠・ベンチマーク根拠の確認が必要という意味です。
  </div>

  <h2>2. 銘柄別の結果</h2>
  <table class="detail">
    <thead><tr><th>シナリオ</th><th>銘柄</th><th>会社名</th><th>初期区分</th><th>点数</th><th>判定</th><th>CPI</th><th>日銀</th><th>FOMC</th><th>20営業日反応</th><th>同業説明</th><th>質的根拠</th><th>ベンチ根拠</th></tr></thead>
    <tbody>
      ${detailRows.slice(1).map(row => {
        const cls = row[6] === '残す' ? 'keep' : row[6] === '保留' ? 'hold' : row[6] === '入力待ち' ? 'wait' : 'remove';
        return `<tr><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}点</td><td><span class="pill ${cls}">${row[6]}</span></td><td>${row[7]}</td><td>${row[8]}</td><td>${row[9]}</td><td>${row[10]}</td><td>${row[11]}</td><td>${row[12]}</td><td>${row[13]}</td></tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>3. 次の使い方</h2>
  <table>
    <thead><tr><th>使う場面</th><th>確認すること</th><th>反映先</th></tr></thead>
    <tbody>
      <tr><td>6月イベント前</td><td>標準通過で保留に残る銘柄を確認し、追加説明が必要な項目を先に埋める。</td><td>候補10社の根拠整理</td></tr>
      <tr><td>6月イベント後</td><td>CPI、日銀、FOMC、20営業日反応を実数で入力し、コックピットで再判定する。</td><td>6月最終再判定 入力コックピット</td></tr>
      <tr><td>悪化時</td><td>S&P500投信・日経平均/TOPIXを1年で+1%以上上回る根拠が弱い場合は、個別株比率を下げる。</td><td>資金配分・保留判断</td></tr>
    </tbody>
  </table>

  <div class="footer">
    CSV: <a href="716_june_scenario_simulation_summary.csv">要約</a> /
    <a href="717_june_scenario_simulation_detail.csv">明細</a> /
    <a href="718_june_scenario_simulation_rules.csv">ルール</a>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync('june_scenario_simulation_20260527.html', html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'june_scenario_simulation_20260527.html',
  scenarios: scenarios.length,
  rows: detailRows.length - 1
}, null, 2));
