import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_UNIVERSE = '209_meaningful_universe_v2.csv';
const SOURCE_SCREENING = '199_universe100_screening.csv';

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
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(ROOT, file), 'utf8'));
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

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || '未分類';
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([name, count]) => ({ name, count }));
}

const universeRows = readCsv(SOURCE_UNIVERSE);
const screeningRows = fs.existsSync(path.join(ROOT, SOURCE_SCREENING)) ? readCsv(SOURCE_SCREENING) : [];
const screeningByTicker = new Map(screeningRows.map((row) => [row.ticker, row]));

const policyRows = [
  {
    rule_id: 'U01',
    rule_name: '母集団は売買対象ではなく検証対象',
    fixed_rule: '100社前後の母集団は、NISA 1年保有候補を探すための比較対象群であり、この段階で購入検討対象とは呼ばない。件数は固定せず、品質を優先する。',
    pass_condition: '各銘柄に検証上の役割が付いている。',
    fail_action: '役割が説明できない銘柄は母集団から外す。',
  },
  {
    rule_id: 'U02',
    rule_name: '役割を必ず付与',
    fixed_rule: '指数比較、大型代表、NISA 1年保有、時流テーマ、マクロ感応、テンバガー探索のいずれかの役割を付ける。',
    pass_condition: 'universe_roles または primary_purpose が空欄でない。',
    fail_action: '役割不明として除外または補充待ちにする。',
  },
  {
    rule_id: 'U03',
    rule_name: 'データ取得状況を分ける',
    fixed_rule: '株価、業績、チャートの取得状況を同列に扱わず、未取得は順位や購入検討用スコアに混ぜない。',
    pass_condition: 'quote_status、performance_status、chart_status を記録する。',
    fail_action: '未取得項目は非加点。重要項目が取れない場合は検証候補へ進めない。',
  },
  {
    rule_id: 'U04',
    rule_name: '数合わせをしない',
    fixed_rule: '100社ぴったりにすることを目的にしない。現行版は約100社を目安にするが、品質を優先し、除外や補充はログに残す。',
    pass_condition: '追加・除外理由が記録されている。',
    fail_action: '理由のない追加はしない。',
  },
  {
    rule_id: 'U05',
    rule_name: '同一テーマの偏りを管理',
    fixed_rule: 'AI、半導体、銀行などに偏りすぎると分散検証にならないため、テーマとセクターの内訳を表示する。',
    pass_condition: 'sector、theme、primary_purpose の分布を確認できる。',
    fail_action: '偏りが強い場合は、代表銘柄へ絞るか補充ルールで調整する。',
  },
  {
    rule_id: 'U06',
    rule_name: '検証前に条件を固定',
    fixed_rule: '6月テスト前にこの母集団定義を固定し、スコア結果を見た後で都合よく母集団を入れ替えない。',
    pass_condition: '固定日、入力ファイル、変更ルールを明記する。',
    fail_action: '変更が必要な場合は、変更前後と理由を別ログに残す。',
  },
];

const exclusionRows = [
  {
    exclusion_id: 'E01',
    condition: '上場銘柄コードや対象企業名が確認できない',
    reason: '株価・決算・公式資料へ接続できず、検証対象として再現できない。',
    action: '母集団から除外。',
  },
  {
    exclusion_id: 'E02',
    condition: '役割が説明できない',
    reason: 'なぜ比較対象に入っているのか説明できない銘柄は恣意的に見える。',
    action: '除外または補充待ち。',
  },
  {
    exclusion_id: 'E03',
    condition: '株価・業績・チャートの主要データがほぼ未取得',
    reason: 'スコア計算に使えず、計算したふりになる。',
    action: '探索メモに留め、検証候補へ進めない。',
  },
  {
    exclusion_id: 'E04',
    condition: '話題性だけで数値根拠がない',
    reason: '質的イベントを直接加点すると誤判定になる。',
    action: '仮説メモ扱い。過去反応や公式数値が取れるまで母集団入りさせない。',
  },
  {
    exclusion_id: 'E05',
    condition: '同一テーマの重複が強すぎる',
    reason: '10社テストが同じリスクに偏る。',
    action: '代表銘柄に絞り、残りは比較候補へ移す。',
  },
];

const replenishmentRows = [
  {
    group: '小中型成長株',
    add_rule: '時価総額500億〜5,000億円、売上成長10%以上、赤字拡大なし、出来高あり。',
    purpose: '大型株だけでは+1%超過の余地が小さいため、成長余地を検証する。',
  },
  {
    group: '政策・国策テーマ',
    add_rule: 'AI電力、防衛、防災、省人化など、政策資料・業界統計・会社受注に数字がある銘柄だけ追加。',
    purpose: '質的テーマを仮説で止めず、数字に接続できる銘柄を入れる。',
  },
  {
    group: '決算上方修正・増配・自社株買い',
    add_rule: 'TDnet、IR、J-Quants等で上方修正、増配、自社株買いを確認できる銘柄。',
    purpose: '1年保有で株価反応が起きやすいイベントの検証対象にする。',
  },
  {
    group: '指数比較・守り枠',
    add_rule: '大型・高流動性・配当または安定利益があり、指数との比較対象として使える銘柄。',
    purpose: '個別株を選ぶ意味があるか、無難な運用との比較に使う。',
  },
];

const auditRows = universeRows.map((row, index) => {
  const screen = screeningByTicker.get(row.ticker) || {};
  const hasRole = Boolean(row.universe_roles || row.primary_purpose);
  const dataStatuses = [row.quote_status, row.performance_status, row.chart_status].filter(Boolean);
  const acquiredCount = dataStatuses.filter((value) => value === '取得').length;
  const fixedStatus = hasRole && acquiredCount >= 2 ? '母集団採用' : '確認待ち';
  return {
    updated_at: generatedAt,
    fixed_universe_id: index + 1,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    theme: row.theme,
    primary_purpose: row.primary_purpose,
    usefulness_level: row.usefulness_level,
    roles: row.universe_roles,
    quote_status: row.quote_status,
    performance_status: row.performance_status,
    chart_status: row.chart_status,
    data_acquired_count: acquiredCount,
    universe_score: row.score || screen.universe_score_100 || '',
    reason_in_universe: row.reason_in_universe,
    fixed_status: fixedStatus,
    fixed_reason: fixedStatus === '母集団採用'
      ? '役割があり、主要データ取得状況を確認できる。'
      : '役割または主要データ取得状況の確認が不足。',
  };
});

const summaryRows = [
  { item: '固定日', value: generatedAt, note: 'この時点の母集団定義として扱う。' },
  { item: '入力母集団', value: `${universeRows.length}社`, note: SOURCE_UNIVERSE },
  { item: '採用扱い', value: `${auditRows.filter((row) => row.fixed_status === '母集団採用').length}社`, note: '役割と主要データ取得状況を確認できる銘柄。' },
  { item: '確認待ち', value: `${auditRows.filter((row) => row.fixed_status !== '母集団採用').length}社`, note: '母集団には残すが、検証候補化には追加確認が必要。' },
  { item: '次工程', value: '業種別補正', note: 'PER/PBR/ROEを業種内で比較する準備へ進む。' },
];

const sectorRows = countBy(auditRows, 'sector').map((row) => ({ updated_at: generatedAt, group_type: 'sector', ...row }));
const purposeRows = countBy(auditRows, 'primary_purpose').map((row) => ({ updated_at: generatedAt, group_type: 'primary_purpose', ...row }));
const usefulnessRows = countBy(auditRows, 'usefulness_level').map((row) => ({ updated_at: generatedAt, group_type: 'usefulness_level', ...row }));
const distributionRows = [...sectorRows, ...purposeRows, ...usefulnessRows];

writeCsv('293_universe_fixed_policy.csv', policyRows, ['rule_id', 'rule_name', 'fixed_rule', 'pass_condition', 'fail_action']);
writeCsv('294_universe_membership_audit.csv', auditRows, [
  'updated_at',
  'fixed_universe_id',
  'ticker',
  'company',
  'sector',
  'theme',
  'primary_purpose',
  'usefulness_level',
  'roles',
  'quote_status',
  'performance_status',
  'chart_status',
  'data_acquired_count',
  'universe_score',
  'reason_in_universe',
  'fixed_status',
  'fixed_reason',
]);
writeCsv('295_universe_distribution.csv', distributionRows, ['updated_at', 'group_type', 'name', 'count']);
writeCsv('296_universe_exclusion_rules.csv', exclusionRows, ['exclusion_id', 'condition', 'reason', 'action']);
writeCsv('297_universe_replenishment_fixed_rules.csv', replenishmentRows, ['group', 'add_rule', 'purpose']);
writeCsv('298_universe_definition_summary.csv', summaryRows, ['item', 'value', 'note']);

const topRows = (rows, limit = 12) => rows.slice(0, limit);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>100社前後の母集団 条件固定 2026年5月25日</title>
  <style>
    body { margin:0; font-family:"Yu Gothic", Meiryo, sans-serif; color:#111; background:#f5f8fb; line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:28px 18px 54px; }
    h1 { margin:0 0 8px; color:#073a5a; font-size:28px; }
    h2 { margin:30px 0 12px; padding-left:10px; border-left:8px solid #0b6f9f; color:#073a5a; }
    .card, .lead { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .grid { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi span { display:block; color:#42526b; font-size:13px; }
    .kpi b { display:block; color:#073a5a; font-size:24px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; margin-top:12px; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; vertical-align:top; overflow-wrap:anywhere; font-size:12.5px; }
    th { background:#e4f1fa; color:#073a5a; }
    .ok { color:#007a3d; font-weight:800; }
    .warn { color:#9a5b00; font-weight:800; }
    .formula { font-family:Consolas, "Yu Gothic", Meiryo, sans-serif; background:#f7fbff; border:1px solid #cbddeb; border-radius:8px; padding:12px; }
    a { color:#075985; font-weight:700; }
    @media print { body { background:#fff; } table, tr, td, th, .card, .lead, .kpi { break-inside:avoid; page-break-inside:avoid; box-shadow:none; } }
  </style>
</head>
<body>
<main>
  <h1>100社前後の母集団 条件固定</h1>
  <div class="lead">
    <p><b>目的:</b> 「都合のよい100社を後から選んだ」と見えないように、検証対象となる母集団の条件、除外条件、補充ルールを固定します。</p>
    <p><b>結論:</b> 現行の100社前後の母集団は売買対象ではなく、NISA 1年保有テスト候補を探すための比較母集団です。役割・データ取得状況・除外条件を記録し、スコア結果を見てから恣意的に入れ替えない運用にします。件数は90〜120社程度を許容し、無理に100社へ合わせません。</p>
    <p><a href="index.html">メインページへ戻る</a> / <a href="issue_resolution_flowchart_20260525.html">課題解決フローへ戻る</a></p>
  </div>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>固定ルール</h2>
  <table>
    <thead><tr><th style="width:8%">ID</th><th style="width:18%">ルール</th><th>固定内容</th><th style="width:22%">通過条件</th><th style="width:20%">落ちた場合</th></tr></thead>
    <tbody>
      ${policyRows.map((row) => `<tr>
        <td>${esc(row.rule_id)}</td>
        <td><b>${esc(row.rule_name)}</b></td>
        <td>${esc(row.fixed_rule)}</td>
        <td>${esc(row.pass_condition)}</td>
        <td>${esc(row.fail_action)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>母集団の作り方</h2>
  <div class="card">
    <div class="formula">
      1. 役割を持つ日本株を一次母集団に入れる。<br>
      2. 株価・業績・チャートの取得状況を記録する。<br>
      3. 役割不明、データ未取得、話題性だけの銘柄は検証候補へ進めない。<br>
      4. スコア後に都合よく母集団を入れ替えない。変更する場合は、補充ルールと変更理由を残す。
    </div>
  </div>

  <h2>除外条件</h2>
  <table>
    <thead><tr><th style="width:8%">ID</th><th>条件</th><th>理由</th><th style="width:22%">扱い</th></tr></thead>
    <tbody>
      ${exclusionRows.map((row) => `<tr>
        <td>${esc(row.exclusion_id)}</td>
        <td>${esc(row.condition)}</td>
        <td>${esc(row.reason)}</td>
        <td>${esc(row.action)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>補充ルール</h2>
  <table>
    <thead><tr><th style="width:18%">補充枠</th><th>追加条件</th><th style="width:28%">目的</th></tr></thead>
    <tbody>
      ${replenishmentRows.map((row) => `<tr>
        <td><b>${esc(row.group)}</b></td>
        <td>${esc(row.add_rule)}</td>
        <td>${esc(row.purpose)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>分布確認</h2>
  <table>
    <thead><tr><th style="width:22%">区分</th><th>名前</th><th style="width:12%">件数</th></tr></thead>
    <tbody>
      ${topRows(distributionRows, 24).map((row) => `<tr>
        <td>${esc(row.group_type)}</td>
        <td>${esc(row.name)}</td>
        <td>${esc(row.count)}社</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>母集団監査表 上位30件</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">ID</th>
        <th style="width:14%">銘柄</th>
        <th style="width:10%">業種</th>
        <th style="width:13%">主目的</th>
        <th style="width:10%">有用度</th>
        <th style="width:13%">取得状況</th>
        <th>母集団理由</th>
        <th style="width:10%">固定状態</th>
      </tr>
    </thead>
    <tbody>
      ${auditRows.slice(0, 30).map((row) => `<tr>
        <td>${esc(row.fixed_universe_id)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td>${esc(row.sector)}</td>
        <td>${esc(row.primary_purpose)}</td>
        <td>${esc(row.usefulness_level)}</td>
        <td>株価:${esc(row.quote_status)}<br>業績:${esc(row.performance_status)}<br>チャート:${esc(row.chart_status)}</td>
        <td>${esc(row.reason_in_universe)}</td>
        <td class="${row.fixed_status === '母集団採用' ? 'ok' : 'warn'}">${esc(row.fixed_status)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>次の工程</h2>
  <div class="card">
    <p>次は、業種別補正へ進みます。PER/PBR/ROEは業種ごとに意味が違うため、半導体、銀行、食品、保険、通信などを同じ閾値で比較しない形に直します。</p>
    <p>更新日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'universe_definition_20260525.html'), html, 'utf8');

console.log(`generated universe definition: ${universeRows.length} rows`);
