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

const totalCapital = 2_000_000;

const eventCalendar = [
  {
    日付: '2026-06-10',
    イベント: '米CPI 5月分',
    確認内容: '前年比、前月比、コアCPI、米10年金利、ドル円、NASDAQ/S&P500反応',
    判定: 'CPI再加速・米金利急騰なら6月投入を延期。市場が消化できれば6月18日以降の初回投入候補。',
    情報源: 'BLS CPI release'
  },
  {
    日付: '2026-06-15〜2026-06-16',
    イベント: '日銀 金融政策決定会合',
    確認内容: '政策金利、国債買入、声明、銀行・保険・円相場の反応',
    判定: '銀行・保険に追い風でも、円高急進や指数急落なら投入縮小。',
    情報源: '日本銀行 2026 MPM schedule'
  },
  {
    日付: '2026-06-16〜2026-06-17',
    イベント: 'FOMC',
    確認内容: '政策金利、声明、SEP、米10年金利、ドル円、米株反応',
    判定: '金利急騰・株安なら初回投入延期。通過後の6月18日〜19日に初回判定。',
    情報源: 'Federal Reserve FOMC calendar'
  },
  {
    日付: '2026-06-18〜2026-06-19',
    イベント: '初回投入判定',
    確認内容: 'CPI、日銀、FOMC後の指数・金利・為替・候補銘柄反応',
    判定: '条件がそろえば30%投入。悪化なら15%以下または見送り。',
    情報源: 'システム判定'
  },
  {
    日付: '2026-06-24〜2026-06-26',
    イベント: '第2投入判定',
    確認内容: '初回投入後の反応、日銀後の安定、FOMC後の米金利落ち着き',
    判定: '候補が指数を大きく劣後していなければ25%追加。',
    情報源: 'システム判定'
  },
  {
    日付: '2026-07-03前後',
    イベント: '第3投入判定',
    確認内容: '6月末値、月次反応、75日線、候補別下落率',
    判定: '市場が安定し、候補の停止条件に抵触しなければ20%追加。',
    情報源: 'システム判定'
  },
  {
    日付: '2026-08-中旬',
    イベント: '決算後調整',
    確認内容: '4〜6月期決算、会社予想、決算後1日/5日/20日反応',
    判定: '決算確認後に15%追加または入替。残り10%は現金待機。',
    情報源: '決算短信・株価時系列'
  }
];

const deploymentPlan = [
  {
    時期: '2026-06-18〜06-19',
    投入率: '30%',
    金額: '600,000円',
    条件: 'CPI、日銀、FOMC後に金利急騰、円高ショック、日経平均75日線割れがない',
    実行: '三井住友FG、東京海上HD、三菱商事、三菱UFJ、三井物産を中心に分散'
  },
  {
    時期: '2026-06-24〜06-26',
    投入率: '25%',
    金額: '500,000円',
    条件: '初回後に候補が指数を大きく劣後せず、個別停止条件に抵触しない',
    実行: '上位継続銘柄へ追加。保留銘柄はデータ補完後に限定投入'
  },
  {
    時期: '2026-07-03前後',
    投入率: '20%',
    金額: '400,000円',
    条件: '月末月初の需給確認後、日経平均が崩れていない',
    実行: '商社・銀行・保険・電機のバランスを調整'
  },
  {
    時期: '2026-08-中旬',
    投入率: '15%',
    金額: '300,000円',
    条件: '4〜6月期決算後、業績成長と株価反応が確認できる',
    実行: '決算通過後に残す銘柄へ追加。悪い銘柄は入替候補'
  },
  {
    時期: '常時',
    投入率: '10%',
    金額: '200,000円',
    条件: '急落、事故、予備資金',
    実行: '現金待機。ストップ安直後のナンピンには使わない'
  }
];

const datedSchedule = [
  {
    日付: '2026-06-10（水）',
    種別: '米CPI確認',
    実施内容: '米CPI発表後に、米10年金利、ドル円、S&P500、NASDAQ、日経先物の反応を記録する。',
    売買予定: '売買しない',
    判断基準: 'CPI再加速または米金利急騰なら、6月18日の初回投入を縮小または延期候補にする。'
  },
  {
    日付: '2026-06-11（木）',
    種別: 'CPI翌日確認',
    実施内容: '日本市場で銀行、保険、商社、重工、電線候補の反応を確認する。',
    売買予定: '売買しない',
    判断基準: '候補10社が日経平均に大きく劣後する場合は、投入候補順位を下げる。'
  },
  {
    日付: '2026-06-15（月）',
    種別: '日銀会合1日目',
    実施内容: 'ドル円、銀行株、保険株、日経平均の事前反応を確認する。',
    売買予定: '売買しない',
    判断基準: '円高警戒、銀行株の材料出尽くし、指数下落が強い場合は初回投入を抑制。'
  },
  {
    日付: '2026-06-16（火）',
    種別: '日銀結果確認 / FOMC 1日目',
    実施内容: '日銀の政策結果、声明、ドル円、銀行・保険セクター反応を記録する。',
    売買予定: '原則売買しない',
    判断基準: '日銀後に円高ショックや指数急落がなければ、銀行・保険の中心候補を維持。'
  },
  {
    日付: '2026-06-17（水）',
    種別: 'FOMC結果確認',
    実施内容: 'FOMC声明、SEP、米10年金利、米株、ドル円の反応を確認する。',
    売買予定: '原則売買しない',
    判断基準: '米金利急騰や米株急落があれば、6月18日の投入を見送る。'
  },
  {
    日付: '2026-06-18（木）',
    種別: '初回投入判定日',
    実施内容: 'CPI、日銀、FOMC後の市場反応を総合し、候補10社を再計算する。',
    売買予定: '条件良好なら30%のうち半分から開始、悪化なら見送り',
    判断基準: '日経平均75日線維持、金利急騰なし、ドル円急変なし、候補の停止条件なし。'
  },
  {
    日付: '2026-06-19（金）',
    種別: '初回投入実行候補日',
    実施内容: '6月18日の判定が良好なら初回30%を実行候補とする。',
    売買予定: '最大30% / 600,000円',
    判断基準: '前日判定が良好、かつ当日寄付き後に候補が急騰していないこと。'
  },
  {
    日付: '2026-06-24（水）',
    種別: '第2投入判定日',
    実施内容: '初回投入後の損益、日経平均差、S&P500差、銘柄別停止条件を確認する。',
    売買予定: '条件良好なら追加候補',
    判断基準: '初回投入銘柄が指数に大きく劣後せず、個別悪材料がないこと。'
  },
  {
    日付: '2026-06-26（金）',
    種別: '第2投入実行候補日',
    実施内容: '6月24日の判定が良好なら第2投入を実行候補とする。',
    売買予定: '最大25% / 500,000円',
    判断基準: '候補の価格が急騰していないこと。過熱枠は追加しない。'
  },
  {
    日付: '2026-07-03（金）',
    種別: '第3投入判定・実行候補日',
    実施内容: '6月末値、月次反応、75日線、候補別下落率、ベンチマーク差を確認する。',
    売買予定: '最大20% / 400,000円',
    判断基準: '市場安定、候補の停止条件なし、初回・第2投入分が想定内の値動き。'
  },
  {
    日付: '2026-07-17（金）',
    種別: '中間点検',
    実施内容: '1か月弱の反応を確認し、日経平均・S&P500双方に劣後していないかを見る。',
    売買予定: '原則追加しない',
    判断基準: '双方に大きく劣後する銘柄は追加停止、仮説確認へ回す。'
  },
  {
    日付: '2026-07-31（金）',
    種別: '月末点検',
    実施内容: '月末時点の損益、指数差、銘柄別上値・下値ルールへの抵触を確認する。',
    売買予定: '原則追加しない',
    判断基準: '+20%到達銘柄は一部利確検討、-10%銘柄は保有再判定。'
  },
  {
    日付: '2026-08-14（金）',
    種別: '決算後追加判定',
    実施内容: '4〜6月期決算、会社予想、決算後1日/5日反応を確認する。',
    売買予定: '最大15% / 300,000円',
    判断基準: '業績成長、上方修正、増配、決算後反応が確認できる銘柄だけ追加候補。'
  },
  {
    日付: '2026-08-28（金）',
    種別: '20営業日反応確認',
    実施内容: '決算後20営業日前後の株価反応を確認し、1年保有候補を再整理する。',
    売買予定: '入替・減額の検討',
    判断基準: '決算内容が良くても20営業日で市場評価が弱い銘柄は追加停止。'
  }
];

const targetWeights = [
  ['8316.T', '三井住友FG', '銀行', 20, '前面候補。金利・ROE・与信費用を確認しながら中心に置く。'],
  ['8766.T', '東京海上HD', '保険', 14, '比較候補。運用利回りと災害損害の確認が必要。'],
  ['8058.T', '三菱商事', '商社', 11, '資源と還元。非資源利益で説明できる場合に残す。'],
  ['8306.T', '三菱UFJ FG', '銀行', 11, '三井住友FGとの比較枠。利ざやと信用コスト確認。'],
  ['8031.T', '三井物産', '商社', 9, '商社比較枠。資源と非資源のバランス確認。'],
  ['8001.T', '伊藤忠商事', '商社', 7, '非資源安定枠。商社内比較で残す。'],
  ['6501.T', '日立製作所', '総合電機・IT', 7, 'AI・電力インフラ仮説。部門売上・受注確認。'],
  ['7011.T', '三菱重工', '重工・防衛', 5, '保留寄り。防衛受注と利益率確認後に限定投入。'],
  ['5802.T', '住友電工', '電線・通信', 3, '過熱確認枠。業績が株価に追いつく場合のみ少額。'],
  ['5801.T', '古河電工', '電線・通信', 3, '過熱確認枠。上値追い禁止、仮説検算後に限定。'],
  ['CASH', '現金待機', '予備', 10, '急落・入替・イベント悪化対応。']
].map(([ticker, 銘柄, 業種, 比率, 理由]) => ({
  ticker,
  銘柄,
  業種,
  目標比率: `${比率}%`,
  目標金額: `${Math.round(totalCapital * 比率 / 100).toLocaleString('ja-JP')}円`,
  理由
}));

const profitRules = [
  {
    条件: '購入後+10%',
    行動: '原則保有。日経平均、S&P500、同業比で上昇理由を確認。',
    例外: '決算前急騰、出来高急増、悪材料前の急騰なら一部利確を検討。'
  },
  {
    条件: '購入後+20%',
    行動: '25%程度の一部利確を検討。残りは1年保有テスト継続。',
    例外: '決算で利益成長・上方修正・増配が確認できる場合は保有優先。'
  },
  {
    条件: '購入後+30%以上',
    行動: '過熱判定。利益成長が追いつかなければ半分利確、または新規追加停止。',
    例外: '業績上方修正、受注残増加、ROE改善が伴う場合のみ保有継続。'
  },
  {
    条件: '1年騰落率+150%超',
    行動: '新規追加停止。決算で成長が追いつくか確認する。',
    例外: '利益成長、受注、営業利益率が株価上昇を説明できる場合のみ少額継続。'
  }
];

const interimExitRules = [
  {
    条件: '購入後-5%',
    行動: '追加購入しない。市場要因、同業要因、個別要因に分類。',
    判断: '仮説が維持されるなら保有。仮説崩れなら追加停止。'
  },
  {
    条件: '購入後-10%',
    行動: '保有再判定。決算悪化、下方修正、同業劣後なら25〜50%減額。',
    判断: '指数下落だけなら保留、個別悪化なら撤退候補。'
  },
  {
    条件: '購入後-15%以上',
    行動: '原則として一度ポジションを半分以下へ縮小する案を検討。',
    判断: 'NISAでも前提崩れは放置しない。'
  },
  {
    条件: 'ストップ安・急落・悪材料',
    行動: '当日ナンピン禁止。原因確認後、翌営業日以降に判断。',
    判断: '会計、不祥事、下方修正、増資、需給崩壊は撤退優先。'
  }
];

const earningsRules = [
  {
    場面: '決算5営業日前',
    条件: '購入後+15%以上かつ決算期待で急騰',
    行動: '25%一部利確を検討。未保有銘柄は決算通過まで待つ。'
  },
  {
    場面: '決算前',
    条件: '含み損、または指数に劣後',
    行動: '決算跨ぎ前に保有理由を再確認。下方修正懸念があれば減額。'
  },
  {
    場面: '決算翌日',
    条件: '上方修正、増配、利益成長、株価反応が同時に良い',
    行動: '保有継続。5営業日反応を見て追加可否を判断。'
  },
  {
    場面: '決算翌日',
    条件: '数字は良いが株価反応が弱い',
    行動: '20営業日反応まで待つ。急いで追加しない。'
  },
  {
    場面: '決算後',
    条件: '下方修正、利益率悪化、主力テーマの売上未接続',
    行動: '減額または除外候補。質的仮説の点数反映を止める。'
  }
];

const benchmarkRules = [
  {
    時点: '1か月',
    条件: '日経平均・S&P500双方に劣後',
    行動: '観察。個別悪材料がなければ即撤退しない。',
    理由: '1か月はノイズが大きいため。'
  },
  {
    時点: '3か月',
    条件: '日経平均・S&P500双方に-3%以上劣後',
    行動: '個別株比率を25%縮小する候補。上位2社だけ残す案を検討。',
    理由: '目標+1%を狙う根拠が弱くなるため。'
  },
  {
    時点: '6か月',
    条件: 'ベンチマーク+1%を達成できていない',
    行動: '個別株追加を停止し、指数運用比率を引き上げる案を検討。',
    理由: '個別株選定の優位性が確認できないため。'
  },
  {
    時点: '12か月',
    条件: 'ベンチマーク+1%以上',
    行動: 'モデル継続。勝因を記録し、翌年の母集団条件へ反映。',
    理由: '目標達成の再現性を検証するため。'
  },
  {
    時点: '12か月',
    条件: 'ベンチマーク以下',
    行動: '個別株比率を下げ、モデルの重みと候補抽出条件を見直す。',
    理由: 'インデックスを上回れない個別運用は合理性が弱いため。'
  }
];

const branchRules = [
  {
    イベント: '米CPI',
    良い場合: '前年比・前月比・コアが市場想定以下、米10年金利が低下または横ばい',
    行動: '6月18日以降の30%投入候補を維持',
    悪い場合: 'CPI再加速、米10年金利急騰、NASDAQ/S&P500急落',
    悪い場合の行動: '初回投入を15%以下に縮小、またはFOMC後まで延期'
  },
  {
    イベント: '日銀',
    良い場合: '銀行・保険に追い風、円高ショックなし、日経平均75日線維持',
    行動: '銀行・保険の中心候補を維持',
    悪い場合: '急な円高、指数急落、銀行株が材料出尽くしで下落',
    悪い場合の行動: '銀行・保険の初回投入を半分にし、商社・現金比率を上げる'
  },
  {
    イベント: 'FOMC',
    良い場合: '米金利急騰なし、株式市場が安定、ドル円が急変しない',
    行動: '6月18日〜19日に30%投入を検討',
    悪い場合: 'タカ派化、米10年金利急騰、グロース・半導体急落',
    悪い場合の行動: '初回投入を見送り、6月24日以降に再判定'
  },
  {
    イベント: '3イベント通過後',
    良い場合: 'CPI、日銀、FOMC後に指数と候補が安定',
    行動: '30%投入、翌週25%追加の計画へ',
    悪い場合: 'どれか一つでも市場急変を伴う',
    悪い場合の行動: '30%を15%へ縮小、現金比率を25%以上にする'
  }
];

const sourceRows = [
  {
    項目: '米CPI',
    確認日: '2026-06-10 8:30 ET',
    出典: 'BLS CPI release',
    URL: 'https://www.bls.gov/news.release/pdf/cpi.pdf'
  },
  {
    項目: 'FOMC',
    確認日: '2026-06-16〜2026-06-17',
    出典: 'Federal Reserve FOMC calendar',
    URL: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
  },
  {
    項目: '日銀',
    確認日: '2026-06-15〜2026-06-16',
    出典: 'Bank of Japan Monetary Policy Meetings',
    URL: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm'
  }
];

writeCsv('769_provisional_event_calendar.csv', eventCalendar, Object.keys(eventCalendar[0]));
writeCsv('770_provisional_deployment_plan.csv', deploymentPlan, Object.keys(deploymentPlan[0]));
writeCsv('771_provisional_target_weights.csv', targetWeights, Object.keys(targetWeights[0]));
writeCsv('772_provisional_profit_rules.csv', profitRules, Object.keys(profitRules[0]));
writeCsv('773_provisional_exit_rules.csv', interimExitRules, Object.keys(interimExitRules[0]));
writeCsv('774_provisional_earnings_rules.csv', earningsRules, Object.keys(earningsRules[0]));
writeCsv('775_provisional_benchmark_rules.csv', benchmarkRules, Object.keys(benchmarkRules[0]));
writeCsv('776_provisional_june_branch_rules.csv', branchRules, Object.keys(branchRules[0]));
writeCsv('777_provisional_source_notes.csv', sourceRows, Object.keys(sourceRows[0]));
writeCsv('778_provisional_dated_schedule.csv', datedSchedule, Object.keys(datedSchedule[0]));

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>暫定 売買実行ルール</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --amber:#a85b00; --red:#b42318; }
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
    .danger { border-left:6px solid var(--red); background:#fff4f2; border-radius:8px; padding:12px; }
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
    <h1>暫定 売買実行ルール</h1>
    <p>200万円NISAの1年保有テストを想定し、投入日、投入比率、銘柄別比率、利確、途中決済、決算前後、ベンチマーク劣後時、6月イベント後の分岐を暫定整理しました。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="grid">
      <div class="card"><b>総額</b><div class="value">200万</div><p>NISAテスト想定</p></div>
      <div class="card"><b>最大投資</b><div class="value">90%</div><p>180万円まで</p></div>
      <div class="card"><b>現金</b><div class="value">10%</div><p>20万円待機</p></div>
      <div class="card"><b>初回</b><div class="value">6/18</div><p>イベント確認後</p></div>
    </div>
    <p class="danger">暫定ルールです。売買を確定する資料ではありません。最新決算、証券口座の取扱、当日の価格、6月イベント後の市場反応を確認してから再判定します。</p>
  </section>

  <section>
    <h2>具体日付入り予定表</h2>
    ${table(Object.keys(datedSchedule[0]), datedSchedule)}
  </section>

  <section>
    <h2>重要イベント</h2>
    ${table(Object.keys(eventCalendar[0]), eventCalendar)}
  </section>

  <section>
    <h2>投入スケジュール</h2>
    ${table(Object.keys(deploymentPlan[0]), deploymentPlan)}
  </section>

  <section>
    <h2>銘柄別 投入比率</h2>
    ${table(Object.keys(targetWeights[0]), targetWeights)}
  </section>

  <section>
    <h2>利確条件</h2>
    ${table(Object.keys(profitRules[0]), profitRules)}
  </section>

  <section>
    <h2>途中決済・下値条件</h2>
    ${table(Object.keys(interimExitRules[0]), interimExitRules)}
  </section>

  <section>
    <h2>決算前後ルール</h2>
    ${table(Object.keys(earningsRules[0]), earningsRules)}
  </section>

  <section>
    <h2>インデックス劣後時</h2>
    ${table(Object.keys(benchmarkRules[0]), benchmarkRules)}
  </section>

  <section>
    <h2>6月イベント後 分岐表</h2>
    ${table(Object.keys(branchRules[0]), branchRules)}
  </section>

  <section>
    <h2>日程確認元</h2>
    ${table(Object.keys(sourceRows[0]), sourceRows)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="769_provisional_event_calendar.csv">イベントCSV</a>
      <a href="770_provisional_deployment_plan.csv">投入スケジュールCSV</a>
      <a href="771_provisional_target_weights.csv">投入比率CSV</a>
      <a href="772_provisional_profit_rules.csv">利確CSV</a>
      <a href="773_provisional_exit_rules.csv">途中決済CSV</a>
      <a href="774_provisional_earnings_rules.csv">決算ルールCSV</a>
      <a href="775_provisional_benchmark_rules.csv">ベンチマークCSV</a>
      <a href="776_provisional_june_branch_rules.csv">6月分岐CSV</a>
      <a href="778_provisional_dated_schedule.csv">具体日付予定CSV</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'provisional_trade_execution_plan_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'provisional_trade_execution_plan_20260528.html',
  targetWeights: targetWeights.length,
  datedSchedule: datedSchedule.length
}, null, 2));
