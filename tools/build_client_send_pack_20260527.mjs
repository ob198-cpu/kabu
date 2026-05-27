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
  if (row.length) rows.push(row);
  const headers = rows.shift() || [];
  return rows.filter(r => r.some(c => String(c).trim())).map(items => Object.fromEntries(headers.map((h, i) => [h, items[i] || ''])));
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
    .concat(rows.map(row => headers.map(h => csvEscape(row[h])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

const candidateRows = readCsv('708_peer_reflected_candidate_detail.csv');
const finalRows = readCsv('679_final_report_1600_candidates.csv');
const scenarioRows = readCsv('716_june_scenario_simulation_summary.csv');

const finalByTicker = new Map(finalRows.map(row => {
  const match = row['銘柄']?.match(/^([0-9A-Z.]+)\s*(.*)$/);
  return [match?.[1] || row['銘柄'], row];
}));

const candidateTable = candidateRows.map(row => {
  const ticker = row['銘柄'].split(' ')[0];
  const final = finalByTicker.get(ticker) || {};
  return {
    順位: row['順位'],
    銘柄: row['銘柄'],
    現在の扱い: row['反映後の扱い'],
    主な数値根拠: final['主な根拠'] || '',
    同業比較: `${row['同業シグナル']} / PER倍率 ${row['PER倍率']}`,
    選定理由: row['確認内容'],
    '6月確認': row['次アクション']
  };
});

const summaryRows = [
  {
    項目: '資料の目的',
    内容: 'NISA 1年保有テストに向けて、候補10社をどの根拠で選び、6月に何を確認して最終判断するかを説明する。'
  },
  {
    項目: 'システムの目的',
    内容: 'S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%以上上回る根拠を説明できる候補に絞る。'
  },
  {
    項目: '現在できること',
    内容: '候補10社、量的評価、質的テーマ、同業比較、6月イベント後の入力コックピット、シナリオ別の残す・保留・外す判定を確認できる。'
  },
  {
    項目: 'まだ確定しないこと',
    内容: '6月CPI、日銀、FOMC、決算後20営業日反応など、未来の実データが必要な部分は最終判断として扱わない。'
  },
  {
    項目: '10社の位置づけ',
    内容: '購入確定リストではなく、6月再判定にかける検証対象。中心確認、条件付き中心、補欠、監視、反応検算に分けている。'
  }
];

const qaRows = [
  {
    質問: 'どんな10社なのか',
    回答: '銀行、電子部品、商社、食品、半導体製造装置、重工、AI投資会社型を含む10社です。1つのテーマに寄せず、金利、AI、資源、食品、半導体、防衛の複数テーマで比較できるようにしています。'
  },
  {
    質問: 'なぜ10社なのか',
    回答: '100社前後の候補群をすべて深掘りすると、公式決算・同業比較・イベント反応まで確認しきれません。10社なら、NISA 1年保有テスト前に根拠・リスク・6月条件を1社ずつ確認できます。'
  },
  {
    質問: 'なぜこの10社が選ばれたのか',
    回答: '量的評価を主軸に、決算成長、PER/PBR/ROE、株価反応、下落率、同業比較、質的テーマを分けて確認しました。質的テーマは単純加点せず、説明条件や警戒条件として扱います。'
  },
  {
    質問: 'インデックスより利益が出るのか',
    回答: '利益を保証するものではありません。目的は、S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%以上上回る根拠がある候補だけを残すことです。根拠が弱ければ個別株比率を下げます。'
  },
  {
    質問: 'このシステムは何をしているのか',
    回答: '候補銘柄のデータを集め、量的評価、質的テーマ、同業比較、6月イベント条件、ベンチマーク比較を分けて記録し、残す・保留・外すを同じ条件で整理します。'
  },
  {
    質問: '根拠はあるのか',
    回答: '候補ごとにPER、PBR、ROE、利益成長、決算後反応、同業比較、6月確認条件を記録しています。未入力データは点数に混ぜず、入力待ちまたは保留として表示します。'
  }
];

const scriptRows = [
  {
    順番: '1',
    見出し: '最初に伝えること',
    台本: '本資料は購入銘柄を確定する資料ではなく、NISA 1年保有テストに向けて、どの候補をどの根拠で残すかを説明する資料です。目的は、S&P500投信や日経平均/TOPIX連動投信を保有するだけの場合より、1年で+1%以上上回る根拠がある候補だけを残すことです。'
  },
  {
    順番: '2',
    見出し: 'システムの仕組み',
    台本: '仕組みは大きく5段階です。まず100社前後の候補群から検証対象を作り、次にPER、PBR、ROE、利益成長、株価反応などの量的データを確認します。そのうえで、AI、金利、商社、食品、半導体、防衛などの質的テーマを確認します。ただし質的テーマは単純に点数へ足さず、説明条件、警戒条件、除外条件として使います。'
  },
  {
    順番: '3',
    見出し: 'なぜ10社か',
    台本: '10社にした理由は、数を増やしすぎると公式決算、同業比較、20営業日反応、6月イベント後の再判定まで確認しきれないためです。逆に少なすぎると、金利、AI、食品、商社、半導体、防衛などの比較ができません。今回は説明可能性と検証可能性のバランスを取って10社にしています。'
  },
  {
    順番: '4',
    見出し: '10社の説明',
    台本: '中心確認は三井住友FG、TDK、住友商事です。味の素は食品安定枠ではなく、高PER成長枠として条件付きで見ます。三菱UFJ、東京きらぼし、ソフトバンクG、SCREEN、ディスコ、三菱重工業は、補欠、監視、別評価、反応検算に分けています。'
  },
  {
    順番: '5',
    見出し: 'インデックス比較',
    台本: 'この仕組みは、個別株が常にインデックスより有利だと言うものではありません。インデックスを上回る根拠があるときだけ個別株候補を残し、根拠が弱い場合は個別株比率を下げるための判断補助です。'
  },
  {
    順番: '6',
    見出し: '6月に行うこと',
    台本: '6月のCPI、日銀、FOMC、各銘柄の20営業日反応を入力し、残す、保留、外すを再判定します。現時点では一部が入力待ちなので、最終判断ではなく、6月に実データで再判定する前提です。'
  },
  {
    順番: '7',
    見出し: '最後のまとめ',
    台本: '本日の到達点は、候補10社を根拠付きで説明できる形にし、6月の実データ入力後に同じ条件で判定できるところまで整えたことです。今後は実データを入れて、インデックスを+1%以上上回る説明が成立する候補だけを残します。'
  }
];

writeCsv('719_client_send_pack_summary.csv', summaryRows, ['項目', '内容']);
writeCsv('720_client_send_pack_10_candidates.csv', candidateTable, ['順位', '銘柄', '現在の扱い', '主な数値根拠', '同業比較', '選定理由', '6月確認']);
writeCsv('721_client_send_pack_qa.csv', qaRows, ['質問', '回答']);
writeCsv('722_client_explanation_script.csv', scriptRows, ['順番', '見出し', '台本']);

const links = [
  ['システム全体トップ', 'https://ob198-cpu.github.io/kabu/index.html?v=41fe1b8'],
  ['6月最終再判定 入力コックピット', 'https://ob198-cpu.github.io/kabu/june_final_decision_cockpit_20260527.html?v=41fe1b8'],
  ['6月シナリオ別 候補10社シミュレーション', 'https://ob198-cpu.github.io/kabu/june_scenario_simulation_20260527.html?v=41fe1b8'],
  ['同業比較反映後 候補10社レビュー', 'https://ob198-cpu.github.io/kabu/peer_reflected_candidate_review_20260527.html?v=58551c0'],
  ['6月再判定 アクションプラン', 'https://ob198-cpu.github.io/kabu/june_action_plan_peer_reflected_20260527.html?v=a474c89']
];

const scenarioSummary = scenarioRows.map(row => ({
  シナリオ: row['シナリオ'],
  残す: row['残す'],
  保留: row['保留'],
  外す: row['外す'],
  入力待ち: row['入力待ち'],
  意味: row['意味']
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト候補 選定システム 説明資料</title>
  <style>
    :root { --ink:#050b14; --line:#ccd8e6; --blue:#0b4f7a; --navy:#123d63; --soft:#f5f9fd; --green:#087f5b; --amber:#a85400; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif; color:var(--ink); background:#eef4fa; line-height:1.72; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:8px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; line-height:1.25; }
    h2 { margin:26px 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:23px; }
    h3 { margin:18px 0 8px; font-size:18px; }
    p { margin:0 0 10px; }
    .lead { font-size:16px; color:#fff; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .label { font-size:13px; font-weight:800; }
    .value { font-size:25px; font-weight:900; margin-top:4px; color:var(--blue); }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); table-layout:fixed; }
    th, td { border:1px solid var(--line); padding:9px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; font-size:13px; color:#050b14; }
    th { background:#e6f1fb; text-align:left; font-weight:900; }
    .candidate th:nth-child(1), .candidate td:nth-child(1) { width:5%; text-align:center; }
    .candidate th:nth-child(2), .candidate td:nth-child(2) { width:13%; }
    .candidate th:nth-child(3), .candidate td:nth-child(3) { width:10%; }
    .candidate th:nth-child(4), .candidate td:nth-child(4) { width:20%; }
    .candidate th:nth-child(5), .candidate td:nth-child(5) { width:12%; }
    .candidate th:nth-child(6), .candidate td:nth-child(6) { width:20%; }
    .candidate th:nth-child(7), .candidate td:nth-child(7) { width:20%; }
    .box { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; margin:12px 0; }
    .accent { border-left:8px solid var(--blue); }
    .warn { border-left:8px solid var(--amber); }
    .ok { border-left:8px solid var(--green); }
    .script { background:#fff; border:1px solid var(--line); border-radius:8px; padding:14px; margin:10px 0; break-inside:avoid; }
    .script b { color:var(--blue); }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:8px 10px; border-radius:7px; background:#0b5f96; color:#fff; text-decoration:none; font-weight:800; }
    .small { font-size:12px; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } h1 { font-size:24px; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:0; }
      header { border-radius:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .card, .box, .script, table, tr, td, th { break-inside:avoid; page-break-inside:avoid; }
      a { color:#050b14; }
    }
  </style>
</head>
<body>
<main>
  <header>
    <h1>NISA 1年保有テスト候補 選定システム 説明資料</h1>
    <p class="lead">作成: ${esc(generatedAt)} / 目的: 候補10社の選定理由、システムの仕組み、インデックス比較、6月再判定の流れを説明する。</p>
  </header>

  <section class="grid">
    <div class="card"><div class="label">検証対象</div><div class="value">10社</div><div>6月再判定にかける候補</div></div>
    <div class="card"><div class="label">目標</div><div class="value">+1%</div><div>S&P500投信・日経平均/TOPIXを1年で上回る根拠</div></div>
    <div class="card"><div class="label">判定</div><div class="value">3分類</div><div>残す・保留・外す</div></div>
    <div class="card"><div class="label">現在</div><div class="value">入力待ち</div><div>6月実データで再判定</div></div>
  </section>

  <h2>1. 最初に伝える結論</h2>
  <div class="box accent">
    <p>本資料は、NISA 1年保有テストに向けた候補選定システムの説明資料です。現時点の10社は購入確定ではなく、6月のCPI、日銀、FOMC、決算後20営業日反応を入力して再判定する対象です。</p>
    <p>目的は、S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%以上上回る根拠がある候補だけを残すことです。根拠が弱い場合は個別株比率を下げます。</p>
  </div>

  <h2>2. システムの仕組み</h2>
  <table>
    <thead><tr><th>段階</th><th>内容</th><th>判断への使い方</th></tr></thead>
    <tbody>
      <tr><td>1. 母集団作成</td><td>100社前後の候補群から、業績、時流、規模、データ取得可否で検証対象を作る。</td><td>恣意的に1社だけを選ばず、比較可能な候補を残す。</td></tr>
      <tr><td>2. 量的評価</td><td>PER、PBR、ROE、利益成長、株価反応、下落率、データ充足を確認する。</td><td>中心判断。数字が弱い銘柄は質的材料だけで通さない。</td></tr>
      <tr><td>3. 質的テーマ</td><td>金利、AI、商社、食品、半導体、防衛などの時流材料を確認する。</td><td>単純加点ではなく、説明条件、警戒条件、除外条件として扱う。</td></tr>
      <tr><td>4. 同業比較</td><td>銀行、食品、商社、半導体、重工など、業種ごとにPER/PBR/ROEを比較する。</td><td>高PERを説明できるか、低PERが本当に有利かを確認する。</td></tr>
      <tr><td>5. 6月再判定</td><td>CPI、日銀、FOMC、20営業日反応を入力し、残す・保留・外すを判定する。</td><td>購入前の最終確認。未入力のものは入力待ちとして扱う。</td></tr>
    </tbody>
  </table>

  <h2>3. なぜ10社か</h2>
  <div class="box ok">
    <p>10社にした理由は、説明可能性と検証可能性の両立です。候補を多くしすぎると、公式決算、同業比較、決算後反応、6月イベント条件を1社ずつ確認できません。一方で少なすぎると、金利、AI、商社、食品、半導体、防衛などの比較ができません。</p>
    <p>今回の10社は、購入確定リストではなく、6月に同じ条件で再判定するための検証対象です。</p>
  </div>

  <h2>4. 候補10社と選定理由</h2>
  <table class="candidate">
    <thead><tr><th>順位</th><th>銘柄</th><th>扱い</th><th>主な数値根拠</th><th>同業比較</th><th>選定理由</th><th>6月確認</th></tr></thead>
    <tbody>
      ${candidateTable.map(row => `<tr><td>${esc(row['順位'])}</td><td>${esc(row['銘柄'])}</td><td>${esc(row['現在の扱い'])}</td><td>${esc(row['主な数値根拠'])}</td><td>${esc(row['同業比較'])}</td><td>${esc(row['選定理由'])}</td><td>${esc(row['6月確認'])}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>5. インデックスより有利か</h2>
  <div class="box warn">
    <p>このシステムは、個別株が必ずインデックスより有利だと主張するものではありません。個別株を選ぶ意味があるかを確認するための仕組みです。</p>
    <p>判断基準は、S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%以上上回る根拠を説明できるかです。説明が成立しない場合は、個別株候補へ入れる金額を減らし、現金待機または指数投信比較へ戻します。</p>
  </div>

  <h2>6. シナリオ別の見え方</h2>
  <table>
    <thead><tr><th>シナリオ</th><th>残す</th><th>保留</th><th>外す</th><th>入力待ち</th><th>意味</th></tr></thead>
    <tbody>
      ${scenarioSummary.map(row => `<tr><td>${esc(row['シナリオ'])}</td><td>${esc(row['残す'])}</td><td>${esc(row['保留'])}</td><td>${esc(row['外す'])}</td><td>${esc(row['入力待ち'])}</td><td>${esc(row['意味'])}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>7. 想定質問への回答</h2>
  <table>
    <thead><tr><th>質問</th><th>回答</th></tr></thead>
    <tbody>
      ${qaRows.map(row => `<tr><td>${esc(row['質問'])}</td><td>${esc(row['回答'])}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>8. 説明台本</h2>
  ${scriptRows.map(row => `<div class="script"><b>${esc(row['順番'])}. ${esc(row['見出し'])}</b><br>${esc(row['台本'])}</div>`).join('')}

  <h2>9. 確認URL</h2>
  <div class="box links">
    ${links.map(([label, url]) => `<a href="${esc(url)}">${esc(label)}</a>`).join('')}
  </div>

  <p class="small">注: 本資料は判断補助の説明資料です。最終判断は6月イベント後の実データ入力と候補再判定を経て行います。</p>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'client_send_pack_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'client_send_pack_20260527.html',
  candidates: candidateTable.length,
  qa: qaRows.length,
  script: scriptRows.length
}, null, 2));
