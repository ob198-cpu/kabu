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
  {
    rank: 1,
    ticker: '8316.T',
    company: '三井住友FG',
    before: '中心確認',
    sector: '銀行',
    per: 13.40,
    pbr: 1.44,
    roe: 10.38,
    profitGrowth: 34.0,
    reaction: 55.5,
    peerMedianPer: 13.79,
    peerGroup: '三菱UFJ、みずほ、東京きらぼし',
    after: '中心確認',
    peerFinding: '銀行同業内でPERはおおむね中間。ROEも同業平均から大きく外れていない。',
    action: '日銀後の銀行株全体、利ざや、信用コストを確認。銀行枠の中心候補として維持。'
  },
  {
    rank: 2,
    ticker: '2802.T',
    company: '味の素',
    before: '追加確認付き中心',
    sector: '食品・ヘルスケア',
    per: 42.38,
    pbr: 6.60,
    roe: 17.75,
    profitGrowth: 75.0,
    reaction: 65.8,
    peerMedianPer: 17.51,
    peerGroup: 'キッコーマン、キリンHD',
    after: '条件付き中心',
    peerFinding: '食品同業の補助PERより明確に高い。生活必需品の安定枠ではなく、高PER成長枠として扱う必要がある。',
    action: 'ABF、ヘルスケア、利益成長、決算後反応で高PERを説明できる場合のみ維持。説明できなければ保留へ下げる。'
  },
  {
    rank: 3,
    ticker: '6762.T',
    company: 'TDK',
    before: '追加確認付き中心',
    sector: '電子部品・半導体周辺',
    per: 31.22,
    pbr: 3.21,
    roe: 9.81,
    profitGrowth: 21.5,
    reaction: 63.8,
    peerMedianPer: 34.63,
    peerGroup: '村田製作所、京セラ',
    after: '中心確認',
    peerFinding: '電子部品同業と比べてPER過熱は強くない。利益成長と株価反応も確認対象として残せる。',
    action: 'AIサーバー・電源・HDD周辺需要の質的仮説を、売上成長と6月の半導体指数反応で確認する。'
  },
  {
    rank: 4,
    ticker: '8053.T',
    company: '住友商事',
    before: '追加確認付き中心',
    sector: '商社',
    per: 13.73,
    pbr: 1.87,
    roe: 12.94,
    profitGrowth: 0.9,
    reaction: 59.6,
    peerMedianPer: 15.01,
    peerGroup: '三菱商事、三井物産、伊藤忠、丸紅',
    after: '中心確認',
    peerFinding: '総合商社内でPERは低め、PBRとROEは大きく見劣りしない。成長率は弱いため還元・資源・為替の確認が必要。',
    action: '株主還元、資源価格、為替、商社株全体の反応を確認。成長率の弱さを還元と安定性で補えるかを見る。'
  },
  {
    rank: 5,
    ticker: '8306.T',
    company: '三菱UFJ FG',
    before: '条件付き確認',
    sector: '銀行',
    per: 17.00,
    pbr: 1.54,
    roe: 11.34,
    profitGrowth: 27.7,
    reaction: 55.4,
    peerMedianPer: 13.79,
    peerGroup: '三井住友、みずほ、東京きらぼし',
    after: '補欠比較',
    peerFinding: '銀行内ではPERがやや高め。三井住友FGと同じ銀行テーマの重複もある。',
    action: '銀行枠を複数持つ理由があるか確認。三井住友FGと比較して優位が出なければ補欠扱い。'
  },
  {
    rank: 6,
    ticker: '7173.T',
    company: '東京きらぼしFG',
    before: '監視',
    sector: '銀行',
    per: 8.83,
    pbr: 0.96,
    roe: 10.66,
    profitGrowth: 45.2,
    reaction: 34.5,
    peerMedianPer: 13.79,
    peerGroup: '大手銀行比較',
    after: '監視',
    peerFinding: 'PER/PBRは低いが、決算後反応が弱い。割安だけで候補へ上げない。',
    action: '日銀後の地銀株反応、出来高、決算後20営業日反応の改善を確認してから再評価。'
  },
  {
    rank: 7,
    ticker: '9984.T',
    company: 'ソフトバンクG',
    before: '監視',
    sector: '投資会社・AI関連',
    per: null,
    pbr: 2.45,
    roe: 34.28,
    profitGrowth: 259.9,
    reaction: 52.9,
    peerMedianPer: null,
    peerGroup: 'NAV型評価',
    after: '別評価監視',
    peerFinding: 'PERで単純比較しにくい。保有資産価値、Arm、AI関連株、1年上昇率の過熱を別枠で見る必要がある。',
    action: 'NAV、保有株の下落耐性、米金利、AI株全体の反応を確認。通常のPER/PBR同業比較には混ぜない。'
  },
  {
    rank: 8,
    ticker: '7735.T',
    company: 'SCREEN HD',
    before: '監視',
    sector: '半導体製造装置',
    per: 19.65,
    pbr: 4.44,
    roe: 20.28,
    profitGrowth: -9.7,
    reaction: 57.3,
    peerMedianPer: 42.17,
    peerGroup: '東京エレクトロン、ディスコ、アドバンテスト、レーザーテック',
    after: '監視',
    peerFinding: '半導体製造装置内ではPERは低め。ただし利益成長がマイナスで、低PERだけでは候補化できない。',
    action: '受注、次期見通し、20営業日反応、SOX耐性を確認。利益成長改善が見えれば再評価。'
  },
  {
    rank: 9,
    ticker: '6146.T',
    company: 'ディスコ',
    before: '監視',
    sector: '半導体製造装置',
    per: 61.44,
    pbr: 12.74,
    roe: 25.15,
    profitGrowth: 10.9,
    reaction: 55.6,
    peerMedianPer: 42.17,
    peerGroup: '東京エレクトロン、SCREEN、アドバンテスト、レーザーテック',
    after: '反応検算',
    peerFinding: '工程優位の質的材料は強いが、PER/PBRは同業内でも高い。技術優位だけで通さない。',
    action: '20営業日反応、受注、利益率、SOX耐性がそろうまで中心候補へ戻さない。'
  },
  {
    rank: 10,
    ticker: '7011.T',
    company: '三菱重工業',
    before: '監視',
    sector: '重工・防衛',
    per: 34.29,
    pbr: 4.22,
    roe: 12.22,
    profitGrowth: 26.7,
    reaction: 50.6,
    peerMedianPer: 21.60,
    peerGroup: '川崎重工、IHI',
    after: '反応検算',
    peerFinding: '重工同業よりPERが高く、直近下落も大きい。テーマ性だけで候補へ上げない。',
    action: '防衛・発電テーマの継続、200日線回復、下落率改善を確認。改善がなければ監視継続。'
  }
];

function round(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '未取得';
  return Number(value).toFixed(digits).replace(/\.00$/, '');
}

function peerRatio(row) {
  if (!row.per || !row.peerMedianPer) return null;
  return row.per / row.peerMedianPer;
}

function peerSignal(row) {
  const ratio = peerRatio(row);
  if (ratio === null) return '別評価';
  if (ratio >= 1.4) return '割高警戒';
  if (ratio <= 0.85 && row.roe >= 10) return '相対割安';
  return '中間';
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
}

const summary = [
  ['作成', '区分', '内容', '状態'],
  [generatedAt, '反映方法', '外部同業比較は購入候補スコアに直接加点せず、割高警戒、説明補助、除外条件、追加確認条件として使う。', '反映済み'],
  [generatedAt, '中心確認', '三井住友FG、TDK、住友商事は同業比較後も中心確認に残す。', '反映済み'],
  [generatedAt, '条件付き中心', '味の素は同業比でPER/PBRが高いため、高PER成長枠として説明条件を厳格化する。', '反映済み'],
  [generatedAt, '監視・検算', '三菱UFJ、東京きらぼし、ソフトバンクG、SCREEN、ディスコ、三菱重工は追加確認または反応検算に置く。', '反映済み'],
  [generatedAt, '次の入力', '6月イベント後に市場条件、決算後20営業日反応、同業比較の未接続項目を再入力する。', '次工程']
];

const detailRows = [
  ['作成', '順位', '銘柄', '従来区分', '同業', 'PER', '同業PER目安', 'PER倍率', '同業シグナル', '反映後の扱い', '確認内容', '次アクション']
];
for (const row of candidates) {
  const ratio = peerRatio(row);
  detailRows.push([
    generatedAt,
    row.rank,
    `${row.ticker} ${row.company}`,
    row.before,
    row.peerGroup,
    row.per ? `${round(row.per)}倍` : '未取得',
    row.peerMedianPer ? `${round(row.peerMedianPer)}倍` : '別評価',
    ratio ? `${round(ratio, 2)}倍` : '別評価',
    peerSignal(row),
    row.after,
    row.peerFinding,
    row.action
  ]);
}

const rules = [
  ['作成', 'ルール', '内容'],
  [generatedAt, '同業比較', '全業種一律のPER/PBR/ROE比較をしない。銀行、食品、商社、半導体、重工、投資会社型を分ける。'],
  [generatedAt, '直接加点禁止', '同業比較で良い材料があってもスコアに単純加点しない。説明条件、警戒条件、除外条件へ反映する。'],
  [generatedAt, '割高警戒', 'PERが同業目安の1.4倍以上なら割高警戒。利益成長、ROE、決算後反応で説明できない場合は保留へ下げる。'],
  [generatedAt, '相対割安', 'PERが同業目安より低くても、業績悪化や反応悪化があれば候補化しない。'],
  [generatedAt, '別評価', 'ソフトバンクGのような投資会社型はPER比較に混ぜず、NAV、保有資産、関連株の下落耐性で別評価する。']
];

writeCsv('707_peer_reflected_candidate_summary.csv', summary);
writeCsv('708_peer_reflected_candidate_detail.csv', detailRows);
writeCsv('709_peer_reflected_candidate_rules.csv', rules);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>同業比較反映後 候補10社レビュー 2026年5月27日</title>
  <style>
    :root { --ink:#071f3a; --muted:#4c6178; --line:#d7e4f2; --soft:#f6f9fc; --blue:#0b5f96; --green:#087f5b; --amber:#ad5a00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    .hero { background:#123d63; color:white; border-radius:8px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:23px; }
    .note { color:#e8f4ff; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .label { color:var(--muted); font-size:13px; }
    .value { font-size:24px; font-weight:800; margin-top:4px; }
    .ok { color:var(--green); font-weight:800; }
    .warn { color:var(--amber); font-weight:800; }
    .bad { color:var(--red); font-weight:800; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); table-layout:fixed; }
    th, td { border:1px solid var(--line); padding:10px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; font-size:13px; }
    th { background:#e6f1fb; text-align:left; }
    .detail th:nth-child(1), .detail td:nth-child(1) { width:9%; }
    .detail th:nth-child(2), .detail td:nth-child(2) { width:5%; }
    .detail th:nth-child(3), .detail td:nth-child(3) { width:12%; }
    .detail th:nth-child(10), .detail td:nth-child(10) { width:10%; }
    .detail th:nth-child(11), .detail td:nth-child(11) { width:18%; }
    .detail th:nth-child(12), .detail td:nth-child(12) { width:18%; }
    .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-weight:800; background:#eef6ff; border:1px solid var(--line); }
    .formula { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .formula code { display:block; background:#f4f7fb; border:1px solid var(--line); border-radius:6px; padding:10px; white-space:normal; overflow-wrap:anywhere; color:#111; margin-bottom:8px; }
    .footer { margin-top:24px; color:var(--muted); font-size:13px; }
    a { color:#064f88; font-weight:700; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr; } table { table-layout:auto; } h1 { font-size:24px; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>同業比較反映後 候補10社レビュー</h1>
    <div class="note">作成: ${generatedAt} / 目的: 外部同業数値を候補10社の扱いへ反映し、説明条件と警戒条件を明確にする。</div>
  </section>

  <section class="grid">
    <div class="card"><div class="label">中心確認</div><div class="value ok">3社</div><div>三井住友FG、TDK、住友商事</div></div>
    <div class="card"><div class="label">条件付き中心</div><div class="value warn">1社</div><div>味の素は高PER説明が必須</div></div>
    <div class="card"><div class="label">監視・検算</div><div class="value">6社</div><div>反応・同業・別評価を確認</div></div>
    <div class="card"><div class="label">反映方針</div><div class="value warn">加点なし</div><div>警戒条件と説明条件に反映</div></div>
  </section>

  <h2>1. 要約</h2>
  <table>
    <thead><tr><th>区分</th><th>内容</th><th>状態</th></tr></thead>
    <tbody>
      ${summary.slice(1).map(row => `<tr><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>2. 候補10社への反映</h2>
  <table class="detail">
    <thead><tr>${detailRows[0].map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${detailRows.slice(1).map(row => `<tr>${row.map((cell, i) => `<td>${i === 8 || i === 9 ? `<span class="pill">${cell}</span>` : cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>

  <h2>3. 使用ルール</h2>
  <div class="formula">
    <code>PER倍率 = 対象銘柄PER ÷ 同業PER目安</code>
    <code>PER倍率が1.4倍以上: 割高警戒。利益成長、ROE、決算後反応で説明できない場合は保留へ下げる。</code>
    <code>PER倍率が低い: 低PERだけでは候補化しない。業績悪化、決算後反応、下落率を同時に確認する。</code>
    <code>投資会社型: PER比較から切り離し、NAV、保有資産、関連株の下落耐性で別評価する。</code>
  </div>

  <h2>4. 次の作業</h2>
  <table>
    <thead><tr><th>順番</th><th>作業</th><th>目的</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>6月イベント後の市場条件入力</td><td>CPI、日銀、FOMC後に、金利・為替・日経平均/TOPIX・SOXを再入力する。</td></tr>
      <tr><td>2</td><td>20営業日反応の更新</td><td>決算後の価格反応が指数を上回っているか確認する。</td></tr>
      <tr><td>3</td><td>候補10社の残す・保留・外す再判定</td><td>同業比較、量的評価、質的テーマ確認を合わせ、NISA 1年保有テスト候補を再整理する。</td></tr>
    </tbody>
  </table>

  <div class="footer">
    CSV: <a href="707_peer_reflected_candidate_summary.csv">要約</a> /
    <a href="708_peer_reflected_candidate_detail.csv">明細</a> /
    <a href="709_peer_reflected_candidate_rules.csv">ルール</a>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync('peer_reflected_candidate_review_20260527.html', html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'peer_reflected_candidate_review_20260527.html',
  candidates: candidates.length
}, null, 2));
