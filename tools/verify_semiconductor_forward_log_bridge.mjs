import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const htmlPath = path.join(ROOT, 'semiconductor_forward_log_bridge_20260526.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

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

if (!scriptMatch) {
  throw new Error('inline script not found');
}

const elements = new Map();
const downloads = [];
const alerts = [];

function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      textContent: '',
      innerHTML: '',
      files: [],
      addEventListener() {},
    });
  }
  return elements.get(id);
}

const context = {
  console,
  Blob: class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  },
  URL: {
    createObjectURL() {
      return 'blob:mock';
    },
    revokeObjectURL() {},
  },
  alert(message) {
    alerts.push(message);
  },
  fetch: async (url) => ({
    text: async () => fs.readFileSync(path.join(ROOT, url), 'utf8'),
  }),
  document: {
    getElementById: element,
    createElement(tag) {
      if (tag !== 'a') return {};
      return {
        href: '',
        download: '',
        click() {
          downloads.push(this.download);
        },
      };
    },
  },
};

vm.createContext(context);
vm.runInContext(scriptMatch[1], context, { filename: 'semiconductor_forward_log_bridge_inline.js' });

await context.loadSampleCsv();
const sampleStatus = element('status').textContent;
const previewHtml = element('preview').innerHTML;
const previewRows = (previewHtml.match(/<tr><td>/g) || []).length;

context.downloadDecisionLog();
const decisionStatus = element('status').textContent;
context.downloadPredictionLog();
const predictionStatus = element('status').textContent;

const checks = [
  {
    updated_at: generatedAt,
    check: 'サンプルCSV読込',
    result: sampleStatus.includes('サンプルCSV 6件') && previewRows === 6 ? 'OK' : 'NG',
    detail: `status=${sampleStatus}; previewRows=${previewRows}`,
  },
  {
    updated_at: generatedAt,
    check: '一次判定ログCSV出力',
    result: downloads.includes('semiconductor_june_decision_log.csv') && decisionStatus.includes('一次判定ログCSVを出力') ? 'OK' : 'NG',
    detail: `status=${decisionStatus}; downloads=${downloads.join('|')}`,
  },
  {
    updated_at: generatedAt,
    check: '予実差テンプレートCSV出力',
    result: downloads.includes('semiconductor_june_prediction_actual_log.csv') && predictionStatus.includes('予実差テンプレートCSVを出力') ? 'OK' : 'NG',
    detail: `status=${predictionStatus}; downloads=${downloads.join('|')}`,
  },
  {
    updated_at: generatedAt,
    check: 'ブラウザ実操作',
    result: '未完了',
    detail: '現在の実行環境では in-app browser の操作対象を取得できなかったため、DOM関数検証で代替。ユーザー画面ではサンプルCSVボタンから確認可能。',
  },
];

writeCsv('417_semiconductor_forward_bridge_operation_check.csv', checks, [
  'updated_at',
  'check',
  'result',
  'detail',
]);

const failed = checks.some((row) => row.result === 'NG');
console.log(JSON.stringify({
  failed,
  previewRows,
  downloads,
  checks,
}, null, 2));

if (failed) process.exit(1);
