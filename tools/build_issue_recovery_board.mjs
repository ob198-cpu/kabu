import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const rows = [
  {
    priority: '最重要',
    issue: '質的イベントを単純加点してしまう危険',
    why: 'ニュース、TOB、新商品、戦争、停戦などを点数に直接足すと、実績のない期待だけで高スコアになる。',
    current_status: '回収中',
    done: 'イベントは「候補発見」と「確認優先度」に限定し、本体の購入候補スコアへ直接加点しない方針へ変更。',
    evidence: 'event_score_adjustment.html / dual_axis_selection_model.html / model_integrity_audit.html',
    next_action: 'イベント仮説ごとに、過去の類似イベント後リターンを確認する表を追加する。',
    owner_note: '購入判断には未使用。探索入口としてのみ使用。',
  },
  {
    priority: '最重要',
    issue: '仮説データ層と実績データ層の混同',
    why: '仮説Sと実績Sは意味が違う。足し算すると論理が崩れる。',
    current_status: '回収中',
    done: '質的データ軸と量的データ軸を分け、仮説は「検証対象」、実績は「通過条件」として扱う設計に変更。',
    evidence: '264_dual_axis_rating_rules.csv / 265_dual_axis_selection_logic.csv / dual_axis_selection_model.html',
    next_action: '画面上でも「仮説」「実績」「量的スコア」を列分けして、総合点に混ぜない表示へ寄せる。',
    owner_note: '仮説だけで買い候補にしない。',
  },
  {
    priority: '最重要',
    issue: '購入候補と調査候補が混ざって見える',
    why: '候補と表示されると、買える銘柄と誤認される。',
    current_status: '一部回収済み',
    done: '10社は「検証候補」とし、予備2社は購入候補ではないと明記。6月判定ルールも追加。',
    evidence: 'candidate_supplement_10_plan.html / supplement_reaction_check.html / candidate_june_rulebook.html',
    next_action: 'メイン画面の文言も「保有候補」から「検証候補」寄りにさらに整理する。',
    owner_note: '現段階の購入判断は不可。',
  },
  {
    priority: '高',
    issue: '未取得データを点数に混ぜる危険',
    why: 'PER/PBR/ROEや決算後反応が未取得なのに仮値で埋めると、計算したふりになる。',
    current_status: '一部回収済み',
    done: '未取得は非加点または信頼度低下に回す方針へ変更。予備候補の決算反応は実データで補完開始。',
    evidence: 'supplement_reaction_check.html / 279_supplement_earnings_reaction_check.csv',
    next_action: '全候補で「取得済み/未取得/代替/非加点」を明示する列を追加する。',
    owner_note: '未取得が多い銘柄は購入候補に進めない。',
  },
  {
    priority: '高',
    issue: '100社母集団の条件が恣意的に見える',
    why: '意味ある100社を作るには、選定条件を固定しないと後出しに見える。',
    current_status: '未完了',
    done: '暫定母集団と上位20補完再計算までは作成済み。',
    evidence: 'meaningful_universe_design.html / top20_completion_recalculated_candidates.html',
    next_action: '母集団条件を「決算成長、流動性、時価総額、除外条件」で固定し、同じ条件で再生成する。',
    owner_note: '6月テスト前に優先して整える。',
  },
  {
    priority: '高',
    issue: '業種別補正がまだ弱い',
    why: 'PER/PBR/ROEは業種で意味が違う。銀行と半導体を同じ閾値で比べるのは危険。',
    current_status: '未完了',
    done: '収益型の分類、ストック/フロー/混合の見方は追加済み。',
    evidence: 'index.html / 285_june_ticker_rulebook.csv',
    next_action: '業種別中央値または同業比較を入れ、割高判定を業種内比較にする。',
    owner_note: 'これがないと精密な順位付けは弱い。',
  },
  {
    priority: '高',
    issue: '過去検証・バックテストが不足',
    why: 'スコア上位が本当に指数を上回ったかを確認しないと、モデルの有効性は言えない。',
    current_status: '未完了',
    done: '決算後1日/5日/20日の対日経平均反応を一部取得開始。',
    evidence: 'top10_earnings_reaction_check.html / supplement_reaction_check.html',
    next_action: '過去決算日と株価を結合し、1年保有に近い検証を追加する。',
    owner_note: '購入判断へ進む前の必須課題。',
  },
  {
    priority: '高',
    issue: '+1%目標との接続が弱い',
    why: '個別株を選ぶ意味は、S&P500・日経平均・TOPIX等を最低1%上回る見込みを説明できること。',
    current_status: '回収中',
    done: '6月判定ルールに+1%目標の判定式を追加。',
    evidence: 'candidate_june_rulebook.html / plus1_practical_validation_model_20260525.html',
    next_action: '候補ごとにベンチマーク比較欄を追加し、勝てない場合は個別株比率を下げるルールを明文化する。',
    owner_note: '目的は「買うこと」ではなく、指数を上回る根拠を作ること。',
  },
  {
    priority: '中',
    issue: 'イベントと株価の因果を誤解する危険',
    why: '相関やイベント後リターンは因果ではない。市場全体、金利、為替の影響を分ける必要がある。',
    current_status: '未完了',
    done: '対日経平均超過リターンで市場影響を少し分離し始めた。',
    evidence: '236_top10_earnings_reaction_detail.csv / 279_supplement_earnings_reaction_check.csv',
    next_action: '日経平均、TOPIX、SOX、金利、為替を同時に見た複合条件へ拡張する。',
    owner_note: '単純な相関だけでは買い判断にしない。',
  },
  {
    priority: '中',
    issue: '表示上の誤解・旧文言の残存',
    why: '「購入開始」「候補」などの言葉が強すぎると顧客説明で誤解される。',
    current_status: '継続回収',
    done: '旧表現を複数回削除・修正。6月開始前提と検証候補の扱いへ寄せた。',
    evidence: 'index.html / daily_progress_report_20260525.html',
    next_action: '全ページで「購入候補」「保有候補」の文言を棚卸しし、必要に応じて検証候補へ変更する。',
    owner_note: '顧客向け表示は継続監査が必要。',
  },
];

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const headers = ['priority', 'issue', 'why', 'current_status', 'done', 'evidence', 'next_action', 'owner_note'];
const csv = [headers.join(',')]
  .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
  .join('\n');
fs.writeFileSync(path.join(ROOT, '287_issue_recovery_board.csv'), `\uFEFF${csv}\n`, 'utf8');

const count = (status) => rows.filter((row) => row.current_status.includes(status)).length;
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>課題回収管理表 2026年5月25日</title>
  <style>
    body { margin:0; font-family:"Yu Gothic", Meiryo, sans-serif; color:#111; background:#f5f8fb; line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:28px 18px 54px; }
    h1 { margin:0 0 8px; color:#073a5a; font-size:28px; }
    h2 { margin-top:30px; padding-left:10px; border-left:8px solid #0b6f9f; color:#073a5a; }
    .lead, .card { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .lead strong { color:#b00020; }
    .kpis { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi span { display:block; color:#42526b; font-size:13px; }
    .kpi b { display:block; color:#073a5a; font-size:28px; }
    table { width:100%; border-collapse:collapse; background:#fff; table-layout:fixed; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; vertical-align:top; font-size:12.5px; overflow-wrap:anywhere; }
    th { background:#e4f1fa; color:#073a5a; }
    .p-critical { color:#b00020; font-weight:800; }
    .p-high { color:#b45f00; font-weight:800; }
    .p-mid { color:#006f50; font-weight:800; }
    .status-done { background:#e9f7ef; font-weight:800; color:#007a3d; }
    .status-doing { background:#fff7e6; font-weight:800; color:#9a5b00; }
    .status-todo { background:#fdecec; font-weight:800; color:#b00020; }
    .flow { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:8px; }
    .step { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:12px; min-height:104px; }
    .step b { display:block; color:#073a5a; margin-bottom:6px; }
    .note { font-size:13px; color:#333; }
    @media print {
      body { background:#fff; }
      table, tr, td, th, .lead, .card, .kpi, .step { break-inside:avoid; page-break-inside:avoid; box-shadow:none; }
      .kpis, .flow { grid-template-columns:1fr 1fr; }
    }
  </style>
</head>
<body>
<main>
  <h1>課題回収管理表 2026年5月25日</h1>
  <div class="lead">
    <p><b>目的:</b> 今日判明した設計上の課題を、感覚的な反省で終わらせず、実装・検証・表示修正の単位に分解して回収するための管理表です。</p>
    <p><strong>現時点の扱い:</strong> 現システムは購入判断システムではなく、NISA 1年保有の検証候補を絞るためのプロトタイプです。課題が未回収の項目は、購入判断には使いません。</p>
  </div>

  <div class="kpis">
    <div class="kpi"><span>管理対象</span><b>${rows.length}件</b></div>
    <div class="kpi"><span>回収済み/一部回収</span><b>${count('回収済み')}</b></div>
    <div class="kpi"><span>回収中</span><b>${count('回収中') + count('継続回収')}</b></div>
    <div class="kpi"><span>未完了</span><b>${count('未完了')}</b></div>
  </div>

  <h2>回収の流れ</h2>
  <div class="flow">
    <div class="step"><b>1. 課題を分解</b>単純加点、仮説と実績の混同、未取得データ混入などを別課題に分ける。</div>
    <div class="step"><b>2. 購入判断から隔離</b>未監査の式や質的イベント評価は、探索候補だけに使う。</div>
    <div class="step"><b>3. 実データで補完</b>決算後反応、PER/PBR/ROE、下落率、指数比較を銘柄別に入れる。</div>
    <div class="step"><b>4. ルール化</b>進める、待つ、止める条件を数値とイベントで明文化する。</div>
    <div class="step"><b>5. 検証記録</b>予測と実績の差を残し、式の採用/修正/廃止を判断する。</div>
  </div>

  <h2>課題一覧</h2>
  <table>
    <thead>
      <tr>
        <th style="width:7%">重要度</th>
        <th style="width:14%">課題</th>
        <th style="width:17%">なぜ問題か</th>
        <th style="width:8%">状態</th>
        <th style="width:17%">対応済み</th>
        <th style="width:15%">根拠ファイル</th>
        <th style="width:16%">次の回収作業</th>
        <th style="width:6%">扱い</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => {
        const pClass = row.priority === '最重要' ? 'p-critical' : row.priority === '高' ? 'p-high' : 'p-mid';
        const sClass = row.current_status.includes('未完了') ? 'status-todo' : row.current_status.includes('回収中') || row.current_status.includes('継続') ? 'status-doing' : 'status-done';
        return `<tr>
          <td class="${pClass}">${esc(row.priority)}</td>
          <td><b>${esc(row.issue)}</b></td>
          <td>${esc(row.why)}</td>
          <td class="${sClass}">${esc(row.current_status)}</td>
          <td>${esc(row.done)}</td>
          <td>${esc(row.evidence)}</td>
          <td>${esc(row.next_action)}</td>
          <td>${esc(row.owner_note)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>次にやる順番</h2>
  <div class="card">
    <ol>
      <li>メイン画面の「保有候補」という強い表現を、必要箇所で「検証候補」へ整理する。</li>
      <li>未取得データを点数に混ぜない列を全候補に追加し、データ信頼度70点未満の扱いを固定する。</li>
      <li>100社母集団の条件を固定し、再現できる選定条件として保存する。</li>
      <li>業種別補正とベンチマーク比較を入れ、+1%目標に接続する。</li>
      <li>過去イベント後リターンを取り、質的イベント評価を「仮説」から「実績確認」へ進める。</li>
    </ol>
    <p class="note">更新日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'issue_recovery_board_20260525.html'), html, 'utf8');
console.log(`generated issue recovery board: ${rows.length} rows`);
