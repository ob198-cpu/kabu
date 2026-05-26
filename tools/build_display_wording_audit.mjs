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

const targetFiles = [
  'index.html',
  'issue_resolution_flowchart_20260525.html',
  'issue_recovery_board_20260525.html',
  'terminology_cleanup_20260525.html',
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
  'semiconductor_june_recheck_checklist_20260526.html',
  'semiconductor_june_result_input_cockpit_20260526.html',
  'semiconductor_forward_log_bridge_20260526.html',
  'semiconductor_june_dry_run_test_20260526.html',
  'semiconductor_dry_run_verification_20260526.html',
  'candidate_10_priority_completion_20260526.html',
  'june_test_10_selection_board_20260526.html',
  'candidate_10_completion_workbench_20260526.html',
  'candidate_10_event_evidence_workbench_20260526.html',
  'candidate_10_event_evidence_dryrun_verification_20260526.html',
  'june_10_finalization_sprint_20260526.html',
  'immediate_completion_input_map_20260526.html',
  'immediate_completion_score_bridge_20260526.html',
  'missing_per_peer_fetch_queue_20260526.html',
  'existing_metric_reuse_scan_20260526.html',
  'external_metric_source_feasibility_20260526.html',
  'candidate_10_rational_selection_board_20260526.html',
  'candidate_10_explanation_cards_20260526.html',
];

const phraseRules = [
  {
    phrase: '購入開始',
    level: '禁止',
    replacement: '開始判定 / 実施可否判断',
    note: '売買を確定したように見えるため、現行表示では使わない。',
  },
  {
    phrase: '買う時期',
    level: '禁止',
    replacement: '開始判定 / 開始条件',
    note: '日付だけで売買が決まる誤解を生むため、条件判定に置き換える。',
  },
  {
    phrase: '新規買い',
    level: '禁止',
    replacement: '新規投入',
    note: '実売買を直接指示しているように見えるため、資金投入の判定表現へ置き換える。',
  },
  {
    phrase: '購入候補',
    level: '禁止',
    replacement: '検証候補 / 確認対象',
    note: '購入確定に近く見えるため、現段階では使わない。',
  },
  {
    phrase: '保有候補',
    level: '注意',
    replacement: '検証候補',
    note: '既存UIの名残。顧客向けには検証候補へ寄せる。',
  },
  {
    phrase: '分割候補',
    level: '注意',
    replacement: '分割検証候補',
    note: '旧スコア資料に残る場合は、実施ではなく検証と明示する。',
  },
  {
    phrase: '売買判断',
    level: '条件付き',
    replacement: '売買判断ではない / 判断補助',
    note: '否定文・注意文では使用可。肯定的に使わない。',
  },
  {
    phrase: '購入検討',
    level: '条件付き',
    replacement: '購入検討用スコア / 購入検討へ進めない',
    note: 'ゲートや非採用説明では使用可。購入対象の断定には使わない。',
  },
  {
    phrase: '見送り',
    level: '条件付き',
    replacement: '保留 / 除外 / 待機',
    note: '過去表では使用可。現行判断では理由を必ず併記する。',
  },
  {
    phrase: '監視',
    level: '注意',
    replacement: '観察 / 確認',
    note: 'やや運用色が強いため、顧客向けでは観察・確認が望ましい。',
  },
];

const manualFixRows = [
  {
    file: 'index.html',
    before: '買う時期',
    after: '開始判定',
    reason: '日付で売買が決まる印象を避けるため。',
  },
  {
    file: 'index.html',
    before: '買う時期を見る',
    after: '開始条件を見る',
    reason: 'クリック先が条件判定であることを明確化。',
  },
  {
    file: 'index.html',
    before: '今すぐ全額ではなく、イベントを見ながら段階的に買います。',
    after: '今すぐ全額ではなく、イベントを見ながら段階的に実施可否を判断します。',
    reason: '実売買指示ではなく判定プロセスであることを明確化。',
  },
  {
    file: 'index.html',
    before: '買う/待つ',
    after: '開始/待機',
    reason: '強い売買表現を条件判定表現へ変更。',
  },
  {
    file: 'index.html',
    before: '予定通り買う条件',
    after: '予定通り開始する条件',
    reason: '購入確定ではなく開始条件として表現。',
  },
  {
    file: 'index.html',
    before: '新規買い停止',
    after: '新規投入停止',
    reason: '実売買命令に見える表現を資金配分の停止へ変更。',
  },
  {
    file: 'index.html',
    before: '買う/追加候補',
    after: '開始/追加候補',
    reason: 'カレンダー凡例の誤読防止。',
  },
  {
    file: 'issue_recovery_board_20260525.html',
    before: '「購入開始」「候補」などの言葉が強すぎる',
    after: '実施が確定したように見える言葉や、候補の意味が曖昧な言葉',
    reason: '報告書自体に強い旧表現を残さないため。',
  },
  {
    file: 'issue_recovery_board_20260525.html',
    before: '検証候補という強い表現を、検証候補へ整理',
    after: '強い表現を、検証候補・確認対象・開始判定へ整理',
    reason: '意味不明な文を修正。',
  },
  {
    file: 'index.html',
    before: '購入検討対象',
    after: '購入検討可否の確認対象',
    reason: '購入できる対象と誤読されないよう、確認段階の表現へ変更。',
  },
  {
    file: 'index.html',
    before: '確認候補',
    after: '追加確認対象',
    reason: '候補ではなく、追加で確認する対象であることを明確化。',
  },
];

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

function lineContext(lines, index, phrase) {
  const text = lines[index] ?? '';
  const compact = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const pos = compact.indexOf(phrase);
  if (pos === -1) return compact.slice(0, 220);
  return compact.slice(Math.max(0, pos - 70), pos + phrase.length + 120);
}

function classifyUsage(rule, context) {
  if (rule.level === '禁止') return '要修正';
  if (rule.phrase === '売買判断' && /ではない|不可|隔離|進む前|根拠にしない/.test(context)) return '許容';
  if (rule.phrase === '購入検討' && /用スコア|へ進めない|対象ではなく|根拠にしない|段階/.test(context)) return '許容';
  if (rule.phrase === '見送り' && /理由|判断|継続|追加/.test(context)) return '注意';
  return rule.level === '条件付き' ? '注意' : rule.level;
}

const findingRows = [];
for (const file of targetFiles) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of phraseRules) {
      if (!line.includes(rule.phrase)) continue;
      const context = lineContext(lines, index, rule.phrase);
      const treatment = classifyUsage(rule, context);
      findingRows.push({
        updated_at: generatedAt,
        file,
        line: index + 1,
        phrase: rule.phrase,
        rule_level: rule.level,
        treatment,
        replacement: rule.replacement,
        context,
        note: treatment === '要修正' ? '現行ページに残る場合は修正対象。' : rule.note,
      });
    }
  });
}

const unresolvedMustFix = findingRows.filter((row) => row.treatment === '要修正');
const summaryRows = [
  {
    updated_at: generatedAt,
    item: '監査対象ファイル',
    value: `${targetFiles.length}件`,
    interpretation: '現行導線の主要HTMLを対象に確認。',
  },
  {
    updated_at: generatedAt,
    item: '今回修正した表現',
    value: `${manualFixRows.length}件`,
    interpretation: '実施が確定したように見える旧表現を、開始判定・新規投入停止へ変更。',
  },
  {
    updated_at: generatedAt,
    item: '残存する要修正表現',
    value: `${unresolvedMustFix.length}件`,
    interpretation: unresolvedMustFix.length
      ? '修正が必要な強い表現が残っている。'
      : '現行導線では禁止表現の残存なし。',
  },
  {
    updated_at: generatedAt,
    item: '条件付き表現',
    value: `${findingRows.filter((row) => row.treatment === '許容' || row.treatment === '注意').length}件`,
    interpretation: '購入検討用スコア、売買判断ではない等、注意文として使う表現を記録。',
  },
];

const nextRows = [
  {
    priority: 1,
    action: 'ドライランCSVを使って手動操作確認を行う',
    reason: '実績値は未来だが、入力CSVから一次判定ログ・予実差テンプレートへ変換する流れは事前確認できるため。',
    output: 'サンプルCSV読込確認、一次判定ログ出力確認、予実差テンプレート出力確認',
  },
];

writeCsv('318_display_wording_audit_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('319_display_wording_findings.csv', findingRows, [
  'updated_at',
  'file',
  'line',
  'phrase',
  'rule_level',
  'treatment',
  'replacement',
  'context',
  'note',
]);

writeCsv('320_display_wording_rules.csv', phraseRules.map((row) => ({
  updated_at: generatedAt,
  ...row,
})), [
  'updated_at',
  'phrase',
  'level',
  'replacement',
  'note',
]);

writeCsv('321_display_wording_fixes.csv', manualFixRows.map((row) => ({
  updated_at: generatedAt,
  ...row,
})), [
  'updated_at',
  'file',
  'before',
  'after',
  'reason',
]);

writeCsv('322_display_wording_next_actions.csv', nextRows, [
  'priority',
  'action',
  'reason',
  'output',
]);

const badgeClass = (treatment) => {
  if (treatment === '要修正') return 'stop';
  if (treatment === '許容') return 'ok';
  return 'warn';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>表示文言監査 2026年5月25日</title>
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
      background: var(--bg);
      color: var(--ink);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card {
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
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
    }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; font-size: 25px; color: var(--blue); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      overflow-wrap: anywhere;
      color: #111;
    }
    th { background: #e4f1fa; color: var(--blue); }
    .badge {
      display: inline-block;
      min-width: 72px;
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
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr; } }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>表示文言監査</h1>
  <div class="lead">
    <p><b>目的:</b> 顧客向け画面で、購入が確定したように見える表現や、検証段階と売買判断を混同させる表現を減らします。</p>
    <p><b>方針:</b> 現段階のシステムは「検証候補抽出」と「判断補助」です。実売買を指示する表現は使わず、開始判定・待機・確認対象・検証候補へ寄せます。</p>
    <div class="toolbar">
      <a class="button" href="318_display_wording_audit_summary.csv">318 要約CSV</a>
      <a class="button" href="319_display_wording_findings.csv">319 検出CSV</a>
      <a class="button" href="320_display_wording_rules.csv">320 文言ルールCSV</a>
      <a class="button" href="321_display_wording_fixes.csv">321 修正CSV</a>
      <a class="button" href="current_vs_history_materials_20260525.html">資料区分台帳へ</a>
      <a class="button" href="prepublish_wording_check_20260526.html">公開前文言チェックへ</a>
      <a class="button" href="candidate_role_wording_20260526.html">候補表現ロール整理へ</a>
      <a class="button" href="candidate_data_completion_20260526.html">候補10社データ補完へ</a>
      <a class="button" href="event_type_reaction_db_20260526.html">イベント種類別反応DBへ</a>
      <a class="button" href="june_forward_test_record_20260526.html">6月前向きテスト記録へ</a>
      <a class="button" href="semiconductor_structural_advantage_gate_20260526.html">半導体構造優位ゲートへ</a>
      <a class="button" href="semiconductor_downside_resilience_20260526.html">半導体下落耐性検証へ</a>
      <a class="button" href="semiconductor_fundamental_completion_20260526.html">半導体決算・割高補完へ</a>
      <a class="button" href="semiconductor_june_recheck_checklist_20260526.html">半導体6月再判定へ</a>
      <a class="button" href="semiconductor_june_result_input_cockpit_20260526.html">半導体6月実績入力へ</a>
      <a class="button" href="semiconductor_forward_log_bridge_20260526.html">半導体判定ログ接続へ</a>
      <a class="button" href="semiconductor_june_dry_run_test_20260526.html">半導体ドライランへ</a>
      <a class="button" href="semiconductor_dry_run_verification_20260526.html">半導体ドライラン検算へ</a>
      <a class="button" href="candidate_10_priority_completion_20260526.html">候補10社優先補完へ</a>
      <a class="button" href="june_test_10_selection_board_20260526.html">6月テスト10社選定へ</a>
      <a class="button" href="candidate_10_completion_workbench_20260526.html">候補10社補完作業へ</a>
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

  <h2>1. 今回修正した表現</h2>
  <div class="card">
    <table>
      <thead><tr><th>ファイル</th><th>修正前</th><th>修正後</th><th>理由</th></tr></thead>
      <tbody>
        ${manualFixRows.map((row) => `
          <tr>
            <td>${esc(row.file)}</td>
            <td>${esc(row.before)}</td>
            <td>${esc(row.after)}</td>
            <td>${esc(row.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 文言ルール</h2>
  <div class="card">
    <table>
      <thead><tr><th>表現</th><th>扱い</th><th>置き換え</th><th>理由</th></tr></thead>
      <tbody>
        ${phraseRules.map((row) => `
          <tr>
            <td>${esc(row.phrase)}</td>
            <td><span class="badge ${row.level === '禁止' ? 'stop' : row.level === '条件付き' ? 'warn' : 'warn'}">${esc(row.level)}</span></td>
            <td>${esc(row.replacement)}</td>
            <td>${esc(row.note)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 検出結果</h2>
  <div class="card">
    <p class="note">「許容」は、否定文や注意文として使っているものです。禁止表現が残った場合は修正対象にします。</p>
    <table>
      <thead><tr><th style="width:22%">ファイル</th><th style="width:7%">行</th><th style="width:12%">表現</th><th style="width:10%">扱い</th><th>文脈</th><th style="width:18%">置き換え</th></tr></thead>
      <tbody>
        ${findingRows.length ? findingRows.map((row) => `
          <tr>
            <td>${esc(row.file)}</td>
            <td>${esc(row.line)}</td>
            <td>${esc(row.phrase)}</td>
            <td><span class="badge ${badgeClass(row.treatment)}">${esc(row.treatment)}</span></td>
            <td>${esc(row.context)}</td>
            <td>${esc(row.replacement)}</td>
          </tr>
        `).join('') : '<tr><td colspan="6">検出なし</td></tr>'}
      </tbody>
    </table>
  </div>

  <h2>4. 次の作業</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:8%">優先</th><th style="width:30%">作業</th><th>理由</th><th style="width:24%">成果物</th></tr></thead>
      <tbody>
        ${nextRows.map((row) => `
          <tr>
            <td>${esc(row.priority)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.reason)}</td>
            <td>${esc(row.output)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'display_wording_audit_20260525.html'), cleanLines(html), 'utf8');

console.log('generated display_wording_audit_20260525.html');
