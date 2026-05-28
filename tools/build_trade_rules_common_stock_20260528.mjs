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

const recalcRows = readCsv('764_morning_recalc_top10.csv');
const controlRows = readCsv('759_top10_decision_control_board.csv');
const controlByTicker = new Map(controlRows.map((row) => [row.ticker, row]));

const commonRules = [
  {
    区分: '開始前ゲート',
    条件: '6月CPI、日銀会合、FOMCの確認前',
    行動: '新規購入は確定しない。候補比較とデータ補完だけ進める。',
    理由: '金利、為替、指数反応で候補の優先順位が変わるため。'
  },
  {
    区分: '開始前ゲート',
    条件: '日経平均が直近高値から-10%以上',
    行動: '予定投入額を半分以下に下げ、個別株の一括投入を避ける。',
    理由: '市場全体の下落で個別要因より指数要因が強くなるため。'
  },
  {
    区分: '開始前ゲート',
    条件: '日経平均が75日線を明確に下回る',
    行動: '新規買いを停止し、指数回復または再判定を待つ。',
    理由: '1年保有前提でも、地合い悪化時の初期エントリーを避けるため。'
  },
  {
    区分: '下値共通',
    条件: '購入後-5%',
    行動: '追加購入しない。指数、同業、決算、ニュースを確認し、原因を分類する。',
    理由: '単なる押し目か、仮説崩れかを分けるため。'
  },
  {
    区分: '下値共通',
    条件: '購入後-10%',
    行動: '保有継続を再判定。決算悪化、下方修正、同業劣後なら減額または撤退候補。',
    理由: 'NISA 1年保有でも、前提が崩れた損失を放置しないため。'
  },
  {
    区分: '下値共通',
    条件: 'ストップ安、急落、出来高急増を伴う下落',
    行動: 'その場でナンピンしない。原因確認後に翌営業日以降で判断する。',
    理由: '情報の非対称性が大きく、初動での追加購入が危険なため。'
  },
  {
    区分: '上値共通',
    条件: '購入後+10%',
    行動: '原則保有。日経平均、S&P500、同業比で上昇理由を確認する。',
    理由: '1年保有テストでは、早すぎる利確で上昇余地を捨てないため。'
  },
  {
    区分: '上値共通',
    条件: '購入後+20%',
    行動: '決算前、出来高急増、PER急上昇が重なる場合は25%利確を検討。',
    理由: '利益を一部固定しつつ、残りで1年保有の上昇余地を残すため。'
  },
  {
    区分: '上値共通',
    条件: '購入後+30%以上、または1年騰落率+150%超',
    行動: '過熱確認。利益成長が追いつかない場合は半分利確または新規追加停止。',
    理由: '価格上昇だけを実力と誤認しないため。'
  },
  {
    区分: 'ベンチマーク',
    条件: '3か月時点で日経平均・S&P500の双方に劣後',
    行動: '個別株比率を下げる候補。銘柄別の仮説が生きている場合だけ保留。',
    理由: '目標は既存の無難な運用を少なくとも+1%上回ることだから。'
  },
  {
    区分: 'ベンチマーク',
    条件: '6か月時点でベンチマーク+1%未満',
    行動: '個別株の追加を停止し、指数運用比率を上げる案を検討。',
    理由: '個別株を選ぶ意味が薄くなるため。'
  }
];

function stockCorrection(row, control) {
  const sector = row.業種;
  const overheat = row.過熱判定 === '過熱・データ確認';
  if (overheat) {
    return {
      下値補正: '急落時の追加購入は禁止。最大下落率、出来高、利益成長、同業比較を確認する。',
      上値補正: '上値追い禁止。購入後+10%でも利益成長確認前は追加しない。+20%以上で一部利確を検討。',
      追加条件: '売上・利益成長、受注、営業利益率が株価上昇に追いつくこと。',
      個別停止条件: control?.停止条件 || '過熱と利益未達が同時に出た場合'
    };
  }
  if (sector.includes('銀行')) {
    return {
      下値補正: '金利上昇局面でも与信費用増加、銀行セクター劣後なら減額候補。',
      上値補正: '金利上昇とROE改善が確認できる間は保有優先。PBR急上昇と信用コスト増なら一部利確。',
      追加条件: '利ざや改善、与信費用抑制、ROE改善、株主還元。',
      個別停止条件: control?.停止条件 || '信用コスト増加'
    };
  }
  if (sector.includes('保険')) {
    return {
      下値補正: '自然災害損害、海外保険採算悪化、保険セクター劣後なら減額候補。',
      上値補正: '保険料率改善と運用利回り改善が続く間は保有優先。災害損失が大きい場合は利確検討。',
      追加条件: 'コンバインドレシオ、運用利回り、正味収入保険料の改善。',
      個別停止条件: control?.停止条件 || '大規模災害損失'
    };
  }
  if (sector.includes('商社')) {
    return {
      下値補正: '資源価格下落、還元縮小、非資源利益悪化なら再判定。',
      上値補正: '資源価格だけで上昇した場合は一部利確を検討。非資源利益と還元で説明できる場合は保有。',
      追加条件: '非資源利益、ROE、株主還元、商品価格前提の確認。',
      個別停止条件: control?.停止条件 || '商品市況依存が強く、還元で補えない'
    };
  }
  if (sector.includes('重工')) {
    return {
      下値補正: '受注増でも利益率が悪化する場合は減額候補。',
      上値補正: '受注残と利益率が伴う上昇なら保有。期待だけで急騰した場合は一部利確。',
      追加条件: '受注残、防衛関連売上、営業利益率、増産能力。',
      個別停止条件: control?.停止条件 || '受注増でも利益率低下'
    };
  }
  if (sector.includes('総合電機')) {
    return {
      下値補正: 'AI・電力テーマが部門売上に接続しない場合は減額候補。',
      上値補正: '部門売上、受注、利益率で説明できる上昇なら保有。テーマだけなら一部利確。',
      追加条件: 'Lumada、エネルギー部門受注、営業利益率、海外比率。',
      個別停止条件: control?.停止条件 || '対象部門の寄与が小さい'
    };
  }
  if (sector.includes('電線')) {
    return {
      下値補正: '銅価格や原価上昇で利益率が悪化する場合は減額候補。',
      上値補正: 'データセンター需要と受注が確認できる場合だけ保有継続。急騰後は新規追加を抑える。',
      追加条件: '情報通信売上、電力インフラ売上、受注、銅価格影響。',
      個別停止条件: control?.停止条件 || '利益成長が株価上昇に追いつかない'
    };
  }
  return {
    下値補正: '決算悪化、下方修正、同業劣後なら再判定。',
    上値補正: '利益成長を伴う上昇なら保有。期待先行なら利確検討。',
    追加条件: '売上、利益、ROE、決算後反応。',
    個別停止条件: control?.停止条件 || '前提悪化'
  };
}

const stockRules = recalcRows.map((row) => {
  const control = controlByTicker.get(row.ticker) || {};
  const correction = stockCorrection(row, control);
  return {
    順位: row.朝更新順位,
    ticker: row.ticker,
    銘柄: row.銘柄,
    業種: row.業種,
    現時点の扱い: row.現時点の扱い,
    過熱判定: row.過熱判定,
    共通下値ルール: '-5%で原因確認、-10%で保有再判定、急落時は追加購入しない',
    共通上値ルール: '+10%は原則保有、+20%で一部利確検討、+30%以上で過熱確認',
    銘柄別下値補正: correction.下値補正,
    銘柄別上値補正: correction.上値補正,
    追加購入条件: correction.追加条件,
    個別停止条件: correction.個別停止条件,
    まだ必要な確認: row.まだ必要な確認
  };
});

const summaryRows = [
  {
    項目: '実装内容',
    内容: '売買ルールを、全銘柄に共通する市場ルールと、銘柄別に変える補正ルールへ分離した。'
  },
  {
    項目: '下値の考え方',
    内容: '下落率、指数悪化、決算悪化、急落時のナンピン禁止を共通ルールにし、銘柄ごとの崩れる理由を補正として追加。'
  },
  {
    項目: '上値の考え方',
    内容: '早すぎる利確を避けつつ、+20%、+30%、過熱、PER急上昇、決算前急騰では一部利確や追加停止を検討。'
  },
  {
    項目: '使い方',
    内容: '購入前は共通ゲートを通し、購入後は共通ルールで初動判定し、最後に銘柄別補正で保有、減額、利確、停止を決める。'
  }
];

writeCsv('766_common_trade_rules.csv', commonRules, Object.keys(commonRules[0]));
writeCsv('767_stock_trade_rule_overrides.csv', stockRules, Object.keys(stockRules[0]));
writeCsv('768_trade_rule_summary.csv', summaryRows, Object.keys(summaryRows[0]));

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>共通ルール + 銘柄別補正 売買ルール</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --amber:#a85b00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:var(--bg); line-height:1.75; }
    main { max-width:1320px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; margin:16px 0; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
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
    @media (max-width:980px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>共通ルール + 銘柄別補正 売買ルール</h1>
    <p>売買判断を、全銘柄に共通する市場ルールと、銘柄ごとの事業・テーマ・過熱状態に応じた補正ルールへ分けました。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="grid">
      <div class="card"><b>共通ルール</b><div class="value">${commonRules.length}</div><p>開始前、下値、上値、ベンチマーク</p></div>
      <div class="card"><b>銘柄別補正</b><div class="value">${stockRules.length}</div><p>10社ごとに補正</p></div>
      <div class="card"><b>下値</b><div class="value">-5/-10</div><p>原因確認と再判定</p></div>
      <div class="card"><b>上値</b><div class="value">+20/+30</div><p>一部利確と過熱確認</p></div>
    </div>
    <p class="note">これは売買を自動実行するものではありません。実データ、証券口座、最新決算、6月イベント後の市場反応を確認して、判断補助として使います。</p>
  </section>

  <section>
    <h2>要約</h2>
    ${table(Object.keys(summaryRows[0]), summaryRows)}
  </section>

  <section>
    <h2>共通ルール</h2>
    ${table(Object.keys(commonRules[0]), commonRules)}
  </section>

  <section>
    <h2>銘柄別補正</h2>
    ${table(Object.keys(stockRules[0]), stockRules)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="766_common_trade_rules.csv">共通ルールCSV</a>
      <a href="767_stock_trade_rule_overrides.csv">銘柄別補正CSV</a>
      <a href="768_trade_rule_summary.csv">要約CSV</a>
      <a href="morning_recalc_top10_20260528.html">今朝指標反映 10社暫定再計算</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'trade_rules_common_stock_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'trade_rules_common_stock_20260528.html',
  commonRules: commonRules.length,
  stockRules: stockRules.length
}, null, 2));
