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
  'missing_data_score_gate_20260525.html',
  'universe_definition_20260525.html',
  'sector_adjustment_20260525.html',
  'backtest_validation_20260525.html',
  'plus1_benchmark_connection_20260525.html',
  'event_causality_validation_20260525.html',
  'candidate_june_rulebook.html',
];

const roleRules = [
  {
    role: '比較母集団',
    allowed_terms: '比較母集団 / 比較対象群 / 100社前後の母集団',
    meaning: '候補を探す前の広いリスト。購入検討対象ではない。',
    example: '100社前後の比較母集団から、検証候補を抽出する。',
  },
  {
    role: '検証候補',
    allowed_terms: '検証候補 / NISA 1年保有テスト検証候補',
    meaning: '数値・IR・イベントを深掘りする銘柄。まだ購入確定ではない。',
    example: '6月イベント後に深掘りする検証候補として残す。',
  },
  {
    role: '確認対象',
    allowed_terms: '確認対象 / 追加確認対象 / 条件確認対象',
    meaning: '未取得データ、IR、決算後反応、イベント結果を確認する段階。',
    example: '決算後20営業日反応が未到達のため、追加確認対象にする。',
  },
  {
    role: '保留',
    allowed_terms: '保留 / 再判定待ち / 待機',
    meaning: '数値は悪くないが、過熱・未確認・イベント待ちが残る段階。',
    example: '高PERと金利イベント待ちが残るため、保留にする。',
  },
  {
    role: '除外',
    allowed_terms: '除外 / 初回除外 / テスト対象外',
    meaning: 'ハードゲートにより、初回NISAテストには進めない段階。',
    example: 'データ信頼度70未満のため、初回テスト対象外にする。',
  },
  {
    role: '購入検討',
    allowed_terms: '購入検討用スコア / 購入検討可否判定',
    meaning: '6月イベント、公式IR、証券会社画面の確認後にだけ使う最終手前の言葉。',
    example: '購入検討用スコアは、未取得データを混ぜずに算出する。',
  },
];

const rewriteExamples = [
  {
    before: '候補',
    after: '検証候補 / 確認対象 / 保留 / 除外のいずれか',
    reason: '候補だけでは購入可能銘柄に見えるため。',
  },
  {
    before: '10社候補 / 現候補',
    after: '10社検証候補 / 現行検証候補',
    reason: 'テスト前の深掘り対象であり、購入確定ではないため。',
  },
  {
    before: '保有候補',
    after: 'NISA 1年保有テスト検証候補',
    reason: '保有する前提に見えるため、テスト検証段階を明示する。',
  },
  {
    before: '購入候補',
    after: '購入検討可否の確認対象',
    reason: '購入推奨に近く見えるため、確認段階に戻す。',
  },
  {
    before: '確認候補',
    after: '追加確認対象',
    reason: '候補よりも、何をする段階かが明確になるため。',
  },
  {
    before: '候補維持',
    after: '検証候補として継続 / 保留継続',
    reason: '維持する対象が購入候補なのか検証候補なのかを分けるため。',
  },
];

const riskyPatterns = [
  {
    pattern: /購入候補|保有候補|買い候補/g,
    severity: '要修正',
    role: '購入に見える表現',
    suggestion: '検証候補 / 購入検討可否の確認対象',
  },
  {
    pattern: /購入検討対象/g,
    severity: '要確認',
    role: '購入検討',
    suggestion: '購入検討可否の確認対象 / 購入検討へ進めない',
  },
  {
    pattern: /10社候補|候補10社|現候補|候補別|候補銘柄|候補群/g,
    severity: '要役割付け',
    role: '検証候補',
    suggestion: '10社検証候補 / 現行検証候補 / 検証候補別',
  },
  {
    pattern: /予備候補|確認候補|追加候補|分割候補/g,
    severity: '要役割付け',
    role: '確認対象',
    suggestion: '予備検証候補 / 追加確認対象 / 分割検証候補',
  },
  {
    pattern: /候補維持/g,
    severity: '要役割付け',
    role: '保留',
    suggestion: '検証候補として継続 / 保留継続',
  },
];

const safePatterns = [
  /検証候補/,
  /確認対象/,
  /比較候補/,
  /探索候補/,
  /調査候補/,
  /除外候補/,
  /保留候補/,
  /補充候補/,
  /PDF数値候補/,
  /数値候補/,
  /候補抽出システム/,
  /候補を探す/,
  /候補ではなく/,
  /候補とは別/,
  /候補へ進めない/,
  /候補にしない/,
  /購入検討対象ではない/,
  /購入対象の確定ではない/,
  /購入確定ではなく/,
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

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
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

function classify(match, context) {
  if (safePatterns.some((pattern) => pattern.test(context))) return '許容';
  if (match.severity === '要修正') return '要修正';
  if (match.severity === '要確認' && /ではない|へ進めない|対象ではなく|呼ばない|根拠にしない/.test(context)) return '許容';
  return match.severity;
}

const targets = [...new Set(fallbackTargets)]
  .filter((file) => fs.existsSync(path.join(ROOT, file)))
  .filter((file) => file !== 'candidate_role_wording_20260526.html')
  .sort((a, b) => a.localeCompare(b, 'ja'));

const findingRows = [];
for (const file of targets) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const item of riskyPatterns) {
      const matches = [...line.matchAll(item.pattern)];
      for (const found of matches) {
        const phrase = found[0];
        const context = contextAt(lines, index, phrase);
        const treatment = classify(item, context);
        findingRows.push({
          updated_at: generatedAt,
          file,
          line: index + 1,
          phrase,
          role: item.role,
          treatment,
          suggestion: item.suggestion,
          context,
        });
      }
    }
  });
}

const mustFixRows = findingRows.filter((row) => row.treatment === '要修正');
const roleNeededRows = findingRows.filter((row) => row.treatment === '要役割付け');
const confirmRows = findingRows.filter((row) => row.treatment === '要確認');
const okRows = findingRows.filter((row) => row.treatment === '許容');

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '監査対象HTML',
    value: `${targets.length}件`,
    interpretation: '現行導線の主要HTMLで、候補表現の役割を確認。',
  },
  {
    updated_at: generatedAt,
    item: '購入に見える要修正',
    value: `${mustFixRows.length}件`,
    interpretation: mustFixRows.length ? '購入・保有に見える語が残っている。' : '購入・保有に見える強い語は自動検出上なし。',
  },
  {
    updated_at: generatedAt,
    item: '役割付けが必要',
    value: `${roleNeededRows.length}件`,
    interpretation: '候補という語に、検証・確認・保留・除外などの役割を付ける対象。',
  },
  {
    updated_at: generatedAt,
    item: '文脈確認',
    value: `${confirmRows.length}件`,
    interpretation: '購入検討対象など、文脈により誤読される可能性がある表現。',
  },
  {
    updated_at: generatedAt,
    item: '許容',
    value: `${okRows.length}件`,
    interpretation: '検証候補、確認対象、否定文など、役割が読める表現。',
  },
];

const operationRows = [
  {
    step: 1,
    operation: '候補表現を検出',
    command: 'node tools/build_candidate_role_wording.mjs',
    output: '333〜337 CSVとHTMLを生成',
  },
  {
    step: 2,
    operation: '強い表現を確認',
    command: '333_candidate_role_rules.csv / 334_candidate_role_findings.csv',
    output: '購入・保有に見える語と、役割付けが必要な語を分ける',
  },
  {
    step: 3,
    operation: '公開前チェックへ接続',
    command: 'node tools/build_prepublish_wording_check.mjs',
    output: '新規ページも文言チェック対象へ入れる',
  },
];

writeCsv('333_candidate_role_rules.csv', roleRules.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'role',
  'allowed_terms',
  'meaning',
  'example',
]);

writeCsv('334_candidate_role_findings.csv', findingRows, [
  'updated_at',
  'file',
  'line',
  'phrase',
  'role',
  'treatment',
  'suggestion',
  'context',
]);

writeCsv('335_candidate_role_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('336_candidate_role_rewrite_examples.csv', rewriteExamples.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'before',
  'after',
  'reason',
]);

writeCsv('337_candidate_role_operation.csv', operationRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'step',
  'operation',
  'command',
  'output',
]);

const badgeClass = (treatment) => {
  if (treatment === '要修正') return 'stop';
  if (treatment === '許容') return 'ok';
  return 'warn';
};

const shownFindings = findingRows
  .filter((row) => row.treatment !== '許容')
  .slice(0, 180);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補表現ロール整理 2026年5月26日</title>
  <style>
    :root {
      --ink: #111;
      --blue: #073a5a;
      --line: #bed3e5;
      --bg: #f5f8fb;
      --card: #fff;
      --ok: #eaf7ef;
      --warn: #fff5df;
      --stop: #fdecec;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", Meiryo, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card, .kpi {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-block;
      padding: 8px 12px;
      border: 1px solid #9fc1db;
      border-radius: 8px;
      background: #fff;
      color: var(--blue);
      text-decoration: none;
      font-weight: 700;
    }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; color: var(--blue); font-size: 24px; }
    .role-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .role-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
      padding: 12px;
    }
    .role-card b { color: var(--blue); font-size: 16px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      color: #111;
      overflow-wrap: anywhere;
    }
    th { background: #e4f1fa; color: var(--blue); }
    .badge {
      display: inline-block;
      min-width: 78px;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 12px;
    }
    .ok { background: var(--ok); color: #007a3d; }
    .warn { background: var(--warn); color: #8a5200; }
    .stop { background: var(--stop); color: #b00020; }
    .note { color: #333; font-size: 13px; }
    @media (max-width: 980px) {
      .kpis, .role-grid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi, .role-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>候補表現ロール整理</h1>
  <div class="lead">
    <p><b>目的:</b> 「候補」という言葉が、購入できる銘柄のように見える問題を避けるため、各画面の候補表現を役割別に整理します。</p>
    <p><b>結論:</b> 今後は、候補だけで終わらせず、比較母集団・検証候補・確認対象・保留・除外・購入検討可否判定のどれかに寄せます。</p>
    <div class="toolbar">
      <a class="button" href="333_candidate_role_rules.csv">333 ロール定義CSV</a>
      <a class="button" href="334_candidate_role_findings.csv">334 検出CSV</a>
      <a class="button" href="335_candidate_role_summary.csv">335 要約CSV</a>
      <a class="button" href="336_candidate_role_rewrite_examples.csv">336 置換例CSV</a>
      <a class="button" href="display_wording_audit_20260525.html">表示文言監査へ</a>
      <a class="button" href="prepublish_wording_check_20260526.html">公開前文言チェックへ</a>
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

  <h2>1. 使うロール</h2>
  <div class="role-grid">
    ${roleRules.map((row) => `
      <div class="role-card">
        <b>${esc(row.role)}</b>
        <p><b>使う表現:</b> ${esc(row.allowed_terms)}</p>
        <p>${esc(row.meaning)}</p>
        <p class="note">例: ${esc(row.example)}</p>
      </div>
    `).join('')}
  </div>

  <h2>2. 置き換えルール</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:24%">修正前</th><th style="width:28%">修正後</th><th>理由</th></tr></thead>
      <tbody>
        ${rewriteExamples.map((row) => `
          <tr>
            <td>${esc(row.before)}</td>
            <td>${esc(row.after)}</td>
            <td>${esc(row.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 要整理リスト</h2>
  <div class="card">
    <p class="note">下表は、現行資料内で「候補」の役割が弱い可能性がある箇所です。許容文脈はCSVに記録し、画面では要整理分を優先表示しています。</p>
    <table>
      <thead><tr><th style="width:18%">ファイル</th><th style="width:7%">行</th><th style="width:12%">表現</th><th style="width:12%">扱い</th><th style="width:15%">推奨ロール</th><th style="width:20%">推奨表現</th><th>文脈</th></tr></thead>
      <tbody>
        ${shownFindings.length ? shownFindings.map((row) => `
          <tr>
            <td>${esc(row.file)}</td>
            <td>${esc(row.line)}</td>
            <td>${esc(row.phrase)}</td>
            <td><span class="badge ${badgeClass(row.treatment)}">${esc(row.treatment)}</span></td>
            <td>${esc(row.role)}</td>
            <td>${esc(row.suggestion)}</td>
            <td>${esc(row.context)}</td>
          </tr>
        `).join('') : '<tr><td colspan="7">要整理の候補表現はありません。</td></tr>'}
      </tbody>
    </table>
  </div>

  <h2>4. 運用</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:8%">順番</th><th style="width:24%">作業</th><th>コマンド</th><th style="width:28%">出力</th></tr></thead>
      <tbody>
        ${operationRows.map((row) => `
          <tr>
            <td>${esc(row.step)}</td>
            <td>${esc(row.operation)}</td>
            <td>${esc(row.command)}</td>
            <td>${esc(row.output)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'candidate_role_wording_20260526.html'), cleanLines(html), 'utf8');

console.log(`generated candidate role wording: ${targets.length} targets, ${mustFixRows.length} must-fix, ${roleNeededRows.length} need-role`);
