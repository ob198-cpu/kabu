import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = path.resolve(process.cwd());
const now = "2026年6月8日";

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
];

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
      background: #ffffff;
      font-family: "Noto Sans JP", "Yu Gothic", "Meiryo", Arial, sans-serif;
      font-size: 12.4px;
      line-height: 1.62;
    }
    .page {
      width: 100%;
      padding: 10px 18px 18px;
      break-after: page;
      page-break-after: always;
    }
    .page:last-child { break-after: auto; page-break-after: auto; }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      font-size: 27px;
      letter-spacing: 0;
      color: #062f4f;
      margin: 0 0 8px;
      padding-bottom: 8px;
      border-bottom: 3px solid #176b9d;
    }
    h2 {
      font-size: 18px;
      color: #07385f;
      margin: 18px 0 8px;
      padding-left: 10px;
      border-left: 7px solid #176b9d;
      break-after: avoid;
      page-break-after: avoid;
    }
    h3 { font-size: 14px; color: #063456; margin: 12px 0 6px; }
    .lead {
      font-size: 14px;
      border: 1.5px solid #a6c7df;
      border-left: 8px solid #176b9d;
      background: #f4f9fd;
      padding: 10px 13px;
      border-radius: 8px;
      margin: 10px 0 13px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 9px;
      margin: 12px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card {
      border: 1.4px solid #b8d2e6;
      border-radius: 8px;
      padding: 10px;
      background: #f8fbfe;
      min-height: 90px;
    }
    .card b { display: block; color: #063456; font-size: 13px; margin-bottom: 4px; }
    .value { font-size: 19px; font-weight: 800; color: #0a6797; margin-bottom: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px;
      break-inside: avoid;
      page-break-inside: avoid;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #bfd4e5;
      padding: 7px 8px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    th {
      background: #e5f1fa;
      color: #063456;
      font-weight: 800;
      text-align: left;
    }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .note {
      border: 1.4px solid #d7b06b;
      background: #fff9ee;
      border-left: 7px solid #b87500;
      padding: 9px 12px;
      border-radius: 8px;
      margin: 10px 0 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .danger {
      border: 1.5px solid #d39a9a;
      background: #fff5f5;
      border-left: 8px solid #bd1f2d;
      color: #741018;
      padding: 10px 12px;
      border-radius: 8px;
      margin: 10px 0 12px;
      font-weight: 700;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ok { color: #007a4d; font-weight: 800; }
    .warn { color: #b26800; font-weight: 800; }
    .ng { color: #bd1f2d; font-weight: 800; }
    .small { font-size: 11px; color: #263849; }
    .checklist {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 10px 0 14px;
    }
    .check {
      border: 1px solid #c8dcec;
      border-radius: 8px;
      padding: 9px 10px;
      background: #fbfdff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .check b { display: block; margin-bottom: 3px; color: #063456; }
    .footer {
      margin-top: 13px;
      padding-top: 8px;
      border-top: 1px solid #d7e3ee;
      color: #3a5062;
      font-size: 10.5px;
    }
    a { color: #075f94; text-decoration: none; }
    .nowrap { white-space: nowrap; }
  </style>
</head>
<body>
  <section class="page">
    <h1>NISA口座運用代替案 比較報告書</h1>
    <p class="small">作成日: ${now} / 対象: NISA口座を用いた家族・複数本人分の運用準備</p>
    <div class="lead">
      本報告書は、NISA口座を安全に運用するための実務ルートを比較したものです。結論として、成人本人のNISA口座は本人名義・本人ログイン・本人発注を基本にし、第三者がIDやパスワードを預かって操作する形は採用しません。理由は、本人同意の有無だけでなく、証券会社のパスワード管理・代理発注制限、仮名・借名取引防止、金融商品取引業の登録要否、不正アクセス関連のリスクが重なるためです。負担を下げる代替案として、証券会社所定の代理制度、家族サポート証券口座、登録助言業者・IFA連携、NISA対応ラップ等を確認します。
    </div>
    <div class="cards">
      <div class="card"><b>最短で実行しやすい案</b><div class="value">本人発注型</div><p>候補銘柄、買う日、買わない条件、金額を注文票にし、本人がスマホで最終発注する。</p></div>
      <div class="card"><b>正式化の確認先</b><div class="value">証券会社</div><p>代理人登録、家族サポート制度、NISA口座での注文権限を個別に確認する。</p></div>
      <div class="card"><b>未成年口座</b><div class="value">別制度</div><p>登録親権者が関与できる仕組みは成人本人のNISA口座とは別に扱う。</p></div>
      <div class="card"><b>中期代替</b><div class="value">IFA/ラップ</div><p>本人操作負担を下げるため、登録業者連携やNISA対応ラップも比較する。</p></div>
    </div>
    <h2>1. 結論</h2>
    <table>
      <colgroup><col style="width:18%"><col style="width:23%"><col style="width:23%"><col style="width:36%"></colgroup>
      <thead><tr><th>論点</th><th>結論</th><th>実務上の扱い</th><th>理由</th></tr></thead>
      <tbody>
        <tr><td>成人本人のNISA</td><td><span class="ok">本人操作が基本</span></td><td>本人スマホ、本人ログイン、本人確認、本人発注に寄せる。</td><td>NISA口座は本人の非課税口座であり、他人がID・パスワードを預かって実質管理する形は疑義が出やすい。</td></tr>
        <tr><td>未成年口座</td><td><span class="ok">登録親権者は別扱い</span></td><td>未成年口座の取引主体・登録親権者の仕組みを確認する。</td><td>SBI証券の未成年口座FAQでも、取引主体を親権者とする場合は登録親権者が未成年者本人に代わり財産管理を目的として取引できる旨が示されている。</td></tr>
        <tr><td>成人家族の代理</td><td><span class="warn">証券会社確認が必要</span></td><td>代理人登録、家族サポート証券口座、法定代理等の対象・権限範囲を問い合わせる。</td><td>成人本人の通常NISAを、家族が自由に操作できる一般的な近道として扱うのは危険。証券会社所定制度がある場合のみ、その範囲で検討する。</td></tr>
        <tr><td>再来週の購入準備</td><td><span class="ok">二段構え</span></td><td>初回は本人発注型で準備し、並行して正式代理・IFA・ラップを確認する。</td><td>正式制度は審査・書類・対象取引の確認に時間がかかるため、購入予定を止めない現実策と中期策を分ける。</td></tr>
      </tbody>
    </table>
  </section>

  <section class="page">
    <h2>2. 他人の口座を直接操作しない根拠</h2>
    <table>
      <colgroup><col style="width:18%"><col style="width:31%"><col style="width:28%"><col style="width:23%"></colgroup>
      <thead><tr><th>根拠区分</th><th>確認できる内容</th><th>今回の実務への影響</th><th>採用する対応</th></tr></thead>
      <tbody>
        <tr>
          <td><b>証券会社の制限</b></td>
          <td>SBI証券は、パスワード管理・代理発注等の制限に関する案内で、仮名・借名取引は脱税、マネー・ローンダリング、不公正取引の温床となる可能性があり、法令諸規則等により委託・受託が禁止されている旨を示している。</td>
          <td>本人のID・パスワードを預かり、家族や第三者が本人になり代わって注文する形は、口座規約・代理発注制限・借名取引防止の観点で採用しない。</td>
          <td>本人発注型、または証券会社所定の代理制度へ切り替える。</td>
        </tr>
        <tr>
          <td><b>金融商品取引業の登録</b></td>
          <td>金融庁の登録手続ガイドブックでは、顧客資産やファンドの運用を行う場合は投資運用業の登録が必要であり、投資判断の助言に留まる場合でも投資助言・代理業の登録対象になり得ることが説明されている。</td>
          <td>第三者が継続的に銘柄選定、売買判断、発注実行まで担うと、単なる資料作成を超え、登録業務の論点が出る。</td>
          <td>本システムは判断補助と注文票作成に留め、最終発注は本人または正式登録された権限者が行う。</td>
        </tr>
        <tr>
          <td><b>投資助言・代理業の登録要否</b></td>
          <td>関東財務局のQ&Aでは、投資助言・代理業を行うには金融商品取引法第29条に基づく登録が必要とされている。金融庁監督指針でも、一連の行為の一部だけを見て直ちに登録不要と判断するのは適切でない旨が示されている。</td>
          <td>有償で具体的な投資判断を継続提供する場合、単なる情報提供か登録が必要な助言・代理かを切り分ける必要がある。</td>
          <td>登録業者・IFA連携を代替案に入れ、非登録者が投資判断・発注権限を引き受ける形にしない。</td>
        </tr>
        <tr>
          <td><b>ID・パスワード利用</b></td>
          <td>警察庁は、他人のIDやパスワードを使用してサービスを悪用する行為を不正アクセスとして説明している。不正アクセス禁止法では、他人の識別符号を入力してアクセス制限された利用を可能にする行為が規制対象となる。ただし、法令上はアクセス管理者や利用権者の承諾等の要件も関係するため、本人同意だけで判断しない。</td>
          <td>証券口座は金融資産を扱うため、本人同意があっても、証券会社が第三者ログインを認めているかを確認しない限り、運用上のリスクが残る。</td>
          <td>本人端末・本人ログインを原則にし、第三者がログイン情報を保管しない。</td>
        </tr>
        <tr>
          <td><b>正規の例外制度</b></td>
          <td>未成年口座では登録親権者が関与できる仕組みがある。日本証券業協会の家族サポート証券口座は、本人と家族代理人の任意代理契約を前提に、必要なタイミングで家族代理人による取引等を可能にする枠組みとして説明されている。</td>
          <td>「家族だから触れる」ではなく、「制度上の代理権限がある場合に限り、その範囲で扱える」と整理する。</td>
          <td>未成年口座、家族サポート証券口座、法定代理、証券会社所定代理を別ルートとして確認する。</td>
        </tr>
      </tbody>
    </table>
    <div class="note">
      法的な整理として重要なのは、「本人が了承しているか」だけでは足りない点です。証券会社の規約、代理権限の登録、金融商品取引業の登録要否、ID・パスワード管理の全てを満たす必要があります。したがって、成人本人NISAでは、本人発注型または証券会社が認める正式代理ルートを採用します。
    </div>

    <h2>3. 代替案の比較</h2>
    <table>
      <colgroup><col style="width:5%"><col style="width:17%"><col style="width:13%"><col style="width:12%"><col style="width:11%"><col style="width:24%"><col style="width:18%"></colgroup>
      <thead><tr><th>優先</th><th>案</th><th>再来週</th><th>満足度</th><th>法令面</th><th>実務内容</th><th>注意点</th></tr></thead>
      <tbody>
        <tr>
          <td>1</td><td><b>本人発注型 + 注文票作成</b></td><td><span class="ok">間に合いやすい</span></td><td>中〜高</td><td>高</td>
          <td>本人別に、銘柄、数量、金額、買う日、買わない条件を注文票化する。本人が本人スマホでログインし、内容を確認して発注する。</td>
          <td>こちらは発注画面を操作しない。本人が内容を理解できる説明資料が必要。</td>
        </tr>
        <tr>
          <td>2</td><td><b>証券会社の正式代理制度確認</b></td><td><span class="warn">要確認</span></td><td>高</td><td>高</td>
          <td>証券会社に、代理人登録、家族サポート制度、法定代理・任意代理の対象、NISA注文の可否、開始時期を確認する。</td>
          <td>照会のみの場合もある。NISA口座での注文権限まで認められるかは証券会社ごとに確認が必要。</td>
        </tr>
        <tr>
          <td>3</td><td><b>登録助言業者・IFA連携</b></td><td>中</td><td>高</td><td>高</td>
          <td>投資判断の助言、説明資料、注文前確認を登録業者と連携する。本人が最終発注する形と組み合わせる。</td>
          <td>登録区分、報酬、責任範囲、勧誘・助言の線引きを確認する。</td>
        </tr>
        <tr>
          <td>4</td><td><b>NISA対応ラップ・投信中心代替</b></td><td>中</td><td>中</td><td>高</td>
          <td>個別株10社戦略が難しい本人分は、NISA対応ラップや投信で運用負担を下げる。</td>
          <td>個別株で指数超過を狙う設計とは異なる。手数料、商品範囲、NISA対応を確認する。</td>
        </tr>
        <tr>
          <td>5</td><td><b>家族信託・法人管理等</b></td><td><span class="ng">間に合いにくい</span></td><td>中〜高</td><td>要専門家</td>
          <td>将来の判断能力低下、相続、財産管理を含めた中長期設計として検討する。</td>
          <td>NISA口座の即時運用代替ではない。弁護士、司法書士、税理士等の確認が必要。</td>
        </tr>
      </tbody>
    </table>

    <h2>4. 未成年口座と成人本人NISAの違い</h2>
    <table>
      <colgroup><col style="width:20%"><col style="width:28%"><col style="width:24%"><col style="width:28%"></colgroup>
      <thead><tr><th>区分</th><th>誰が関与できるか</th><th>今回の扱い</th><th>確認ポイント</th></tr></thead>
      <tbody>
        <tr><td>未成年口座</td><td>親権者・未成年後見人が関与する制度がある。</td><td>登録親権者として手続きする場合は成人本人NISAとは別に整理する。</td><td>取引主体、親権者の同意、登録親権者、必要署名、証券会社の未成年口座ルール。</td></tr>
        <tr><td>成人本人のNISA</td><td>原則として本人が口座開設・ログイン・発注する。</td><td>本人発注型を基本ルートにする。</td><td>本人確認、NISA口座区分、二段階認証、本人スマホ、注文内容の理解。</td></tr>
        <tr><td>成人家族の代理操作</td><td>一般的な自由代理として扱わない。</td><td>証券会社所定制度が確認できるまで採用しない。</td><td>代理権限の範囲、注文可否、出金可否、NISA対象可否、記録方法。</td></tr>
        <tr><td>家族サポート証券口座</td><td>本人と家族代理人の任意代理契約を前提とする枠組み。</td><td>中期の正式化候補として確認する。</td><td>認知判断能力低下時の取引継続を想定した制度。取り扱い証券会社、対象取引、開始条件を確認する。</td></tr>
      </tbody>
    </table>

    <div class="note">
      実務上の重要点は、未成年口座の登録親権者と、成人本人NISAの家族操作を同じ制度として扱わないことです。未成年口座では親権者の関与が制度上整理されていますが、成人本人NISAでは本人の意思確認と本人操作を残す必要があります。
    </div>
  </section>

  <section class="page">
    <h2>5. 再来週に間に合わせる実務プラン</h2>
    <table>
      <colgroup><col style="width:12%"><col style="width:18%"><col style="width:36%"><col style="width:18%"><col style="width:16%"></colgroup>
      <thead><tr><th>日程</th><th>作業</th><th>内容</th><th>成果物</th><th>判定</th></tr></thead>
      <tbody>
        <tr><td>6/8〜6/10</td><td>証券会社確認</td><td>SBI、楽天、対面証券等に、成人本人NISAで代理人登録・家族サポート・NISA注文権限が使えるか確認する。</td><td>証券会社確認メモ</td><td>正式代理可否</td></tr>
        <tr><td>6/8〜6/12</td><td>本人別準備</td><td>本人スマホ、本人メール、本人ログイン、NISA口座、入金、二段階認証、配当金受取方式を確認する。</td><td>本人別チェック表</td><td>本人発注可否</td></tr>
        <tr><td>6/10〜6/17</td><td>市場イベント確認</td><td>CPI、日銀、FOMC、為替、金利、指数、候補銘柄の反応を更新する。</td><td>購入前ゲート</td><td>買う/待つ</td></tr>
        <tr><td>6/18以降</td><td>初回購入判断</td><td>正式代理が間に合えば正式制度の範囲で実行。間に合わなければ本人発注型で、本人が注文票を確認して発注する。</td><td>本人別注文票</td><td>購入/延期</td></tr>
        <tr><td>6月下旬〜7月</td><td>中期制度移行</td><td>継続運用のため、正式代理、家族サポート証券口座、IFA連携、NISAラップのどれが最も負担を下げるか比較する。</td><td>中期移行案</td><td>運用体制決定</td></tr>
      </tbody>
    </table>

    <h2>6. 証券会社へ確認する質問</h2>
    <div class="checklist">
      <div class="check"><b>成人本人NISAの代理注文</b>NISA口座で、所定の代理人登録により代理人が注文できる制度はありますか。</div>
      <div class="check"><b>権限範囲</b>照会のみ、注文、売却、出金、書類請求のどこまで可能ですか。</div>
      <div class="check"><b>必要書類</b>委任状、本人確認、代理人確認、家族関係書類、任意代理契約等は必要ですか。</div>
      <div class="check"><b>開始時期</b>書類提出から登録完了までの日数はどれくらいですか。6/18以降の購入に間に合いますか。</div>
      <div class="check"><b>家族サポート証券口座</b>取り扱い予定、対象者、開始条件、取引範囲、NISA対象可否を確認します。</div>
      <div class="check"><b>本人発注型の注意</b>本人スマホ、本人ログイン、本人発注で行う場合に、家族が横で説明することの注意点はありますか。</div>
      <div class="check"><b>高齢者・遠方家族</b>遠方本人がスマホでログインし、電話や資料で説明を受けて発注する場合の推奨手順はありますか。</div>
      <div class="check"><b>記録方法</b>本人確認、説明資料、注文票、本人の最終確認をどのように記録しておくべきですか。</div>
    </div>

    <div class="danger">代理人登録・家族サポート・成人本人NISAの代理注文可否は、証券会社に確認が必要です。未確認のまま「家族がまとめて操作できる」と説明しない。</div>
  </section>

  <section class="page">
    <h2>7. 採用ルートの判断表</h2>
    <table>
      <colgroup><col style="width:22%"><col style="width:24%"><col style="width:24%"><col style="width:30%"></colgroup>
      <thead><tr><th>確認結果</th><th>採用ルート</th><th>初回購入</th><th>継続運用</th></tr></thead>
      <tbody>
        <tr><td>代理人登録がNISA注文まで可能で、6/18以降に間に合う</td><td><span class="ok">A: 正式代理</span></td><td>証券会社所定の権限範囲で実行。</td><td>代理登録の記録を残し、本人確認・運用報告を継続。</td></tr>
        <tr><td>代理制度はあるが、登録完了が間に合わない</td><td><span class="warn">B: 本人発注 + 中期移行</span></td><td>本人発注型で初回対応。</td><td>翌月以降に正式代理、家族サポート、IFA、ラップへ移行。</td></tr>
        <tr><td>代理制度は照会のみ、またはNISA注文不可</td><td><span class="warn">C: 本人発注型</span></td><td>本人スマホ・本人ログイン・本人発注。</td><td>注文票と説明資料を整備し、操作負担を下げる。</td></tr>
        <tr><td>本人発注も難しい</td><td><span class="ng">D: 購入延期</span></td><td>該当本人分は購入しない。</td><td>口座、スマホ、本人確認、正式制度を整えてから再検討。</td></tr>
        <tr><td>個別株の説明負担が大きい</td><td><span class="warn">E: 投信・ラップ代替</span></td><td>NISA対応商品を別途確認。</td><td>個別株戦略ではなく、本人負担を下げる運用へ切替。</td></tr>
      </tbody>
    </table>

    <h2>8. 運用提案としての整理</h2>
    <table>
      <colgroup><col style="width:24%"><col style="width:38%"><col style="width:38%"></colgroup>
      <thead><tr><th>不安・疑問</th><th>回答の骨子</th><th>実務上の対応</th></tr></thead>
      <tbody>
        <tr><td>結局、家族分は運用できないのか</td><td>無断操作ではなく、本人発注型と正式代理確認の二段構えで進める。</td><td>本人別の注文票と、証券会社への代理制度確認を同時に進める。</td></tr>
        <tr><td>毎回本人に開いてもらうのは大変</td><td>短期は本人発注型で安全に進め、中期は代理制度・IFA・ラップで負担を下げる。</td><td>初回購入と継続運用を分けて設計する。</td></tr>
        <tr><td>未成年なら親が操作できるのか</td><td>未成年口座は登録親権者の仕組みがある。ただし成人本人NISAとは別制度。</td><td>未成年口座の取引主体、登録親権者、必要書類を証券会社で確認する。</td></tr>
        <tr><td>再来週に間に合うのか</td><td>正式代理は要確認。本人発注型なら、口座・入金・スマホ・注文票が整えば間に合わせる余地がある。</td><td>6/10までに証券会社確認、6/17までに本人別準備、6/18以降に市場条件で購入可否を判定。</td></tr>
      </tbody>
    </table>

    <h2>9. 参考情報</h2>
    <table>
      <colgroup><col style="width:28%"><col style="width:72%"></colgroup>
      <thead><tr><th>情報</th><th>URL</th></tr></thead>
      <tbody>
        ${sources.map(([label, url]) => `<tr><td>${label}</td><td><a href="${url}">${url}</a></td></tr>`).join("")}
      </tbody>
    </table>
    <div class="note">
      上記は公式確認の入口です。実際の注文権限、NISA対象可否、必要書類、開始日、本人確認方法は、利用する証券会社に個別確認します。
    </div>
  </section>
</body>
</html>`;

const htmlFiles = [
  "nisa_account_plan.html",
  "nisa_account_alternative_plan_20260604.html",
  "nisa_account_alternative_plan_20260608.html",
];

for (const file of htmlFiles) {
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

const pdfTargets = [
  ["nisa_account_plan.html", "nisa_account_plan.pdf"],
  ["nisa_account_alternative_plan_20260604.html", "nisa_account_alternative_plan_20260604.pdf"],
  ["nisa_account_alternative_plan_20260608.html", "nisa_account_alternative_plan_20260608.pdf"],
];

for (const [htmlFile, pdfFile] of pdfTargets) {
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
