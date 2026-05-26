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

const fallbackTargets = [
  'index.html',
  'issue_resolution_flowchart_20260525.html',
  'issue_recovery_board_20260525.html',
  'current_vs_history_materials_20260525.html',
  'display_wording_audit_20260525.html',
  'missing_data_score_gate_20260525.html',
  'universe_definition_20260525.html',
  'sector_adjustment_20260525.html',
  'backtest_validation_20260525.html',
  'plus1_benchmark_connection_20260525.html',
  'event_causality_validation_20260525.html',
  'event_type_reaction_db_20260526.html',
  'ipo_special_watch_corner_20260526.html',
  'june_forward_test_record_20260526.html',
  'semiconductor_structural_advantage_gate_20260526.html',
  'semiconductor_downside_resilience_20260526.html',
  'semiconductor_quant_gate_connection_20260526.html',
  'semiconductor_fundamental_completion_20260526.html',
  'candidate_june_rulebook.html',
  'prepublish_wording_check_20260526.html',
  'candidate_role_wording_20260526.html',
  'candidate_data_completion_20260526.html',
];

const rules = [
  {
    id: 'R01',
    phrase: '購入開始',
    severity: 'BLOCK',
    replacement: '開始判定 / 実施可否判断',
    reason: '購入が確定したように見えるため。',
  },
  {
    id: 'R02',
    phrase: '買う時期',
    severity: 'BLOCK',
    replacement: '開始判定 / 開始条件',
    reason: '日付だけで売買が決まる誤解を生むため。',
  },
  {
    id: 'R03',
    phrase: '新規買い',
    severity: 'BLOCK',
    replacement: '新規投入',
    reason: '売買指示に見えるため。',
  },
  {
    id: 'R04',
    phrase: '買い推奨',
    severity: 'BLOCK',
    replacement: '検証候補 / 判断補助',
    reason: '投資助言に近く見えるため。',
  },
  {
    id: 'R05',
    phrase: '投資推奨',
    severity: 'BLOCK',
    replacement: '検証候補 / 判断補助',
    reason: '投資助言に近く見えるため。',
  },
  {
    id: 'R06',
    phrase: '必ず上がる',
    severity: 'BLOCK',
    replacement: '上昇仮説 / 検証対象',
    reason: '利益保証に見えるため。',
  },
  {
    id: 'R07',
    phrase: '確実に儲かる',
    severity: 'BLOCK',
    replacement: '期待値を検証する',
    reason: '利益保証に見えるため。',
  },
  {
    id: 'R08',
    phrase: '保証',
    severity: 'WARN',
    replacement: '想定 / 検証 / 条件付き',
    reason: '保証という語は顧客説明で誤解されやすい。',
  },
  {
    id: 'R09',
    phrase: '購入候補',
    severity: 'WARN',
    replacement: '検証候補 / 確認対象',
    reason: '購入確定に近く見えるため、役割を併記する。',
  },
  {
    id: 'R10',
    phrase: '保有候補',
    severity: 'WARN',
    replacement: '検証候補',
    reason: '保有する前提に見えるため。',
  },
  {
    id: 'R11',
    phrase: '買う',
    severity: 'WARN',
    replacement: '開始する / 投入する / 検討する',
    reason: '文脈によって売買指示に見えるため。',
  },
  {
    id: 'R12',
    phrase: '売買判断',
    severity: 'CONTEXT',
    replacement: '売買判断ではない / 判断補助',
    reason: '否定文・注意文なら可。肯定文では不可。',
  },
  {
    id: 'R13',
    phrase: '購入検討',
    severity: 'CONTEXT',
    replacement: '購入検討用スコア / 購入検討へ進めない',
    reason: 'ゲートや非採用説明なら可。購入対象の断定には使わない。',
  },
  {
    id: 'R14',
    phrase: '見送り',
    severity: 'WARN',
    replacement: '保留 / 除外 / 待機',
    reason: '理由を併記して使う。',
  },
  {
    id: 'R15',
    phrase: '損切り',
    severity: 'WARN',
    replacement: '停止条件 / 損失抑制ルール',
    reason: '実売買命令に見えないよう、条件として表現する。',
  },
  {
    id: 'R16',
    phrase: '利確',
    severity: 'WARN',
    replacement: '利益確定条件 / 途中評価条件',
    reason: '実売買命令に見えないよう、条件として表現する。',
  },
];

const safeContextPatterns = [
  /ではない/,
  /ではありません/,
  /ではなく/,
  /使わない/,
  /混ぜない/,
  /しない/,
  /不可/,
  /禁止/,
  /履歴/,
  /旧/,
  /要注意/,
  /単独提示不可/,
  /検証候補/,
  /確認対象/,
  /判断補助/,
  /購入検討用スコア/,
  /購入検討へ進めない/,
  /購入ではなく/,
  /根拠にしない/,
  /指示する表現を使わない/,
  /修正前/,
  /修正後/,
  /実施が確定したように見える/,
];

const warningSafePatterns = [
  /理由/,
  /条件/,
  /保留/,
  /除外/,
  /待機/,
  /停止/,
  /検証/,
  /確認/,
  /候補ではなく/,
  /見えるため/,
  /置き換え/,
  /表現/,
];

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

function csvTargets() {
  const file = path.join(ROOT, '324_current_materials.csv');
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'))
    .filter((row) => row.kind === 'HTML')
    .map((row) => row.file);
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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stripHtml(line) {
  return line
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contextAt(lines, index, phrase) {
  const prev = stripHtml(lines[index - 1] ?? '');
  const current = stripHtml(lines[index] ?? '');
  const next = stripHtml(lines[index + 1] ?? '');
  const joined = [prev, current, next].filter(Boolean).join(' ');
  const pos = joined.indexOf(phrase);
  if (pos === -1) return joined.slice(0, 260).trim();
  return joined.slice(Math.max(0, pos - 90), pos + phrase.length + 150).trim();
}

function classify(rule, context) {
  const replacementTokens = String(rule.replacement).split(/[ /／]+/).filter((token) => token && token.length >= 3);
  const isReplacementExample = replacementTokens.some((token) => context.includes(token));
  const isSafe = safeContextPatterns.some((pattern) => pattern.test(context)) || isReplacementExample;
  if (rule.severity === 'BLOCK') return isSafe ? '許容' : '要修正';
  if (rule.severity === 'CONTEXT') return isSafe ? '許容' : '要確認';
  const warningSafe = isSafe || warningSafePatterns.some((pattern) => pattern.test(context));
  return warningSafe ? '許容' : '要確認';
}

const targets = [...new Set([...csvTargets(), ...fallbackTargets])]
  .filter((file) => fs.existsSync(path.join(ROOT, file)))
  .filter((file) => file !== 'prepublish_wording_check_20260526.html')
  .sort((a, b) => a.localeCompare(b, 'ja'));

const findingRows = [];
for (const file of targets) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (!line.includes(rule.phrase)) continue;
      const context = contextAt(lines, index, rule.phrase);
      const treatment = classify(rule, context);
      findingRows.push({
        updated_at: generatedAt,
        file,
        line: index + 1,
        rule_id: rule.id,
        phrase: rule.phrase,
        severity: rule.severity,
        treatment,
        replacement: rule.replacement,
        reason: rule.reason,
        context,
      });
    }
  });
}

const targetRows = targets.map((file) => {
  const findings = findingRows.filter((row) => row.file === file);
  const mustFix = findings.filter((row) => row.treatment === '要修正').length;
  const confirm = findings.filter((row) => row.treatment === '要確認').length;
  return {
    updated_at: generatedAt,
    file,
    target_reason: file === 'prepublish_wording_check_20260526.html'
      ? '公開前チェックページ自体'
      : '現行資料または現行補助として台帳に登録',
    finding_count: findings.length,
    must_fix_count: mustFix,
    confirm_count: confirm,
    gate: mustFix > 0 ? '公開前修正' : confirm > 0 ? '人間確認後に公開可' : '公開可',
  };
});

const mustFixRows = findingRows.filter((row) => row.treatment === '要修正');
const confirmRows = findingRows.filter((row) => row.treatment === '要確認');
const summaryRows = [
  {
    updated_at: generatedAt,
    item: '監査対象HTML',
    value: `${targets.length}件`,
    interpretation: '現行資料・現行補助・公開前チェックページを対象に確認。',
  },
  {
    updated_at: generatedAt,
    item: '公開前修正が必要',
    value: `${mustFixRows.length}件`,
    interpretation: mustFixRows.length ? 'このまま公開しない。文言修正が必要。' : 'ブロック対象の強い表現はなし。',
  },
  {
    updated_at: generatedAt,
    item: '人間確認が必要',
    value: `${confirmRows.length}件`,
    interpretation: '否定文・注意文ではない可能性がある表現。公開前に文脈確認する。',
  },
  {
    updated_at: generatedAt,
    item: '全体ゲート',
    value: mustFixRows.length ? '停止' : '通過',
    interpretation: mustFixRows.length
      ? '要修正表現が残るため、顧客向け現行導線としては止める。'
      : '自動チェック上は公開前ゲートを通過。要確認は人間が文脈確認する。',
  },
];

const operationRows = [
  {
    step: '1',
    operation: 'ページ作成後にスクリプトを実行',
    command: 'node tools/build_prepublish_wording_check.mjs',
    output: '328〜331 CSVとHTMLレポートを更新',
  },
  {
    step: '2',
    operation: '要修正が0件か確認',
    command: '329_prepublish_wording_findings.csv の treatment を確認',
    output: '要修正が1件以上なら公開前に修正',
  },
  {
    step: '3',
    operation: '資料区分台帳へ登録',
    command: 'node tools/build_material_registry.mjs',
    output: '現行資料・履歴資料の区分を再生成',
  },
  {
    step: '4',
    operation: '公開前の最終確認',
    command: 'HTML表示確認 + GitHub Pages反映確認',
    output: '顧客向け導線に入れる',
  },
];

writeCsv('328_prepublish_wording_rules.csv', rules.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'id',
  'phrase',
  'severity',
  'replacement',
  'reason',
]);

writeCsv('329_prepublish_wording_findings.csv', findingRows, [
  'updated_at',
  'file',
  'line',
  'rule_id',
  'phrase',
  'severity',
  'treatment',
  'replacement',
  'reason',
  'context',
]);

writeCsv('330_prepublish_wording_targets.csv', targetRows, [
  'updated_at',
  'file',
  'target_reason',
  'finding_count',
  'must_fix_count',
  'confirm_count',
  'gate',
]);

writeCsv('331_prepublish_wording_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('332_prepublish_wording_operation.csv', operationRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'step',
  'operation',
  'command',
  'output',
]);

const badgeClass = (treatment) => {
  if (treatment === '要修正') return 'stop';
  if (treatment === '要確認') return 'warn';
  return 'ok';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>公開前 文言自動チェック 2026年5月26日</title>
  <style>
    :root {
      --ink:#111;
      --blue:#073a5a;
      --line:#bed3e5;
      --bg:#f5f8fb;
      --card:#fff;
      --ok:#eaf7ef;
      --warn:#fff5df;
      --stop:#fdecec;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic", Meiryo, sans-serif; color:var(--ink); background:var(--bg); line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:28px 18px 56px; }
    h1 { margin:0 0 8px; color:var(--blue); font-size:30px; }
    h2 { margin:30px 0 12px; padding-left:10px; border-left:8px solid #0b6f9f; color:var(--blue); }
    .lead, .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 18px; box-shadow:0 2px 9px rgba(0,40,80,.06); }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-block; padding:8px 12px; border:1px solid #9fc1db; border-radius:8px; background:#fff; color:var(--blue); text-decoration:none; font-weight:700; }
    .kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:18px 0; }
    .kpi { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; min-height:112px; }
    .kpi small { display:block; color:#38536b; font-weight:700; }
    .kpi b { display:block; font-size:28px; color:var(--blue); }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th, td { border:1px solid var(--line); padding:9px 10px; vertical-align:top; font-size:13px; overflow-wrap:anywhere; color:#111; }
    th { background:#e4f1fa; color:var(--blue); }
    .badge { display:inline-block; min-width:76px; text-align:center; padding:2px 8px; border-radius:999px; font-weight:800; font-size:12px; }
    .ok { background:var(--ok); color:#007a3d; }
    .warn { background:var(--warn); color:#8a5200; }
    .stop { background:var(--stop); color:#b00020; }
    .flow { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .step { background:#fff; border:1px solid var(--line); border-radius:10px; padding:13px; min-height:120px; }
    .note { color:#333; font-size:13px; }
    @media (max-width:900px){ .kpis,.flow{grid-template-columns:1fr;} }
    @media print { body{background:#fff;} .lead,.card,.kpi,.step,table,tr,td,th{break-inside:avoid; page-break-inside:avoid; box-shadow:none;} }
  </style>
</head>
<body>
<main>
  <h1>公開前 文言自動チェック</h1>
  <div class="lead">
    <p><b>目的:</b> 新しいHTMLページを公開する前に、購入が確定したように見える表現や、検証段階と売買判断を混同させる表現を自動で拾います。</p>
    <p><b>扱い:</b> このチェックは投資判断ではありません。顧客向け資料の誤解を減らすための品質管理です。要修正が1件でもあれば、公開前に文言を直します。</p>
    <div class="toolbar">
      <a class="button" href="328_prepublish_wording_rules.csv">328 ルールCSV</a>
      <a class="button" href="329_prepublish_wording_findings.csv">329 検出CSV</a>
      <a class="button" href="330_prepublish_wording_targets.csv">330 対象CSV</a>
      <a class="button" href="331_prepublish_wording_summary.csv">331 要約CSV</a>
      <a class="button" href="332_prepublish_wording_operation.csv">332 運用CSV</a>
      <a class="button" href="display_wording_audit_20260525.html">表示文言監査へ</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </div>

  <div class="kpis">
    ${summaryRows.map((row) => `
      <div class="kpi">
        <small>${esc(row.item)}</small>
        <b>${esc(row.value)}</b>
        <span>${esc(row.interpretation)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. 運用手順</h2>
  <div class="flow">
    ${operationRows.map((row) => `
      <div class="step">
        <b>${esc(row.step)}. ${esc(row.operation)}</b><br>
        <span>${esc(row.command)}</span><br>
        <small>${esc(row.output)}</small>
      </div>
    `).join('')}
  </div>

  <h2>2. 監査対象</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:28%">ファイル</th><th>対象理由</th><th style="width:12%">検出数</th><th style="width:12%">要修正</th><th style="width:12%">要確認</th><th style="width:16%">ゲート</th></tr></thead>
      <tbody>
        ${targetRows.map((row) => `
          <tr>
            <td><a href="${esc(row.file)}">${esc(row.file)}</a></td>
            <td>${esc(row.target_reason)}</td>
            <td>${esc(row.finding_count)}</td>
            <td>${esc(row.must_fix_count)}</td>
            <td>${esc(row.confirm_count)}</td>
            <td><span class="badge ${row.gate === '公開前修正' ? 'stop' : row.gate === '人間確認後に公開可' ? 'warn' : 'ok'}">${esc(row.gate)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 検出結果</h2>
  <div class="card">
    <p class="note">「許容」は、否定文、禁止説明、履歴扱い、検証候補の説明など、安全な文脈として判定したものです。「要確認」は人間が文脈を確認します。</p>
    <table>
      <thead><tr><th style="width:22%">ファイル</th><th style="width:6%">行</th><th style="width:8%">規則</th><th style="width:12%">表現</th><th style="width:10%">判定</th><th>文脈</th><th style="width:16%">置き換え</th></tr></thead>
      <tbody>
        ${findingRows.length ? findingRows.map((row) => `
          <tr>
            <td>${esc(row.file)}</td>
            <td>${esc(row.line)}</td>
            <td>${esc(row.rule_id)}</td>
            <td>${esc(row.phrase)}</td>
            <td><span class="badge ${badgeClass(row.treatment)}">${esc(row.treatment)}</span></td>
            <td>${esc(row.context)}</td>
            <td>${esc(row.replacement)}</td>
          </tr>
        `).join('') : '<tr><td colspan="7">検出なし</td></tr>'}
      </tbody>
    </table>
  </div>

  <h2>4. ルール</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:8%">ID</th><th style="width:14%">表現</th><th style="width:12%">厳しさ</th><th style="width:22%">置き換え</th><th>理由</th></tr></thead>
      <tbody>
        ${rules.map((row) => `
          <tr>
            <td>${esc(row.id)}</td>
            <td>${esc(row.phrase)}</td>
            <td>${esc(row.severity)}</td>
            <td>${esc(row.replacement)}</td>
            <td>${esc(row.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'prepublish_wording_check_20260526.html'), cleanLines(html), 'utf8');

console.log(`generated prepublish wording check: ${targets.length} targets, ${mustFixRows.length} must-fix, ${confirmRows.length} confirm`);
