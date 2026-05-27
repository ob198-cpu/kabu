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

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `\uFEFF${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
}

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function num(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchEvents(candidate, events) {
  const tickerCode = candidate.ticker.replace('.T', '');
  const companyKey = candidate.company.replace(/\s+/g, '');
  return events.filter((event) => {
    const target = `${event.affected_ticker} ${event.qualitative_theme}`.replace(/\s+/g, '');
    return target.includes(candidate.ticker) || target.includes(tickerCode) || target.includes(companyKey);
  });
}

function qualitativeStatus(matches) {
  if (!matches.length) {
    return {
      score: 50,
      status: '質的材料未接続',
      themes: '未接続',
      action: '量的スコアのみで候補比較。質的イベント監視台帳へ接続候補を追加する。',
      risk: '質的な追い風・逆風を未反映',
    };
  }
  const maxScore = Math.max(...matches.map((row) => num(row.event_total_score, 50)));
  const hasAlert = matches.some((row) => row.classification.includes('警戒') || row.expected_direction.includes('逆風'));
  const themes = matches.map((row) => row.qualitative_theme).join(' / ');
  const risk = matches.map((row) => row.reject_condition).join(' / ');
  if (hasAlert) {
    return {
      score: Math.min(62, maxScore),
      status: '警戒条件あり',
      themes,
      action: '新規購入候補には昇格させず、指数反応・決算数字・ニュース確認を優先する。',
      risk,
    };
  }
  if (maxScore >= 70) {
    return {
      score: maxScore,
      status: '質的確認待ち',
      themes,
      action: '候補に残す。ただし決算資料、株価反応、同業比較で裏取り後に6月再判定する。',
      risk,
    };
  }
  return {
    score: maxScore,
    status: '保留',
    themes,
    action: '質的材料は記録するが、購入検討には直接使わない。',
    risk,
  };
}

function operationDecision(candidate, qual) {
  const nisa = num(candidate.nisa_score);
  const confidence = num(candidate.data_confidence);
  const hardGate = candidate.hard_gate || 'なし';
  const lowReaction = hardGate.includes('決算後反応') && !hardGate.includes('20営業日未到達');
  if (confidence < 70) return 'データ補完';
  if (qual.status === '警戒条件あり') return '警戒';
  if (lowReaction) return '反応再確認';
  if (nisa >= 65 && qual.score >= 65) return '6月再判定候補';
  if (nisa >= 58 && qual.score >= 60) return '比較継続';
  return '保留';
}

function buyRule(decision) {
  if (decision === '6月再判定候補') return '6月CPI・日銀・FOMC確認後、日経平均75日線、米10年金利、為替、決算後20営業日反応が悪化していない場合だけ購入検討に進む。';
  if (decision === '比較継続') return '候補には残すが、同業比較と決算後反応を追加確認するまで購入検討に進めない。';
  if (decision === '反応再確認') return '決算後反応の弱さが解消するまで購入検討に進めない。';
  if (decision === '警戒') return '警戒イベントの理由が確認できるまで新規購入候補にしない。';
  if (decision === 'データ補完') return 'PER/PBR/ROE、決算成長率、決算後反応の未取得を補完してから再計算する。';
  return '監視のみ。点数や質的材料だけで購入候補へ上げない。';
}

function stopRule(decision) {
  if (decision === '6月再判定候補') return 'テスト後は買値から-5%で理由確認、-8%で追加停止、-12%で撤退候補。日経平均75日線割れでは全候補を再判定。';
  if (decision === '警戒') return '対象イベントで指数劣後、会社側否定、主要指標悪化が出た場合は候補から外す。';
  return '購入前段階のため損切り設定ではなく、候補維持条件の確認に限定する。';
}

const candidates = readCsv('245_nisa_1year_hold_score_top20.csv')
  .slice(0, 12)
  .map((row, index) => ({ ...row, rank: index + 1 }));
const events = readCsv('622_qual_event_scored_cases.csv');

const ruleRows = candidates.map((candidate) => {
  const qual = qualitativeStatus(matchEvents(candidate, events));
  const decision = operationDecision(candidate, qual);
  return {
    generated_at: generatedAt,
    rank: candidate.rank,
    ticker: candidate.ticker,
    company: candidate.company,
    sector: candidate.sector,
    nisa_score: candidate.nisa_score,
    data_confidence: candidate.data_confidence,
    per: candidate.per || '未取得',
    pbr: candidate.pbr || '未取得',
    roe_pct: candidate.roe_pct || '未取得',
    hard_gate: candidate.hard_gate || 'なし',
    qualitative_status: qual.status,
    qualitative_score: qual.score,
    qualitative_themes: qual.themes,
    decision,
    buy_rule: buyRule(decision),
    stop_rule: stopRule(decision),
    reject_or_watch: qual.risk,
    next_input: '公式決算値、PER/PBR/ROE、決算後1日/5日/20営業日対指数反応、6月イベント後の市場指標',
  };
});

const formulaRows = [
  {
    item: '基本設計',
    rule: '量的スコアを主軸にし、質的イベントは直接加点せず、確認条件・警戒条件・保留条件として扱う。',
    reason: 'イベントの話だけで銘柄を上げると誤判定になりやすいため。',
  },
  {
    item: '購入検討へ進む条件',
    rule: 'NISA1年保有スコア65点以上、データ信頼度70点以上、質的イベントが警戒ではない、決算後反応または20営業日確認が悪化していない。',
    reason: '数字・データ信頼度・イベント確認を同時に満たす銘柄だけを残すため。',
  },
  {
    item: '質的イベントの扱い',
    rule: 'S/A相当の質的材料でも、会社売上・受注・利益率・株価反応に接続できるまで購入候補へ直接昇格させない。',
    reason: '仮説データ層と実績データ層を混ぜないため。',
  },
  {
    item: '除外・警戒条件',
    rule: 'バフェット大幅売却、指数劣後、会社側否定、PER過熱、決算後反応悪化、日経75日線割れは警戒または保留にする。',
    reason: '上昇仮説より損失回避を優先するため。',
  },
  {
    item: '6月再判定',
    rule: 'CPI、日銀、FOMC、米10年金利、為替、日経平均75日線、対象銘柄の決算後20営業日反応を確認して再判定する。',
    reason: 'NISA 1年保有テスト前に市場環境の急変を確認するため。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '目的',
    detail: '質的イベント監視を、候補銘柄ごとの購入検討・保留・警戒・比較継続ルールへ接続した。',
  },
  {
    generated_at: generatedAt,
    item: '対象',
    detail: `NISA 1年保有スコア上位候補${ruleRows.length}件を対象に、質的イベント判定結果を接続した。`,
  },
  {
    generated_at: generatedAt,
    item: '現時点の扱い',
    detail: '本表は購入対象の確定ではない。6月イベント後の再判定に使う検証用の運用表。',
  },
];

writeCsv('623_candidate_operation_rule_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('624_candidate_operation_rule_formula.csv', formulaRows, ['item', 'rule', 'reason']);
writeCsv('625_candidate_operation_rules.csv', ruleRows, [
  'generated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'nisa_score',
  'data_confidence',
  'per',
  'pbr',
  'roe_pct',
  'hard_gate',
  'qualitative_status',
  'qualitative_score',
  'qualitative_themes',
  'decision',
  'buy_rule',
  'stop_rule',
  'reject_or_watch',
  'next_input',
]);

const decisionCounts = [...new Set(ruleRows.map((row) => row.decision))]
  .map((decision) => ({
    decision,
    count: ruleRows.filter((row) => row.decision === decision).length,
    meaning: {
      '6月再判定候補': '購入可否の最終確認へ進める候補',
      比較継続: '候補には残すが追加確認が必要',
      反応再確認: '決算後反応が弱く、追加確認が必要',
      警戒: '質的イベントまたは逆風を優先確認',
      データ補完: '主要数値が不足',
      保留: '現時点では監視のみ',
    }[decision] || '',
  }));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補銘柄 運用ルール接続表 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; --red:#a82424; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1360px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1060px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card b { display:block; font-size:26px; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:2300px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .ok { color:var(--green); font-weight:800; }
    .warn { color:var(--orange); font-weight:800; }
    .bad { color:var(--red); font-weight:800; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .cards { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      .wide table { min-width:0; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>候補銘柄 運用ルール接続表</h1>
      <p class="lead">質的イベント判定を、テスト候補・購入検討・保留・警戒の運用ルールへ接続した表です。質的材料は直接加点せず、確認条件と警戒条件として扱います。</p>
    </header>

    <section>
      <h2>1. 位置づけ</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">本表は投資実行判断ではありません。6月の市場イベントと各銘柄の追加数値を入れて、候補を再判定するための運用表です。</div>
    </section>

    <section>
      <h2>2. 判定区分</h2>
      <div class="cards">
        ${decisionCounts.map((row) => `<div class="card"><b>${esc(row.count)}件</b><span>${esc(row.decision)}</span><p>${esc(row.meaning)}</p></div>`).join('')}
      </div>
    </section>

    <section>
      <h2>3. ルール</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'rule', label: 'ルール' },
        { key: 'reason', label: '理由' },
      ], formulaRows, 'wide')}
    </section>

    <section>
      <h2>4. 候補別の運用ルール</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'sector', label: '業種' },
        { key: 'nisa_score', label: '量的スコア' },
        { key: 'data_confidence', label: '信頼度' },
        { key: 'per', label: 'PER' },
        { key: 'pbr', label: 'PBR' },
        { key: 'roe_pct', label: 'ROE' },
        { key: 'hard_gate', label: '未確認/警戒' },
        { key: 'qualitative_status', label: '質的判定' },
        { key: 'qualitative_score', label: '質的点' },
        { key: 'qualitative_themes', label: '接続テーマ' },
        { key: 'decision', label: '運用区分' },
        { key: 'buy_rule', label: '購入検討へ進む条件' },
        { key: 'stop_rule', label: '停止/撤退ルール' },
        { key: 'reject_or_watch', label: '崩れる条件' },
        { key: 'next_input', label: '次に入れる数値' },
      ], ruleRows, 'wide')}
      <div class="actions">
        <a href="623_candidate_operation_rule_summary.csv">概要CSV</a>
        <a href="624_candidate_operation_rule_formula.csv">ルールCSV</a>
        <a href="625_candidate_operation_rules.csv">候補別CSV</a>
        <a href="qual_event_scoring_engine_20260527.html">質的イベント判定へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_operation_rule_system_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  candidates: ruleRows.length,
  decisions: decisionCounts,
  output: 'candidate_operation_rule_system_20260527.html',
}, null, 2));
