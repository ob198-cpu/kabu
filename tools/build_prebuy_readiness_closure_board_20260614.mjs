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

function readText(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
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
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = Object.keys(rows[0] ?? {})) {
  const body = rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${headers.join(",")}\n${body}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/未完了|停止|不可|0円|未入力|要入力|未確認|除外/.test(s)) return "bad";
  if (/一部|注意|確認|保留|条件|準備済み/.test(s)) return "warn";
  if (/完了|接続済み|通過|済み|利用可/.test(s)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${statusClass(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

const events = parseCsv(readText("102_june_event_result_input.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));
const finances = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));
const strict = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const orders = parseCsv(readText("nisa_account_order_ticket_template_20260614.csv"));

const missingEvents = events.filter((e) => e.current_status === "未入力" || !e.current_status);
const attentionEvents = events.filter((e) => e.current_status === "注意");
const readyAccounts = accounts.filter((a) => a.account_ready !== "購入不可");
const orderPositive = orders.filter((o) => !/^0円$/.test(o.order_upper_yen || ""));
const financialPass = finances.filter((f) => f.financial_status === "pass");
const financialPartial = finances.filter((f) => f.financial_status === "partial");
const universeExcluded = strict.filter((s) => s.universe_status === "除外");
const universeWatch = strict.filter((s) => s.universe_status === "監視");
const universeCandidate = strict.filter((s) => s.universe_status === "再選定候補");

const overallStop = missingEvents.length > 0 || readyAccounts.length === 0 || orderPositive.length === 0;

const gateRows = [
  {
    項目: "6月イベント",
    現状: missingEvents.length ? `未完了: ${missingEvents.length}件未入力 / 注意${attentionEvents.length}件` : attentionEvents.length ? `一部注意: ${attentionEvents.length}件` : "完了",
    完了条件: "日銀、FOMC、最終購入前確認を入力し、緑/黄/赤を確定する",
    次の作業: "6/15〜6/18の実数を入力する",
    買付への影響: missingEvents.length ? "0円" : attentionEvents.length ? "36万円上限" : "84万円上限",
  },
  {
    項目: "NISA口座・本人操作",
    現状: readyAccounts.length ? `一部確認済み: ${readyAccounts.length}/${accounts.length}口座` : `未完了: ${accounts.length}口座すべて未確認`,
    完了条件: "本人名義スマホ、本人ログイン、NISA口座区分、残枠、二段階認証を確認",
    次の作業: "本人別に口座情報を入力する",
    買付への影響: readyAccounts.length ? "確認済み口座だけ注文票へ進む" : "0円",
  },
  {
    項目: "注文票",
    現状: orderPositive.length ? `一部金額あり: ${orderPositive.length}行` : "未完了: 全行0円",
    完了条件: "イベントゲートと口座ゲートの両方がそろった口座だけ金額を出す",
    次の作業: "イベント・口座確認後に再生成する",
    買付への影響: orderPositive.length ? "本人確認後に使用候補" : "0円",
  },
  {
    項目: "候補10社の財務確認",
    現状: `一部完了: pass ${financialPass.length}/10、partial ${financialPartial.length}/10`,
    完了条件: "未確認数値を点数に混ぜず、partial銘柄は公式IR確認後に扱う",
    次の作業: "条件付き候補のPER/PBR/ROE、利益率、受注・セグメント寄与を補完",
    買付への影響: "partial銘柄は比率を上げない",
  },
  {
    項目: "候補分類",
    現状: `再選定候補 ${universeCandidate.length}社 / 監視 ${universeWatch.length}社 / 除外 ${universeExcluded.length}社`,
    完了条件: "除外銘柄は価格・反応・下落理由が改善するまで初回買付不可",
    次の作業: "除外・監視銘柄を注文票へ入れない状態を維持",
    買付への影響: "中心候補を優先、監視・除外は抑制",
  },
  {
    項目: "指数比較 +1%目標",
    現状: "接続済み。実測入力は購入後に開始",
    完了条件: "20営業日・60営業日でS&P500/TOPIXとの差を記録",
    次の作業: "購入後の基準日と比較指数を記録する",
    買付への影響: "劣後時は追加停止または0円",
  },
  {
    項目: "上値・下値・途中決済",
    現状: "完了: 銘柄別ルールを作成済み",
    完了条件: "買付後の価格と指数差を記録してルールを適用",
    次の作業: "購入後に買値を入力する",
    買付への影響: "高リスク銘柄ほど浅い下落で追加停止",
  },
  {
    項目: "記録・検証",
    現状: "準備済み。実運用記録は未開始",
    完了条件: "買う理由、買わない条件、比較指数、途中決済理由を記録",
    次の作業: "初回購入判断時に記録表へ入力",
    買付への影響: "記録できない場合はテスト価値が下がるため保留",
  },
];

const nextRows = [
  {
    優先: "1",
    作業: "日銀会合の結果入力",
    期限目安: "6/15〜6/16",
    見る数値: "政策変更、ドル円、日経平均/TOPIX、銀行・商社・輸出株反応",
    結果: "緑/黄/赤を決める",
  },
  {
    優先: "2",
    作業: "FOMCの結果入力",
    期限目安: "6/16〜6/17",
    見る数値: "米10年金利、NASDAQ、SOX、ドル円、ハイテク株反応",
    結果: "半導体・高PER候補の比率を決める",
  },
  {
    優先: "3",
    作業: "本人別NISA口座確認",
    期限目安: "6/18前",
    見る数値: "本人スマホ、本人ログイン、NISA区分、残枠、二段階認証",
    結果: "口座別注文票を0円から更新できるか決める",
  },
  {
    優先: "4",
    作業: "最終購入前確認",
    期限目安: "6/18以降",
    見る数値: "候補別株価、PER/PBR/ROE、直近下落、未確認データ、証券会社画面",
    結果: "84万円・36万円・0円のどれかに確定する",
  },
];

const headlineRows = [
  {
    判定: overallStop ? "購入不可" : "小口検討",
    買付上限: overallStop ? "0円" : "36万円または84万円",
    理由: overallStop
      ? "イベント未入力、本人別口座未確認、注文票0円が残っているため"
      : "最低限の入力がそろったため。最終確認後に金額を決める",
    次に見るもの: "日銀、FOMC、本人別NISA口座、最終購入前確認",
  },
];

writeCsv("prebuy_readiness_closure_board_20260614.csv", gateRows);
writeCsv("prebuy_readiness_next_actions_20260614.csv", nextRows);
writeCsv("prebuy_readiness_headline_20260614.csv", headlineRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6/18前 実行準備クロージングボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1560px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--warn);background:#fff7e7;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .danger{border-left-color:var(--red);background:#fff1f1}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6/18前 実行準備クロージングボード</h1>
  <p>6月の購入判断に進む前に、未完了項目、完了条件、次の作業、買付上限への影響を1枚で確認します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice danger">現在は ${esc(headlineRows[0].判定)} です。買付上限は ${esc(headlineRows[0].買付上限)} です。理由: ${esc(headlineRows[0].理由)}</p>
    <div class="cards">
      <div class="card"><b>イベント未入力</b><strong>${missingEvents.length}件</strong><span>日銀・FOMC・最終確認</span></div>
      <div class="card"><b>口座確認済み</b><strong>${readyAccounts.length}/${accounts.length}</strong><span>本人操作・NISA区分</span></div>
      <div class="card"><b>財務pass</b><strong>${financialPass.length}/10</strong><span>partialは比率を上げない</span></div>
      <div class="card"><b>注文票</b><strong>${orderPositive.length}行</strong><span>現時点は全て0円</span></div>
    </div>
  </section>

  <section>
    <h2>ゲート別の進捗</h2>
    ${table(["項目", "現状", "完了条件", "次の作業", "買付への影響"], gateRows, {
      現状: "220px",
      完了条件: "320px",
      次の作業: "300px",
      買付への影響: "180px",
    })}
  </section>

  <section>
    <h2>次にやること</h2>
    ${table(["優先", "作業", "期限目安", "見る数値", "結果"], nextRows, {
      見る数値: "430px",
      結果: "260px",
    })}
  </section>

  <section>
    <h2>関連画面</h2>
    <ul>
      <li><a href="june_event_input_decision_board_20260614.html">6月イベント入力・判定ボード</a></li>
      <li><a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a></li>
      <li><a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1%目標 資金配分スイッチ</a></li>
      <li><a href="ticker_trade_rule_matrix_20260614.html">候補10社 上値・下値・途中決済ルール</a></li>
      <li><a href="candidate10_financial_confirmation_gate_20260614.html">候補10社 財務確認ゲート</a></li>
    </ul>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入実行ではなく、購入判断前の未完了項目を閉じるための確認表です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "prebuy_readiness_closure_board_20260614.html"), html, "utf8");

function insertBefore(file, needle, block, marker) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return false;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes(marker)) return false;
  const index = text.indexOf(needle);
  if (index < 0) return false;
  text = `${text.slice(0, index)}${block}\n${text.slice(index)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

const indexCard = `        <a class="card" href="prebuy_readiness_closure_board_20260614.html">
          <b>6/18前 実行準備クロージングボード</b>
          <span>イベント、口座、候補10社、指数比較、注文票、記録の未完了項目を1枚で確認。</span>
        </a>`;
const hubCard = `        <a class="link-card" href="prebuy_readiness_closure_board_20260614.html">
          <b>6/18前 実行準備クロージングボード</b>
          <span>イベント、口座、候補10社、指数比較、注文票、記録の未完了項目を1枚で確認。</span>
        </a>`;
const cockpitLink = `    <li><a href="prebuy_readiness_closure_board_20260614.html">6/18前 実行準備クロージングボード</a></li>`;

insertBefore("index.html", '<a class="secondary" href="june_event_gate_engine.html"', `${indexCard}\n`, "prebuy_readiness_closure_board_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_prebuy_final_verification_20260613.html"', `${hubCard}\n`, "prebuy_readiness_closure_board_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "prebuy_readiness_closure_board_20260614.html");

console.log("generated prebuy_readiness_closure_board_20260614.html");
