import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function readCsv(name) {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^\uFEFF/, '').trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function compactBasis(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/ \/ /g, ' / ')
    .trim();
}

const candidates = readCsv('720_client_send_pack_10_candidates.csv').map((row) => ({
  rank: row['順位'],
  ticker: row['銘柄'],
  status: row['現在の扱い'],
  metrics: compactBasis(row['主な数値根拠']),
  peer: row['同業比較'],
  reason: row['選定理由'],
  june: row['6月確認'],
  chart: row['1年チャート']
}));

const core = candidates.filter((row) => row.status.includes('中心'));
const watch = candidates.filter((row) => !row.status.includes('中心'));

const roleText = {
  '中心確認': '中心候補',
  '条件付き中心': '条件付き中心候補',
  '補欠比較': '比較候補',
  '監視': '監視候補',
  '別評価監視': '別評価候補',
  '反応検算': '反応検算候補'
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト候補 提案資料</title>
  <style>
    :root {
      --ink:#050b14;
      --muted:#435469;
      --line:#cfd9e6;
      --navy:#0f3154;
      --blue:#0b5f96;
      --soft:#f4f8fc;
      --pale:#eaf4fb;
      --green:#0d7b57;
      --amber:#a85b00;
      --red:#a92721;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP","Yu Gothic",Meiryo,sans-serif;
      color:var(--ink);
      background:#eef3f8;
      line-height:1.7;
      letter-spacing:0;
    }
    main { max-width:1160px; margin:0 auto; padding:28px 18px 58px; }
    .cover {
      background:linear-gradient(135deg,#0f3154,#174a75);
      color:#fff;
      border-radius:10px;
      padding:34px 34px 28px;
      margin-bottom:18px;
      page-break-after:avoid;
    }
    .eyebrow { margin:0 0 8px; font-size:13px; font-weight:800; color:#bfe3ff; }
    h1 { margin:0; font-size:34px; line-height:1.22; }
    .lead { max-width:900px; margin:14px 0 0; color:#eaf6ff; font-size:15px; }
    .meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .meta span { border:1px solid rgba(255,255,255,.35); border-radius:999px; padding:6px 10px; font-size:12px; }
    section {
      background:#fff;
      border:1px solid var(--line);
      border-radius:10px;
      padding:22px;
      margin:14px 0;
      break-inside:avoid;
      box-shadow:0 8px 24px rgba(20,48,84,.06);
    }
    h2 { margin:0 0 12px; color:var(--navy); font-size:22px; line-height:1.28; border-left:7px solid var(--blue); padding-left:10px; }
    h3 { margin:0 0 8px; color:var(--navy); font-size:16px; }
    p { margin:0 0 10px; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .grid-2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .box { border:1px solid var(--line); background:var(--soft); border-radius:8px; padding:14px; }
    .box b { display:block; color:var(--navy); margin-bottom:5px; }
    .large { font-size:25px; font-weight:900; color:var(--blue); }
    .flow { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; align-items:stretch; }
    .step { background:var(--pale); border:1px solid #bcd5ea; border-radius:8px; padding:12px; position:relative; }
    .step b { color:var(--navy); }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:break-word; word-break:normal; }
    th { background:#e5f0f8; color:var(--navy); text-align:left; }
    tr:nth-child(even) td { background:#fafcff; }
    .proposal-candidates th:nth-child(1), .proposal-candidates td:nth-child(1) { width:5%; text-align:center; }
    .proposal-candidates th:nth-child(2), .proposal-candidates td:nth-child(2) { width:16%; }
    .proposal-candidates th:nth-child(3), .proposal-candidates td:nth-child(3) { width:13%; text-align:center; overflow-wrap:normal; word-break:keep-all; }
    .proposal-candidates th:nth-child(4), .proposal-candidates td:nth-child(4) { width:23%; }
    .proposal-candidates th:nth-child(5), .proposal-candidates td:nth-child(5) { width:14%; }
    .proposal-candidates th:nth-child(6), .proposal-candidates td:nth-child(6) { width:22%; }
    .proposal-candidates th:nth-child(7), .proposal-candidates td:nth-child(7) { width:7%; text-align:center; overflow-wrap:normal; word-break:keep-all; white-space:nowrap; }
    .status { display:inline-flex; align-items:center; justify-content:center; min-width:76px; border-radius:8px; padding:4px 8px; font-weight:800; font-size:11px; line-height:1.25; color:#fff; background:var(--blue); white-space:nowrap; }
    .status.watch { background:var(--amber); }
    .status.stop { background:var(--red); }
    .note { font-size:12px; color:var(--muted); }
    .strong { color:var(--navy); font-weight:900; }
    .risk-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .risk { border-left:6px solid var(--amber); background:#fff8ed; padding:12px; border-radius:8px; border-top:1px solid #efd4ad; border-right:1px solid #efd4ad; border-bottom:1px solid #efd4ad; }
    .link { display:inline-block; color:#075e91; font-weight:800; text-decoration:none; white-space:nowrap; word-break:keep-all; }
    .qa td:first-child { width:26%; font-weight:800; color:var(--navy); }
    .footer-note { font-size:11px; color:#48596d; border-top:1px solid var(--line); padding-top:10px; margin-top:16px; }
    @media (max-width:850px) {
      main { padding:16px 10px; }
      .cover { padding:24px 18px; }
      h1 { font-size:26px; }
      .grid,.grid-2,.flow,.risk-list { grid-template-columns:1fr; }
      table { table-layout:auto; }
    }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:0; }
      section, .cover { box-shadow:none; }
      a { color:#000; text-decoration:none; }
      .cover { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>
</head>
<body>
<main>
  <div class="cover">
    <p class="eyebrow">NISA 1年保有テスト / 候補選定提案資料</p>
    <h1>インデックス比較を前提にした<br>NISA日本株 候補10社提案</h1>
    <p class="lead">本資料は、S&P500投信・日経平均/TOPIX連動投信を保有するだけの場合より、1年で+1%以上上回る説明が成立するかを検証するための候補資料です。現時点の10社は購入確定ではなく、6月の市場イベントと各社データを入力して再判定する対象です。</p>
    <div class="meta">
      <span>作成日時: ${esc(generatedAt)}</span>
      <span>対象: 日本株10社</span>
      <span>運用前提: NISA / 1年保有テスト</span>
      <span>判定: 残す・保留・外す</span>
    </div>
  </div>

  <section>
    <h2>1. 提案の要旨</h2>
    <div class="grid">
      <div class="box"><b>目的</b><span>S&P500投信・日経平均/TOPIXを単純保有する場合と比較し、個別株を選ぶ合理性を検証する。</span></div>
      <div class="box"><b>選定対象</b><span>100社前後の候補群から、説明可能性と検証可能性を満たす10社を抽出する。</span></div>
      <div class="box"><b>現時点の結論</b><span>購入確定ではなく、6月イベント後に実データで再判定する候補リストとして扱う。</span></div>
    </div>
  </section>

  <section>
    <h2>2. なぜ10社に絞るのか</h2>
    <div class="grid-2">
      <div class="box">
        <b>多すぎる場合の問題</b>
        <p>100社前後をすべて深掘りすると、公式決算、PER/PBR/ROE、同業比較、決算後反応、6月イベント条件を1社ずつ確認しきれません。</p>
      </div>
      <div class="box">
        <b>少なすぎる場合の問題</b>
        <p>数社だけでは、金利、AI、商社、食品、半導体、防衛などのテーマ比較ができず、偶然の銘柄選択に見えやすくなります。</p>
      </div>
    </div>
    <p class="strong">そのため、説明可能性、検証可能性、分散性のバランスを取り、今回は10社をテスト対象とします。</p>
  </section>

  <section>
    <h2>3. システムの仕組み</h2>
    <div class="flow">
      <div class="step"><b>1. 母集団</b><br>業績、テーマ、流動性から100社前後を作る。</div>
      <div class="step"><b>2. 量的評価</b><br>PER/PBR/ROE、利益成長、株価反応、下落率を見る。</div>
      <div class="step"><b>3. 質的評価</b><br>AI、金利、防衛、食品、商社などの時流を確認する。</div>
      <div class="step"><b>4. 同業比較</b><br>高PERや低PERが妥当か、同じ業種内で確認する。</div>
      <div class="step"><b>5. 6月再判定</b><br>CPI、日銀、FOMC、20営業日反応で残す・保留・外すを決める。</div>
    </div>
    <p class="note">質的材料は単純加点しません。数字で裏付ける条件、警戒条件、除外条件として扱います。</p>
  </section>

  <section>
    <h2>4. 候補10社の概要</h2>
    <table class="proposal-candidates">
      <thead>
        <tr><th style="width:5%">No.</th><th style="width:15%">銘柄</th><th style="width:10%">位置づけ</th><th style="width:24%">主な数値根拠</th><th style="width:15%">同業比較</th><th>確認ポイント</th><th style="width:9%">1年</th></tr>
      </thead>
      <tbody>
        ${candidates.map((row) => {
          const watchClass = row.status.includes('中心') ? '' : ' watch';
          return `<tr><td>${esc(row.rank)}</td><td><b>${esc(row.ticker)}</b></td><td><span class="status${watchClass}">${esc(roleText[row.status] || row.status)}</span></td><td>${esc(row.metrics)}</td><td>${esc(row.peer)}</td><td>${esc(row.june)}</td><td><a class="link" href="${esc(row.chart)}">チャート</a></td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>5. 現時点の候補分類</h2>
    <div class="grid-2">
      <div class="box">
        <h3>中心・条件付き中心</h3>
        <ul>
          ${core.map((row) => `<li><b>${esc(row.ticker)}</b>: ${esc(roleText[row.status] || row.status)}。${esc(row.peer)}</li>`).join('')}
        </ul>
      </div>
      <div class="box">
        <h3>比較・監視・反応検算</h3>
        <ul>
          ${watch.map((row) => `<li><b>${esc(row.ticker)}</b>: ${esc(roleText[row.status] || row.status)}。6月に条件確認。</li>`).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section>
    <h2>6. インデックス比較の考え方</h2>
    <div class="grid-2">
      <div class="box">
        <b>目標</b>
        <p class="large">+1%以上</p>
        <p>S&P500投信・日経平均/TOPIX連動投信を保有するだけの場合より、1年で+1%以上上回る根拠がある候補だけを残します。</p>
      </div>
      <div class="box">
        <b>根拠が弱い場合</b>
        <p>個別株比率を下げ、現金待機または指数投信比較へ戻します。個別株を選ぶ意味が説明できない場合は、無理に個別株へ寄せません。</p>
      </div>
    </div>
  </section>

  <section>
    <h2>7. 6月の判定フロー</h2>
    <table>
      <thead><tr><th>確認項目</th><th>見る数字・材料</th><th>良い場合</th><th>悪い場合</th></tr></thead>
      <tbody>
        <tr><td>米CPI</td><td>前年比、前月比、米10年金利</td><td>候補維持または追加検討</td><td>金利敏感株・高PER株を保留</td></tr>
        <tr><td>日銀</td><td>円高/円安、銀行株反応、日経平均</td><td>銀行・内需候補を再評価</td><td>急な円高や指数下落時は保留</td></tr>
        <tr><td>FOMC</td><td>米10年金利、NASDAQ、SOX</td><td>AI・半導体候補の維持判断</td><td>半導体・高PER候補を縮小</td></tr>
        <tr><td>決算後反応</td><td>1日/5日/20営業日の対指数反応</td><td>反応が強い候補を残す</td><td>反応が弱い候補は監視へ下げる</td></tr>
        <tr><td>同業比較</td><td>PER/PBR/ROE、利益成長、受注・見通し</td><td>割高を説明できる候補のみ残す</td><td>説明できない高PERは外す</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>8. 主なリスクと対応</h2>
    <div class="risk-list">
      <div class="risk"><b>高PER・過熱リスク</b><br>味の素、ディスコ、三菱重工業などは、テーマ性だけでなく利益成長・受注・同業比較で説明できるかを見る。</div>
      <div class="risk"><b>金利上昇リスク</b><br>FOMC後に米10年金利が急騰する場合、AI・半導体・高PER候補は保留または縮小する。</div>
      <div class="risk"><b>テーマ先行リスク</b><br>半導体、防衛、AI関連は材料だけで判断せず、決算後反応と実績数字で裏付ける。</div>
      <div class="risk"><b>指数劣後リスク</b><br>個別株候補が指数を上回る説明を持てない場合、個別株比率を下げる。</div>
    </div>
  </section>

  <section>
    <h2>9. 想定される質問への回答</h2>
    <table class="qa">
      <tbody>
        <tr><td>この10社は購入確定ですか</td><td>いいえ。6月のCPI、日銀、FOMC、決算後反応を入力して再判定する候補です。</td></tr>
        <tr><td>なぜ指数投信だけではないのですか</td><td>指数投信を基準にし、それを+1%以上上回る説明が成立するかを検証するためです。成立しなければ個別株比率を下げます。</td></tr>
        <tr><td>質的材料はどう使いますか</td><td>単純加点ではなく、確認条件、警戒条件、除外条件として使います。数字で裏付けられない材料だけでは候補にしません。</td></tr>
        <tr><td>どこまで根拠がありますか</td><td>PER/PBR/ROE、利益成長、株価反応、同業比較、1年チャート、6月の判定条件を同じ表で確認できる段階です。</td></tr>
      </tbody>
    </table>
    <p class="footer-note">本資料はNISA 1年保有テストに向けた判断補助資料です。最終判断は6月イベント後の実データ入力と候補再判定を経て行います。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'broker_style_proposal_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'broker_style_proposal_20260527.html',
  candidates: candidates.length,
  core: core.length,
  watch: watch.length
}, null, 2));
