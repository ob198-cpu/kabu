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

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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

const matrix = [
  {
    ticker: '8316.T',
    銘柄: '三井住友FG',
    質的テーマ: '金利・金融政策',
    主要仮説: '国内金利上昇が貸出利ざやと資本効率の改善につながる。',
    実績確認データ: '日銀政策金利、10年国債利回り、決算資料の利ざや、ROE、与信費用',
    株価検証: '金利上昇局面の対TOPIX超過リターン、決算後1日/5日/20日反応',
    反映方法: '質的検証点へ最大10点。ただし財務・割安、業績成長、決算後反応が入力済みの場合のみ',
    停止条件: '与信費用増加が利ざや改善を上回る、または日銀後に銀行株全体が対TOPIXで大幅劣後',
    現状: '確認優先'
  },
  {
    ticker: '8766.T',
    銘柄: '東京海上HD',
    質的テーマ: '金利・保険料率',
    主要仮説: '運用利回りと保険料率改善が1年保有の利益安定性を支える。',
    実績確認データ: '正味収入保険料、コンバインドレシオ、運用利回り、自然災害損害、ROE',
    株価検証: '金利上昇局面と決算後反応の対TOPIX超過リターン',
    反映方法: '災害損害を控除しても収益改善が確認できる場合だけ質的検証点へ反映',
    停止条件: '大規模災害損失、海外保険の採算悪化、保険セクター全体の反応悪化',
    現状: '確認優先'
  },
  {
    ticker: '8306.T',
    銘柄: '三菱UFJ FG',
    質的テーマ: '金利・金融政策',
    主要仮説: '銀行セクター全体の金利上昇メリットを取り込める。',
    実績確認データ: '国内外利ざや、与信費用、PBR、ROE、株主還元、海外金利感応度',
    株価検証: '三井住友FG、みずほFGとの対TOPIX反応差',
    反映方法: '同業比較で優位性が確認できる場合に候補順位を上げる',
    停止条件: '同業比較で劣後、または海外信用コスト増加',
    現状: '量的補完後'
  },
  {
    ticker: '7011.T',
    銘柄: '三菱重工',
    質的テーマ: '防衛・安全保障 / エネルギー',
    主要仮説: '防衛、宇宙、原子力、エネルギー投資の長期需要が受注残と利益率に反映される。',
    実績確認データ: '受注残、防衛関連売上、営業利益率、研究開発費、セグメント別利益',
    株価検証: '防衛予算・大型受注・決算発表後の対TOPIX超過リターン',
    反映方法: '受注残と利益率の両方が確認できる場合に質的検証点へ反映',
    停止条件: '受注は増えても利益率が低下、または過熱指標が強い',
    現状: '量的補完後'
  },
  {
    ticker: '8058.T',
    銘柄: '三菱商事',
    質的テーマ: '資源・商品価格 / 資本政策',
    主要仮説: '資源価格と株主還元が下支えになるが、商品市況依存を確認する必要がある。',
    実績確認データ: '資源利益、非資源利益、ROE、配当、自社株買い、原油・金属価格前提',
    株価検証: '商品価格変化と商社株の相関、決算後反応',
    反映方法: '非資源利益と還元で説明できる場合に反映。商品価格だけの上振れは確認止まり',
    停止条件: '資源価格下落で利益計画が崩れる、または還元縮小',
    現状: '量的補完後'
  },
  {
    ticker: '6501.T',
    銘柄: '日立製作所',
    質的テーマ: 'AIデータセンター投資 / 電力・インフラ',
    主要仮説: 'データセンター、送配電、産業DX需要が部門売上と受注に表れる。',
    実績確認データ: 'Lumada売上、エネルギー部門受注、営業利益率、海外比率、受注残',
    株価検証: 'データセンター関連ニュース、決算、同業の反応比較',
    反映方法: 'テーマが部門売上または受注に接続した場合だけ反映',
    停止条件: 'テーマは強いが対象部門の寄与が小さい、または利益率悪化',
    現状: '量的補完後'
  },
  {
    ticker: '8031.T',
    銘柄: '三井物産',
    質的テーマ: '資源・商品価格 / 非資源成長',
    主要仮説: '資源、エネルギー、インフラ投資と非資源利益の組み合わせで商社内比較に残る可能性がある。',
    実績確認データ: '資源利益、非資源利益、ROE、還元方針、原油・鉄鉱石・LNG前提',
    株価検証: '三菱商事、伊藤忠商事、住友商事との対TOPIX反応差',
    反映方法: '資源だけでなく非資源成長と還元の両方が確認できる場合に反映',
    停止条件: '商品市況依存が強く、非資源や還元で説明できない',
    現状: '量的補完後'
  },
  {
    ticker: '5802.T',
    銘柄: '住友電工',
    質的テーマ: '電力・光通信 / データセンター',
    主要仮説: '電線、光通信、車載の複合需要がAIインフラ投資に接続する。',
    実績確認データ: '情報通信売上、環境エネルギー売上、受注、銅価格影響、営業利益率',
    株価検証: '電線・光通信同業、銅価格、決算後反応の比較',
    反映方法: '売上・受注・利益率でテーマ接続が確認できる場合に反映',
    停止条件: '銅価格や原価上昇で利益率が悪化、または同業比較で劣後',
    現状: '量的補完後'
  },
  {
    ticker: '5801.T',
    銘柄: '古河電工',
    質的テーマ: '電力・光通信 / データセンター',
    主要仮説: '電線・光通信需要に接続するが、急騰後の過熱確認が必須。',
    実績確認データ: '情報通信売上、電力インフラ売上、営業利益率、最大下落率、出来高急増',
    株価検証: '住友電工、フジクラとの同業比較、過熱調整後の反応',
    反映方法: '過熱控除後も同業比較で優位なら比較枠に残す',
    停止条件: '1年上昇率に対して利益成長が追いつかない、または最大下落リスクが大きい',
    現状: '仮説検算'
  },
  {
    ticker: '8001.T',
    銘柄: '伊藤忠商事',
    質的テーマ: '非資源・資本政策',
    主要仮説: '非資源比率と還元方針が商社内の安定候補として機能する可能性がある。',
    実績確認データ: '非資源利益、ROE、株主還元、純利益進捗、セグメント別利益',
    株価検証: '三菱商事、三井物産との相対反応、決算後反応',
    反映方法: '非資源安定性が確認できる場合に商社枠内で順位比較',
    停止条件: '利益成長が弱い、還元縮小、商社内比較で劣後',
    現状: '量的補完後'
  }
];

const operationalRules = [
  {
    項目: '質的情報の入力条件',
    内容: 'ニュースやテーマは、公式発表、決算資料、統計、株価反応のいずれかで検証できる場合だけ入力する。'
  },
  {
    項目: '点数反映の順序',
    内容: '先に量的4区分を入力し、その後に質的検証点を最大10点として扱う。質的点だけで判定可能にしない。'
  },
  {
    項目: 'イベントの扱い',
    内容: 'イベントは分類名ではなく、発生日、対象企業、伝播経路、確認数字、反証条件をセットで記録する。'
  },
  {
    項目: '候補10社への反映',
    内容: '質的情報は、候補順位の微調整、深掘り優先度、停止条件、6月再判定時の確認項目に使う。'
  },
  {
    項目: '避ける処理',
    内容: 'AI、半導体、防衛などのテーマ名を選んだだけで加点する処理は行わない。'
  }
];

writeCsv('757_qualitative_reflection_matrix.csv', matrix, Object.keys(matrix[0]));
writeCsv('758_qualitative_operational_rules.csv', operationalRules, Object.keys(operationalRules[0]));

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的情報 反映マトリクス</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --amber:#a85b00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:var(--bg); line-height:1.75; }
    main { max-width:1280px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; margin:16px 0; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:9px; background:#f8fbff; padding:14px; }
    .value { font-size:30px; font-weight:900; color:var(--blue); }
    .note { border-left:6px solid var(--amber); background:#fff8ec; border-radius:8px; padding:12px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; color:#050b14; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    a { color:#075e91; font-weight:800; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a { border:1px solid var(--blue); color:#fff; background:var(--blue); border-radius:8px; padding:9px 12px; text-decoration:none; }
    @media (max-width:980px) { .summary { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>質的情報 反映マトリクス</h1>
    <p>10社候補ごとに、質的情報をどの数字で確認し、どの条件ならスコアへ反映し、どの条件なら停止するかを整理しました。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="summary">
      <div class="card"><b>対象銘柄</b><div class="value">10</div><p>候補10社を全件整理</p></div>
      <div class="card"><b>反映上限</b><div class="value">10%</div><p>質的検証点の最大重み</p></div>
      <div class="card"><b>主軸</b><div class="value">90%</div><p>長期・財務・成長・反応</p></div>
      <div class="card"><b>扱い</b><div class="value">検証</div><p>単純加点ではなく確認条件</p></div>
    </div>
    <p class="note">質的情報は、候補の深掘り優先度と停止条件を決めるために使います。量的データが不足した状態で、質的情報だけを理由に候補確定はしません。</p>
  </section>

  <section>
    <h2>10社別 反映マトリクス</h2>
    ${table(Object.keys(matrix[0]), matrix)}
  </section>

  <section>
    <h2>運用ルール</h2>
    ${table(Object.keys(operationalRules[0]), operationalRules)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="757_qualitative_reflection_matrix.csv">反映マトリクスCSV</a>
      <a href="758_qualitative_operational_rules.csv">運用ルールCSV</a>
      <a href="top10_score_input_calculator_20260528.html">10社スコア入力・再計算</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'qualitative_reflection_matrix_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'qualitative_reflection_matrix_20260528.html',
  rows: matrix.length
}, null, 2));
