import fs from 'node:fs';
import path from 'node:path';

const scriptPath = decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const root = path.resolve(path.dirname(scriptPath), '..');
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const updatedAt = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const totalCapital = 2400000;
const attentionBudget = 360000;
const allPassBudget = 840000;

function q(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(name, header, rows) {
  const body = [header, ...rows].map(row => row.map(q).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(root, name), `\ufeff${body}`, 'utf8');
}

function yen(n) {
  return `${Number(n).toLocaleString('ja-JP')}円`;
}

const marketRows = [
  ['指数・為替', '^N225', '日経平均', 71053.49, 69317.50, '+2.50%', '6/15基準比。日銀後も日本株全体は崩れていない。'],
  ['指数・為替', '1306.T', 'TOPIX連動ETF', 432.30, 424.50, '+1.84%', 'TOPIX代替。日本株全体の確認に使用。'],
  ['指数・為替', 'JPY=X', 'ドル円', 160.605, 160.127, '+0.30%', '急な円高ショックは確認されていない。'],
  ['金利', '^TNX', '米10年金利', 4.463, 4.487, '-0.53%', '6/15基準比では低下。FOMC後の金利急騰は確認されていない。'],
  ['米株', '^IXIC', 'NASDAQ', 26021.656, 25888.84, '+0.51%', '6/15基準比では小幅プラス。ただし前日比はマイナスのため高PER株は注意。'],
  ['米株', '^SOX', 'SOX指数', 13477.072, 13371.47, '+0.79%', '6/15基準比では小幅プラス。CPI当日の下落が残るため半導体は注意。'],
  ['ボラティリティ', '^VIX', 'VIX', 17.08, 16.77, '+1.85%', '急騰ではないが、CPI・FOMC後の不確実性は残す。'],
];

const candidateRows = [
  ['8053.T', '住友商事', '総合候補', '中心候補', -0.61, '確認', '商社・資源・還元。個別は小幅安のため、資源価格と商社全体の反応を確認。'],
  ['8316.T', '三井住友FG', '総合候補', '中心候補', 4.31, '確認', '日銀後の銀行株反応は強い。信用コストと金利カーブを確認しつつ中心候補を維持。'],
  ['6501.T', '日立製作所', 'AIインフラ', '中心候補', 2.11, '確認', 'AIインフラ・電力・デジタルの横断テーマ。指数に対して大きく崩れていない。'],
  ['6503.T', '三菱電機', '総合候補', '条件付き候補', 3.29, '確認', 'FA・電力制御・防衛。イベント後反応は良好だが、事業寄与の確認を残す。'],
  ['6857.T', 'アドバンテスト', '半導体製造装置・材料', '条件付き候補', 0.80, '保留', 'AI半導体検査装置。高PER・高ボラのため、SOXと金利の安定確認後に小比率扱い。'],
  ['8035.T', '東京エレクトロン', '半導体製造装置・材料', '条件付き候補', 4.74, '確認', '装置株代表。反応は強いが、CPI後の半導体注意を残して比率は抑える。'],
  ['7011.T', '三菱重工業', 'AIインフラ・防衛', '条件付き候補', 2.80, '確認', '防衛・電力・エネルギー。短期過熱の確認を残しつつ候補維持。'],
  ['6762.T', 'TDK', 'フィジカルAI', '条件付き候補', 0.65, '確認', '電子部品・AI端末・電池。反応は小幅で、為替と電子部品株全体を確認。'],
  ['6146.T', 'ディスコ', '半導体製造装置・材料', '条件付き候補', 1.54, '保留', '精密加工の構造優位候補。値動きが大きいため初回は慎重扱い。'],
  ['5803.T', 'フジクラ', 'AIインフラ', '条件付き候補', -5.67, '保留', '電線・データセンターテーマ。イベント後に大きく売られたため、反発確認まで買付対象から外す。'],
];

const currentEvents = [
  ['E01', '2026-06-10', '米5月CPI', 'CPI前年比・前月比、米10年金利、NASDAQ、SOX、VIX、ドル円', 'BLS公式: CPI-U 前月比+0.5%、前年比+4.2%。コアCPI 前月比+0.2%、前年比+2.9%。エネルギー前年比+23.5%。', '確認済: 6/10当日は米10年金利+1.4bp、NASDAQ -1.98%、SOX -3.57%、VIX +11.83%、ドル円+0.13%。6/12時点でNASDAQ/SOXは回復、米10年金利は4.487%へ低下。', 'インフレ再加速と米金利急騰が同時に起きず、NASDAQ/SOXが大崩れしない', '注意', '半導体・高PER・高ボラ候補は買付前ゲートを厳格化'],
  ['E02', '2026-06-15〜2026-06-16', '日銀会合', '政策変更、ドル円、日経平均/TOPIX、銀行・商社・輸出株反応', 'BOJ公式: 2026年6月16日「金融市場調節方針の変更について」。無担保コールレートを1.0%程度で推移するよう促し、6月17日から適用。', '確認済: 日経平均は6/15基準比+2.50%、TOPIX連動ETF+1.84%、ドル円+0.30%。三井住友FGは前日比+4.31%。急な円高ショックや日本株全体の大幅下落は確認されない。', '急な円高ショックと日本株指数の大幅下落が同時に出ない', '通過', '日本株の予定買付を延期、または比率を下げる'],
  ['E03', '2026-06-16〜2026-06-17', 'FOMC', '政策金利見通し、米10年金利、NASDAQ、SOX、ドル円', 'Fed公式: 2026年6月17日FOMC声明。政策金利レンジ3.50%〜3.75%を維持。インフレは2%目標に対してなお高いと記載。', '確認済: 米10年金利は6/15基準比-0.53%、NASDAQ+0.51%、SOX+0.79%、VIX+1.85%、ドル円+0.30%。金利急騰やSOX急落は確認されないが、高PER株の注意は継続。', '米長期金利が急騰せず、ハイテク株のリスク許容度が崩れない', '注意', '半導体・高PER・高ボラ候補を小比率または保留'],
  ['E04', '2026-06-18以降', '最終購入前確認', '候補別株価、PER/PBR/ROE、直近下落率、未確認データ、証券会社画面', '市場イベント3件は入力済み。本人別NISA口座、注文画面、本人操作、残枠、入金確認は未完了。', '候補別では、8316・8035・6503・7011は反応良好。5803は前日比-5.67%のため保留。6857・6146は高PER・高ボラ注意。', '停止条件なし、未確認データを点数に混ぜない、本人操作とNISA口座区分を確認', '注意', '本人別NISA・証券画面確認が完了するまで実注文額は0円'],
];

writeCsv('102_june_event_result_input.csv',
  ['event_id', 'planned_date', 'event', 'input_required', 'actual_value', 'market_reaction', 'pass_condition', 'current_status', 'action_if_fail'],
  currentEvents
);

writeCsv('event_after_update_20260618.csv',
  ['updated_at', 'category', 'ticker', 'name', 'current_value', 'baseline_value', 'change_from_baseline', 'comment'],
  marketRows.map(r => [updatedAt, ...r])
);

const eventStatus = '黄: 注意あり';
const prebuyGate = '市場ゲートは赤停止なし。本人別NISA・証券画面確認が終わるまで実注文額は0円。';

writeCsv('106_june_event_engine_output.csv',
  ['updated_at', 'ticker', 'name', 'channel', 'role', 'market_signal', 'one_day_change_pct', 'event_status', 'engine_status_now', 'prebuy_gate', 'reference_score', 'data_coverage_points', 'risk_tags', 'current_allocation_yen', 'reason', 'stop_condition'],
  candidateRows.map(([ticker, name, channel, role, day, signal, reason]) => {
    const score = role === '中心候補' ? 9 : 7;
    const riskTags = ticker === '5803.T' ? '電線/データセンター/高ボラ/反応注意' :
      ticker === '6857.T' || ticker === '8035.T' || ticker === '6146.T' ? '半導体/高PER/高ボラ' :
      channel.includes('AIインフラ') ? 'AIインフラ/政策/設備投資' :
      channel.includes('総合') ? '総合候補/大型株/指数確認' : '候補/イベント確認';
    const stop = ticker === '5803.T' ? '前日比の下落が続く、またはデータセンター関連株全体が弱い場合は初回対象外。' :
      riskTags.includes('半導体') ? 'SOX/NASDAQが再び弱い、米金利が上がる、または出来高を伴う反落時は保留。' :
      '指数に明確に劣後、決算・業界材料が弱い場合は保留。';
    return [updatedAt, ticker, name, channel, role, signal, `${day.toFixed(2)}%`, eventStatus, 'イベント反映済み・注文前', prebuyGate, score, 'CPI/日銀/FOMC/指数/為替/個別株反応を反映。口座確認は別ゲート。', riskTags, 0, reason, stop];
  })
);

writeCsv('108_capital_allocation_by_ticker.csv',
  ['updated_at', 'ticker', 'name', 'role', 'target_weight_pct', 'market_signal', 'current_allocation_yen', 'current_cash_yen', 'all_pass_allocation_yen', 'attention_allocation_yen', 'bad_event_allocation_yen', 'max_position_note', 'condition_to_use'],
  candidateRows.map(([ticker, name, , role, , signal]) => {
    const target = role === '中心候補' ? 18.75 : 6.25;
    const allPass = Math.round(allPassBudget * target / 100);
    const attention = Math.round(attentionBudget * target / 100);
    const note = '市場ゲートは注意あり。イベント上限は15%だが、本人別NISA・証券画面確認が終わるまで実注文額は0円。';
    return [updatedAt, ticker, name, role, target, signal, 0, totalCapital, allPass, attention, 0, note, 'E01〜E04、市場反応、本人操作、NISA口座区分、証券会社画面確認'];
  })
);

writeCsv('109_capital_scenario_plan.csv',
  ['updated_at', 'scenario', 'stock_investment_yen', 'cash_yen', 'action'],
  [
    [updatedAt, '現在', 0, totalCapital, '6月イベントは反映済み。市場ゲートは黄: 注意あり。本人別NISA・証券画面確認が完了するまで実注文額は0円。'],
    [updatedAt, 'イベント後仮上限: 黄', attentionBudget, totalCapital - attentionBudget, 'CPI/FOMC後の高PER・半導体注意を残すため、イベント面だけなら初回15%上限。実行前に口座確認が必要。'],
    [updatedAt, '緑: 全イベント確認後', allPassBudget, totalCapital - allPassBudget, '全イベント・口座確認・証券画面確認まで揃った場合の初回35%上限。'],
    [updatedAt, '赤: 悪化', 0, totalCapital, '金利急騰、指数急落、円高ショック、候補急落が出た場合は新規購入停止。'],
    [updatedAt, '第2回', 480000, '', '初回後の実績、指数比較、決算後反応を確認して追加上限20%。'],
    [updatedAt, '第3回', 360000, '', 'さらに確認後の追加上限15%。最低30%は現金待機。'],
  ]
);

writeCsv('today_action_20260618.csv',
  ['作成時刻', '今日', 'ID', '区分', '項目', '状態', '本日の作業', '見るページ', '停止条件'],
  [
    [updatedAt, '2026-06-18', 'T01', 'イベント', 'CPI・日銀・FOMC結果反映', '完了', '公式結果と市場反応を102/106/108/109へ反映済み。', 'event_after_update_20260618.html / 102_june_event_result_input.csv', '赤停止なし。ただしCPI/FOMC後の注意は残す。'],
    [updatedAt, '2026-06-18', 'T02', '候補銘柄', '候補10社のイベント後反応', '完了', '個別株の前日比を反映。5803は大きめの下落、半導体高PER株は注意扱い。', 'event_after_update_20260618.html / 106_june_event_engine_output.csv', '候補が指数に明確に劣後する場合は初回対象外。'],
    [updatedAt, '2026-06-18', 'T03', '資金配分', 'イベント後の仮上限', '注意あり', 'イベント面だけなら15%上限を表示。ただし実注文額は本人別NISA確認まで0円。', '109_capital_scenario_plan.csv / 108_capital_allocation_by_ticker.csv', '本人操作・NISA口座区分・証券画面未確認なら注文しない。'],
    [updatedAt, '2026-06-18', 'T04', '口座', '本人別NISA・証券画面確認', '未完了', '本人スマホ、本人ログイン、NISA口座区分、残枠、入金、注文画面を確認する。', 'nisa_account_execution_gate_20260614.html', 'どれか未確認なら買付上限0円。'],
    [updatedAt, '2026-06-18', 'T05', '次作業', '実行前チェック', '次に実施', 'イベント更新後の画面を確認し、口座・注文票・銘柄別保留条件を順に埋める。', 'today_action_20260618.html', '確認が終わるまで注文票に進めない。'],
  ]
);

const style = `
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:19px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.15;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1100px}
    main{max-width:1220px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:10px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:31px;line-height:1.2;color:var(--blue)}
    .card span{display:block;font-weight:850;color:#263e55}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:10px;vertical-align:top;word-break:normal;overflow-wrap:anywhere}
    th{background:#e6f1fa;color:#063b63;text-align:left}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    .notice{border:2px solid var(--amber);background:#fff8e8;color:#5d3500;border-radius:10px;padding:14px 16px;font-weight:900}
    .small{font-size:15px;color:#2f4558;font-weight:800}
    a{color:#075d9a;font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}table{table-layout:auto}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}tr{break-inside:avoid}}
  </style>`;

function table(headers, rows) {
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const marketHtml = table(
  ['区分', '対象', '現在値', '基準値', '変化', '読み取り'],
  marketRows.map(([cat, ticker, name, current, base, change, comment]) => [cat, `${ticker}<br>${name}`, current, base, `<b>${change}</b>`, comment])
);

const candidatesHtml = table(
  ['銘柄', '区分', '前日比', '扱い', '理由'],
  candidateRows.map(([ticker, name, channel, role, day, signal, reason]) => {
    const cls = signal === '保留' ? 'warn' : 'ok';
    return [`${ticker}<br><b>${name}</b>`, `${channel}<br>${role}`, `${day.toFixed(2)}%`, `<span class="${cls}">${signal}</span>`, reason];
  })
);

const eventsHtml = table(
  ['イベント', '結果', '判定', '扱い'],
  currentEvents.map(([, date, event, , actual, reaction, , status, action]) => [`${date}<br><b>${event}</b>`, actual, `<span class="${status === '通過' ? 'ok' : 'warn'}">${status}</span>`, `${reaction}<br><span class="small">${action}</span>`])
);

const eventPage = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント後 更新結果 2026年6月18日</title>
  ${style}
</head>
<body>
<header>
  <h1>6月イベント後 更新結果</h1>
  <p>CPI・日銀・FOMC後の公式結果と市場反応を、購入前ゲートへ反映した画面です。</p>
</header>
<main>
  <section>
    <h2>更新後の結論</h2>
    <p class="notice">市場イベント面は「黄: 注意あり」です。赤停止は出していません。ただし、本人別NISA・証券画面・本人操作確認が終わるまで、実注文額は0円です。</p>
    <div class="cards">
      <div class="card"><b>イベント判定</b><strong class="warn">注意あり</strong><span>CPI/FOMC後の高PER注意を残す</span></div>
      <div class="card"><b>赤停止</b><strong class="ok">なし</strong><span>金利急騰・円高ショックなし</span></div>
      <div class="card"><b>イベント仮上限</b><strong>${yen(attentionBudget)}</strong><span>市場面だけの上限</span></div>
      <div class="card"><b>実注文額</b><strong class="bad">0円</strong><span>口座確認後に判断</span></div>
    </div>
  </section>
  <section>
    <h2>公式イベント結果</h2>
    ${eventsHtml}
  </section>
  <section>
    <h2>市場反応</h2>
    ${marketHtml}
  </section>
  <section>
    <h2>候補10社の扱い</h2>
    ${candidatesHtml}
  </section>
  <section>
    <h2>次に見ること</h2>
    <ol>
      <li>本人別のNISA口座区分、残枠、入金、注文画面を確認する。</li>
      <li>5803.T フジクラは大きめの下落が出たため、反発確認まで初回対象から外す。</li>
      <li>6857.T、6146.Tは高PER・高ボラ注意として、小比率または保留で扱う。</li>
      <li>中心候補は、8316.T、8053.T、6501.Tを軸に、イベント後の指数差を再確認する。</li>
    </ol>
    <p class="small">出所: BLS Consumer Price Index Summary 2026-06-10、Fed FOMC statement 2026-06-17、日本銀行「金融市場調節方針の変更について」2026-06-16、Yahoo Finance chart API取得値。</p>
  </section>
  <section>
    <h2>公式ソース</h2>
    ${table(['確認項目', '公式URL'], [
      ['米CPI', '<a href="https://www.bls.gov/news.release/cpi.nr0.htm">BLS Consumer Price Index Summary</a>'],
      ['日銀会合', '<a href="https://www.boj.or.jp/mopo/mpmdeci/mpr_2026/k260616a.pdf">日本銀行 金融市場調節方針の変更について</a>'],
      ['FOMC', '<a href="https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm">Federal Reserve FOMC statement</a>'],
    ])}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(root, 'event_after_update_20260618.html'), eventPage, 'utf8');

const todayPage = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日の確認事項 2026年6月18日</title>
  ${style}
</head>
<body>
<header>
  <h1>本日の確認事項 2026年6月18日</h1>
  <p>6月イベント後に、今日どこまで進めるかを確認する実用画面です。</p>
</header>
<main>
  <section>
    <h2>今日の扱い</h2>
    <div class="cards">
      <div class="card"><b>公式イベント</b><strong class="ok">反映済み</strong><span>CPI・日銀・FOMC</span></div>
      <div class="card"><b>市場ゲート</b><strong class="warn">注意あり</strong><span>赤停止なし</span></div>
      <div class="card"><b>注文準備</b><strong class="bad">未完了</strong><span>本人別確認が必要</span></div>
      <div class="card"><b>今日の実注文</b><strong class="bad">0円</strong><span>確認完了まで進めない</span></div>
    </div>
  </section>
  <section>
    <h2>今日すること</h2>
    ${table(['順番', '作業', '結果', '次の扱い'], [
      ['1', 'イベント後更新ページを確認', '市場ゲートは黄: 注意あり', '赤停止なし。ただし慎重運用。'],
      ['2', '本人別NISA・証券画面確認', '未完了', 'ここが完了するまで実注文額0円。'],
      ['3', '候補10社の個別反応確認', '5803は保留、半導体高PERは注意', '初回候補を中心候補寄りにする。'],
      ['4', '注文票作成可否', 'まだ不可', '本人別確認後に金額を入れる。'],
    ])}
  </section>
  <section>
    <h2>更新したファイル</h2>
    ${table(['ファイル', '内容'], [
      ['102_june_event_result_input.csv', 'CPI・日銀・FOMC・最終確認の状態を、未入力からイベント後の実数反映へ更新。'],
      ['106_june_event_engine_output.csv', '候補10社のイベント後扱い、前日比、保留条件を更新。'],
      ['108_capital_allocation_by_ticker.csv', 'イベント上限と実注文額0円を分けて更新。'],
      ['109_capital_scenario_plan.csv', '現在、黄、緑、赤の資金シナリオを更新。'],
      ['event_after_update_20260618.html', 'イベント通過後の確認画面。'],
    ])}
  </section>
</main>
</body>
</html>`;
fs.writeFileSync(path.join(root, 'today_action_20260618.html'), todayPage, 'utf8');

const indexPath = path.join(root, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
if (!index.includes('.warn{color:var(--amber);font-weight:900}')) {
  index = index.replace('.bad{color:var(--red);font-weight:900}', '.bad{color:var(--red);font-weight:900}\n    .warn{color:var(--amber);font-weight:900}');
}
index = index.replace(
  /<div class="cards">\s*<div class="card"><b>購入判断<\/b>[\s\S]*?<div class="card"><b>次の確認<\/b>[\s\S]*?<\/div>\s*<\/div>/,
  `<div class="cards">
      <div class="card"><b>購入判断</b><strong class="warn">条件確認中</strong><span>イベント反映済み・口座確認前</span></div>
      <div class="card"><b>イベント判定</b><strong class="warn">注意あり</strong><span>CPI/FOMC後の高PER注意</span></div>
      <div class="card"><b>イベント仮上限</b><strong>${yen(attentionBudget)}</strong><span>市場面だけの上限</span></div>
      <div class="card"><b>実注文額</b><strong class="bad">0円</strong><span>本人別NISA確認後に判断</span></div>
    </div>`
);
index = index.replace(
  /<p class="notice">[\s\S]*?<\/p>/,
  '<p class="notice">6月CPI・日銀・FOMCの公式結果と市場反応を反映しました。市場ゲートは「黄: 注意あり」、赤停止はありません。ただし、本人別NISA口座区分、本人操作、証券会社注文画面、入金・残枠確認が終わるまで実注文額は0円です。</p>'
);
if (!index.includes('event_after_update_20260618.html')) {
  index = index.replace(
    '<div class="links">\n      <a href="prebuy_master_gate_20260615.html">',
    '<div class="links">\n      <a href="event_after_update_20260618.html"><b>6月イベント後 更新結果</b><span>CPI・日銀・FOMC後の市場ゲート、候補10社の扱い、次の確認です。</span></a>\n      <a href="today_action_20260618.html"><b>本日の確認事項 6/18</b><span>今日見る項目、注文に進まない条件、次作業をまとめた実用画面です。</span></a>\n      <a href="prebuy_master_gate_20260615.html">'
  );
}
index = index.replace(/\s*<a href="today_action_20260617.html">[\s\S]*?<\/a>\n/, '');
index = index.replace(
  /<footer>[\s\S]*?<\/footer>/,
  `<footer>更新: ${updatedAt} / このシステムは投資助言、自動売買、利益保証を行いません。実売買前には証券会社画面、公式決算、本人操作、NISA口座区分を確認します。</footer>`
);
index = index.replace(/\n\s+<a href="official_source_check_log_20260616.html">/, '\n      <a href="official_source_check_log_20260616.html">');
fs.writeFileSync(indexPath, index, 'utf8');

console.log(JSON.stringify({
  updatedAt,
  files: [
    '102_june_event_result_input.csv',
    '106_june_event_engine_output.csv',
    '108_capital_allocation_by_ticker.csv',
    '109_capital_scenario_plan.csv',
    'event_after_update_20260618.csv',
    'event_after_update_20260618.html',
    'today_action_20260618.csv',
    'today_action_20260618.html',
    'index.html',
  ],
}, null, 2));
