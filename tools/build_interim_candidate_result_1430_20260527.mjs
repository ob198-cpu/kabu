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

function num(value) {
  const m = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function classLabel(priority) {
  if (priority.startsWith("A ")) return "中心確認";
  if (priority.startsWith("A-")) return "追加確認付き中心";
  if (priority.startsWith("B ")) return "条件付き確認";
  return "監視";
}

function className(priority) {
  if (priority.startsWith("A ")) return "rankA";
  if (priority.startsWith("A-")) return "rankAm";
  if (priority.startsWith("B ")) return "rankB";
  return "rankC";
}

function scoreBar(score) {
  const n = Math.max(0, Math.min(100, num(score) ?? 0));
  return `<div class="bar"><span style="width:${n}%"></span></div>`;
}

function compactNumbers(row) {
  return row.key_numbers
    .replaceAll("最終補正", "補正")
    .replaceAll("決算後反応", "反応")
    .split(" / ")
    .filter((part) => !part.includes("データ"))
    .join(" / ");
}

const planRows = parseCsv(read("663_june_test_candidate_plan_detail.csv"));
const liveRows = parseCsv(read("659_focus10_core_watch_selection.csv"));
const ruleRows = parseCsv(read("668_june_recheck_input_criteria.csv"));
const stopRows = parseCsv(read("669_june_recheck_hard_stop_criteria.csv"));
const sectorRows = parseCsv(read("670_june_recheck_sector_criteria.csv"));

const liveByTicker = new Map(liveRows.map((row) => [row.ticker, row]));

const displayRows = planRows.map((row) => {
  const live = liveByTicker.get(row.ticker) ?? {};
  return {
    "順位": row.plan_rank,
    "銘柄": `${row.ticker} ${row.company}`,
    "暫定区分": classLabel(row.june_test_priority),
    "補正後点": row.final_selection_score,
    "データ充足": row.data_completion,
    "量的根拠": compactNumbers(row),
    "質的テーマ": row.sector_role,
    "注意点": row.caution_items,
    "6月に残す条件": row.pass_condition,
    "外す条件": row.stop_condition,
    "直近扱い": row.current_handling,
    "60日下落率": live.max_drawdown_60d_pct ? `${live.max_drawdown_60d_pct}%` : "",
  };
});

const summaryRows = [
  {
    項目: "現在の到達点",
    内容: "100社前後の母集団から、実データを入れた10社の比較表と6月再判定用の候補案まで作成済み。",
  },
  {
    項目: "候補抽出",
    内容: "10社すべてに株価・出来高・業績・決算後反応を接続し、中心確認、追加確認付き中心、条件付き確認、監視に分けた。",
  },
  {
    項目: "評価方法",
    内容: "量的評価を主軸にし、質的テーマは直接加点ではなく確認条件・警戒条件として扱う。",
  },
  {
    項目: "6月の扱い",
    内容: "CPI、日銀、FOMC、市場反応を確認してから、残す・保留・外すを再判定する。",
  },
  {
    項目: "目標",
    内容: "S&P500投信・日経平均/TOPIXを保有するだけの場合より、1年で+1%上回る根拠を説明できる候補に絞る。",
  },
];

const topSummary = {
  center: planRows.filter((row) => row.june_test_priority.startsWith("A ") || row.june_test_priority.startsWith("A-")).length,
  conditional: planRows.filter((row) => row.june_test_priority.startsWith("B ")).length,
  watch: planRows.filter((row) => row.june_test_priority.startsWith("C ")).length,
  fullData: planRows.filter((row) => row.data_completion === "10/10").length,
};

const immediateNextRows = [
  {
    時間帯: "14:30まで",
    作業: "見せる版の確認、候補区分と根拠の読み合わせ",
    成果: "顧客向け暫定ページ",
  },
  {
    時間帯: "15:30まで",
    作業: "説明文と残タスクを整理し、質問に答えやすい形へ補強",
    成果: "説明用要約、想定質問、残確認リスト",
  },
  {
    時間帯: "6月イベント後",
    作業: "CPI、日銀、FOMC、市場反応、個別材料を入力して再判定",
    成果: "残す/保留/外すの最終確認表",
  },
];

const csvRows = displayRows.map((row) => ({ generated_at: generatedAt, ...row }));
write("671_interim_candidate_result_1430.csv", toCsv(csvRows));
write("672_interim_candidate_summary_1430.csv", toCsv(summaryRows.map((row) => ({ generated_at: generatedAt, ...row }))));
write("673_interim_candidate_next_steps_1430.csv", toCsv(immediateNextRows.map((row) => ({ generated_at: generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const cards = planRows.map((row) => {
  const label = classLabel(row.june_test_priority);
  return `<article class="candidate ${className(row.june_test_priority)}">
    <div class="tag">${esc(label)}</div>
    <h3>${esc(row.plan_rank)}. ${esc(row.company)} <span>${esc(row.ticker)}</span></h3>
    <div class="score"><b>${esc(row.final_selection_score)}点</b>${scoreBar(row.final_selection_score)}</div>
    <p><b>量的根拠</b><br>${esc(compactNumbers(row))}</p>
    <p><b>質的テーマ</b><br>${esc(row.sector_role)}</p>
    <p><b>注意点</b><br>${esc(row.caution_items)}</p>
  </article>`;
}).join("");

const shortRuleRows = ruleRows.filter((row) => ["定量", "マクロ", "市場", "個別", "質的イベント"].includes(row.category));
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト 14:30暫定報告</title>
  <style>
    :root {
      --ink:#061d33;
      --muted:#22384f;
      --blue:#0b5e94;
      --navy:#082f53;
      --line:#c8dbea;
      --bg:#f5f8fb;
      --green:#087a55;
      --orange:#b45f06;
      --red:#b42318;
      --soft:#eef7ff;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.7; }
    header { background:linear-gradient(135deg,#082f53,#114d76); color:#fff; padding:30px 34px; }
    header h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    header p { margin:0; color:#fff; font-weight:700; }
    main { max-width:1320px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:22px; }
    h3 { margin:6px 0 10px; font-size:18px; }
    h3 span { font-size:13px; color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .kpi { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; }
    .kpi .num { font-size:30px; font-weight:900; color:#064f79; line-height:1.1; }
    .kpi b { display:block; margin-top:4px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:700; }
    .candidates { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .candidate { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fff; position:relative; overflow:hidden; }
    .candidate:before { content:""; position:absolute; left:0; top:0; bottom:0; width:7px; background:var(--blue); }
    .candidate.rankA:before { background:var(--green); }
    .candidate.rankAm:before { background:#0b6fa4; }
    .candidate.rankB:before { background:var(--orange); }
    .candidate.rankC:before { background:#64748b; }
    .tag { display:inline-block; padding:3px 8px; border-radius:999px; border:1px solid var(--line); background:#f1f7fc; font-weight:800; color:#06395b; font-size:12px; }
    .candidate p { margin:8px 0 0; color:#111; }
    .score { display:flex; align-items:center; gap:10px; }
    .score b { min-width:58px; font-size:18px; color:#061d33; }
    .bar { height:10px; flex:1; border-radius:999px; background:#e5eef6; overflow:hidden; }
    .bar span { display:block; height:100%; background:#0b6fa4; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; min-width:1120px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:880px; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:800; }
    .flow { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .step { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; }
    .step b { display:block; color:#06395b; margin-bottom:4px; }
    @media (max-width:860px) {
      header { padding:24px 18px; }
      main { padding:12px; }
      .grid, .candidates, .flow { grid-template-columns:1fr; }
      table { font-size:12px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>NISA 1年保有テスト 14:30暫定報告</h1>
    <p>作成: ${esc(generatedAt)} / 6月再判定に向けた候補10社の見せる版</p>
  </header>
  <main>
    <section>
      <h2>1. 結論</h2>
      <div class="grid">
        <div class="kpi"><div class="num">10社</div><b>検証対象</b><div>購入確定ではなく、6月再判定へ進める対象</div></div>
        <div class="kpi"><div class="num">${topSummary.center}社</div><b>中心確認</b><div>A/A-として優先的に確認</div></div>
        <div class="kpi"><div class="num">${topSummary.conditional}社</div><b>条件付き</b><div>不足補完後に中心候補へ戻せるか確認</div></div>
        <div class="kpi"><div class="num">${topSummary.watch}社</div><b>監視</b><div>条件改善まで購入候補にしない</div></div>
      </div>
      <div class="note" style="margin-top:12px">現時点では「6月イベント後に再判定できるところまで整った」という段階です。購入対象の確定ではありません。</div>
    </section>

    <section>
      <h2>2. 今日までに実施した作業</h2>
      ${table(summaryRows, "narrow")}
    </section>

    <section>
      <h2>3. 暫定候補10社</h2>
      <div class="candidates">${cards}</div>
    </section>

    <section>
      <h2>4. 詳細表</h2>
      ${table(displayRows)}
    </section>

    <section>
      <h2>5. 再判定の入力基準</h2>
      <div class="note">質的テーマは「候補を探す理由」と「確認条件」に使います。定量・マクロ・市場条件が悪い銘柄を、質的テーマだけで残す設計にはしません。</div>
      ${table(shortRuleRows, "narrow")}
    </section>

    <section>
      <h2>6. 重大停止条件</h2>
      ${table(stopRows, "narrow")}
    </section>

    <section>
      <h2>7. 業種別に見る確認ポイント</h2>
      ${table(sectorRows)}
    </section>

    <section>
      <h2>8. ここから16:00まで</h2>
      <div class="flow">
        ${immediateNextRows.map((row) => `<div class="step"><b>${esc(row.時間帯)}</b><div>${esc(row.作業)}</div><div><b>成果</b>${esc(row.成果)}</div></div>`).join("")}
      </div>
    </section>

    <section>
      <h2>9. 関連リンク</h2>
      <div class="links">
        <a href="671_interim_candidate_result_1430.csv">候補10社CSV</a>
        <a href="june_event_recheck_sheet_20260527.html">6月イベント後 再判定シート</a>
        <a href="june_recheck_input_criteria_20260527.html">入力基準表</a>
        <a href="june_test_candidate_plan_20260527.html">6月テスト候補案</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("interim_candidate_result_1430_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  candidates: planRows.length,
  center: topSummary.center,
  conditional: topSummary.conditional,
  watch: topSummary.watch,
  output: "interim_candidate_result_1430_20260527.html",
}, null, 2));
