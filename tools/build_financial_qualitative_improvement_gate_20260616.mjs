import fs from 'node:fs';

const outHtml = 'financial_qualitative_improvement_gate_20260616.html';
const outCsv = 'financial_qualitative_improvement_gate_20260616.csv';
const financialGateCsv = 'candidate10_financial_confirmation_gate_20260614.csv';
const financialSummaryCsv = 'p1_financial_completion_summary_20260614.csv';
const p1SummaryCsv = 'p1_segment_next_gate_input_validator_summary_20260615.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? '').trim() !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const financialRows = fs.existsSync(financialGateCsv) ? parseCsv(fs.readFileSync(financialGateCsv, 'utf8')) : [];
const financialSummary = fs.existsSync(financialSummaryCsv) ? parseCsv(fs.readFileSync(financialSummaryCsv, 'utf8')) : [];
const p1Summary = fs.existsSync(p1SummaryCsv) ? parseCsv(fs.readFileSync(p1SummaryCsv, 'utf8')) : [];

const passCount = financialRows.filter((row) => row.financial_status === 'pass').length;
const partialCount = financialRows.filter((row) => row.financial_status === 'partial').length;
const totalFinancial = financialRows.length;
const p1Input = p1Summary.find((row) => row.項目 === '入力項目通過')?.値 || '36/44項目';
const p1Gate = p1Summary.find((row) => row.項目 === 'ゲート通過')?.値 || '6/8ゲート';
const p1Buy = p1Summary.find((row) => row.項目 === 'P1復帰/買付')?.値 || '0社 / 0円';
const officialWaiting = financialSummary.find((row) => row.項目 === '入力項目')?.件数 || '67項目';
const completedFinancial = financialSummary.find((row) => row.項目 === '完了銘柄')?.件数 || '0銘柄';

const financialStatusRows = financialRows.map((row) => ({
  作成時刻: generatedAt,
  分類: '財務データ',
  対象: `${row.ticker} ${row.name}`,
  現状: row.financial_status === 'pass' ? '公式確認済み扱い' : 'partial',
  揃っているもの: row.financial_status === 'pass' ? '財務確認ゲートを通過済み' : '一部数値・確認ルート・入力候補',
  不足しているもの: row.financial_status === 'pass'
    ? '6月イベント、指数反応、口座確認は別ゲートで未完了'
    : row.required_items,
  改善後の扱い: row.financial_status === 'pass'
    ? '財務面は候補比較に使える。ただし買付はイベント・口座ゲート通過後'
    : '未確認値をスコアに混ぜない。公式値・出所・資料日付が揃うまで比率を上げない',
  スコア反映: row.financial_status === 'pass' ? '財務ゲート内で使用可' : '禁止',
  次アクション: row.financial_status === 'pass'
    ? '6月イベント後にP1復帰可否を再判定'
    : `${row.source_to_check}でPER/PBR/ROE/EPS/BPS、営業利益率、会社予想、還元方針を確認`,
}));

const qualitativeRows = [
  {
    対象: '半導体製造装置・材料',
    仮説層: 'AI・データセンター需要が続くと、製造装置、検査、材料、消耗品に二次需要が出る。',
    実績層: '候補銘柄の決算後反応、SOX指数、受注・セグメント利益、指数差で検証する。',
    反証条件: 'SOX下落、受注鈍化、高PER説明不可、候補銘柄が指数に明確劣後。',
  },
  {
    対象: 'AIインフラ・データセンター',
    仮説層: 'AI計算需要が増えると、電力、冷却、電線、重電、制御機器へ資金が回る。',
    実績層: '電力投資、設備受注、データセンター関連売上、候補銘柄の指数超過で検証する。',
    反証条件: '設備投資鈍化、金利上昇でインフラ投資が遅れる、株価だけ先行し業績寄与が弱い。',
  },
  {
    対象: '金利・金融',
    仮説層: '日銀・米金利が銀行利ざやや保険運用益に影響する。',
    実績層: '日銀結果、長期金利、銀行株反応、決算の利ざや・与信費用で検証する。',
    反証条件: '急な円高、信用コスト悪化、日銀方針が市場予想と逆に動く。',
  },
  {
    対象: '防衛・重工',
    仮説層: '国策・防衛費・安全保障需要が長期テーマになる。',
    実績層: '受注残、予算、セグメント利益、過去上昇後の反落率で検証する。',
    反証条件: '過熱後の大幅下落、受注が利益化しない、指数に劣後。',
  },
  {
    対象: '量子コンピューター',
    仮説層: '将来テーマとしては大きいが、1年NISAテストでは業績寄与が見えにくい。',
    実績層: '売上寄与、受注、提携、株価反応が確認できるまで監視枠。',
    反証条件: 'ニュースだけで業績影響が薄い、関連売上が小さい、出来高だけの短期材料。',
  },
  {
    対象: 'フィジカルAI・ロボティクス',
    仮説層: '人手不足、工場自動化、制御、センサー、FA需要とつながる。',
    実績層: 'FA売上、受注、利益率、設備投資統計、候補銘柄の指数超過で検証する。',
    反証条件: '中国・設備投資の鈍化、在庫調整、セグメント利益が伸びない。',
  },
].map((row) => ({
  作成時刻: generatedAt,
  分類: '質的テーマ',
  対象: row.対象,
  現状: '仮説層は整理済み・実績層は未完了',
  揃っているもの: row.仮説層,
  不足しているもの: `${row.実績層} 反証条件: ${row.反証条件}`,
  改善後の扱い: '仮説だけでは加点しない。実績層または公式数値で裏取りできた場合だけ補助評価に使う',
  スコア反映: '原則禁止。検証済みイベント反応がある場合のみ補助係数',
  次アクション: 'ニュース、公式IR、業界統計、イベント後リターンを同じ表へ入れて、仮説・実績・反証を分ける',
}));

const rows = [
  {
    作成時刻: generatedAt,
    分類: '総括',
    対象: '財務データ',
    現状: `${passCount}/${totalFinancial}銘柄がpass、${partialCount}/${totalFinancial}銘柄がpartial`,
    揃っているもの: '既存の財務確認ゲート、公式確認ルート、入力候補',
    不足しているもの: `${officialWaiting}が公式確認待ち。完了銘柄は${completedFinancial}`,
    改善後の扱い: 'passとpartialを分け、partialはスコア・比率へ混ぜない',
    スコア反映: 'passのみ財務ゲート内で使用可',
    次アクション: 'partial銘柄の公式値と出所を埋める',
  },
  {
    作成時刻: generatedAt,
    分類: '総括',
    対象: 'P1ゲート',
    現状: `${p1Input} / ${p1Gate} / ${p1Buy}`,
    揃っているもの: '入力・ゲート・復帰可否を分ける仕組み',
    不足しているもの: '6月イベント後の指数反応、個別反応、説明可能性',
    改善後の扱い: '全ゲート通過まで候補順位と買付上限を動かさない',
    スコア反映: '禁止',
    次アクション: '6月イベント入力後にP1復帰可否を再判定',
  },
  ...financialStatusRows,
  ...qualitativeRows,
];

const headers = ['作成時刻', '分類', '対象', '現状', '揃っているもの', '不足しているもの', '改善後の扱い', 'スコア反映', '次アクション'];
writeCsv(outCsv, headers, rows);

function table(filter) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>分類</th><th>対象</th><th>現状</th><th>揃っているもの</th><th>不足しているもの</th><th>改善後の扱い</th><th>スコア反映</th><th>次アクション</th></tr></thead>
    <tbody>${rows.filter(filter).map((row) => `<tr>
      <td>${h(row.分類)}</td>
      <td><b>${h(row.対象)}</b></td>
      <td>${h(row.現状)}</td>
      <td>${h(row.揃っているもの)}</td>
      <td>${h(row.不足しているもの)}</td>
      <td>${h(row.改善後の扱い)}</td>
      <td class="${row.スコア反映.includes('禁止') ? 'bad' : 'warn'}">${h(row.スコア反映)}</td>
      <td>${h(row.次アクション)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>財務・質的テーマ 改善ゲート</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1400px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}.card strong{display:block;font-size:30px;color:var(--blue);line-height:1.25}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .bad{color:var(--red);font-weight:900}.warn{color:var(--amber);font-weight:900}.ok{color:var(--green);font-weight:900}
    a{color:#075c94;font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>財務・質的テーマ 改善ゲート</h1>
  <p>「一部あり」「枠はあり」の曖昧な状態をやめ、買付判断へ使えるデータ、使えないデータ、次に埋めるデータを分ける画面です。</p>
</header>
<main>
  <section>
    <h2>現在の判定</h2>
    <div class="cards">
      <div class="card"><b>財務pass</b><strong>${h(passCount)}/${h(totalFinancial)}</strong></div>
      <div class="card"><b>財務partial</b><strong>${h(partialCount)}/${h(totalFinancial)}</strong></div>
      <div class="card"><b>P1復帰/買付</b><strong>${h(p1Buy)}</strong></div>
      <div class="card"><b>質的テーマ</b><strong>補助のみ</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">partial財務値と未検証の質的テーマは、候補順位・買付比率・買付上限に混ぜません。公式値、出所、取得日時、イベント後反応が揃ったものだけを反映対象にします。</p>
  </section>
  <section>
    <h2>総括</h2>
    ${table((row) => row.分類 === '総括')}
  </section>
  <section>
    <h2>財務データ</h2>
    ${table((row) => row.分類 === '財務データ')}
  </section>
  <section>
    <h2>質的テーマ</h2>
    ${table((row) => row.分類 === '質的テーマ')}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  passCount,
  partialCount,
  totalFinancial,
  p1Buy,
}, null, 2));
