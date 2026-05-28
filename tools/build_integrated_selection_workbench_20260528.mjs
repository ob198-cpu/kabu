import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

function parseCsvRows(text) {
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  return rows.filter((items) => items.some((item) => String(item).trim() !== ''));
}

function readRows(name) {
  return parseCsvRows(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function show(value, suffix = '') {
  const n = num(value);
  return n === null ? '' : `${Number(n.toFixed(1))}${suffix}`;
}

const companyMaster = {
  '1605.T': ['INPEX', 'エネルギー'],
  '1801.T': ['大成建設', '建設'],
  '1802.T': ['大林組', '建設'],
  '1812.T': ['鹿島', '建設'],
  '2802.T': ['味の素', '食品'],
  '5020.T': ['ENEOS HD', 'エネルギー'],
  '5801.T': ['古河電工', '電線・通信'],
  '5802.T': ['住友電工', '電線・通信'],
  '6146.T': ['ディスコ', '半導体製造装置'],
  '6501.T': ['日立製作所', '総合電機・IT'],
  '6503.T': ['三菱電機', '総合電機・FA'],
  '6701.T': ['NEC', 'IT・防衛周辺'],
  '6762.T': ['TDK', '電子部品'],
  '6857.T': ['アドバンテスト', '半導体製造装置'],
  '7011.T': ['三菱重工', '重工・防衛'],
  '7012.T': ['川崎重工業', '重工・防衛'],
  '7013.T': ['IHI', '重工・防衛'],
  '7203.T': ['トヨタ自動車', '自動車'],
  '7735.T': ['SCREEN HD', '半導体製造装置'],
  '8001.T': ['伊藤忠商事', '商社'],
  '8002.T': ['丸紅', '商社'],
  '8031.T': ['三井物産', '商社'],
  '8035.T': ['東京エレクトロン', '半導体製造装置'],
  '8053.T': ['住友商事', '商社'],
  '8058.T': ['三菱商事', '商社'],
  '8306.T': ['三菱UFJ FG', '銀行'],
  '8316.T': ['三井住友FG', '銀行'],
  '8411.T': ['みずほFG', '銀行'],
  '8725.T': ['MS&AD', '保険'],
  '8750.T': ['第一生命HD', '保険'],
  '8766.T': ['東京海上HD', '保険'],
  '9434.T': ['ソフトバンク', '通信'],
  '9984.T': ['ソフトバンクG', '投資・AI']
};

const themeMaster = {
  AI_DATA_CENTER: {
    label: 'AI・データセンター',
    logic: 'AI需要の増加が、半導体、電力、冷却、通信、電線、制御機器の実需へ波及するかを確認する。',
    evidence: '受注、設備投資、売上成長、利益率、SOXや電力・資本財指標との連動'
  },
  RATE_BANK: {
    label: '金利・銀行/保険',
    logic: '金利上昇が利ざやや運用収益を押し上げる一方、信用コスト悪化がないかを分けて確認する。',
    evidence: '日銀・FRB、長短金利、銀行株指数、信用コスト、自己資本、還元'
  },
  YEN_RESOURCE: {
    label: '円安・資源・商社',
    logic: '円安、資源価格、海外利益の円換算、還元姿勢が業績と株価に残るかを確認する。',
    evidence: '為替、原油/資源価格、セグメント利益、自社株買い、PER/PBR'
  },
  NAPHTHA_CHEM: {
    label: 'ナフサ・化学',
    logic: '原材料高が売上増ではなく利益率改善につながる企業だけを残す。',
    evidence: 'ナフサ/原油、製品市況、価格転嫁率、営業利益率'
  },
  PRICE_PASS: {
    label: '価格転嫁・消費',
    logic: '値上げ、数量、ブランド力、海外比率が利益率に反映されているかを確認する。',
    evidence: '売上成長、数量、営業利益率、CPI、PER説明力'
  },
  DEFENSE_POLICY: {
    label: '防衛・政策',
    logic: '政策予算や受注残が単なる材料ではなく、売上・利益へ変換されるかを確認する。',
    evidence: '防衛予算、受注残、セグメント利益、採算、納期'
  },
  DISASTER_INFRA: {
    label: '防災・インフラ更新',
    logic: '災害や老朽化対策が、建設、通信、電力、重工の受注へつながるかを確認する。',
    evidence: '公共投資、受注、補正予算、資本財指標'
  },
  HEALTHCARE_POLICY: {
    label: '医薬・ヘルスケア政策',
    logic: '新薬、薬価、承認、海外販売が利益成長として持続するかを確認する。',
    evidence: '承認、薬価、パイプライン、地域別売上、PER'
  }
};

const longRows = readRows('728_universe100_long_term_stability_score.csv').slice(1);
const quantRows = readRows('200_universe100_top10_test_candidates.csv').slice(1);
const qualRows = readRows('734_qualitative_candidate_bridge.csv').slice(1);

const longByTicker = new Map(longRows.map((row) => [row[1], {
  longRank: num(row[0]),
  ticker: row[1],
  score: num(row[3]),
  years: row[5],
  cagr5: num(row[6]),
  cagr10: num(row[7]),
  spExcess5: num(row[8]),
  nikkeiExcess5: num(row[9]),
  volatility5: num(row[10]),
  maxDrawdown5: num(row[11]),
  winRate: num(row[12]),
  spCorr: num(row[13]),
  spBeta: num(row[14])
}]));

const quantByTicker = new Map(quantRows.map((row) => [row[2], {
  quantRank: num(row[0]),
  quantScore: num(row[6]),
  salesGrowth: num(row[7]),
  profitGrowth: num(row[8]),
  per: num(row[9]),
  pbr: num(row[10]),
  roe: num(row[11]),
  ret60: num(row[14]),
  ret1y: num(row[15])
}]));

const qualByTicker = new Map();
for (const row of qualRows) {
  const themeId = row[0];
  const ticker = row[1];
  if (!ticker || !themeMaster[themeId]) continue;
  if (!qualByTicker.has(ticker)) qualByTicker.set(ticker, []);
  qualByTicker.get(ticker).push({
    themeId,
    fit: num(row[8]),
    theme: themeMaster[themeId]
  });
}

function decide({ longScore, quantScore, qualList }) {
  const hasQuant = quantScore !== null;
  const hasQual = qualList.length > 0;
  const maxFit = Math.max(...qualList.map((item) => item.fit ?? 0), 0);

  if (longScore >= 70 && hasQuant && quantScore >= 68 && hasQual) {
    return ['優先深掘り', '長期安定性、既存の量的評価、質的接続が同時に確認できる。'];
  }
  if (longScore >= 70 && hasQuant && quantScore >= 65) {
    return ['量的優先確認', '長期安定性と既存の量的評価は強い。質的接続の根拠を追加確認する。'];
  }
  if (longScore >= 70 && !hasQuant) {
    return ['長期浮上・量的補完', '100社の長期計算で浮上。PER/PBR/ROE、成長率、決算後反応を補完して評価する。'];
  }
  if (longScore >= 58 && hasQual && maxFit >= 78) {
    return ['テーマ接続確認', '長期安定性は条件付き。質的接続が強いため、受注・売上・株価反応で検証する。'];
  }
  if (longScore >= 58) {
    return ['比較枠', '長期安定性は条件付き。量的データか質的根拠が足りなければ中心候補にはしない。'];
  }
  if (hasQual) {
    return ['仮説検算枠', '質的接続はあるが、長期安定性が弱い。小さな検算対象にとどめる。'];
  }
  return ['保留', '長期安定性、量的評価、質的接続のいずれも中心候補化には不足。'];
}

const rows = Array.from(longByTicker.values()).map((longRow) => {
  const [company, sectorFallback] = companyMaster[longRow.ticker] || [longRow.ticker, '未分類'];
  const quant = quantByTicker.get(longRow.ticker) || {};
  const qualList = qualByTicker.get(longRow.ticker) || [];
  const qualMax = Math.max(...qualList.map((item) => item.fit ?? 0), 0) || '';
  const [status, reason] = decide({
    longScore: longRow.score ?? 0,
    quantScore: quant.quantScore ?? null,
    qualList
  });
  const missing = [
    quant.quantScore === undefined ? 'PER/PBR/ROE・成長率・決算後反応' : '',
    qualList.length ? '' : '質的接続',
    longRow.years && Number(longRow.years) < 10 ? '10年データ不足' : ''
  ].filter(Boolean).join(' / ');
  return {
    順位: '',
    ticker: longRow.ticker,
    銘柄: company,
    業種: sectorFallback,
    長期安定性点: longRow.score,
    長期順位: longRow.longRank,
    '5年CAGR': longRow.cagr5,
    '10年CAGR': longRow.cagr10,
    '5年S&P差': longRow.spExcess5,
    '5年年率変動': longRow.volatility5,
    '5年最大下落': longRow.maxDrawdown5,
    量的点: quant.quantScore ?? '',
    量的順位: quant.quantRank ?? '',
    質的接続数: qualList.length,
    質的接続強度: qualMax,
    質的接続: qualList.map((item) => `${item.theme.label}(${item.fit ?? ''})`).join(' / '),
    現在の扱い: status,
    判断理由: reason,
    補完項目: missing || '追加確認へ'
  };
});

const statusWeight = {
  優先深掘り: 1,
  量的優先確認: 2,
  '長期浮上・量的補完': 3,
  テーマ接続確認: 4,
  比較枠: 5,
  仮説検算枠: 6,
  保留: 7
};

rows.sort((a, b) => {
  const aw = statusWeight[a.現在の扱い] ?? 99;
  const bw = statusWeight[b.現在の扱い] ?? 99;
  if (aw !== bw) return aw - bw;
  return (b.長期安定性点 || 0) - (a.長期安定性点 || 0);
});
rows.forEach((row, index) => {
  row.順位 = index + 1;
});

const top20 = rows.slice(0, 20);
const summaryRows = [
  ['対象母集団', rows.length, '100社前後の候補群を対象'],
  ['長期安定性計算済み', rows.filter((row) => row.長期安定性点 !== '').length, '5年・10年の株価系列で確認'],
  ['量的詳細あり', rows.filter((row) => row.量的点 !== '').length, 'PER/PBR/ROE・成長率等の既存入力がある銘柄'],
  ['質的接続あり', rows.filter((row) => row.質的接続数 > 0).length, 'テーマIDと企業接続が登録済みの銘柄'],
  ['優先深掘り', rows.filter((row) => row.現在の扱い === '優先深掘り').length, '量的・長期・質的がそろう銘柄'],
  ['長期浮上・量的補完', rows.filter((row) => row.現在の扱い === '長期浮上・量的補完').length, '長期で浮上し、財務・反応データを追加すべき銘柄']
].map(([項目, 件数, 説明]) => ({ 項目, 件数, 説明 }));

writeCsv('736_integrated_selection_workbench.csv', rows, Object.keys(rows[0]));
writeCsv('737_integrated_selection_top20.csv', top20, Object.keys(rows[0]));
writeCsv('738_integrated_selection_summary.csv', summaryRows, ['項目', '件数', '説明']);

function badgeClass(status) {
  if (status === '優先深掘り') return 'ok';
  if (status.includes('補完') || status.includes('確認')) return 'watch';
  if (status === '保留') return 'stop';
  return 'mid';
}

function renderRows(items) {
  return items.map((row) => `<tr>
    <td>${esc(row.順位)}</td>
    <td><b>${esc(row.ticker)}</b></td>
    <td><b>${esc(row.銘柄)}</b><br><small>${esc(row.業種)}</small></td>
    <td>${esc(show(row.長期安定性点, '点'))}<br><small>5年 ${esc(show(row['5年CAGR'], '%'))} / S&P差 ${esc(show(row['5年S&P差'], '%'))}</small></td>
    <td>${esc(row.量的点 === '' ? '未補完' : `${row.量的点}点`)}</td>
    <td>${esc(row.質的接続 || '未接続')}</td>
    <td><span class="badge ${badgeClass(row.現在の扱い)}">${esc(row.現在の扱い)}</span></td>
    <td>${esc(row.判断理由)}<br><small>補完: ${esc(row.補完項目)}</small></td>
  </tr>`).join('');
}

const themeRows = Object.entries(themeMaster).map(([themeId, item]) => `<tr>
  <td>${esc(themeId)}</td>
  <td><b>${esc(item.label)}</b></td>
  <td>${esc(item.logic)}</td>
  <td>${esc(item.evidence)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>100社統合選定ワークベンチ</title>
  <style>
    :root { --ink:#050b14; --muted:#45566a; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#123d63; color:#fff; border-radius:10px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; line-height:1.25; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); font-size:22px; }
    p { margin:0 0 10px; }
    .grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .card b { display:block; color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .main th:nth-child(1), .main td:nth-child(1) { width:5%; text-align:center; }
    .main th:nth-child(2), .main td:nth-child(2) { width:8%; }
    .main th:nth-child(3), .main td:nth-child(3) { width:14%; }
    .main th:nth-child(4), .main td:nth-child(4) { width:13%; }
    .main th:nth-child(5), .main td:nth-child(5) { width:9%; }
    .main th:nth-child(7), .main td:nth-child(7) { width:12%; }
    .badge { display:inline-block; border-radius:8px; padding:4px 8px; color:#fff; font-weight:900; }
    .ok { background:var(--green); }
    .watch { background:var(--amber); }
    .mid { background:var(--blue); }
    .stop { background:var(--red); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>100社統合選定ワークベンチ</h1>
    <p>100社前後の母集団を、長期安定性、既存の量的評価、質的情報の構造化接続で分けて確認します。質的情報は直接加点せず、深掘り優先度と確認条件として扱います。</p>
    <p>作成: ${esc(generatedAt)} / 本表は購入確定表ではなく、次に検証すべき候補を整理するための作業表です。</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.説明)}</p></div>`).join('')}
  </div>

  <section>
    <h2>判定ルール</h2>
    <p class="notice">長期安定性だけ、質的テーマだけ、短期量的スコアだけでは候補を確定しません。長期で浮上した銘柄は、PER/PBR/ROE、成長率、決算後反応、同業比較を補完してから候補化します。質的接続が強くても、実績データと株価反応で確認できるまで購入候補スコアには直接入れません。</p>
  </section>

  <section>
    <h2>統合確認 上位20件</h2>
    <div class="table-wrap">
      <table class="main">
        <thead><tr><th>順位</th><th>コード</th><th>銘柄</th><th>長期安定性</th><th>量的点</th><th>質的接続</th><th>現在の扱い</th><th>判断理由・補完項目</th></tr></thead>
        <tbody>${renderRows(top20)}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>質的情報の構造</h2>
    <p>テーマ名は単なるカテゴリではなく、「出来事から資金・需要がどこへ流れるか」を検証するための仮説IDです。各仮説は、確認すべき数値やイベント後リターンで検証します。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>仮説ID</th><th>名称</th><th>考え方</th><th>確認する数値</th></tr></thead>
        <tbody>${themeRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="736_integrated_selection_workbench.csv">全100社 統合ワークベンチCSV</a> / <a href="737_integrated_selection_top20.csv">上位20件CSV</a> / <a href="738_integrated_selection_summary.csv">要約CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'integrated_selection_workbench_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'integrated_selection_workbench_20260528.html',
  rows: rows.length,
  top20: top20.length,
  priority: rows.filter((row) => row.現在の扱い === '優先深掘り').length
}, null, 2));
