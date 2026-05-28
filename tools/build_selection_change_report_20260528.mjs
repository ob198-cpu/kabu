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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function tickerOf(text) {
  const m = String(text || '').match(/[0-9]{4}\.T/);
  return m ? m[0] : String(text || '').split(/\s+/)[0];
}

function companyOf(text, fallback = '') {
  const s = String(text || '');
  return s.replace(/^[0-9]{4}\.T\s*/, '') || fallback;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const yesterdayRows = readCsv('679_final_report_1600_candidates.csv').map((row) => ({
  昨日順位: row.順位,
  ticker: tickerOf(row.銘柄),
  銘柄: row.銘柄,
  分類: row.分類,
  補正後点: row.補正後点,
  主な根拠: row.主な根拠,
  注意点: row.注意点
}));

const currentRows = readCsv('764_morning_recalc_top10.csv').map((row) => ({
  現順位: row.朝更新順位,
  ticker: row.ticker,
  銘柄: `${row.ticker} ${row.銘柄}`,
  業種: row.業種,
  事前スコア: row.事前スコア,
  価格確認点: row.価格確認点,
  '1年騰落率%': row['1年騰落率%'],
  過熱判定: row.過熱判定,
  朝更新スコア: row.朝更新スコア,
  扱い: row.現時点の扱い,
  確認: row.まだ必要な確認,
  判断理由: row.判断理由
}));

const longTermRows = [
  ...readCsv('728_universe100_long_term_stability_score.csv'),
  ...readCsv('725_long_term_stability_score.csv')
];
const longTermByTicker = new Map(longTermRows.map((row) => [row.コード, row]));

function num(value) {
  const text = String(value ?? '').replaceAll(',', '').trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '未取得';
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

const continuationRows = currentRows.map((row) => {
  const long = longTermByTicker.get(row.ticker);
  const longScore = num(long?.長期安定性スコア);
  const monthlyWin = num(long?.月次勝率);
  const updateScore = num(row.朝更新スコア);
  const priceScore = num(row.価格確認点);
  const maxDrawdown = num(long?.['5年最大下落率']);
  const overheatPenalty = row.過熱判定.includes('過熱') ? 15 : 0;
  const drawdownPenalty = maxDrawdown !== null && maxDrawdown <= -45 ? 7 : 0;
  const raw = (longScore ?? 50) * 0.4 + (updateScore ?? 50) * 0.25 + (priceScore ?? 50) * 0.2 + (monthlyWin ?? 50) * 0.15 - overheatPenalty - drawdownPenalty;
  const score = clamp(raw, 0, 100);
  const cagr5 = num(long?.['5年CAGR']);
  const cagr10 = num(long?.['10年CAGR']);
  const spDiff = num(long?.['5年S&P差']);
  const annualRateCheck = cagr5 !== null && cagr10 !== null
    ? `5年CAGR ${fmt(cagr5)}% / 10年CAGR ${fmt(cagr10)}%`
    : '長期CAGR未取得';
  const grade = score >= 75 ? 'A: 継続期待が比較的高い'
    : score >= 65 ? 'B: 条件付きで継続確認'
    : score >= 55 ? 'C: 追加確認が必要'
    : 'D: 過熱または下落耐性を優先確認';
  return {
    順位: row.現順位,
    銘柄: row.銘柄,
    '5年CAGR': cagr5 === null ? '未取得' : `${fmt(cagr5)}%`,
    '10年CAGR': cagr10 === null ? '未取得' : `${fmt(cagr10)}%`,
    '5年S&P差': spDiff === null ? '未取得' : `${fmt(spDiff)}%`,
    '5年最大下落': maxDrawdown === null ? '未取得' : `${fmt(maxDrawdown)}%`,
    月次勝率: monthlyWin === null ? '未取得' : `${fmt(monthlyWin)}%`,
    継続期待スコア: fmt(score),
    判定: grade,
    確かめ算: `${annualRateCheck}。最大下落 ${maxDrawdown === null ? '未取得' : `${fmt(maxDrawdown)}%`}、過熱減点 ${overheatPenalty}点、下落耐性減点 ${drawdownPenalty}点。`
  };
});

const continuationFormulaRows = [
  {
    項目: '継続期待スコア',
    式: '長期安定性40% + 朝更新スコア25% + 価格確認点20% + 月次勝率15% - 過熱減点 - 下落耐性減点',
    目的: '直近の強さだけでなく、5年・10年の継続性と下落耐性で確かめる。'
  },
  {
    項目: '過去実績の確かめ算',
    式: '5年CAGR、10年CAGR、5年S&P差、5年最大下落率、月次勝率を確認',
    目的: '去年だけ上がった銘柄を過大評価しない。'
  },
  {
    項目: '減点',
    式: '過熱判定は-15点、5年最大下落率-45%以下は-7点',
    目的: '急騰銘柄や過去に大きく崩れた銘柄を、実用候補として慎重に扱う。'
  }
];

const continuationRowsA = continuationRows.slice(0, 5);
const continuationRowsB = continuationRows.slice(5);

const yesterdaySet = new Set(yesterdayRows.map((row) => row.ticker));
const currentSet = new Set(currentRows.map((row) => row.ticker));

const stayed = currentRows
  .filter((row) => yesterdaySet.has(row.ticker))
  .map((row) => {
    const old = yesterdayRows.find((item) => item.ticker === row.ticker);
    return {
      銘柄: row.銘柄,
      昨日順位: old?.昨日順位 || '-',
      今日順位: row.現順位,
      変化理由: '今日の価格確認点、長期安定性、100社母集団の再整理後も候補に残った。'
    };
  });

const added = currentRows
  .filter((row) => !yesterdaySet.has(row.ticker))
  .map((row) => ({
    銘柄: row.銘柄,
    今日順位: row.現順位,
    採用理由: row.判断理由,
    注意: row.確認
  }));

const removed = yesterdayRows
  .filter((row) => !currentSet.has(row.ticker))
  .map((row) => ({
    銘柄: row.銘柄,
    昨日順位: row.昨日順位,
    昨日時点の分類: row.分類,
    今日外れた理由: (() => {
      if (row.ticker === '2802.T') return '高PER・高PBRの説明力を再確認する必要があり、今日の10社では長期安定性・金利/商社/インフラ系の候補を優先した。';
      if (row.ticker === '6762.T') return '電子部品テーマは残るが、今日の再計算では銀行・保険・商社・インフラ系の長期安定性と価格確認を優先した。';
      if (row.ticker === '8053.T') return '商社枠は三菱商事、三井物産、伊藤忠商事へ整理し、住友商事は今回の10社から外した。';
      if (row.ticker === '7173.T') return '地銀枠は反応確認対象として残せるが、NISA 1年保有テストの中心候補ではメガバンクを優先した。';
      if (row.ticker === '9984.T') return 'AI投資テーマは強いが、1年上昇率の過熱とPER未取得のため、今日の実用10社から外した。';
      if (row.ticker === '7735.T') return '半導体装置テーマは残るが、利益成長マイナスと半導体市況感応度を確認するまで外した。';
      if (row.ticker === '6146.T') return '高収益企業だが、PER未取得・PBR高・半導体市況感応度を確認する必要があり、今日の実用10社では外した。';
      return '今日の再計算では、価格確認点、長期安定性、質的接続、過熱補正の組み合わせで優先度が下がった。';
    })()
  }));

const processRows = [
  {
    工程: '1. 母集団整理',
    内容: '100社前後の候補群から、長期安定性、量的点、質的接続、データ補完状況を確認した。',
    反映: '特定テーマだけでなく、銀行・保険・商社・インフラ・電線を比較対象に入れた。'
  },
  {
    工程: '2. 未取得データの扱い',
    内容: '未取得のPER/PBR/ROE、成長率、決算後反応は点数に混ぜず、確認項目として残した。',
    反映: '計算済みのように見せず、候補化前の不足項目を明記した。'
  },
  {
    工程: '3. 株価時系列の追加',
    内容: '10社の1年騰落率、60日騰落率、日経平均との差、S&P500差、最大下落率を取得した。',
    反映: '価格確認点を作り、事前スコア70% + 価格確認点30%で朝更新スコアを算出した。'
  },
  {
    工程: '4. 過熱補正',
    内容: '1年騰落率が極端に大きい銘柄は価格点を上限処理した。',
    反映: '住友電工、古河電工はテーマが強くても「過熱確認を優先」とした。'
  },
  {
    工程: '5. 実用画面整理',
    内容: '資料を読む画面と、日付・ルール・銘柄・分岐を見る画面を分離した。',
    反映: '普段は実用パートで確認し、根拠確認時のみ資料パートを見る導線にした。'
  }
];

const formulaRows = [
  { 項目: '朝更新スコア', 式: '事前スコア × 70% + 価格確認点 × 30%', 意味: '既存の選定根拠を主軸にしつつ、直近の株価時系列を反映する。' },
  { 項目: '価格確認点', 式: '1年騰落率、60日騰落率、日経平均との差、S&P500差、最大下落率、過熱判定を総合', 意味: '上がっているだけでなく、下落耐性と指数比較を確認する。' },
  { 項目: '過熱補正', 式: '1年騰落率が極端に大きい場合、価格点を上限処理', 意味: '急騰銘柄をそのまま高評価しない。' },
  { 項目: '候補扱い', 式: '前面候補、比較候補、補完後に再確認、保留寄り、過熱確認を優先', 意味: '順位と購入判断を分ける。順位上位でも追加確認が残る。' }
];

const todayWorkRows = [
  { 作業: '現在10社の再計算画面を修正', 内容: '長文の判断理由を一覧表から外し、下段カードへ分離。表の縦伸びを抑制した。' },
  { 作業: '実用パートと資料パートの分離', 内容: 'トップページのリンクを、実用パートと資料パートの2タブに整理。実用パートを基本表示にした。' },
  { 作業: '売買ルールの整理', 内容: '共通ルールと銘柄別補正を分け、下値・上値・決算前後・指数劣後時の分岐を確認できるようにした。' },
  { 作業: '6月予定表の整理', 内容: '6月10日CPI、6月15〜16日日銀、6月16〜17日FOMC、6月18日再判定、6月19日初回投入候補の流れを整理した。' }
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>5月28日 作業報告</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans JP", "Meiryo", "Yu Gothic", Arial, sans-serif; color:#050b14; background:#fff; line-height:1.55; font-size:11px; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .page, section, table, thead, tbody, tr, .table-wrap, .card, .note, .danger { break-inside: avoid; page-break-inside: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
    .cover { min-height:180mm; background:#123d63; color:#fff; padding:22mm; }
    h1 { margin:0 0 12px; font-size:30px; letter-spacing:0; }
    h2 { margin:0 0 10px; padding-left:8px; border-left:6px solid #0b5f96; color:#123d63; font-size:18px; }
    .cover h2 { color:#fff; border-color:#8fd3ff; }
    .lead { font-size:15px; max-width:900px; }
    .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:14px 0; }
    .card { border:1px solid #cbd8e6; background:#f8fbff; border-radius:8px; padding:10px; }
    .cover .card { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.3); color:#fff; }
    .value { display:block; font-size:24px; font-weight:900; color:#0b5f96; }
    .cover .value { color:#fff; }
    section { padding:0; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; margin:6px 0 12px; }
    th,td { border:1px solid #cbd8e6; padding:5px; vertical-align:top; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:#123d63; text-align:left; }
    .note { border-left:6px solid #a85b00; background:#fff8ec; padding:8px; margin:8px 0 12px; }
    .danger { border-left:6px solid #b42318; background:#fff4f2; padding:8px; margin:8px 0 12px; }
    .small { font-size:10px; color:#34465b; }
    .two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    a { color:#075e91; text-decoration:none; }
  </style>
</head>
<body>
  <section class="page cover">
    <h1>5月28日 作業報告</h1>
    <h2>2026年5月28日</h2>
    <p class="lead">昨日の候補10社と今日の候補10社が変わった理由を、計算方法、追加データ、過熱補正、実用画面整理の観点から整理しました。</p>
    <div class="cards">
      <div class="card"><b>昨日候補</b><span class="value">10社</span><p>5/27 13:30時点</p></div>
      <div class="card"><b>今日候補</b><span class="value">10社</span><p>5/28 朝更新後</p></div>
      <div class="card"><b>共通銘柄</b><span class="value">${stayed.length}社</span><p>継続して残った銘柄</p></div>
      <div class="card"><b>入替</b><span class="value">${added.length}社</span><p>今日新たに入った銘柄</p></div>
    </div>
    <p class="danger">本資料は判断補助の整理です。売買を確定するものではありません。6月10日CPI、6月15〜16日日銀、6月16〜17日FOMC後に再判定します。</p>
  </section>

  <section class="page">
    <h2>1. 結論</h2>
    <p class="note">候補が変わった主因は、昨日の「決算・PER等の補完済み候補中心」から、今日の「100社母集団、長期安定性、質的接続、株価時系列、過熱補正を入れた実用10社」へ評価軸を整理したためです。</p>
    ${table(['項目', '式', '意味'], formulaRows)}
    <h2>2. 今日の選出方法</h2>
    ${table(['工程', '内容', '反映'], processRows)}
  </section>

  <section class="page">
    <h2>3. 昨日から継続した銘柄</h2>
    ${table(['銘柄', '昨日順位', '今日順位', '変化理由'], stayed)}
    <h2>4. 今日新たに入った銘柄</h2>
    ${table(['銘柄', '今日順位', '採用理由', '注意'], added)}
  </section>

  <section class="page">
    <h2>5. 今日の10社から外れた銘柄</h2>
    ${table(['銘柄', '昨日順位', '昨日時点の分類', '今日外れた理由'], removed)}
  </section>

  <section class="page">
    <h2>6. 今日の10社一覧</h2>
    ${table(['現順位', '銘柄', '業種', '事前スコア', '価格確認点', '1年騰落率%', '過熱判定', '朝更新スコア', '扱い', '確認'], currentRows)}
  </section>

  <section class="page">
    <h2>7. 過去データからの実績予測</h2>
    <p class="note">ここは将来リターンの断定ではなく、過去5年・10年の実績で現在候補を確かめるための章です。去年だけ上がった銘柄をそのまま採用しないため、CAGR、S&P差、最大下落率、月次勝率を組み合わせます。</p>
    ${table(['項目', '式', '目的'], continuationFormulaRows)}
    ${table(['順位', '銘柄', '5年CAGR', '10年CAGR', '5年S&P差', '5年最大下落', '月次勝率', '継続期待スコア', '判定', '確かめ算'], continuationRowsA)}
  </section>

  <section class="page">
    <h2>8. 過去データからの実績予測 続き</h2>
    ${table(['順位', '銘柄', '5年CAGR', '10年CAGR', '5年S&P差', '5年最大下落', '月次勝率', '継続期待スコア', '判定', '確かめ算'], continuationRowsB)}
  </section>

  <section class="page">
    <h2>9. 本日の作業</h2>
    ${table(['作業', '内容'], todayWorkRows)}
    <h2>10. 残る確認</h2>
    <div class="two">
      <div class="card"><b>データ補完</b><p>PER/PBR/ROE、売上成長率、利益成長率、決算後1日/5日/20日反応、同業中央値比較を補完する。</p></div>
      <div class="card"><b>6月再判定</b><p>6月10日CPI、6月15〜16日日銀、6月16〜17日FOMC後に、市場反応と候補10社の価格反応を入れて再判定する。</p></div>
    </div>
    <p class="small">作成: ${esc(generatedAt)}</p>
  </section>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'selection_change_report_20260528.html'), html, 'utf8');
console.log(JSON.stringify({
  output: 'selection_change_report_20260528.html',
  generatedAt,
  stayed: stayed.length,
  added: added.length,
  removed: removed.length
}, null, 2));
