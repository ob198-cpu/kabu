import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = path.resolve(process.cwd());
const now = "2026年6月8日";

const loanCore = [
  {
    title: "本人名義のNISA口座で運用する",
    tag: "口座の名義と取引主体を一致させる",
    text: "NISA口座は本人ごとの非課税枠です。他人名義口座を操作するのではなく、本人が自分の口座を使い、本人スマホ・本人ログイン・本人確認・本人発注で進める形を基本にします。",
  },
  {
    title: "資金は正式な借入として整理する",
    tag: "贈与ではなく借金として残す",
    text: "投資資金を家族・個人から借りる場合は、金銭消費貸借契約書を作成し、貸付日、金額、返済期限、返済回数、利率、返済方法を明記します。実際の返済履歴を銀行振込で残します。",
  },
  {
    title: "損しても返す契約にする",
    tag: "出資・共同投資と分ける",
    text: "投資が失敗したら返さなくてよい、利益が出たら返す、利益の一部を渡す、という形は借入ではなく出資・共同投資・贈与に近く見られます。元本返済義務を明確にします。",
  },
  {
    title: "利息・印紙・税務記録を残す",
    tag: "後から説明できる形にする",
    text: "無利子・低利息は利子相当額が贈与と見られる場合があります。少額でも契約書、振込履歴、返済予定表を残し、利息を受け取る側の所得申告や契約書の印紙税も確認します。",
  },
];

const loanChecks = [
  {
    title: "贈与と疑われやすい形",
    text: "返済期限がない、返済実績がない、催促しない、ある時払い、出世払い、あとで返済免除する、高額・長期・無利子で実態がない、という形は避けます。",
  },
  {
    title: "借入として強くする記録",
    text: "契約書、返済予定表、本人名義口座への振込、返済時の振込履歴、利息計算、残高管理、返済遅延時の扱いを残します。現金手渡しだけで済ませない設計にします。",
  },
  {
    title: "貸した側の注意",
    text: "利息を受け取る場合、その利息は個人の非営業用貸金の利子として雑所得等の確認対象になり得ます。反復継続して不特定多数に貸す形は貸金業法の論点が出ます。",
  },
  {
    title: "投資利益の扱い",
    text: "借りた元本は通常、借りた側の収入ではありません。投資で得た利益は、株式・投信等の税制に従って本人に課税されます。NISA口座内の利益は制度上の非課税枠で扱います。",
  },
];

const secondaryAlternatives = [
  {
    title: "本人発注型 + 注文票作成",
    tag: "借入案と併用しやすい実務案",
    summary: "本人別に、候補銘柄、購入日、購入金額、買わない条件を注文票にまとめ、本人が自分のスマホで確認して発注する方法です。",
    use: "再来週の購入予定に最も間に合わせやすい案です。こちらは判断材料と注文票を整え、発注操作は本人に残します。",
    point: "本人スマホ、本人ログイン、NISA口座区分、入金、二段階認証、注文内容の理解を確認します。",
  },
  {
    title: "証券会社の正式代理制度",
    tag: "中期の確認先",
    summary: "証券会社が認める代理人登録、法定代理、任意代理、家族向けサポート制度を確認する方法です。",
    use: "認められる範囲が明確であれば、本人発注型より運用負担を下げられます。長期運用の正式ルートになりやすい案です。",
    point: "照会のみ、売却のみ、NISA対象外などの制限があり得ます。注文権限まで認められるかを確認します。",
  },
  {
    title: "家族サポート証券口座",
    tag: "短期本命ではなく制度確認枠",
    summary: "本人と家族代理人の任意代理契約を前提に、将来の判断能力低下に備える制度です。",
    use: "遠方家族や高齢家族について、本人が操作しにくくなった場合の継続運用の選択肢になります。",
    point: "取り扱い証券会社が限られます。すぐに全員分のNISA個別株購入へ使えるとは限りません。",
  },
  {
    title: "登録助言業者・IFA連携",
    tag: "助言責任の正式化",
    summary: "投資助言業者、IFA、金融商品仲介業者など、登録を受けた専門家と連携する方法です。",
    use: "銘柄選定、助言、説明資料、継続フォローの責任分担を明確にできます。",
    point: "登録区分、報酬、対応商品、注文権限、利益相反を確認します。",
  },
  {
    title: "NISA対応ラップ・投信中心代替",
    tag: "個別株が重い人の代替",
    summary: "個別株10社戦略ではなく、NISA対応ラップ、バランスファンド、インデックス投信などを使う方法です。",
    use: "個別株の説明や発注が重い本人分について、運用負担を下げる代替案になります。",
    point: "個別株で指数超過を狙う設計とは目的が変わります。手数料、商品性、NISA対象、期待リターンを確認します。",
  },
  {
    title: "未成年口座の登録親権者",
    tag: "未成年者分のみ",
    summary: "未成年口座で、登録親権者が未成年者本人に代わり財産管理を目的として取引する制度を確認する方法です。",
    use: "未成年者分については、成人本人NISAとは別に、親権者関与の制度を使える可能性があります。",
    point: "成人家族のNISA運用代替にはそのまま使えません。対象者が未成年の場合だけ別ルートで確認します。",
  },
  {
    title: "家族信託・成年後見・法人管理",
    tag: "長期の資産管理案",
    summary: "家族信託、成年後見、任意後見、法人管理などを専門家と検討する方法です。",
    use: "相続、判断能力低下、財産管理まで含めて長期的に設計したい場合の選択肢です。",
    point: "再来週のNISA購入には間に合いにくく、NISA口座の即時操作代替ではありません。",
  },
];

const legalItems = [
  {
    law: "金融商品取引法",
    issue: "他人の資産について、継続的に銘柄選定、売買判断、運用方針の決定、発注実行まで担う場合、投資助言・代理業、投資運用業、金融商品仲介業等の登録要否が問題になります。",
    control: "候補整理、比較資料、注文票作成に留め、投資助言や継続運用を業として行う場合は登録業者・IFA・証券会社の正式制度を使います。",
  },
  {
    law: "不正アクセス禁止法",
    issue: "他人のID・パスワードを預かって証券口座へログインする行為は、本人同意の有無だけでなく、証券会社が認める権限設定かどうかが問題になります。",
    control: "本人スマホ、本人ログイン、本人発注を基本にし、第三者はログイン情報を預かりません。代理が必要な場合は証券会社所定の制度を確認します。",
  },
  {
    law: "犯罪収益移転防止法・本人確認関連",
    issue: "名義人、資金を出す人、実質的に利益を受ける人がずれると、借名取引、仮名取引、マネー・ローンダリング対策上の確認対象になり得ます。",
    control: "本人名義の銀行口座、本人名義の証券口座、本人確認、資金移動記録をそろえます。資金を借りる場合は借入として契約書と返済記録を残します。",
  },
  {
    law: "日本証券業協会の自主規制・証券会社規約",
    issue: "証券会社は、仮名・借名取引、代理発注、ID・パスワード共有を制限する規約を置いています。家族であっても、規約上認められない操作は問題になります。",
    control: "代理人登録、家族サポート証券口座、未成年口座の登録親権者、法定代理など、証券会社が認める範囲だけを使います。",
  },
  {
    law: "民法上の委任・代理",
    issue: "家族間で了承があっても、それだけで証券会社に対する正式な代理権限になるとは限りません。私的な委任と証券会社システム上の権限は別です。",
    control: "委任状、任意代理契約、法定代理、後見制度、証券会社所定書式のいずれが必要かを確認します。",
  },
  {
    law: "相続税法・贈与税の実務",
    issue: "投資資金を渡しただけで返済義務がない場合、贈与と見られる可能性があります。ある時払い、出世払い、返済免除、実質無利子の高額貸付は注意が必要です。",
    control: "金銭消費貸借契約書、返済期限、利率、返済予定表、振込履歴を残し、投資で損をしても返済義務がある形にします。",
  },
  {
    law: "貸金業法",
    issue: "家族間・個人間の一回限りの貸借と、不特定多数・反復継続の貸付は別です。反復継続して貸付を行う場合は貸金業登録の論点が出ます。",
    control: "SNS等で広く個人間融資を募る形は避けます。家族・特定者間でも契約書と返済記録を残し、継続的な貸付業にならないよう整理します。",
  },
  {
    law: "所得税法・租税特別措置法・NISA制度",
    issue: "NISAは本人ごとの非課税制度です。他人資金を本人名義口座で実質運用する場合、所得帰属、贈与、資金移動、NISA枠の実質利用者が問題になり得ます。",
    control: "本人資産としての運用か、借入資金での本人運用かを明確にし、資金移動・返済・利息・投資利益の帰属を記録します。",
  },
];

const evidence = [
  {
    title: "証券会社の制限",
    text: "SBI証券は、パスワード管理・代理発注等の制限として、仮名・借名取引が脱税、マネー・ローンダリング、不公正取引の温床となる可能性があり、法令諸規則等により委託・受託が禁止されている旨を示しています。したがって、ID・パスワードを預かって本人になり代わる注文は採用しません。",
  },
  {
    title: "金融商品取引業の登録",
    text: "金融庁は、顧客資産やファンドの運用を行う場合は投資運用業の登録が必要であり、助言に留まる場合でも投資助言・代理業の登録対象になり得ると説明しています。継続的な銘柄選定、売買判断、発注実行まで引き受けると登録業務の論点が出ます。",
  },
  {
    title: "投資助言・代理業の登録要否",
    text: "関東財務局Q&Aでは、投資助言・代理業を行うには金融商品取引法第29条に基づく登録が必要とされています。金融庁監督指針でも、一連の行為の一部だけを見て直ちに登録不要と判断するのは適切でない旨が示されています。",
  },
  {
    title: "ID・パスワード利用",
    text: "警察庁は、他人のIDやパスワードを使用してサービスを悪用する行為を不正アクセスとして説明しています。不正アクセス禁止法では、他人の識別符号の入力によるアクセス制限された利用が規制対象になります。ただし承諾等の要件も関係するため、本人同意だけで判断しません。",
  },
  {
    title: "正規の例外制度",
    text: "未成年口座、家族サポート証券口座、法定代理、証券会社所定代理など、制度上の代理権限がある場合は別ルートとして確認できます。家族だから触れる、ではなく、制度上の権限がある範囲で扱います。",
  },
];

const sources = [
  ["SBI証券 パスワード管理・代理発注等の制限", "https://search.sbisec.co.jp/v2/popwin/attention/trading/stock_12.html"],
  ["日本証券業協会 家族サポート証券口座", "https://market.jsda.or.jp/shijyo/kazokusupport/index.html"],
  ["SBI証券 未成年口座: 取引主体と親権者", "https://faq.sbisec.co.jp/answer/5ec23dacd31ea500111ec166/"],
  ["SBI証券 未成年口座の開設", "https://faq.sbisec.co.jp/answer/5ec23361d31ea500111ebd45/"],
  ["金融庁 投資運用業等 登録手続ガイドブック", "https://www.fsa.go.jp/policy/marketentry/guidebook/02.html"],
  ["関東財務局 投資助言・代理業 登録Q&A", "https://lfb.mof.go.jp/kantou/rizai/pagekthp0320003150.html"],
  ["金融庁 投資助言・代理業 監督指針", "https://www.fsa.go.jp/common/law/guide/kinyushohin/07.html"],
  ["警察庁 不正アクセス対策", "https://www.npa.go.jp/bureau/cyber/countermeasures/unauthorized-access.html"],
  ["日本法令外国語訳 不正アクセス禁止法", "https://www.japaneselawtranslation.go.jp/en/laws/view/3933"],
  ["国税庁 親から金銭を借りた場合", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/zoyo/4420.htm"],
  ["国税庁 配当金を受け取ったとき", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm"],
  ["国税庁 印紙税目次一覧", "https://www.nta.go.jp/law/shitsugi/inshi/01.htm"],
  ["金融庁 SNS等を利用した個人間融資にご注意ください", "https://www.fsa.go.jp/ordinary/chuui/kinyu_chuui.html"],
];

const loanCards = loanCore.map((a, i) => `
  <article class="option">
    <div class="option-head"><span class="num">${i + 1}</span><div><h3>${a.title}</h3><p class="tag">${a.tag}</p></div></div>
    <p>${a.text}</p>
  </article>
`).join("");

const loanCheckCards = loanChecks.map((a, i) => `
  <article class="evidence">
    <div class="option-head"><span class="num">${i + 1}</span><h3>${a.title}</h3></div>
    <p>${a.text}</p>
  </article>
`).join("");

const optionCards = secondaryAlternatives.map((a, i) => `
  <article class="option">
    <div class="option-head"><span class="num">${i + 1}</span><div><h3>${a.title}</h3><p class="tag">${a.tag}</p></div></div>
    <p class="summary">${a.summary}</p>
    <div class="explain"><b>どう使うか</b><p>${a.use}</p></div>
    <div class="explain"><b>確認すること</b><p>${a.point}</p></div>
  </article>
`).join("");

const evidenceBlocks = evidence.map((e, i) => `
  <article class="evidence">
    <div class="option-head"><span class="num">${i + 1}</span><h3>${e.title}</h3></div>
    <p>${e.text}</p>
  </article>
`).join("");

const sourceBlocks = sources.map(([label, url]) => `
  <div class="source"><b>${label}</b><a href="${url}">${url}</a></div>
`).join("");

const legalBlocks = legalItems.map((l, i) => `
  <article class="evidence">
    <div class="option-head"><span class="num">${i + 1}</span><h3>${l.law}</h3></div>
    <div class="explain"><b>問題になり得る点</b><p>${l.issue}</p></div>
    <div class="explain"><b>回避・確認方法</b><p>${l.control}</p></div>
  </article>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>NISA口座運用代替案 比較報告書 ${now}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #061826;
      background: #fff;
      font-family: "Noto Sans JP", "Yu Gothic", "Meiryo", Arial, sans-serif;
      font-size: 12.6px;
      line-height: 1.58;
    }
    .page { width: 100%; padding: 10px 18px 18px; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 28px; color: #062f4f; margin: 0 0 8px; padding-bottom: 8px; border-bottom: 3px solid #176b9d; letter-spacing: 0; }
    h2 { font-size: 18px; color: #07385f; margin: 18px 0 9px; padding-left: 10px; border-left: 7px solid #176b9d; break-after: avoid; page-break-after: avoid; }
    h3 { font-size: 14px; color: #063456; margin: 0 0 4px; }
    .small { font-size: 11px; color: #263849; }
    .lead { font-size: 14px; border: 1.5px solid #a6c7df; border-left: 8px solid #176b9d; background: #f4f9fd; padding: 11px 13px; border-radius: 8px; margin: 10px 0 13px; break-inside: avoid; page-break-inside: avoid; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin: 12px 0; break-inside: avoid; page-break-inside: avoid; }
    .card { border: 1.4px solid #b8d2e6; border-radius: 8px; padding: 10px; background: #f8fbfe; min-height: 94px; break-inside: avoid; page-break-inside: avoid; }
    .card b { display: block; color: #063456; font-size: 13px; margin-bottom: 4px; }
    .value { font-size: 18px; font-weight: 800; color: #0a6797; margin-bottom: 4px; }
    .option-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .option, .decision, .evidence, .source { border: 1.3px solid #c3d8e8; border-radius: 8px; background: #fbfdff; padding: 10px 12px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
    .option-head { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 6px; }
    .num { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; border-radius: 999px; background: #0a6797; color: #fff; font-weight: 800; flex: 0 0 auto; }
    .tag { color: #0a6797; font-weight: 800; margin: 0; font-size: 11.5px; }
    .summary { font-weight: 700; margin-bottom: 8px; }
    .explain { background: #f3f8fc; border-left: 4px solid #7eb3d4; padding: 7px 8px; margin-top: 6px; border-radius: 6px; }
    .explain b { display: block; color: #063456; margin-bottom: 2px; }
    .explain p { margin-bottom: 0; }
    .note { border: 1.4px solid #d7b06b; background: #fff9ee; border-left: 7px solid #b87500; padding: 9px 12px; border-radius: 8px; margin: 10px 0 12px; break-inside: avoid; page-break-inside: avoid; }
    .evidence { background: #fff; border-left: 7px solid #176b9d; }
    .source b { display:block; color:#063456; margin-bottom:3px; }
    .source a { color:#075f94; text-decoration:none; overflow-wrap:anywhere; }
  </style>
</head>
<body>
  <section class="page">
    <h1>NISA口座運用代替案 比較報告書</h1>
    <p class="small">作成日: ${now} / 対象: 家族・複数本人分のNISA運用準備</p>
    <div class="lead">
      他人名義のNISA口座を直接操作する代替案を模索しましたが、現実的に運用できそうなものはまだ見つかっておりません。次点としてこちらの口座で運用可能な代替案を模索しましたので、ご報告いたします。
    </div>
    <h2>1. その他の制度確認ルート</h2>
    <div class="note">
      以下は、完全に不要という意味ではありません。ただし、再来週の購入に間に合わせる本命案ではなく、証券会社・専門家確認を経て使えるかを判断するルートです。
    </div>
    <div class="option-grid">${optionCards}</div>
  </section>

  <section class="page">
    <h2>2. 本人NISA口座 + 正式な金銭貸借</h2>
    <div class="note">
      投資資金を個人から借りて、あとで本当に返す形であれば、借りた元本そのものは通常、贈与ではなく借入として整理できます。ただし、税務上は契約書の有無だけでなく、返済能力、返済期限、返済状況、利息、返済免除の有無など、実態が見られます。
    </div>
    <div class="option-grid">${loanCards}</div>
  </section>

  <section class="page">
    <h2>3. 借入案で確認すること</h2>
    ${loanCheckCards}
    <div class="note">
      実務上は、投資が失敗しても返済する契約にすることが重要です。損したら返さない、利益が出たら分ける、という設計にすると、借入ではなく出資・共同投資・贈与の論点が強くなります。
    </div>
  </section>

  <section class="page">
    <h2>4. 関連法: 他人の口座を触る場合に問題になり得るもの</h2>
    <div class="note">
      以下は「必ず違反になる」という断定ではありません。ただし、他人名義の証券口座を第三者が操作する場合、複数の法律・規則・証券会社規約にまたがって確認が必要になります。
    </div>
    ${legalBlocks}
  </section>

  <section class="page">
    <h2>5. 他人口座を直接操作する案を後回しにする理由</h2>
    <div class="note">
      他人名義口座を直接操作する案は、本人同意があっても、証券会社規約、金融商品取引業の登録、不正アクセス、借名・仮名取引の確認が残ります。そのため、短期では「本人NISA口座 + 正式な借入 + 本人発注」に寄せます。
    </div>
    ${evidenceBlocks}
  </section>

  <section class="page">
    <h2>6. 参考情報</h2>
    ${sourceBlocks}
  </section>
</body>
</html>`;

for (const file of [
  "nisa_account_plan.html",
  "nisa_account_alternative_plan_20260604.html",
  "nisa_account_alternative_plan_20260608.html",
]) {
  fs.writeFileSync(path.join(root, file), html, "utf8");
}

const chromeCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const chrome = chromeCandidates.find((p) => fs.existsSync(p));

if (!chrome) {
  console.log("HTML files generated. Chrome/Edge was not found, so PDF was not regenerated.");
  process.exit(0);
}

for (const [htmlFile, pdfFile] of [
  ["nisa_account_plan.html", "nisa_account_plan.pdf"],
  ["nisa_account_alternative_plan_20260604.html", "nisa_account_alternative_plan_20260604.pdf"],
  ["nisa_account_alternative_plan_20260608.html", "nisa_account_alternative_plan_20260608.pdf"],
]) {
  const inputUrl = `file:///${path.join(root, htmlFile).replace(/\\/g, "/")}`;
  const output = path.join(root, pdfFile);
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${output}`,
    inputUrl,
  ], { stdio: "inherit" });
}

console.log("Generated NISA account alternative plan HTML/PDF files.");
