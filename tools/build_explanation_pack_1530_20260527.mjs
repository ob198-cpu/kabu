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

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
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

const candidates = parseCsv(read("671_interim_candidate_result_1430.csv"));
const stopRules = parseCsv(read("669_june_recheck_hard_stop_criteria.csv"));

const centerNames = candidates
  .filter((row) => row["暫定区分"] === "中心確認" || row["暫定区分"] === "追加確認付き中心")
  .map((row) => row["銘柄"])
  .join("、");
const conditionalNames = candidates
  .filter((row) => row["暫定区分"] === "条件付き確認")
  .map((row) => row["銘柄"])
  .join("、");
const watchNames = candidates
  .filter((row) => row["暫定区分"] === "監視")
  .map((row) => row["銘柄"])
  .join("、");

const summaryRows = [
  {
    "見出し": "目的",
    "内容": "NISA 1年保有テストに向けて、約100社規模の候補群から実データと確認条件に基づいて10社を抽出し、6月イベント後に再判定できる状態を作る。",
  },
  {
    "見出し": "現在の到達点",
    "内容": "10社の株価、業績、PER/PBR/ROE、決算後反応、注意点を整理し、中心確認、条件付き確認、監視に分類済み。",
  },
  {
    "見出し": "中心確認",
    "内容": centerNames,
  },
  {
    "見出し": "条件付き確認",
    "内容": conditionalNames || "該当なし",
  },
  {
    "見出し": "監視",
    "内容": watchNames,
  },
  {
    "見出し": "評価方針",
    "内容": "量的評価を主軸にし、質的テーマは直接加点ではなく、確認条件・警戒条件・除外条件として扱う。",
  },
  {
    "見出し": "6月の判断",
    "内容": "CPI、日銀、FOMC、米金利、為替、日経平均/TOPIX、個別決算反応を入れて、残す・保留・外すを再判定する。",
  },
];

const qaRows = [
  {
    "質問": "これは何をするシステムか",
    "回答": "NISA 1年保有テストの候補を、実データと確認条件で絞り込む判断補助システムです。購入対象を自動確定するものではなく、候補の根拠、注意点、6月に確認する条件を整理します。",
  },
  {
    "質問": "なぜ今すぐ購入確定ではないのか",
    "回答": "6月にCPI、日銀、FOMCがあり、金利、為替、日本株全体の方向が変わる可能性があります。現時点では候補を作り、イベント後の数値で再判定する方針です。",
  },
  {
    "質問": "10社はどのように選んだのか",
    "回答": "株価、業績、PER/PBR/ROE、決算後反応、下落率、データ充足、時流テーマとの接続を確認し、同じ基準で比較できる銘柄を10社に整理しました。",
  },
  {
    "質問": "質的テーマは点数に足しているのか",
    "回答": "直接加点していません。AI、半導体、金利、商社、食品などのテーマは、確認すべき数字と警戒条件を決めるために使います。定量条件が悪い銘柄をテーマだけで残す扱いにはしません。",
  },
  {
    "質問": "S&P500投信や日経平均/TOPIXを持つだけの場合と何が違うのか",
    "回答": "目標は、ただ指数や投信を保有する場合より1年で+1%上回る根拠を説明できる候補だけを残すことです。根拠が弱ければ、個別株比率を下げる判断につなげます。",
  },
  {
    "質問": "中心確認と監視の違いは何か",
    "回答": "中心確認は、現時点の実データと注意点を見て6月再判定に優先して残す候補です。監視は、過熱、反応不足、PER未取得、下落率などの理由で、条件改善まで購入候補にしない銘柄です。",
  },
  {
    "質問": "現時点で最も説明しやすい候補はどれか",
    "回答": "現時点では三井住友FG、味の素、TDK、住友商事を中心確認として整理しています。ただし、各社とも6月の市場条件と個別条件を通してから扱いを決めます。",
  },
  {
    "質問": "データ不足は残っているか",
    "回答": "残っています。三菱UFJ FG、ディスコ、ソフトバンクGなどはPER未取得があり、一部銘柄は20営業日反応が未到達です。未取得値は点数に混ぜず、条件付きまたは監視として扱います。",
  },
  {
    "質問": "6月に何を見れば判定できるのか",
    "回答": "米CPI、FOMC後の米10年金利、日銀後の為替と銀行株反応、日経平均/TOPIXの75日線、各銘柄の決算後20営業日反応を確認します。",
  },
  {
    "質問": "外す条件は何か",
    "回答": "下方修正、利益成長の鈍化、決算後の指数劣後、75日線割れ、金利急騰、円高ショック、過熱後の急落などです。重大停止が重なる場合は、点数が残っていても外す方向で扱います。",
  },
];

const checkRows = [
  {
    "区分": "マクロ",
    "確認項目": "米CPI",
    "判定基準": "市場予想以下なら良好。市場予想比+0.3pt以上なら悪化。",
    "反映": "高PER、半導体、AI関連の扱いに反映。",
  },
  {
    "区分": "マクロ",
    "確認項目": "FOMC後の米10年金利",
    "判定基準": "+10bp以内なら良好。+25bp超なら悪化。",
    "反映": "金利上昇に弱い銘柄を保留または監視へ下げる。",
  },
  {
    "区分": "日本市場",
    "確認項目": "日銀後の為替と銀行株",
    "判定基準": "急な円高や銀行株下落がなければ確認継続。円高2%以上や銀行株指数劣後なら悪化。",
    "反映": "銀行、輸出、商社、半導体の扱いに反映。",
  },
  {
    "区分": "市場全体",
    "確認項目": "日経平均/TOPIXと75日線",
    "判定基準": "75日線上なら確認継続。明確に下回り5営業日で-5%超なら停止条件。",
    "反映": "個別株選定を一時停止し、現金比率または指数比較へ戻す。",
  },
  {
    "区分": "個別",
    "確認項目": "決算後20営業日反応",
    "判定基準": "TOPIX比+3%以上なら良好。-3%以上劣後なら悪化。",
    "反映": "残す、保留、外すの直接条件にする。",
  },
  {
    "区分": "個別",
    "確認項目": "PER/PBR/ROEと利益成長",
    "判定基準": "高PER/PBRを利益成長、ROE、決算後反応で説明できるか確認。",
    "反映": "説明できなければ中心候補から下げる。",
  },
];

const shareTextRows = [
  {
    "用途": "短文共有",
    "文章": "NISA 1年保有テストに向け、候補10社を実データで整理しました。株価・業績・PER/PBR/ROE・決算後反応をもとに、中心確認、条件付き確認、監視へ分類しています。質的テーマは直接加点せず、確認条件と警戒条件として扱う形にしています。",
  },
  {
    "用途": "短文共有",
    "文章": "現時点では購入確定ではなく、6月のCPI・日銀・FOMC後に再判定する前提です。今後は市場条件、金利、為替、75日線、各銘柄の決算後20営業日反応を入れて、残す・保留・外すを判断します。",
  },
  {
    "用途": "短文共有",
    "文章": "目標は、S&P500投信や日経平均/TOPIXを保有するだけの場合より、1年で+1%上回る根拠を説明できる候補に絞ることです。根拠が弱い場合は、個別株比率を下げる判断につなげます。",
  },
];

write("674_explanation_pack_summary_1530.csv", toCsv(summaryRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("675_explanation_pack_qa_1530.csv", toCsv(qaRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("676_explanation_pack_remaining_checks_1530.csv", toCsv(checkRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("677_explanation_pack_share_text_1530.csv", toCsv(shareTextRows.map((row) => ({ "作成": generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const candidateCards = candidates.slice(0, 5).map((row) => `<article class="card">
  <b>${esc(row["銘柄"])}</b>
  <span>${esc(row["暫定区分"])}</span>
  <p>${esc(row["量的根拠"])}</p>
  <p><strong>注意:</strong> ${esc(row["注意点"])}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>15:30説明補強パック</title>
  <style>
    :root {
      --ink:#061d33;
      --muted:#263f58;
      --blue:#0b5e94;
      --navy:#082f53;
      --line:#c8dbea;
      --bg:#f5f8fb;
      --soft:#eef7ff;
      --green:#087a55;
      --orange:#b45f06;
      --red:#b42318;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.7; }
    header { background:#082f53; color:#fff; padding:30px 34px; }
    header h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    header p { margin:0; color:#fff; font-weight:700; }
    main { max-width:1280px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:22px; }
    .lead { font-size:17px; font-weight:800; color:#111; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .kpi { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; }
    .kpi .num { font-size:28px; font-weight:900; color:#064f79; }
    .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; }
    .card b { display:block; font-size:17px; }
    .card span { display:inline-block; margin:6px 0; padding:3px 8px; border-radius:999px; background:#e7f1fa; color:#06395b; font-weight:800; }
    .card p { margin:7px 0 0; color:#111; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; min-width:1050px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:820px; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:800; }
    @media (max-width:860px) {
      header { padding:24px 18px; }
      main { padding:12px; }
      .grid, .cards { grid-template-columns:1fr; }
      table { font-size:12px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>15:30説明補強パック</h1>
    <p>作成: ${esc(generatedAt)} / 14:30暫定報告を説明しやすくするための要約・想定質問・残確認</p>
  </header>
  <main>
    <section>
      <h2>1. 一言でいうと</h2>
      <p class="lead">NISA 1年保有テストに向け、10社を「6月イベント後に再判定できる状態」まで整理しました。現時点では購入確定ではなく、指数や投信を持つだけの場合より+1%上回る根拠を確認できるかを見る段階です。</p>
      <div class="grid">
        <div class="kpi"><div class="num">${candidates.length}</div><b>検証対象</b><div>実データ接続済み</div></div>
        <div class="kpi"><div class="num">${candidates.filter((row) => row["暫定区分"].includes("中心")).length}</div><b>中心確認</b><div>優先確認枠</div></div>
        <div class="kpi"><div class="num">${candidates.filter((row) => row["暫定区分"] === "条件付き確認").length}</div><b>条件付き</b><div>不足補完後に再評価</div></div>
        <div class="kpi"><div class="num">${candidates.filter((row) => row["暫定区分"] === "監視").length}</div><b>監視</b><div>条件改善待ち</div></div>
      </div>
    </section>

    <section>
      <h2>2. 説明の要点</h2>
      ${table(summaryRows, "narrow")}
    </section>

    <section>
      <h2>3. 上位確認枠</h2>
      <div class="cards">${candidateCards}</div>
      <div class="note" style="margin-top:12px">中心確認は「優先して確認する枠」です。6月イベント後に市場条件と個別条件を入力し、残す・保留・外すを再判定します。</div>
    </section>

    <section>
      <h2>4. 想定質問と回答</h2>
      ${table(qaRows)}
    </section>

    <section>
      <h2>5. 残確認リスト</h2>
      ${table(checkRows)}
    </section>

    <section>
      <h2>6. 重大停止条件</h2>
      ${table(stopRules, "narrow")}
    </section>

    <section>
      <h2>7. 共有用短文</h2>
      ${table(shareTextRows, "narrow")}
    </section>

    <section>
      <h2>8. 関連リンク</h2>
      <div class="links">
        <a href="interim_candidate_result_1430_20260527.html">14:30暫定報告</a>
        <a href="june_event_recheck_sheet_20260527.html">6月イベント後 再判定シート</a>
        <a href="june_recheck_input_criteria_20260527.html">入力基準表</a>
        <a href="674_explanation_pack_summary_1530.csv">要約CSV</a>
        <a href="675_explanation_pack_qa_1530.csv">想定質問CSV</a>
        <a href="676_explanation_pack_remaining_checks_1530.csv">残確認CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("explanation_pack_1530_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  candidates: candidates.length,
  qa: qaRows.length,
  checks: checkRows.length,
  output: "explanation_pack_1530_20260527.html",
}, null, 2));
