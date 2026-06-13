import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(process.cwd());
const today = "2026年6月13日";

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>楽天モバイル・SBI証券 口座準備手順</title>
  <style>
    :root{--ink:#071827;--navy:#123d62;--blue:#0b67a3;--line:#c8dce9;--soft:#eef7fd;--warn:#fff4df;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:#f4f8fb;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.72}
    header{background:var(--navy);color:white;padding:34px 40px}
    h1{margin:0 0 10px;font-size:38px;letter-spacing:0}
    header p{margin:0;font-weight:850;font-size:19px}
    main{max-width:1380px;margin:0 auto;padding:24px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:22px;margin:0 0 20px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid;page-break-inside:avoid}
    h2{margin:0 0 15px;border-left:10px solid var(--blue);padding-left:14px;color:var(--navy);font-size:29px}
    h3{margin:18px 0 8px;color:var(--navy);font-size:22px}
    p{margin:0 0 12px}
    .lead{font-size:21px;font-weight:900}
    .note{background:var(--warn);border-left:8px solid #b86b00;border-radius:8px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:16px}
    .card b{display:block;color:var(--navy);font-size:20px;margin-bottom:6px}
    .steps{counter-reset:step;display:grid;gap:10px}
    .step{display:grid;grid-template-columns:52px 1fr;gap:12px;align-items:start;border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px}
    .step::before{counter-increment:step;content:counter(step);display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--blue);color:white;font-weight:900;font-size:21px}
    .step b{display:block;color:var(--navy);font-size:20px;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}
    th{background:#e2f0fb;color:#053b63;font-weight:900;white-space:nowrap}
    td{font-size:17px}
    .checklist td:first-child{width:92px;text-align:center;font-weight:900;color:var(--blue)}
    .danger{color:var(--red);font-weight:900}
    .source a{color:#064f84;font-weight:900}
    footer{font-size:14px;color:#526b82;margin:16px 0 0}
    @media print{body{background:white;font-size:14px}main{max-width:none;padding:8mm}header{padding:18px 20px}h1{font-size:28px}h2{font-size:22px}h3{font-size:17px}section{box-shadow:none;padding:14px}.lead,.note{font-size:14px}.grid{grid-template-columns:1fr 1fr}td,th{font-size:11px;padding:6px}.step{grid-template-columns:38px 1fr;padding:8px}.step::before{width:30px;height:30px;font-size:16px}.step b{font-size:15px}}
    @media(max-width:900px){main{padding:12px}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>楽天モバイル・SBI証券 口座準備手順</h1>
  <p>本人スマホ・本人名義・本人操作で、NISA取引に進むための準備資料です。作成日: ${today}</p>
</header>
<main>
  <section>
    <h2>1. この資料の目的</h2>
    <p class="lead">NISAで株式購入を行う前に、本人確認用スマホ、通信回線、SBI証券口座、NISA口座、出金先銀行口座をそろえるための手順をまとめます。</p>
    <div class="note">重要: 他人名義の口座を操作する前提ではなく、本人名義のスマホ、本人ログイン、本人確認、本人発注で進める前提です。</div>
    <div class="grid">
      <div class="card"><b>短期目標</b>楽天モバイルeSIM等で本人スマホを使える状態にし、SBI証券のネット口座開設を進める。</div>
      <div class="card"><b>購入前の必須条件</b>SBI証券の取引可能状態、NISA仮開設、入金、注文口座区分、二段階認証、出金先口座を確認する。</div>
    </div>
  </section>

  <section>
    <h2>2. 先に用意するもの</h2>
    <table class="checklist">
      <thead><tr><th>確認</th><th>必要なもの</th><th>用途</th><th>注意点</th></tr></thead>
      <tbody>
        <tr><td>□</td><td>マイナンバーカード</td><td>楽天モバイル本人確認、SBI証券本人確認、マイナンバー提出</td><td>NFC対応スマホがあるとSBI証券の本人確認が早い。</td></tr>
        <tr><td>□</td><td>本人名義のスマホ</td><td>eSIM開通、SMS認証、証券アプリ、二段階認証</td><td>eSIM対応機種か確認する。</td></tr>
        <tr><td>□</td><td>本人名義のメールアドレス</td><td>楽天ID、SBI証券申込、認証コード受信</td><td>家族共用ではなく本人別に分ける。</td></tr>
        <tr><td>□</td><td>楽天ID</td><td>楽天モバイル申込</td><td>本人情報と一致させる。</td></tr>
        <tr><td>□</td><td>本人名義の銀行口座</td><td>SBI証券の出金先、入出金確認</td><td>北洋銀行でも本人名義なら登録を試す。使いにくければ住信SBIネット銀行等を作る。</td></tr>
        <tr><td>□</td><td>本人名義の支払方法</td><td>楽天モバイル料金、証券関連設定</td><td>クレジットカードまたは口座振替等を確認。</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>3. 楽天モバイル加入手順</h2>
    <div class="steps">
      <div class="step"><div><b>楽天モバイル公式サイトへ進む</b>本人の楽天IDでログインし、Rakuten最強プランを選択する。</div></div>
      <div class="step"><div><b>SIMタイプを選ぶ</b>早く始めるならeSIMを選ぶ。物理カードがよければSIMカードを選ぶ。</div></div>
      <div class="step"><div><b>電話番号を選ぶ</b>新しい番号で始めるか、今の番号をMNPで引き継ぐかを選ぶ。</div></div>
      <div class="step"><div><b>本人確認を行う</b>マイナンバーカード等で本人確認を行う。入力住所と本人確認書類の住所を一致させる。</div></div>
      <div class="step"><div><b>eSIMを開通する</b>審査完了後、my 楽天モバイルアプリ等でeSIMを開通する。SMSを受け取れるか確認する。</div></div>
      <div class="step"><div><b>証券用に最低限確認する</b>電話番号、SMS、データ通信、本人のApple ID/Googleアカウント、証券アプリのインストール可否を確認する。</div></div>
    </div>
    <p class="note">eSIMはカードを差し込まないデジタルSIMです。対応スマホなら当日開通できる場合がありますが、審査、入力不備、端末非対応があると遅れます。</p>
  </section>

  <section>
    <h2>4. SBI証券 口座開設手順</h2>
    <div class="steps">
      <div class="step"><div><b>メールアドレス登録</b>SBI証券の口座開設ページで本人メールを登録し、認証コードを入力する。</div></div>
      <div class="step"><div><b>本人情報を入力</b>氏名、住所、生年月日、職業、勤務先、内部者情報などを入力する。</div></div>
      <div class="step"><div><b>特定口座とNISAを選ぶ</b>通常は特定口座「源泉徴収あり」を選び、NISAも同時申込する。既に他社NISAがある場合は要注意。</div></div>
      <div class="step"><div><b>本人確認書類を提出</b>スマホとマイナンバーカードがある場合、マイナンバーカードをスマホにかざして本人確認できる。</div></div>
      <div class="step"><div><b>初期取引パスワードを受け取る</b>審査完了後、メールまたは郵送で案内を受け取り、初期設定へ進む。</div></div>
      <div class="step"><div><b>初期設定を完了する</b>勤務先、出金先金融機関、投資経験、アンケート、取引パスワード等を設定する。</div></div>
    </div>
    <p class="note">SBI証券公式では、スマートフォンとマイナンバーカードがある場合、取引開始まで最短翌営業日と案内されています。NISAは口座開設完了通知後、2営業日程度で仮開設される流れです。</p>
  </section>

  <section>
    <h2>5. 出金先銀行口座の考え方</h2>
    <p class="lead">SBI証券では、初期設定で出金先金融機関口座を登録します。原則として本人名義の銀行口座が必要です。</p>
    <table>
      <thead><tr><th>選択肢</th><th>扱い</th><th>実務判断</th></tr></thead>
      <tbody>
        <tr><td>北洋銀行など既存の本人名義口座</td><td>まず登録を試す候補</td><td>本人名義であれば出金先として登録できる可能性があります。ただし即時入金やSBI連携は別問題です。</td></tr>
        <tr><td>住信SBIネット銀行</td><td>SBI証券と相性がよい候補</td><td>SBI証券と同時申込・連携しやすい一方、開設完了まで数日かかる場合があります。</td></tr>
        <tr><td>SBI新生銀行</td><td>同時申込候補</td><td>住信SBIネット銀行と同様、SBI証券の流れの中で申込候補になります。</td></tr>
      </tbody>
    </table>
    <p class="note">SBI証券公式では、住信SBIネット銀行/SBI新生銀行は初期設定完了後に銀行口座の開設申込が通知され、開設完了まで数日かかると説明されています。また、同時申込した銀行口座は初期設定時点では出金先に設定できず、開設後に変更手続きが必要です。</p>
  </section>

  <section>
    <h2>6. 最短日程の目安</h2>
    <table>
      <thead><tr><th>日程</th><th>作業</th><th>完了条件</th><th>遅れる原因</th></tr></thead>
      <tbody>
        <tr><td>当日</td><td>楽天モバイルeSIM申込・本人確認</td><td>SMSとデータ通信が使える</td><td>端末非対応、本人確認不備、審査待ち</td></tr>
        <tr><td>当日</td><td>SBI証券ネット口座申込</td><td>申込完了、本人確認書類提出</td><td>住所不一致、写真不鮮明、マイナンバー不備</td></tr>
        <tr><td>翌営業日以降</td><td>SBI証券の取引開始</td><td>初期設定と取引パスワード設定完了</td><td>審査混雑、郵送受取、入力不備</td></tr>
        <tr><td>口座開設後2営業日程度</td><td>NISA仮開設</td><td>NISA口座区分で注文できる</td><td>他社NISA重複、税務署確認、申込不備</td></tr>
        <tr><td>購入前日まで</td><td>入金、出金先、二段階認証、注文票確認</td><td>本人が注文画面で銘柄・金額・口座区分を確認できる</td><td>銀行連携未完了、入金反映遅れ、ログイン不備</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>7. 購入前チェック</h2>
    <table class="checklist">
      <thead><tr><th>確認</th><th>項目</th><th>理由</th></tr></thead>
      <tbody>
        <tr><td>□</td><td>本人スマホでログインできる</td><td>本人操作の前提を満たすため。</td></tr>
        <tr><td>□</td><td>NISA口座が仮開設または開設済み</td><td>NISA枠で購入できる状態か確認するため。</td></tr>
        <tr><td>□</td><td>注文画面の口座区分がNISAになっている</td><td>一般口座・特定口座で誤発注しないため。</td></tr>
        <tr><td>□</td><td>入金済みで買付余力がある</td><td>注文直前に資金不足で止まらないため。</td></tr>
        <tr><td>□</td><td>配当金受取方式を確認済み</td><td>NISAで国内株配当を非課税にするには方式確認が重要。</td></tr>
        <tr><td>□</td><td>6月イベント後の買う/待つ判定を確認済み</td><td>CPI、日銀、FOMC、金利、為替、指数反応を踏まえるため。</td></tr>
      </tbody>
    </table>
  </section>

  <section class="source">
    <h2>8. 参照先</h2>
    <p>SBI証券 口座開設の流れ: <a href="https://go.sbisec.co.jp/account/sogoflow_01.html">https://go.sbisec.co.jp/account/sogoflow_01.html</a></p>
    <p>楽天モバイル公式: <a href="https://network.mobile.rakuten.co.jp/">https://network.mobile.rakuten.co.jp/</a></p>
    <p>楽天モバイル Rakuten最強プラン: <a href="https://network.mobile.rakuten.co.jp/fee/saikyo-plan/">https://network.mobile.rakuten.co.jp/fee/saikyo-plan/</a></p>
    <footer>本資料は手続き整理用です。最新の必要書類、審査日数、料金、NISA口座の扱いは、申込時点の公式画面で確認してください。</footer>
  </section>
</main>
</body>
</html>`;

const htmlPath = path.join(root, "rakuten_sbi_setup_guide_20260613.html");
const pdfPath = path.join(root, "rakuten_sbi_setup_guide_20260613.pdf");
fs.writeFileSync(htmlPath, html, "utf8");

const chromeCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const chrome = chromeCandidates.find((p) => fs.existsSync(p));
if (!chrome) {
  throw new Error("Chrome/Edge executable was not found.");
}
execFileSync(chrome, [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--print-to-pdf=" + pdfPath,
  "file:///" + htmlPath.replace(/\\/g, "/"),
], { stdio: "inherit" });

console.log("Generated:", htmlPath);
console.log("Generated:", pdfPath);
