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

function num(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[+%,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value) {
  return `${Math.round(value * 10) / 10}%`;
}

const holdings = readCsv('636_winner_portfolio_holdings_extracted.csv');
const themeRows = readCsv('637_winner_portfolio_theme_summary.csv');
const bridgeRows = readCsv('638_winner_portfolio_candidate_bridge.csv');
const currentCandidates = readCsv('630_candidate_selection_explanation_table.csv');

const validContrib = holdings
  .map((row) => ({ ...row, contribution: num(row.estimated_total_contribution, NaN), returnPct: num(row.source_return_pct, NaN), weight: num(row.portfolio_weight_pct, 0) }))
  .filter((row) => Number.isFinite(row.contribution));
const totalContribution = validContrib.reduce((sum, row) => sum + row.contribution, 0);
const contributionSorted = [...validContrib].sort((a, b) => b.contribution - a.contribution);

function topShare(n) {
  const amount = contributionSorted.slice(0, n).reduce((sum, row) => sum + row.contribution, 0);
  return {
    group: `上位${n}銘柄`,
    contribution: Math.round(amount * 10) / 10,
    share_pct: pct(totalContribution ? amount / totalContribution * 100 : 0),
    interpretation: n <= 5
      ? '成果のかなり大きい部分が少数の主力銘柄に集中。銘柄選定では主力候補の根拠確認が重要。'
      : '上位群でほとんどの利益を作っている。候補10社でも全銘柄同じ重みではなく、根拠の強弱を分ける必要がある。',
  };
}

const concentrationRows = [
  topShare(3),
  topShare(5),
  topShare(10),
  topShare(15),
  {
    group: '全体',
    contribution: Math.round(totalContribution * 10) / 10,
    share_pct: '100%',
    interpretation: 'この資料は勝ち筋の構造分析には使えるが、買付時点・現在株価・最新決算が不明なため、直接の購入判断には使わない。',
  },
];

const themeInsightRows = themeRows.map((row) => {
  const contribution = num(row.estimated_total_contribution);
  let implication = '参考テーマ。既存候補との接続があれば確認材料にする。';
  let useLevel = '補助';
  if (row.theme === '金利・金融') {
    implication = '最も寄与が大きいテーマの一つ。日銀・金利・信用コスト・バフェット売買監視とセットで再評価する価値がある。';
    useLevel = '高';
  } else if (row.theme === '資本財・重工・景気循環') {
    implication = '高寄与テーマ。防衛、インフラ、資本財、商社のうち、今から追える銘柄があるか再スクリーニングする価値がある。';
    useLevel = '高';
  } else if (row.theme === '半導体・AI・大型成長') {
    implication = '寄与は大きいが上昇済み銘柄も多い。TDK、ディスコなどはテーマ近似として残し、PER・SOX・決算反応で確認する。';
    useLevel = '高';
  } else if (row.theme === '指数・ETF') {
    implication = '市場ベータの土台。個別株が指数+1%を狙う意味を確認する比較基準として使う。';
    useLevel = '高';
  }
  return {
    generated_at: generatedAt,
    theme: row.theme,
    count: row.count,
    total_weight_pct: row.total_weight_pct,
    average_return_pct: row.average_return_pct,
    estimated_total_contribution: contribution,
    reference_level: useLevel,
    implication,
  };
}).sort((a, b) => b.estimated_total_contribution - a.estimated_total_contribution);

function referenceSupport(row) {
  if (row.connection === '直接一致') {
    const ret = num(row.reference_return_pct);
    if (ret >= 150) return { score: 76, label: '強い参照。ただし追随リスクあり' };
    return { score: 70, label: '直接参照' };
  }
  if (row.connection === 'テーマ近似') return { score: 64, label: 'テーマ参照' };
  return { score: 45, label: '参照弱い' };
}

function copyRisk(row) {
  const ret = num(row.reference_return_pct, NaN);
  if (row.connection === '未接続') return 'なし。参照ポートフォリオからは補強できない。';
  if (Number.isFinite(ret) && ret >= 200) return '高い。すでに大きく上昇した勝者を後追いする危険がある。';
  if (Number.isFinite(ret) && ret >= 100) return '中。勝ち筋は参考になるが、現在価格と決算反応の再確認が必要。';
  return '低〜中。直接買いではなく構造確認として使う。';
}

function actionByBridge(row) {
  const current = currentCandidates.find((candidate) => candidate.ticker === row.ticker);
  const currentClass = current?.test_priority_class || row.current_class;
  if (row.ticker === '2802.T') return '勝者ポートフォリオからの補強は弱い。食品・値上げ耐性の独立仮説として、決算・PER・数量減を重視する。';
  if (row.connection === '直接一致' && currentClass === '監視のみ') return '過去の勝ち筋には一致。ただし現在は監視分類なので、金利・決算反応・警戒材料が改善した時だけ再浮上させる。';
  if (row.connection === '直接一致') return '直接一致するため説明材料になる。ただし過去上昇の後追いにならないよう、最新PER・決算後反応を必ず確認する。';
  if (row.connection === 'テーマ近似') return '同じテーマの勝者例として有用。現在候補が同じ利益構造に乗っているか、売上・受注・利益率で確認する。';
  return '参照データだけでは補強できない。既存の量的スコアと6月再判定を優先する。';
}

const candidateReferenceRows = bridgeRows.map((row) => {
  const support = referenceSupport(row);
  return {
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    current_class: row.current_class,
    connection: row.connection,
    reference_ticker: row.reference_ticker,
    reference_theme: row.reference_theme,
    reference_return_pct: row.reference_return_pct,
    reference_role: row.reference_role,
    reference_support_score: support.score,
    reference_support_label: support.label,
    copy_risk: copyRisk(row),
    action: actionByBridge(row),
  };
});

const importQueueRows = contributionSorted.slice(0, 16).map((row, index) => {
  const alreadyCandidate = currentCandidates.some((candidate) => candidate.ticker.replace('.T', '') === row.ticker);
  let priority = 'B';
  if (index < 5) priority = 'A';
  if (alreadyCandidate) priority = '既存候補';
  return {
    generated_at: generatedAt,
    priority,
    ticker: `${row.ticker}.T`,
    company: row.company,
    theme: row.theme,
    role: row.role,
    source_return_pct: row.source_return_pct,
    estimated_total_contribution: row.estimated_total_contribution,
    already_in_current_candidates: alreadyCandidate ? 'あり' : 'なし',
    reason_to_review: alreadyCandidate
      ? '既存候補内で、プロ参照データとの整合性を再確認する。'
      : '勝者ポートフォリオの高寄与銘柄。現在のPER、PBR、ROE、決算反応、下落耐性を取得して再スクリーニングする価値がある。',
    caution: num(row.source_return_pct) >= 150
      ? '過去上昇が大きいため、後追い買いにならないかを最優先確認。'
      : '現在の地合い・最新決算を確認する。',
  };
});

const rulesRows = [
  {
    rule: '参照ポートフォリオは直接加点しない',
    detail: '成果が出た事実は参考になるが、買付時点と現在価格が違うため、候補を自動昇格させない。',
  },
  {
    rule: '直接一致は再確認価値を上げる',
    detail: '既存候補と参照ポートフォリオが直接一致する場合、最新PER・決算反応・警戒材料を確認して再判定する。',
  },
  {
    rule: 'テーマ近似は仮説強化に使う',
    detail: 'TDKやディスコのようにテーマが近い場合、売上・受注・利益率が同じ方向に動くかを確認する。',
  },
  {
    rule: '高上昇銘柄は追随リスクを同時に見る',
    detail: '+150%以上の上昇銘柄は勝ち筋としては参考になるが、今から買う場合は割高・過熱を強く確認する。',
  },
  {
    rule: '高寄与なのに候補外の銘柄を追加キューへ入れる',
    detail: '三菱重工、東京きらぼしFG、住友商事、山洋電気、SCREENなどは、現在候補外でも再スクリーニング対象にする。',
  },
  {
    rule: '指数・ETFは基準枠として使う',
    detail: 'TOPIX・日経平均連動ETFは、個別株選定が本当に+1%を狙う意味を持つかの比較基準にする。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '結論',
    detail: 'この資料は参考になる。特に、プロが成果を出した銘柄名そのものより、金利・金融、資本財・重工、半導体・AI、指数ETFという勝ち筋の構造が有用。',
  },
  {
    generated_at: generatedAt,
    item: '使い方',
    detail: '直接買う根拠ではなく、候補銘柄が勝者ポートフォリオの構造と一致しているかを確認する参照レイヤーとして使う。',
  },
  {
    generated_at: generatedAt,
    item: '重要な発見',
    detail: '上位5銘柄で推定寄与の約68.5%、上位10銘柄で約85.3%を占める。NISAテストでも全候補を同じ重みにせず、主力候補と監視候補を分ける必要がある。',
  },
  {
    generated_at: generatedAt,
    item: '追加すべき工程',
    detail: '高寄与なのに現在候補外の銘柄を、プロ参照追加キューとしてPER、PBR、ROE、決算反応、下落耐性で再評価する。',
  },
];

writeCsv('640_professional_portfolio_deep_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('641_professional_portfolio_concentration.csv', concentrationRows, ['group', 'contribution', 'share_pct', 'interpretation']);
writeCsv('642_professional_portfolio_theme_insights.csv', themeInsightRows, ['generated_at', 'theme', 'count', 'total_weight_pct', 'average_return_pct', 'estimated_total_contribution', 'reference_level', 'implication']);
writeCsv('643_professional_portfolio_candidate_reference.csv', candidateReferenceRows, ['generated_at', 'ticker', 'company', 'current_class', 'connection', 'reference_ticker', 'reference_theme', 'reference_return_pct', 'reference_role', 'reference_support_score', 'reference_support_label', 'copy_risk', 'action']);
writeCsv('644_professional_portfolio_import_queue.csv', importQueueRows, ['generated_at', 'priority', 'ticker', 'company', 'theme', 'role', 'source_return_pct', 'estimated_total_contribution', 'already_in_current_candidates', 'reason_to_review', 'caution']);
writeCsv('645_professional_reference_rules.csv', rulesRows, ['rule', 'detail']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>プロ作成ポートフォリオ 深掘り分析 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; --red:#a82424; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1400px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1120px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card b { display:block; font-size:28px; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:2200px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .cards { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      .wide table { min-width:0; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>プロ作成ポートフォリオ 深掘り分析</h1>
      <p class="lead">成果が出ているポートフォリオを、購入銘柄リストとしてではなく、勝ち筋・寄与集中・テーマ構造・既存候補との整合性を確認する参照レイヤーとして分析します。</p>
    </header>

    <section>
      <h2>1. 結論</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">参考になります。ただし、買付時点と現在価格が違うため、そのまま買う判断には使いません。勝ち筋の構造確認に使います。</div>
    </section>

    <section>
      <h2>2. 寄与集中</h2>
      <div class="cards">
        <div class="card"><b>${pct(contributionSorted.slice(0, 3).reduce((sum, row) => sum + row.contribution, 0) / totalContribution * 100)}</b><span>上位3銘柄の寄与比率</span></div>
        <div class="card"><b>${pct(contributionSorted.slice(0, 5).reduce((sum, row) => sum + row.contribution, 0) / totalContribution * 100)}</b><span>上位5銘柄の寄与比率</span></div>
        <div class="card"><b>${pct(contributionSorted.slice(0, 10).reduce((sum, row) => sum + row.contribution, 0) / totalContribution * 100)}</b><span>上位10銘柄の寄与比率</span></div>
        <div class="card"><b>${contributionSorted[0]?.ticker || '-'}</b><span>最大寄与銘柄</span></div>
      </div>
      ${table([
        { key: 'group', label: '区分' },
        { key: 'contribution', label: '推定寄与' },
        { key: 'share_pct', label: '寄与比率' },
        { key: 'interpretation', label: '読み取り' },
      ], concentrationRows)}
    </section>

    <section>
      <h2>3. テーマ別の読み取り</h2>
      ${table([
        { key: 'theme', label: 'テーマ' },
        { key: 'count', label: '件数' },
        { key: 'total_weight_pct', label: '比率合計' },
        { key: 'average_return_pct', label: '平均騰落率' },
        { key: 'estimated_total_contribution', label: '推定寄与' },
        { key: 'reference_level', label: '参照度' },
        { key: 'implication', label: 'システムへの意味' },
      ], themeInsightRows, 'wide')}
    </section>

    <section>
      <h2>4. 既存候補への反映</h2>
      ${table([
        { key: 'ticker', label: '候補銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'current_class', label: '現在分類' },
        { key: 'connection', label: '接続' },
        { key: 'reference_ticker', label: '参照銘柄' },
        { key: 'reference_theme', label: '参照テーマ' },
        { key: 'reference_return_pct', label: '参照騰落率' },
        { key: 'reference_role', label: '参照役割' },
        { key: 'reference_support_score', label: '参照点' },
        { key: 'reference_support_label', label: '参照判定' },
        { key: 'copy_risk', label: '後追いリスク' },
        { key: 'action', label: '反映方法' },
      ], candidateReferenceRows, 'wide')}
    </section>

    <section>
      <h2>5. 追加スクリーニング候補</h2>
      ${table([
        { key: 'priority', label: '優先' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'theme', label: 'テーマ' },
        { key: 'role', label: '役割' },
        { key: 'source_return_pct', label: '資料上騰落率' },
        { key: 'estimated_total_contribution', label: '推定寄与' },
        { key: 'already_in_current_candidates', label: '既存候補' },
        { key: 'reason_to_review', label: '確認理由' },
        { key: 'caution', label: '注意' },
      ], importQueueRows, 'wide')}
    </section>

    <section>
      <h2>6. 運用ルール</h2>
      ${table([
        { key: 'rule', label: 'ルール' },
        { key: 'detail', label: '内容' },
      ], rulesRows, 'wide')}
      <div class="actions">
        <a href="640_professional_portfolio_deep_summary.csv">要約CSV</a>
        <a href="641_professional_portfolio_concentration.csv">寄与集中CSV</a>
        <a href="642_professional_portfolio_theme_insights.csv">テーマ分析CSV</a>
        <a href="643_professional_portfolio_candidate_reference.csv">候補反映CSV</a>
        <a href="644_professional_portfolio_import_queue.csv">追加候補CSV</a>
        <a href="645_professional_reference_rules.csv">運用ルールCSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'professional_portfolio_deep_analysis_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  totalContribution: Math.round(totalContribution * 10) / 10,
  top5Share: concentrationRows[1].share_pct,
  top10Share: concentrationRows[2].share_pct,
  output: 'professional_portfolio_deep_analysis_20260527.html',
}, null, 2));
