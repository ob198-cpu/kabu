import fs from 'node:fs';

const outHtml = 'financial_qualitative_next_input_queue_20260616.html';
const outCsv = 'financial_qualitative_next_input_queue_20260616.csv';
const financialGateCsv = 'candidate10_financial_confirmation_gate_20260614.csv';
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

function itemAcceptance(item) {
  if (item.includes('PER')) return 'EPSまたは会社予想EPS、株価基準日、計算式、出所を揃える。実績PERと予想PERを混同しない。';
  if (item.includes('PBR')) return 'BPSまたは自己資本、株価基準日、計算式、出所を揃える。';
  if (item.includes('ROE')) return '親会社株主に帰属する利益と自己資本、または会社公表ROEの出所を記録する。';
  if (item.includes('営業利益率')) return '売上収益と営業利益を同じ期間で確認し、営業利益率の計算式を残す。';
  if (item.includes('会社予想')) return '今期会社予想の売上・営業利益・純利益・EPSの有無を確認する。';
  if (item.includes('前期比')) return '売上・営業利益・EPSの前年比を、同じ会計基準で確認する。';
  if (item.includes('受注') || item.includes('セグメント')) return '候補テーマが全社業績へどれだけ効くか、受注・セグメント売上・利益で確認する。';
  if (item.includes('高PER') || item.includes('高PBR')) return '高バリュエーションを正当化できる成長率、受注、利益率、ガイダンスを確認する。';
  if (item.includes('配当') || item.includes('還元')) return '配当方針、自社株買い、総還元性向を公式資料で確認する。';
  return '入力値、出所、資料日付、確認区分を揃える。';
}

const financialRows = fs.existsSync(financialGateCsv) ? parseCsv(fs.readFileSync(financialGateCsv, 'utf8')) : [];
const partialRows = financialRows.filter((row) => row.financial_status === 'partial');

const financeQueue = partialRows.flatMap((row) => row.required_items
  .split('/')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => ({
    作成時刻: generatedAt,
    キュー種別: '財務入力',
    優先度: row.universe_status === '再選定候補' ? '高' : row.universe_status === '監視' ? '中' : '低',
    ticker: row.ticker,
    銘柄: row.name,
    役割: row.role,
    入力項目: item,
    現状: '未確認',
    確認先: row.source_to_check,
    合格条件: itemAcceptance(item),
    反映条件: '公式値・出所・資料日付・確認区分が揃った場合のみ反映',
    スコア反映: row.universe_status === '再選定候補' ? 'P1復帰再判定へ接続' : '監視・除外解除の検討材料',
    禁止事項: '推定値、説明不能な転記値、出所のないPER/PBR/ROEをスコアに混ぜない',
  })));

const qualitativeQueue = [
  {
    theme: '半導体製造装置・材料',
    data: 'SOX指数、WFE/半導体設備投資、受注・セグメント利益、候補銘柄の1日/5日/20日反応',
    pass: 'テーマニュース後に候補銘柄が指数を上回り、かつ受注または利益率に接続している',
    fail: '株価だけ上がり、受注・利益・ガイダンスで説明できない',
  },
  {
    theme: 'AIインフラ・データセンター',
    data: '電力需要、データセンター投資、電線・重電・冷却関連受注、候補銘柄の指数超過',
    pass: '需要増が受注・利益・会社コメントに接続し、イベント後反応も強い',
    fail: 'テーマは強いが、対象企業の売上寄与が小さい、または高値掴みリスクが大きい',
  },
  {
    theme: '金利・金融',
    data: '日銀結果、長期金利、銀行株指数、利ざや、与信費用、保険運用益',
    pass: '金利環境が利ざや・運用益にプラスで、信用コスト悪化が限定的',
    fail: '金利上昇より信用不安・円高・景気悪化の影響が大きい',
  },
  {
    theme: '防衛・重工',
    data: '防衛予算、受注残、セグメント売上・利益、過去急騰後の反落率',
    pass: '政策・受注・利益化がつながり、過熱調整後も指数に対して強い',
    fail: '受注はあるが利益化が遅い、または株価が先に織り込み済み',
  },
  {
    theme: '量子コンピューター',
    data: '関連売上、提携、受注、研究開発費、テーマイベント後の株価反応',
    pass: '1年以内の業績寄与または大型契約が確認できる',
    fail: 'ニュース性だけで売上寄与が見えない',
  },
  {
    theme: 'フィジカルAI・ロボティクス',
    data: 'FA売上、設備投資統計、制御・センサー・ロボット関連利益、候補銘柄反応',
    pass: '人手不足・自動化需要が受注と利益率に接続している',
    fail: '中国・設備投資サイクル悪化、在庫調整、セグメント利益鈍化',
  },
].map((row) => ({
  作成時刻: generatedAt,
  キュー種別: '質的テーマ検証',
  優先度: row.theme.includes('半導体') || row.theme.includes('AIインフラ') || row.theme.includes('金利') ? '高' : '中',
  ticker: '複数',
  銘柄: row.theme,
  役割: '補助評価',
  入力項目: '仮説・実績・反証',
  現状: '未検証',
  確認先: row.data,
  合格条件: row.pass,
  反映条件: '仮説だけでは不可。実績データまたはイベント後反応がある場合のみ補助評価',
  スコア反映: '補助係数。単独で買付候補化しない',
  禁止事項: row.fail,
}));

const rows = [...financeQueue, ...qualitativeQueue];
const headers = ['作成時刻', 'キュー種別', '優先度', 'ticker', '銘柄', '役割', '入力項目', '現状', '確認先', '合格条件', '反映条件', 'スコア反映', '禁止事項'];
writeCsv(outCsv, headers, rows);

function table(kind) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>優先度</th><th>ticker</th><th>銘柄/テーマ</th><th>入力項目</th><th>確認先</th><th>合格条件</th><th>反映条件</th><th>スコア反映</th><th>禁止事項</th></tr></thead>
    <tbody>${rows.filter((row) => row.キュー種別 === kind).map((row) => `<tr>
      <td class="${row.優先度 === '高' ? 'bad' : 'warn'}">${h(row.優先度)}</td>
      <td>${h(row.ticker)}</td>
      <td><b>${h(row.銘柄)}</b></td>
      <td>${h(row.入力項目)}</td>
      <td>${h(row.確認先)}</td>
      <td>${h(row.合格条件)}</td>
      <td>${h(row.反映条件)}</td>
      <td>${h(row.スコア反映)}</td>
      <td>${h(row.禁止事項)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>財務・質的テーマ 次入力キュー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}.card strong{display:block;font-size:30px;color:var(--blue);line-height:1.25}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .bad{color:var(--red);font-weight:900}.warn{color:var(--amber);font-weight:900}.ok{color:var(--green);font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:9px;padding:4px 5px}}
  </style>
</head>
<body>
<header>
  <h1>財務・質的テーマ 次入力キュー</h1>
  <p>財務partialを項目単位へ分解し、質的テーマは仮説・実績・反証を同じ表で検証するための作業リストです。</p>
</header>
<main>
  <section>
    <h2>現在の作業量</h2>
    <div class="cards">
      <div class="card"><b>財務入力キュー</b><strong>${h(financeQueue.length)}</strong></div>
      <div class="card"><b>質的検証キュー</b><strong>${h(qualitativeQueue.length)}</strong></div>
      <div class="card"><b>高優先</b><strong>${h(rows.filter((row) => row.優先度 === '高').length)}</strong></div>
      <div class="card"><b>買付上限</b><strong>0円</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">このキューは、未確認データを買付判断に混ぜないための作業表です。入力が完了しても、6月イベント、指数反応、候補銘柄反応、NISA口座確認が未通過なら買付上限は0円です。</p>
  </section>
  <section>
    <h2>財務入力キュー</h2>
    ${table('財務入力')}
  </section>
  <section>
    <h2>質的テーマ検証キュー</h2>
    ${table('質的テーマ検証')}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  financeQueue: financeQueue.length,
  qualitativeQueue: qualitativeQueue.length,
  highPriority: rows.filter((row) => row.優先度 === '高').length,
}, null, 2));
