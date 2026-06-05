import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ""))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

const n = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rows = parseCsv(fs.readFileSync(path.join(ROOT, "887_quantum_physical_ai_quant_connection_20260605.csv"), "utf8"));

function priority(row) {
  if (row.channel === "量子コンピューター") return 80 + Number(row.candidateRank);
  if (row.quantGate === "数値確認済み") return 1;
  if (row.ticker === "6954.T") return 2;
  if (row.ticker === "6861.T") return 3;
  if (row.ticker === "6594.T") return 4;
  if (row.ticker === "6506.T") return 5;
  if (row.ticker === "6645.T") return 6;
  if (row.ticker === "6981.T") return 7;
  if (row.ticker === "6273.T") return 8;
  if (row.ticker === "6479.T") return 9;
  if (row.ticker === "6324.T") return 10;
  return 99;
}

function action(row) {
  if (row.channel === "量子コンピューター") {
    return {
      lane: "長期探索",
      action: "公式IRで量子関連の商用化、受注、売上寄与を確認",
      decisionAfter: "量子単独では購入候補にしない。商用売上が確認できるまで観察枠。",
      why: "1年NISAではテーマ性だけだと株価への説明力が弱い。",
    };
  }
  if (row.quantGate === "数値確認済み") {
    return {
      lane: "候補化テスト",
      action: "決算後反応、受注、テーマ寄与を確認し、既存総合候補と横並び比較",
      decisionAfter: "通過すればフィジカルAI枠の代表候補として残す。",
      why: "既存100社スコアと主要指標は接続済みのため、次は事業寄与とイベント反応を確認する段階。",
    };
  }
  if (row.matched === "未接続") {
    return {
      lane: "データ補完",
      action: "既存100社表に追加するため、PER/PBR/ROE、株価指標、決算成長、最大下落率を取得",
      decisionAfter: "接続できるまで購入候補にしない。",
      why: "同じ数式・同じ列で比較できないため。",
    };
  }
  if (row.quantGate === "保留") {
    return {
      lane: "保留理由の解消",
      action: "保留理由を分解し、過熱、下落、低スコア、リスク減点のどれが原因か確認",
      decisionAfter: "保留理由が解消しなければ観察または除外。",
      why: "テーマ性があっても、下落耐性や割高度で落ちる可能性があるため。",
    };
  }
  return {
    lane: "観察から昇格検討",
    action: "不足している決算後反応、受注、事業寄与を確認",
    decisionAfter: "既存総合候補を上回る説明ができれば候補化。",
    why: "数値は接続できたが、まだ購入候補へ進める根拠が足りないため。",
  };
}

const queue = rows
  .map((row) => {
    const a = action(row);
    const score = n(row.universeScore);
    const ret1y = n(row.ret1y);
    const dd = n(row.maxDrawdown60);
    const per = row.per || "未取得";
    return {
      priority: priority(row),
      channel: row.channel,
      ticker: row.ticker,
      name: row.name,
      lane: a.lane,
      quantGate: row.quantGate,
      universeScore: row.universeScore || "未接続",
      currentNumbers: `既存スコア ${score ?? "未接続"} / PER ${per} / 1年騰落 ${ret1y ?? "未取得"}% / 60日最大下落 ${dd ?? "未取得"}%`,
      action: a.action,
      decisionAfter: a.decisionAfter,
      why: a.why,
      immediateUse: row.channel === "フィジカルAI" && priority(row) <= 5 ? "高" : row.channel === "フィジカルAI" ? "中" : "低",
    };
  })
  .sort((a, b) => a.priority - b.priority);

const headers = ["priority", "channel", "ticker", "name", "lane", "quantGate", "universeScore", "currentNumbers", "action", "decisionAfter", "why", "immediateUse"];
const csv = [
  headers.join(","),
  ...queue.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
].join("\n");

function table(list) {
  return list.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><b>${esc(row.ticker)} ${esc(row.name)}</b><br><small>${esc(row.channel)}</small></td>
      <td><span class="badge ${row.immediateUse === "高" ? "good" : row.immediateUse === "中" ? "hold" : "watch"}">${esc(row.immediateUse)}</span><br>${esc(row.lane)}</td>
      <td>${esc(row.currentNumbers)}</td>
      <td>${esc(row.action)}</td>
      <td>${esc(row.decisionAfter)}</td>
      <td>${esc(row.why)}</td>
    </tr>
  `).join("");
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>フィジカルAI・量子 昇格作業キュー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--good:#0b6b4f;--hold:#a85b00;--watch:#455a6f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1460px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:800;border-radius:8px}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}.card b{display:block;color:var(--navy);font-size:17px}.card strong{display:block;font-size:28px;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1260px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;font-size:12px}.badge.good{background:var(--good)}.badge.hold{background:var(--hold)}.badge.watch{background:var(--watch)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1120px}}
  </style>
</head>
<body>
<header>
  <h1>フィジカルAI・量子 昇格作業キュー</h1>
  <p>作成: ${esc(generatedAt)} / テーマ候補を購入候補へ上げるために、次に何を確認するかを優先順位化した表です。</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="notice">次に進めるべき中心はフィジカルAIです。量子は重要テーマですが、1年NISAの購入候補にするには商用売上・受注・株価反応の証拠が不足しています。したがって、当面はTDK、ファナック、キーエンス、ニデック、安川電機を優先して補完します。</p>
    <div class="cards">
      <div class="card"><b>最優先</b><strong>5社</strong><span>TDK、ファナック、キーエンス、ニデック、安川電機</span></div>
      <div class="card"><b>目的</b><strong>昇格判定</strong><span>購入候補に上げられるか、保留かを分ける</span></div>
      <div class="card"><b>量子</b><strong>探索継続</strong><span>商用売上・受注が見えるまで購入候補化しない</span></div>
    </div>
    <div class="links">
      <a href="888_quantum_physical_ai_promotion_queue_20260605.csv">CSVを開く</a>
      <a href="887_quantum_physical_ai_quant_connection_20260605.html">既存数値接続チェック</a>
      <a href="886_quantum_physical_ai_screening_20260605.html">候補整理</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. 作業キュー</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th style="width:48px">順</th><th style="width:210px">銘柄</th><th style="width:130px">優先/段階</th><th>現時点の数字</th><th>次にする作業</th><th>作業後の判断</th><th>理由</th></tr>
        </thead>
        <tbody>${table(queue)}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 今日以降の扱い</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>分類</th><th>扱い</th><th>理由</th></tr></thead>
        <tbody>
          <tr><td>すぐ比較に進める</td><td>TDK</td><td>既存100社データに接続済みで、数値ゲートは通過。決算後反応とテーマ寄与の確認へ進める。</td></tr>
          <tr><td>追加確認で候補化可能性あり</td><td>ファナック、キーエンス、ニデック、安川電機</td><td>フィジカルAIの実需に近いが、不足データまたは保留理由がある。</td></tr>
          <tr><td>観察・保留</td><td>SMC、オムロン、村田製作所、ハーモニック、ミネベアミツミ</td><td>テーマ性はあるが、スコア、過熱、業績回復、未接続の問題がある。</td></tr>
          <tr><td>長期探索</td><td>量子コンピューター10社</td><td>国策テーマとして監視するが、1年NISAの購入候補にはまだしない。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "888_quantum_physical_ai_promotion_queue_20260605.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "888_quantum_physical_ai_promotion_queue_20260605.html"), html, "utf8");

for (const file of ["index.html", "practical_action_dashboard_20260528.html", "887_quantum_physical_ai_quant_connection_20260605.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("888_quantum_physical_ai_promotion_queue_20260605.html")) continue;
  const link = '<a class="button secondary" href="888_quantum_physical_ai_promotion_queue_20260605.html">フィジカルAI・量子 昇格作業キュー</a>';
  if (text.includes("887_quantum_physical_ai_quant_connection_20260605.html")) {
    text = text.replace(/(<a[^>]+href="887_quantum_physical_ai_quant_connection_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
    fs.writeFileSync(filePath, text, "utf8");
  }
}

console.log("wrote 888_quantum_physical_ai_promotion_queue_20260605.html");
console.log("wrote 888_quantum_physical_ai_promotion_queue_20260605.csv");
