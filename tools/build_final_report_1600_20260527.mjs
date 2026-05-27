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
const summary = parseCsv(read("674_explanation_pack_summary_1530.csv"));
const qa = parseCsv(read("675_explanation_pack_qa_1530.csv"));
const checks = parseCsv(read("676_explanation_pack_remaining_checks_1530.csv"));
const shareText = parseCsv(read("677_explanation_pack_share_text_1530.csv"));
const hardStops = parseCsv(read("669_june_recheck_hard_stop_criteria.csv"));

const center = candidates.filter((row) => row["暫定区分"] === "中心確認" || row["暫定区分"] === "追加確認付き中心");
const conditional = candidates.filter((row) => row["暫定区分"] === "条件付き確認");
const watch = candidates.filter((row) => row["暫定区分"] === "監視");

const resultRows = [
  {
    "区分": "本日の成果",
    "内容": "100社前後の候補群から、実データを接続した10社の検証対象を整理し、6月再判定用の候補表、入力基準表、説明補強資料まで作成した。",
    "状態": "完了",
  },
  {
    "区分": "候補分類",
    "内容": `中心確認${center.length}社、条件付き確認${conditional.length}社、監視${watch.length}社に分けた。`,
    "状態": "完了",
  },
  {
    "区分": "評価方法",
    "内容": "量的評価を主軸にし、質的テーマは直接加点せず、確認条件・警戒条件・除外条件として扱う方針に統一した。",
    "状態": "完了",
  },
  {
    "区分": "6月判断",
    "内容": "CPI、日銀、FOMC、米金利、為替、日経平均/TOPIX、決算後20営業日反応を入力して、残す・保留・外すを再判定する。",
    "状態": "次工程",
  },
  {
    "区分": "運用目標",
    "内容": "S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%上回る根拠を説明できる候補に絞る。",
    "状態": "継続確認",
  },
];

const finalCandidateRows = candidates.map((row) => ({
  "順位": row["順位"],
  "銘柄": row["銘柄"],
  "分類": row["暫定区分"],
  "補正後点": row["補正後点"],
  "データ充足": row["データ充足"],
  "主な根拠": row["量的根拠"],
  "質的テーマ": row["質的テーマ"],
  "注意点": row["注意点"],
  "6月に確認する条件": row["6月に残す条件"],
  "外す条件": row["外す条件"],
}));

const nextTaskRows = [
  {
    "時期": "本日16:00時点",
    "作業": "候補10社、評価ロジック、残確認項目、想定質問を報告できる状態にする。",
    "成果物": "本ページ、14:30暫定報告、15:30説明補強パック",
  },
  {
    "時期": "5/28",
    "作業": "PER未取得、20営業日未到達、業種別比較、決算後反応の不足を追加確認する。",
    "成果物": "不足データ補完表、候補の上げ下げ履歴",
  },
  {
    "時期": "6月上旬",
    "作業": "CPI前後の市場反応、米金利、VIX、日経平均/TOPIXの75日線を記録する。",
    "成果物": "市場ゲート入力表",
  },
  {
    "時期": "6月中旬",
    "作業": "日銀、FOMC後に10社を再判定し、残す・保留・外すを更新する。",
    "成果物": "6月再判定結果表",
  },
  {
    "時期": "購入検討前",
    "作業": "証券会社画面、最新決算、適時開示、各社IRで最終確認する。",
    "成果物": "購入可否確認リスト",
  },
];

const lineRows = [
  {
    "用途": "LINE共有",
    "文章": "本日は、NISA 1年保有テストに向けて候補10社を実データで整理し、中心確認・条件付き確認・監視に分類しました。株価、業績、PER/PBR/ROE、決算後反応、下落率を確認し、質的テーマは直接加点せず確認条件として扱う形にしています。",
  },
  {
    "用途": "LINE共有",
    "文章": "現時点では購入確定ではなく、6月のCPI・日銀・FOMC後に、米金利、為替、日経平均/TOPIX、各銘柄の決算後反応を入れて再判定します。目標は、指数や投信を保有するだけの場合より1年で+1%上回る根拠を説明できる候補に絞ることです。",
  },
  {
    "用途": "LINE共有",
    "文章": "現在の中心確認は三井住友FG、味の素、TDK、住友商事です。三菱UFJ FGは条件付き確認、その他は監視として、6月までに不足データと市場条件を確認します。",
  },
];

write("678_final_report_1600_summary.csv", toCsv(resultRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("679_final_report_1600_candidates.csv", toCsv(finalCandidateRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("680_final_report_1600_next_tasks.csv", toCsv(nextTaskRows.map((row) => ({ "作成": generatedAt, ...row }))));
write("681_final_report_1600_line_text.csv", toCsv(lineRows.map((row) => ({ "作成": generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function badgeClass(label) {
  if (label === "中心確認") return "good";
  if (label === "追加確認付き中心") return "blue";
  if (label === "条件付き確認") return "warn";
  return "muted";
}

const candidateCards = candidates.map((row) => `<article class="candidate">
  <div class="badge ${badgeClass(row["暫定区分"])}">${esc(row["暫定区分"])}</div>
  <h3>${esc(row["順位"])}. ${esc(row["銘柄"])}</h3>
  <div class="score">${esc(row["補正後点"])}点 <span>${esc(row["データ充足"])}</span></div>
  <p><b>根拠</b>${esc(row["量的根拠"])}</p>
  <p><b>テーマ</b>${esc(row["質的テーマ"])}</p>
  <p><b>注意</b>${esc(row["注意点"])}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日報告 16:00版</title>
  <style>
    :root {
      --ink:#061d33;
      --muted:#2a4157;
      --blue:#0b5e94;
      --navy:#082f53;
      --line:#c8dbea;
      --bg:#f5f8fb;
      --soft:#eef7ff;
      --green:#087a55;
      --orange:#b45f06;
      --red:#b42318;
      --slate:#64748b;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.7; }
    header { background:linear-gradient(135deg,#082f53,#124d77); color:#fff; padding:32px 36px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1.2; }
    header p { margin:0; color:#fff; font-weight:700; }
    main { max-width:1320px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:22px; }
    h3 { margin:8px 0; font-size:18px; }
    .lead { font-size:18px; font-weight:900; color:#111; margin:0 0 12px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .kpi { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; min-height:112px; }
    .kpi .num { font-size:32px; font-weight:900; color:#064f79; line-height:1.1; }
    .kpi b { display:block; margin:4px 0; color:#061d33; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:700; }
    .candidates { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .candidate { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; }
    .candidate p { margin:8px 0 0; color:#111; }
    .candidate b { display:inline-block; min-width:48px; color:#06395b; }
    .score { font-size:18px; font-weight:900; }
    .score span { font-size:13px; color:#334155; margin-left:8px; }
    .badge { display:inline-block; border-radius:999px; padding:3px 9px; font-size:12px; font-weight:900; border:1px solid var(--line); }
    .badge.good { background:#eaf8f1; color:#087a55; border-color:#a8d8c1; }
    .badge.blue { background:#e7f1fa; color:#064f79; border-color:#aacce2; }
    .badge.warn { background:#fff6e8; color:#9a4b00; border-color:#efc98e; }
    .badge.muted { background:#f1f5f9; color:#475569; border-color:#cbd5e1; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; min-width:1120px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:860px; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:800; }
    .print-note { color:#334155; font-size:12px; }
    @media print {
      body { background:#fff; }
      header { background:#082f53 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      section { box-shadow:none; }
      .links { display:none; }
    }
    @media (max-width:860px) {
      header { padding:24px 18px; }
      main { padding:12px; }
      .grid, .candidates { grid-template-columns:1fr; }
      table { font-size:12px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>本日報告 16:00版</h1>
    <p>作成: ${esc(generatedAt)} / NISA 1年保有テスト 候補10社の整理と6月再判定計画</p>
  </header>
  <main>
    <section>
      <h2>1. 本日の結論</h2>
      <p class="lead">候補10社を実データで整理し、6月イベント後に「残す・保留・外す」を再判定できる状態まで進みました。現時点では購入確定ではありません。</p>
      <div class="grid">
        <div class="kpi"><div class="num">${candidates.length}</div><b>検証対象</b><div>実データ接続済み</div></div>
        <div class="kpi"><div class="num">${center.length}</div><b>中心確認</b><div>三井住友FG、味の素、TDK、住友商事</div></div>
        <div class="kpi"><div class="num">${conditional.length}</div><b>条件付き確認</b><div>三菱UFJ FG</div></div>
        <div class="kpi"><div class="num">${watch.length}</div><b>監視</b><div>条件改善まで中心候補にしない</div></div>
      </div>
      <div class="note" style="margin-top:12px">目標は、S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%上回る根拠を説明できる候補に絞ることです。</div>
    </section>

    <section>
      <h2>2. 本日の成果</h2>
      ${table(resultRows, "narrow")}
    </section>

    <section>
      <h2>3. 候補10社</h2>
      <div class="candidates">${candidateCards}</div>
    </section>

    <section>
      <h2>4. 候補一覧 詳細</h2>
      ${table(finalCandidateRows)}
    </section>

    <section>
      <h2>5. 説明時の想定質問</h2>
      ${table(qa.slice(0, 8))}
    </section>

    <section>
      <h2>6. 6月までの確認事項</h2>
      ${table(checks)}
    </section>

    <section>
      <h2>7. 重大停止条件</h2>
      ${table(hardStops, "narrow")}
    </section>

    <section>
      <h2>8. 次の作業</h2>
      ${table(nextTaskRows, "narrow")}
    </section>

    <section>
      <h2>9. 共有用文章</h2>
      ${table(lineRows, "narrow")}
    </section>

    <section>
      <h2>10. 関連リンク</h2>
      <div class="links">
        <a href="678_final_report_1600_summary.csv">本日成果CSV</a>
        <a href="679_final_report_1600_candidates.csv">候補10社CSV</a>
        <a href="680_final_report_1600_next_tasks.csv">次作業CSV</a>
        <a href="681_final_report_1600_line_text.csv">共有文CSV</a>
        <a href="final_report_1600_20260527.pdf">PDF版</a>
        <a href="interim_candidate_result_1430_20260527.html">14:30暫定報告</a>
        <a href="explanation_pack_1530_20260527.html">15:30説明補強パック</a>
        <a href="june_event_recheck_sheet_20260527.html">6月再判定シート</a>
      </div>
      <div class="print-note">PDF版はHTML版と同じ内容を固定資料として保存したものです。</div>
    </section>
  </main>
</body>
</html>`;

write("final_report_1600_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  candidates: candidates.length,
  center: center.length,
  conditional: conditional.length,
  watch: watch.length,
  output: "final_report_1600_20260527.html",
}, null, 2));
