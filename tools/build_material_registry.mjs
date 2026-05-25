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

const currentFiles = new Map([
  ['index.html', ['現行資料', '顧客説明に使用可', '現在の入口ページ。ただし詳細判断は各検証ページで確認する。', '']],
  ['issue_resolution_flowchart_20260525.html', ['現行資料', '顧客説明に使用可', '課題をどの順番で回収するかを示す現行フロー。', '']],
  ['issue_recovery_board_20260525.html', ['現行資料', '顧客説明に使用可', '課題、対応済み、次作業を管理する現行台帳。', '']],
  ['current_vs_history_materials_20260525.html', ['現行資料', '顧客説明に使用可', '現行資料と履歴資料を分ける台帳。', '']],
  ['display_wording_audit_20260525.html', ['現行資料', '顧客説明に使用可', '購入が確定したように見える文言を監査するページ。', '']],
  ['prepublish_wording_check_20260526.html', ['現行資料', '顧客説明に使用可', '新規ページ作成時に文言ルールを自動確認する公開前チェック。', 'display_wording_audit_20260525.html']],
  ['candidate_role_wording_20260526.html', ['現行資料', '顧客説明に使用可', '候補という言葉を、検証候補・確認対象・保留・除外などの役割へ分けるページ。', 'display_wording_audit_20260525.html']],
  ['terminology_cleanup_20260525.html', ['現行補助', '台帳経由で使用可', '旧表現を整理した補助ページ。表示文言監査とセットで使う。', 'display_wording_audit_20260525.html']],
  ['missing_data_score_gate_20260525.html', ['現行資料', '顧客説明に使用可', '未取得データを点数に混ぜないためのゲート。', '']],
  ['universe_definition_20260525.html', ['現行資料', '顧客説明に使用可', '100社前後の母集団条件を固定するページ。', '']],
  ['sector_adjustment_20260525.html', ['現行資料', '顧客説明に使用可', 'PER/PBR/ROEを業種内比較で見る補正ページ。', '']],
  ['backtest_validation_20260525.html', ['現行資料', '顧客説明に使用可', '過去検証・バックテストの初期接続ページ。', '']],
  ['plus1_benchmark_connection_20260525.html', ['現行資料', '顧客説明に使用可', '+1%目標とベンチマーク比較を接続するページ。', '']],
  ['event_causality_validation_20260525.html', ['現行資料', '顧客説明に使用可', 'イベント名だけで加点しないための因果・複合条件ページ。', '']],
  ['candidate_june_rulebook.html', ['現行資料', '顧客説明に使用可', '6月の市場イベント確認後に使う判定ルール。', '']],
  ['candidate_supplement_10_plan.html', ['現行補助', '台帳経由で使用可', '10社候補を補充するための検証候補資料。購入対象の確定ではない。', 'candidate_june_rulebook.html']],
  ['supplement_reaction_check.html', ['現行補助', '台帳経由で使用可', '予備候補の決算後反応を確認する補助資料。', 'candidate_june_rulebook.html']],
  ['top20_completion_recalculated_candidates.html', ['現行補助', '台帳経由で使用可', '上位20社の補完再計算資料。候補抽出の途中資料。', 'candidate_supplement_10_plan.html']],
  ['dual_axis_selection_model.html', ['現行補助', '台帳経由で使用可', '質的データと量的データを分ける設計資料。', 'event_causality_validation_20260525.html']],
  ['event_impact_2026_screening_plan.html', ['現行補助', '台帳経由で使用可', '2026年イベントを検証候補抽出に使うための補助資料。', 'event_causality_validation_20260525.html']],
  ['trend_news_extraction_mvp.html', ['現行補助', '台帳経由で使用可', '時流ニュースから検証テーマを拾うMVP。直接加点には使わない。', 'event_causality_validation_20260525.html']],
  ['trend_deduction_research_base.html', ['現行補助', '台帳経由で使用可', '時流から銘柄仮説を作るための基礎資料。直接の購入根拠ではない。', 'event_causality_validation_20260525.html']],
  ['trend_candidate_price_intake.html', ['現行補助', '台帳経由で使用可', '時流候補の株価一次判定。量的検証へ渡す前段資料。', 'candidate_june_rulebook.html']],
  ['trend_candidate_fundamental_gate.html', ['現行補助', '台帳経由で使用可', '時流候補の財務・IR二次判定。未取得データは非加点で扱う。', 'missing_data_score_gate_20260525.html']],
  ['trend_candidate_official_ir_gate.html', ['現行補助', '台帳経由で使用可', '時流候補の公式IR確認ゲート。手作業確認の対象を示す補助資料。', 'missing_data_score_gate_20260525.html']],
  ['market_theme_check.html', ['現行補助', '台帳経由で使用可', '市場テーマの確認表。探索補助であり、直接加点には使わない。', 'event_causality_validation_20260525.html']],
  ['theme_stock_bridge.html', ['現行補助', '台帳経由で使用可', 'テーマと銘柄の接続表。仮説発見用であり、購入根拠にはしない。', 'event_causality_validation_20260525.html']],
  ['candidate_theme_scoring.html', ['現行補助', '台帳経由で使用可', 'テーマ候補の試算資料。探索用であり、量的ゲートとセットで使う。', 'dual_axis_selection_model.html']],
  ['tenbagger_research_corner.html', ['現行補助', '台帳経由で使用可', 'テンバガー探索の考え方を整理した補助資料。NISA 1年候補とは別枠で扱う。', 'index.html']],
  ['model_integrity_audit.html', ['現行補助', '台帳経由で使用可', '単純加点などの設計リスク監査。', 'issue_recovery_board_20260525.html']],
  ['academic_validation_protocol_20260525.html', ['現行補助', '台帳経由で使用可', 'モデル検証の考え方を整理した補助資料。', 'backtest_validation_20260525.html']],
  ['plus1_practical_validation_model_20260525.html', ['現行補助', '台帳経由で使用可', '+1%目標の実運用検証設計。', 'plus1_benchmark_connection_20260525.html']],
  ['data_acquisition_completion_dashboard.html', ['現行補助', '台帳経由で使用可', '取得済みデータと未取得データの管理ページ。', 'data_sources_view.html']],
  ['data_sources_view.html', ['現行補助', '台帳経由で使用可', 'データ取得元と取得結果の確認ページ。', 'data_acquisition_completion_dashboard.html']],
  ['operation_cockpit.html', ['現行補助', '台帳経由で使用可', '運用手順を確認する補助ページ。最終判断は6月判定ルールで行う。', 'candidate_june_rulebook.html']],
  ['delivery_check_report.html', ['現行補助', '台帳経由で使用可', '納品前チェックの補助ページ。資料区分台帳で最新性を確認して使う。', 'current_vs_history_materials_20260525.html']],
  ['client_handoff_guide.html', ['現行補助', '台帳経由で使用可', '顧客向け納品ガイドのHTML版。古いPDFよりHTML台帳を優先する。', 'current_vs_history_materials_20260525.html']],
  ['client_handoff_guide.pdf', ['履歴資料', '履歴参照のみ', 'PDFは作成時点で固定されるため、最新説明はHTML台帳で確認する。', 'client_handoff_guide.html']],
  ['stock_decision_mvp_calculated.xlsx', ['データ資料', '内部確認のみ', '実データ・計算シート。説明時はHTML台帳やCSV説明とセットで使う。', 'current_vs_history_materials_20260525.html']],
]);

const cautionPatterns = [
  [/^development_plan\.(html|pdf)$/i, '初期の開発計画資料。現行の課題回収フローと異なる可能性がある。', 'issue_resolution_flowchart_20260525.html'],
  [/^system_spec_schedule\.(html|pdf)$/i, '初期の仕様・工期資料。現行の6月テスト前提と異なる可能性がある。', 'issue_resolution_flowchart_20260525.html'],
  [/^mvp_client_summary\.(html|pdf)$/i, '初期MVP説明資料。現行の検証候補抽出設計とは粒度が違う。', 'current_vs_history_materials_20260525.html'],
  [/^nisa_1year_mvp_june_test_report\.(html|pdf)$/i, '初期の6月テスト資料。現行ルールに上書きされた箇所がある。', 'candidate_june_rulebook.html'],
  [/^daily_progress_report_202605(18|20|21|25).*?\.(html|pdf)$/i, '日次報告の履歴。作成時点の表現を含むため、現行方針として単独提示しない。', 'issue_recovery_board_20260525.html'],
  [/^formula_calculation_report\.(html|pdf)$/i, '数式整理の履歴。現在採用していない式も含むため単独提示しない。', 'missing_data_score_gate_20260525.html'],
  [/^variable_formula_status_report\.(html|pdf)$/i, '変数・数式の途中整理資料。現行仕様ではなく履歴として扱う。', 'missing_data_score_gate_20260525.html'],
  [/^event_need_analysis_prototype\.(html|pdf|csv)$/i, '初期プロトタイプ。現行の因果・複合条件ゲートに置き換える。', 'event_causality_validation_20260525.html'],
  [/^prototype_sample\.html$/i, '初期サンプル。現行資料ではない。', 'index.html'],
];

const historyPatterns = [
  [/^top3_|^first5_|^top10_/i, '途中検証の履歴。現行の候補抽出は上位20・10社補充・6月判定ルール側を優先する。', 'candidate_june_rulebook.html'],
  [/^candidate_ir_pdf_|^pdf_/i, 'PDF読解実験の履歴。正式な自動読解完成品ではない。', 'data_acquisition_completion_dashboard.html'],
  [/^tenbagger_/i, 'テンバガー探索の補助・履歴資料。NISA 1年保有候補の確定資料ではない。', 'tenbagger_research_corner.html'],
  [/^alternative_source_/i, '代替データ取得の途中確認資料。', 'data_sources_view.html'],
];

const currentCsvPrefixes = [
  '245_', '246_', '247_', '250_', '251_', '252_', '253_', '254_', '255_', '256_', '257_', '258_', '259_',
  '260_', '261_', '262_', '263_', '264_', '265_', '266_', '267_', '268_', '269_', '270_', '271_', '272_',
  '273_', '274_', '275_', '276_', '277_', '278_', '279_', '280_', '281_', '283_', '284_', '285_', '286_',
  '287_', '288_', '289_', '290_', '291_', '292_', '293_', '294_', '295_', '296_', '297_', '298_', '299_',
  '300_', '301_', '302_', '303_', '304_', '305_', '306_', '307_', '308_', '309_', '310_', '311_', '312_',
  '313_', '314_', '315_', '316_', '317_', '318_', '319_', '320_', '321_', '322_', '323_', '324_', '325_',
  '326_', '327_', '328_', '329_', '330_', '331_', '332_',
  '333_', '334_', '335_', '336_', '337_',
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

function classifyFile(file) {
  if (currentFiles.has(file)) {
    const [status, useAllowed, reason, replacement] = currentFiles.get(file);
    return { status, use_allowed: useAllowed, reason, replacement: replacement || '' };
  }

  for (const [pattern, reason, replacement] of cautionPatterns) {
    if (pattern.test(file)) {
      return {
        status: '要注意履歴',
        use_allowed: '単独提示不可',
        reason,
        replacement,
      };
    }
  }

  for (const [pattern, reason, replacement] of historyPatterns) {
    if (pattern.test(file)) {
      return {
        status: '履歴資料',
        use_allowed: '履歴参照のみ',
        reason,
        replacement,
      };
    }
  }

  if (file.endsWith('.csv')) {
    const isCurrentCsv = currentCsvPrefixes.some((prefix) => file.startsWith(prefix));
    return {
      status: isCurrentCsv ? 'データ資料' : '履歴データ',
      use_allowed: '内部確認のみ',
      reason: isCurrentCsv
        ? '現行検証ページの根拠CSV。単独では説明資料にしない。'
        : '過去工程または途中検証のCSV。必要時に履歴として確認する。',
      replacement: isCurrentCsv ? '対応する現行HTMLページ' : 'current_vs_history_materials_20260525.html',
    };
  }

  if (file.endsWith('.pdf')) {
    return {
      status: '履歴資料',
      use_allowed: '履歴参照のみ',
      reason: 'PDFは作成時点の固定資料。現行方針は最新HTMLと台帳で確認する。',
      replacement: 'current_vs_history_materials_20260525.html',
    };
  }

  if (file.endsWith('.html')) {
    return {
      status: '履歴資料',
      use_allowed: '履歴参照のみ',
      reason: '現行導線に明示されていないHTML。必要時は台帳から位置づけを確認する。',
      replacement: 'current_vs_history_materials_20260525.html',
    };
  }

  if (file.endsWith('.xlsx') || file.endsWith('.md') || file.endsWith('.json')) {
    return {
      status: 'データ資料',
      use_allowed: '内部確認のみ',
      reason: '計算・記録・補助データ。顧客説明ではHTMLの要約とセットで使う。',
      replacement: 'current_vs_history_materials_20260525.html',
    };
  }

  return {
    status: 'その他',
    use_allowed: '内部確認のみ',
    reason: '公開補助ファイル。顧客説明資料としては扱わない。',
    replacement: 'current_vs_history_materials_20260525.html',
  };
}

const files = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => /\.(html|pdf|csv|xlsx|md|json)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'ja'));

const registryRows = files.map((file) => {
  const stat = fs.statSync(path.join(ROOT, file));
  const c = classifyFile(file);
  return {
    updated_at: generatedAt,
    file,
    kind: path.extname(file).slice(1).toUpperCase(),
    status: c.status,
    use_allowed: c.use_allowed,
    reason: c.reason,
    replacement: c.replacement,
    last_modified: new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(stat.mtime),
    size_kb: Math.round(stat.size / 1024),
  };
});

const summaryRows = [...new Map(registryRows.map((row) => [row.status, null])).keys()]
  .sort((a, b) => a.localeCompare(b, 'ja'))
  .map((status) => {
    const rows = registryRows.filter((row) => row.status === status);
    return {
      updated_at: generatedAt,
      status,
      count: rows.length,
      use_allowed: [...new Set(rows.map((row) => row.use_allowed))].join(' / '),
      interpretation: {
        '現行資料': '顧客説明の主資料として使える。',
        '現行補助': '主資料ではなく、根拠確認や補足として使う。',
        'データ資料': '計算・記録の根拠。単独説明には使わない。',
        '履歴資料': '過去の作業履歴。現行方針ではない。',
        '要注意履歴': '古い方針や強い表現を含む可能性があり、単独提示しない。',
        '履歴データ': '過去工程のCSV。必要時だけ参照する。',
        'その他': '公開補助ファイル。',
      }[status] || '資料区分を確認してから使う。',
    };
  });

const ruleRows = [
  {
    rule: '現行資料を優先',
    meaning: '顧客へ説明する時は、現行資料または現行補助から使う。',
    reason: '古いPDFや日次報告に残る旧表現を現行方針と誤認させないため。',
  },
  {
    rule: '履歴資料は単独提示しない',
    meaning: '履歴資料を見る場合は、台帳の「置き換え先」も一緒に確認する。',
    reason: '作成時点のたたき台や旧案を、現在の約束に見せないため。',
  },
  {
    rule: 'データ資料は根拠として使う',
    meaning: 'CSVやXLSXは計算根拠であり、説明資料ではない。',
    reason: '数字だけでは、何に使えるか、何に使えないかが伝わらないため。',
  },
  {
    rule: '購入確定に見える表現を避ける',
    meaning: '現段階は検証候補抽出・判断補助であり、実売買の指示ではない。',
    reason: '顧客説明で責任範囲と検証段階を明確にするため。',
  },
  {
    rule: '5月は開発・検証、6月は結果確認後に再判定',
    meaning: '5月の資料にある旧案は現行方針に上書きされる。',
    reason: '市場イベントやデータ未接続の課題を確認してからNISAテスト候補を扱うため。',
  },
];

writeCsv('323_material_registry.csv', registryRows, [
  'updated_at',
  'file',
  'kind',
  'status',
  'use_allowed',
  'reason',
  'replacement',
  'last_modified',
  'size_kb',
]);

writeCsv('324_current_materials.csv', registryRows.filter((row) => row.status === '現行資料' || row.status === '現行補助'), [
  'updated_at',
  'file',
  'kind',
  'status',
  'use_allowed',
  'reason',
  'replacement',
  'last_modified',
  'size_kb',
]);

writeCsv('325_history_materials.csv', registryRows.filter((row) => row.status.includes('履歴') || row.status === '要注意履歴'), [
  'updated_at',
  'file',
  'kind',
  'status',
  'use_allowed',
  'reason',
  'replacement',
  'last_modified',
  'size_kb',
]);

writeCsv('326_material_boundary_rules.csv', ruleRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'rule',
  'meaning',
  'reason',
]);

writeCsv('327_material_registry_summary.csv', summaryRows, [
  'updated_at',
  'status',
  'count',
  'use_allowed',
  'interpretation',
]);

const statusClass = (status) => {
  if (status === '現行資料') return 'ok';
  if (status === '現行補助') return 'work';
  if (status === 'データ資料') return 'data';
  if (status === '要注意履歴') return 'stop';
  if (status.includes('履歴')) return 'warn';
  return 'neutral';
};

const currentImportant = registryRows.filter((row) => row.status === '現行資料' || row.status === '現行補助');
const cautionImportant = registryRows.filter((row) => row.status === '要注意履歴').slice(0, 30);
const dataImportant = registryRows.filter((row) => row.status === 'データ資料').slice(0, 30);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>現行資料・履歴資料 区分台帳 2026年5月25日</title>
  <style>
    :root {
      --ink:#111;
      --blue:#073a5a;
      --line:#bed3e5;
      --bg:#f5f8fb;
      --card:#fff;
      --ok:#eaf7ef;
      --work:#eaf4ff;
      --data:#f0f4ff;
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
    .kpis { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin:18px 0; }
    .kpi { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; min-height:116px; }
    .kpi small { display:block; color:#38536b; font-weight:700; }
    .kpi b { display:block; font-size:28px; color:var(--blue); }
    .flow { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; }
    .step { position:relative; background:#fff; border:1px solid var(--line); border-radius:10px; padding:13px; min-height:126px; }
    .step:not(:last-child)::after { content:"→"; position:absolute; right:-13px; top:44%; color:#0b6f9f; font-weight:900; font-size:20px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th, td { border:1px solid var(--line); padding:9px 10px; vertical-align:top; font-size:13px; overflow-wrap:anywhere; color:#111; }
    th { background:#e4f1fa; color:var(--blue); }
    .badge { display:inline-block; min-width:84px; text-align:center; padding:2px 8px; border-radius:999px; font-weight:800; font-size:12px; }
    .ok { background:var(--ok); color:#007a3d; }
    .work { background:var(--work); color:#00588a; }
    .data { background:var(--data); color:#25408f; }
    .warn { background:var(--warn); color:#8a5200; }
    .stop { background:var(--stop); color:#b00020; }
    .neutral { background:#f2f2f2; color:#333; }
    .note { font-size:13px; color:#333; }
    .callout { border-left:6px solid #b00020; background:#fff8f8; padding:12px 14px; margin-top:12px; }
    @media (max-width:900px) {
      .kpis, .flow { grid-template-columns:1fr; }
      .step:not(:last-child)::after { content:"↓"; right:50%; top:auto; bottom:-22px; transform:translateX(50%); }
    }
    @media print {
      body { background:#fff; }
      .lead, .card, .kpi, .step, table, tr, td, th { break-inside:avoid; page-break-inside:avoid; box-shadow:none; }
    }
  </style>
</head>
<body>
<main>
  <h1>現行資料・履歴資料 区分台帳</h1>
  <div class="lead">
    <p><b>目的:</b> 顧客説明で使う資料と、過去の作業履歴を明確に分けます。古いPDFや日次報告に残る旧案を、現在の方針として誤って提示しないための台帳です。</p>
    <p><b>現行方針:</b> 現段階はNISA 1年保有の検証候補を絞るための判断補助システムです。5月は開発・検証、6月は主要イベントの結果と最新データを確認してから、テスト候補を再判定します。</p>
    <div class="toolbar">
      <a class="button" href="323_material_registry.csv">323 全資料台帳CSV</a>
      <a class="button" href="324_current_materials.csv">324 現行資料CSV</a>
      <a class="button" href="325_history_materials.csv">325 履歴資料CSV</a>
      <a class="button" href="326_material_boundary_rules.csv">326 区分ルールCSV</a>
      <a class="button" href="327_material_registry_summary.csv">327 要約CSV</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </div>

  <div class="kpis">
    ${summaryRows.map((row) => `
      <div class="kpi">
        <small>${esc(row.status)}</small>
        <b>${esc(row.count)}件</b>
        <span>${esc(row.interpretation)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. 使う順番</h2>
  <div class="flow">
    <div class="step"><b>現行資料を見る</b><br>顧客説明では、まず現行資料から使います。</div>
    <div class="step"><b>補助資料を添える</b><br>計算根拠や途中検証は、補助資料として添えます。</div>
    <div class="step"><b>データ資料で確認</b><br>CSVやXLSXは根拠確認用です。単独説明にはしません。</div>
    <div class="step"><b>履歴資料は区別</b><br>古いPDFや日次報告は、履歴として参照します。</div>
  </div>

  <h2>2. 現行資料</h2>
  <div class="card">
    <p class="note">ここにある資料を、現在の説明導線として優先します。補助資料は「主資料」ではなく、根拠確認として扱います。</p>
    <table>
      <thead><tr><th style="width:24%">ファイル</th><th style="width:11%">区分</th><th style="width:15%">使用可否</th><th>理由</th><th style="width:18%">置き換え先/関連資料</th></tr></thead>
      <tbody>
        ${currentImportant.map((row) => `
          <tr>
            <td><a href="${esc(row.file)}">${esc(row.file)}</a></td>
            <td><span class="badge ${statusClass(row.status)}">${esc(row.status)}</span></td>
            <td>${esc(row.use_allowed)}</td>
            <td>${esc(row.reason)}</td>
            <td>${row.replacement ? `<a href="${esc(row.replacement)}">${esc(row.replacement)}</a>` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 要注意の履歴資料</h2>
  <div class="card">
    <p class="note">削除はしません。監査履歴として残します。ただし、現行方針と違う表現が含まれる可能性があるため、単独では提示しません。</p>
    <table>
      <thead><tr><th style="width:24%">ファイル</th><th style="width:11%">区分</th><th style="width:15%">使用可否</th><th>理由</th><th style="width:18%">現行で見る資料</th></tr></thead>
      <tbody>
        ${cautionImportant.map((row) => `
          <tr>
            <td><a href="${esc(row.file)}">${esc(row.file)}</a></td>
            <td><span class="badge ${statusClass(row.status)}">${esc(row.status)}</span></td>
            <td>${esc(row.use_allowed)}</td>
            <td>${esc(row.reason)}</td>
            <td><a href="${esc(row.replacement)}">${esc(row.replacement)}</a></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="callout">
      <b>重要:</b> 過去資料に「開始日」「投入率」「購入に見える表現」が残っていても、現行方針としては扱いません。現行方針は、課題解決フロー、6月判定ルール、+1%目標接続、イベント因果チェック、文言監査で確認します。
    </div>
  </div>

  <h2>4. データ資料</h2>
  <div class="card">
    <p class="note">データ資料は、計算・検算・記録の根拠です。顧客説明では、HTMLの要約ページと一緒に使います。</p>
    <table>
      <thead><tr><th style="width:28%">ファイル</th><th style="width:12%">種類</th><th style="width:14%">区分</th><th>理由</th><th style="width:12%">サイズKB</th></tr></thead>
      <tbody>
        ${dataImportant.map((row) => `
          <tr>
            <td><a href="${esc(row.file)}">${esc(row.file)}</a></td>
            <td>${esc(row.kind)}</td>
            <td><span class="badge ${statusClass(row.status)}">${esc(row.status)}</span></td>
            <td>${esc(row.reason)}</td>
            <td>${esc(row.size_kb)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>5. 区分ルール</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:22%">ルール</th><th>意味</th><th>理由</th></tr></thead>
      <tbody>
        ${ruleRows.map((row) => `
          <tr>
            <td><b>${esc(row.rule)}</b></td>
            <td>${esc(row.meaning)}</td>
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

fs.writeFileSync(path.join(ROOT, 'current_vs_history_materials_20260525.html'), cleanLines(html), 'utf8');

console.log(`generated current_vs_history_materials_20260525.html with ${registryRows.length} registry rows`);
