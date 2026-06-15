import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const sourceArg = process.argv[2] || '';
const canonicalCsv = 'june_event_result_entry_20260615.csv';
const helperCsv = 'june_event_manual_input_apply_helper_20260615.csv';
const helperHtml = 'june_event_manual_input_apply_helper_20260615.html';
const backupDir = '_event_result_backups';
const requiredIds = ['T01', 'T02', 'T03', 'T04', 'T05'];
const requiredHeaders = [
  '作成時刻',
  '更新時刻',
  'ID',
  '確認時期',
  'イベント',
  '入力するもの',
  '取得元候補',
  '入力ステータス',
  '結果値',
  '市場反応',
  '出所URL',
  '出所時刻または対象期間',
  '取得日時',
  '反映先',
  '反映状況',
  '次アクション',
  '停止条件メモ',
  '確認者メモ',
];
const allowedStatuses = ['未入力', '部分確認', '確認済', '注意', '停止候補'];
const allowedReflectionStatuses = ['未反映', '反映待ち', '反映済', '反映保留', '反映停止'];

const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === ',') {
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
  return {
    headers,
    rows: rows
      .filter((values) => values.some((value) => String(value ?? '').trim() !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))),
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blank(value) {
  return String(value ?? '').trim() === '';
}

function resolveSource() {
  if (!sourceArg) return '';
  return path.isAbsolute(sourceArg) ? sourceArg : path.join(ROOT, sourceArg);
}

function validate(headers, rows) {
  const errors = [];
  const warnings = [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) errors.push(`必須列が不足: ${missingHeaders.join(' / ')}`);

  const ids = rows.map((row) => row.ID).filter(Boolean);
  const missingIds = requiredIds.filter((id) => !ids.includes(id));
  if (missingIds.length) errors.push(`必須IDが不足: ${missingIds.join(' / ')}`);

  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) errors.push(`ID重複: ${[...new Set(duplicates)].join(' / ')}`);

  const unexpected = ids.filter((id) => !requiredIds.includes(id));
  if (unexpected.length) errors.push(`想定外ID: ${unexpected.join(' / ')}`);

  for (const row of rows) {
    if (!allowedStatuses.includes(row.入力ステータス)) {
      errors.push(`${row.ID || '(IDなし)'} 入力ステータスが不正: ${row.入力ステータス || '(空欄)'}`);
    }
    if (!allowedReflectionStatuses.includes(row.反映状況)) {
      errors.push(`${row.ID || '(IDなし)'} 反映状況が不正: ${row.反映状況 || '(空欄)'}`);
    }
    const requiredWhenConfirmed = ['結果値', '市場反応', '出所URL', '取得日時', '反映先'];
    const missingForConfirmed = requiredWhenConfirmed.filter((field) => blank(row[field]));
    if (row.入力ステータス === '確認済' && missingForConfirmed.length) {
      errors.push(`${row.ID} 確認済だが不足項目あり: ${missingForConfirmed.join(' / ')}`);
    }
    if (row.入力ステータス === '確認済' && row.反映状況 !== '反映済') {
      warnings.push(`${row.ID} 確認済だが反映状況が反映済ではありません。検証画面では未完了扱いになります。`);
    }
    if (row.入力ステータス !== '未入力' && (blank(row.結果値) || blank(row.出所URL))) {
      warnings.push(`${row.ID} は ${row.入力ステータス} ですが、結果値または出所URLが不足しています。`);
    }
  }
  return { errors, warnings };
}

function normalize(rows) {
  return requiredIds.map((id) => {
    const row = rows.find((item) => item.ID === id) ?? {};
    return Object.fromEntries(requiredHeaders.map((header) => [header, row[header] ?? '']));
  });
}

function backupCanonical() {
  fs.mkdirSync(path.join(ROOT, backupDir), { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backupName = `${backupDir}/june_event_result_entry_20260615_${stamp}.csv`;
  fs.copyFileSync(path.join(ROOT, canonicalCsv), path.join(ROOT, backupName));
  return backupName;
}

function runNode(script) {
  execFileSync('node', [script], { cwd: ROOT, stdio: 'inherit' });
}

function writeHelper(result) {
  const rows = [
    {
      区分: '現在の状態',
      内容: result.status,
      詳細: result.message,
      次アクション: result.status === '反映完了' ? '検証画面で購入前ゲートを再確認する' : 'フォームでCSVを作成し、このヘルパーで反映する',
    },
    {
      区分: '入力フォーム',
      内容: 'june_event_manual_input_form_20260615.html',
      詳細: '公式結果と市場反応を入力し、CSVをダウンロードする',
      次アクション: 'CSV名を指定して反映コマンドを実行する',
    },
    {
      区分: '反映コマンド',
      内容: 'node tools/apply_june_event_manual_input_csv_20260615.mjs june_event_result_entry_20260615_filled.csv',
      詳細: 'CSVを検証し、問題がなければ正本へ反映して関連画面を再生成する',
      次アクション: 'エラーが出た場合は不足列、ID、出所、取得日時を修正する',
    },
    ...(result.backup
      ? [{
          区分: 'バックアップ',
          内容: result.backup,
          詳細: '反映前の正本CSVを保存',
          次アクション: '必要時のみ参照',
        }]
      : []),
    ...result.errors.map((error) => ({
      区分: 'エラー',
      内容: error,
      詳細: '正本へ反映していない',
      次アクション: 'CSVを修正して再実行する',
    })),
    ...result.warnings.map((warning) => ({
      区分: '注意',
      内容: warning,
      詳細: '反映は可能だが検証画面で未完了または保留になる可能性',
      次アクション: '出所、取得日時、反映状況を確認する',
    })),
  ];
  writeCsv(helperCsv, ['区分', '内容', '詳細', '次アクション'], rows);

  const rowHtml = rows.map((row) => `<tr>
    <td>${h(row.区分)}</td>
    <td>${h(row.内容)}</td>
    <td>${h(row.詳細)}</td>
    <td>${h(row.次アクション)}</td>
  </tr>`).join('');

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベントCSV反映ヘルパー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1260px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    code{display:block;background:#f7fafc;border:1px solid var(--line);border-radius:9px;padding:12px;overflow-wrap:anywhere;white-space:normal}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.links{grid-template-columns:1fr}body{font-size:16px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベントCSV反映ヘルパー</h1>
  <p>手入力フォームで出力したCSVを検証し、問題がなければ結果入力台帳へ反映するための手順です。</p>
</header>
<main>
  <section>
    <p class="notice">このヘルパーは、根拠不足のCSVを正本へ混ぜないための確認用です。確認済、出所URL、取得日時、反映状況が揃わない行は、検証画面で未完了扱いになります。この段階のデータは買付判断には使えません。</p>
  </section>
  <section>
    <h2>反映コマンド</h2>
    <code>node tools/apply_june_event_manual_input_csv_20260615.mjs june_event_result_entry_20260615_filled.csv</code>
  </section>
  <section>
    <h2>現在の結果</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>区分</th><th>内容</th><th>詳細</th><th>次アクション</th></tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_manual_input_form_20260615.html">手入力フォーム</a>
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_ticket_validator_20260615.html">入力検証</a>
      <a href="prebuy_master_gate_20260615.html">購入前統合ゲート</a>
    </div>
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(helperHtml, html, 'utf8');
}

function applySource(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    return {
      status: '未反映',
      message: `指定CSVが見つかりません: ${sourcePath}`,
      errors: [`指定CSVが見つかりません: ${sourcePath}`],
      warnings: [],
    };
  }
  const parsed = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
  const validation = validate(parsed.headers, parsed.rows);
  if (validation.errors.length) {
    return {
      status: '未反映',
      message: 'CSV検証でエラーが出たため、正本は更新していません。',
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
  const normalized = normalize(parsed.rows);
  const backup = backupCanonical();
  writeCsv(canonicalCsv, requiredHeaders, normalized);
  runNode('tools/build_june_event_result_entry_20260615.mjs');
  runNode('tools/build_june_event_ticket_validator_20260615.mjs');
  runNode('tools/build_june_event_reflection_preview_20260615.mjs');
  runNode('tools/build_prebuy_master_gate_20260615.mjs');
  runNode('tools/build_clean_system_home_20260615.mjs');
  runNode('tools/check_critical_links_20260613.mjs');
  return {
    status: '反映完了',
    message: `${path.basename(sourcePath)} を結果入力台帳へ反映しました。`,
    backup,
    errors: [],
    warnings: validation.warnings,
  };
}

const sourcePath = resolveSource();
const result = sourcePath
  ? applySource(sourcePath)
  : {
      status: '準備完了',
      message: '手入力フォームでCSVを作成し、ファイル名を指定して反映します。',
      errors: [],
      warnings: [],
    };

writeHelper(result);
console.log(`${result.status}: ${result.message}`);
if (result.backup) console.log(`backup: ${result.backup}`);
if (result.errors.length) {
  for (const error of result.errors) console.log(`error: ${error}`);
  process.exitCode = 1;
}
