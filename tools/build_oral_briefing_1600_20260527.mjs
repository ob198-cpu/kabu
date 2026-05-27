import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((row) => header.map((h) => csvEscape(row[h])).join(",")).join("\n")}\n`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

const scripts = [
  {
    "種類": "30秒版",
    "本文": "本日は、NISA 1年保有テストに向けて候補10社を実データで整理しました。株価、業績、PER/PBR/ROE、決算後反応を使って、中心確認4社、条件付き確認1社、監視5社に分けています。現時点では購入確定ではなく、6月のCPI・日銀・FOMC後に市場条件を入れて再判定します。",
  },
  {
    "種類": "1分版",
    "本文": "本日の作業では、約100社規模の候補群から、実データで比較できる10社を整理しました。評価は量的データを主軸にし、質的テーマは直接点数に足さず、確認条件や警戒条件として扱います。中心確認は三井住友FG、味の素、TDK、住友商事です。三菱UFJ FGは条件付き確認、残り5社は監視です。6月のCPI、日銀、FOMC、米金利、為替、日経平均/TOPIX、決算後20営業日反応を入れて、残す・保留・外すを再判定します。",
  },
  {
    "種類": "3分版",
    "本文": "今回の目的は、NISAで1年保有するテスト候補を、感覚ではなく実データと条件で絞ることです。単にテーマ性がある銘柄を選ぶのではなく、株価、業績、PER/PBR/ROE、決算後反応、下落率、データ充足を見ています。質的テーマは、AI、半導体、金利、商社、食品などを見ますが、直接加点はしません。売上・利益・株価反応へつながるかを確認するために使います。現時点では中心確認4社、条件付き確認1社、監視5社に分類しました。中心確認は三井住友FG、味の素、TDK、住友商事です。ただし、これは購入確定ではありません。6月はCPI、日銀、FOMCがあり、市場の方向が変わる可能性があります。そのため、6月イベント後に米金利、為替、日経平均/TOPIX、75日線、個別決算後反応を入れて、残す・保留・外すを再判定します。目標は、S&P500投信や日経平均/TOPIXを保有するだけの場合より、1年で+1%上回る根拠を説明できる候補に絞ることです。",
  },
];

const flowRows = [
  { "順番": 1, "話す内容": "目的", "要点": "NISA 1年保有テストの候補を、実データと条件で絞る。" },
  { "順番": 2, "話す内容": "本日の成果", "要点": "10社を整理し、中心確認4社、条件付き確認1社、監視5社に分類した。" },
  { "順番": 3, "話す内容": "評価方法", "要点": "量的評価を主軸にし、質的テーマは確認条件・警戒条件として扱う。" },
  { "順番": 4, "話す内容": "現在の候補", "要点": "三井住友FG、味の素、TDK、住友商事を中心確認に置く。" },
  { "順番": 5, "話す内容": "6月の扱い", "要点": "CPI、日銀、FOMC後に市場条件を入れて再判定する。" },
  { "順番": 6, "話す内容": "結論", "要点": "本日は候補確定ではなく、再判定できる状態まで整えた。" },
];

const shortAnswers = [
  {
    "聞かれた内容": "もう買える段階か",
    "短い回答": "いいえ。現時点は候補整理の段階です。6月イベント後に市場条件を入れて再判定します。",
  },
  {
    "聞かれた内容": "なぜこの10社か",
    "短い回答": "株価、業績、PER/PBR/ROE、決算後反応、下落率、質的テーマとの接続を同じ基準で見たためです。",
  },
  {
    "聞かれた内容": "質的テーマはどう使うのか",
    "短い回答": "点数に直接足さず、売上・利益・株価反応へつながるかを確認する条件として使います。",
  },
  {
    "聞かれた内容": "指数や投信と比べる意味は何か",
    "短い回答": "個別株を選ぶ以上、S&P500投信や日経平均/TOPIXより1年で+1%上回る根拠が必要だからです。",
  },
  {
    "聞かれた内容": "外す条件は何か",
    "短い回答": "下方修正、決算後の指数劣後、75日線割れ、金利急騰、円高ショック、過熱後の急落です。",
  },
];

const urlRows = [
  {
    "資料": "本日報告 16:00版 HTML",
    "URL": "https://ob198-cpu.github.io/kabu/final_report_1600_20260527.html?v=8073e66",
    "用途": "全体説明",
  },
  {
    "資料": "本日報告 16:00版 PDF",
    "URL": "https://ob198-cpu.github.io/kabu/final_report_1600_20260527.pdf?v=8073e66",
    "用途": "固定資料",
  },
  {
    "資料": "14:30暫定報告",
    "URL": "https://ob198-cpu.github.io/kabu/interim_candidate_result_1430_20260527.html?v=bf0c99e",
    "用途": "候補10社の見える化",
  },
  {
    "資料": "15:30説明補強パック",
    "URL": "https://ob198-cpu.github.io/kabu/explanation_pack_1530_20260527.html?v=14666c6",
    "用途": "質問対応",
  },
  {
    "資料": "6月再判定シート",
    "URL": "https://ob198-cpu.github.io/kabu/june_event_recheck_sheet_20260527.html?v=3b67907",
    "用途": "6月イベント後の入力",
  },
];

write("682_oral_briefing_scripts_1600.csv", toCsv(scripts.map((row) => ({ "作成": generatedAt, ...row }))));
write("683_oral_briefing_flow_1600.csv", toCsv(flowRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("684_oral_briefing_short_answers_1600.csv", toCsv(shortAnswers.map((row) => ({ "作成": generatedAt, ...row }))));
write("685_oral_briefing_urls_1600.csv", toCsv(urlRows.map((row) => ({ "作成": generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const scriptCards = scripts.map((row) => `<article class="script">
  <h3>${esc(row["種類"])}</h3>
  <p>${esc(row["本文"])}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>16:00説明用スクリプト</title>
  <style>
    :root {
      --ink:#061d33;
      --blue:#0b5e94;
      --navy:#082f53;
      --line:#c8dbea;
      --bg:#f5f8fb;
      --soft:#eef7ff;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.75; }
    header { background:#082f53; color:#fff; padding:30px 34px; }
    header h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    header p { margin:0; color:#fff; font-weight:700; }
    main { max-width:1240px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:22px; }
    h3 { margin:0 0 8px; font-size:18px; color:#06395b; }
    .scripts { display:grid; grid-template-columns:1fr; gap:12px; }
    .script { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; }
    .script p { margin:0; color:#111; font-size:15px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; min-width:980px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:760px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:700; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:800; }
    @media (max-width:820px){ header{padding:24px 18px;} main{padding:12px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>16:00説明用スクリプト</h1>
    <p>作成: ${esc(generatedAt)} / 本日報告を短く正確に伝えるための説明文</p>
  </header>
  <main>
    <section>
      <h2>1. そのまま読める説明文</h2>
      <div class="scripts">${scriptCards}</div>
    </section>
    <section>
      <h2>2. 説明の順番</h2>
      ${table(flowRows, "narrow")}
    </section>
    <section>
      <h2>3. 短い回答</h2>
      ${table(shortAnswers, "narrow")}
    </section>
    <section>
      <h2>4. 共有URL</h2>
      ${table(urlRows)}
      <div class="note" style="margin-top:12px">URLは資料の用途別に分けています。全体説明は16:00版、質問対応は15:30補強、実入力は6月再判定シートを使います。</div>
    </section>
    <section>
      <h2>5. CSV</h2>
      <div class="links">
        <a href="682_oral_briefing_scripts_1600.csv">説明文CSV</a>
        <a href="683_oral_briefing_flow_1600.csv">説明順CSV</a>
        <a href="684_oral_briefing_short_answers_1600.csv">短い回答CSV</a>
        <a href="685_oral_briefing_urls_1600.csv">URL一覧CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("oral_briefing_1600_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  scripts: scripts.length,
  answers: shortAnswers.length,
  urls: urlRows.length,
  output: "oral_briefing_1600_20260527.html",
}, null, 2));
