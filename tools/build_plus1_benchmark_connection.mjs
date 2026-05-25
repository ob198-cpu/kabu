import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATE_FILE = '280_nisa_test_10_candidate_plan_reaction_updated.csv';
const MARKET_MONTHLY_FILE = '89_market_monthly_returns.csv';
const BACKTEST_CONNECTION_FILE = '305_candidate_backtest_connection.csv';

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
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, 'utf8'));
}

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${round(value, 2)}%`;
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

function sortedMonthly(rows) {
  return [...rows]
    .filter((row) => numericValue(row.month_close) !== null)
    .sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
}

function trailingReturn(rows, monthsBack = 12) {
  const valid = sortedMonthly(rows);
  if (valid.length <= monthsBack) return null;
  const latest = valid[valid.length - 1];
  const base = valid[valid.length - 1 - monthsBack];
  const latestClose = numericValue(latest.month_close);
  const baseClose = numericValue(base.month_close);
  if (latestClose === null || baseClose === null || baseClose === 0) return null;
  return {
    start_month: base.month,
    end_month: latest.month,
    start_value: baseClose,
    end_value: latestClose,
    return_pct: (latestClose / baseClose - 1) * 100,
    available_months: valid.length,
  };
}

function hardGateText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === 'なし') return '';
  return text;
}

function riskMemo(row) {
  const parts = [];
  const hardGate = hardGateText(row.hard_gate);
  const per = numericValue(row.per);
  const drawdown = numericValue(row.max_drawdown60_pct);
  const confidence = numericValue(row.data_confidence);
  if (hardGate) parts.push(`ゲート: ${hardGate}`);
  if (per !== null && per >= 40) parts.push(`PER ${round(per)}倍で割高確認`);
  if (drawdown !== null && drawdown <= -20) parts.push(`60日最大下落 ${pct(drawdown)}`);
  if (confidence !== null && confidence < 90) parts.push(`信頼度 ${round(confidence)}点`);
  return parts.join(' / ') || '大きな停止理由なし';
}

function plus1Status(row, bestBenchmarkReturn) {
  const ret1y = numericValue(row.ret1y_pct);
  const score = numericValue(row.nisa_score);
  const confidence = numericValue(row.data_confidence);
  const hardGate = hardGateText(row.hard_gate);
  if (ret1y === null || bestBenchmarkReturn === null) {
    return {
      status: '未判定',
      action: 'データ未接続',
      reason: '1年騰落率または比較対象が未取得。',
      excess: null,
    };
  }
  const target = bestBenchmarkReturn + 1;
  const excess = ret1y - target;
  if (excess < 0) {
    return {
      status: hardGate ? '指数優位・ゲートあり' : '指数優位',
      action: '個別株比率を下げる',
      reason: `1年実績が合格線を ${pct(Math.abs(excess))} 下回る。現時点では指数・投信優先。`,
      excess,
    };
  }
  if (hardGate) {
    return {
      status: '比較上は通過・ゲート保留',
      action: '6月イベント後に再判定',
      reason: `1年実績は合格線比 ${pct(excess)}。ただし ${hardGate} のため売買判断へ進めない。`,
      excess,
    };
  }
  if (excess >= 5 && score !== null && score >= 60 && confidence !== null && confidence >= 90) {
    return {
      status: '比較上は有力',
      action: '候補維持',
      reason: `1年実績が合格線を ${pct(excess)} 上回り、スコアと信頼度も最低条件を満たす。`,
      excess,
    };
  }
  if (excess >= 0) {
    return {
      status: '比較上は通過・要確認',
      action: '少額テスト候補',
      reason: `1年実績は合格線比 ${pct(excess)}。ただしスコア、信頼度、リスクの追加確認が必要。`,
      excess,
    };
  }
}

const candidates = readCsv(CANDIDATE_FILE).slice(0, 10);
const marketRows = readCsv(MARKET_MONTHLY_FILE);
const connectionRows = readCsv(BACKTEST_CONNECTION_FILE);
const connectionByTicker = new Map(connectionRows.map((row) => [row.ticker, row]));

const benchmarkDefs = [
  { symbol: '^GSPC', name: 'S&P500', role: '既存の無難な米国株比較', group: '主比較' },
  { symbol: '^N225', name: '日経平均', role: '日本株指数比較', group: '主比較' },
  { symbol: '^TOPX', name: 'TOPIX', role: '日本株広範囲比較', group: '主比較' },
  { symbol: '^IXIC', name: 'NASDAQ総合', role: '成長株・AI相場の参考比較', group: '参考比較' },
  { symbol: 'SMH', name: '半導体ETF(SMH)', role: '半導体テーマの参考比較', group: '参考比較' },
];

const benchmarkRows = benchmarkDefs.map((def) => {
  const rows = marketRows.filter((row) => row.market_symbol === def.symbol);
  const trailing = trailingReturn(rows, 12);
  return {
    updated_at: generatedAt,
    benchmark_symbol: def.symbol,
    benchmark_name: def.name,
    role: def.role,
    comparison_group: def.group,
    data_status: trailing ? '取得済み' : '未取得',
    start_month: trailing?.start_month || '',
    end_month: trailing?.end_month || '',
    start_value: round(trailing?.start_value, 2),
    end_value: round(trailing?.end_value, 2),
    trailing_12m_return_pct: round(trailing?.return_pct, 2),
    source: trailing ? '89_market_monthly_returns.csv / Yahoo Finance chart API 1mo' : '未取得。追加取得が必要。',
    treatment: trailing
      ? def.group === '主比較' ? '+1%合格線に使用' : '参考比較。+1%合格線には混ぜない'
      : '計算に混ぜない',
  };
});

const usablePrimaryBenchmarks = benchmarkRows
  .map((row) => ({ ...row, returnValue: numericValue(row.trailing_12m_return_pct) }))
  .filter((row) => row.returnValue !== null && row.comparison_group === '主比較');

const usableReferenceBenchmarks = benchmarkRows
  .map((row) => ({ ...row, returnValue: numericValue(row.trailing_12m_return_pct) }))
  .filter((row) => row.returnValue !== null && row.comparison_group === '参考比較');

const bestBenchmark = usablePrimaryBenchmarks
  .sort((a, b) => b.returnValue - a.returnValue)[0];
const bestBenchmarkReturn = bestBenchmark?.returnValue ?? null;
const plus1Target = bestBenchmarkReturn === null ? null : bestBenchmarkReturn + 1;

const candidateRows = candidates.map((row) => {
  const status = plus1Status(row, bestBenchmarkReturn);
  const connection = connectionByTicker.get(row.ticker);
  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    category: row.category,
    nisa_score: row.nisa_score,
    data_confidence: row.data_confidence,
    ret1y_pct: row.ret1y_pct,
    best_benchmark_name: bestBenchmark?.benchmark_name || '',
    best_benchmark_return_pct: round(bestBenchmarkReturn, 2),
    plus1_target_return_pct: round(plus1Target, 2),
    excess_vs_plus1_target_pct: round(status.excess, 2),
    validation_status: connection?.validation_status || '未接続',
    hard_gate: row.hard_gate || '',
    plus1_status: status.status,
    action: status.action,
    reason: status.reason,
    risk_memo: riskMemo(row),
  };
});

const allocationRuleRows = [
  {
    rule_id: 'P01',
    condition: '合格線を上回り、ゲートなし、信頼度90点以上',
    action: '個別株テスト候補として維持',
    meaning: '指数より個別株を選ぶ理由がある。ただし6月イベント後に再確認。',
  },
  {
    rule_id: 'P02',
    condition: '合格線を上回るが、決算後20営業日未到達などのゲートあり',
    action: '購入検討へ進めず、6月イベント後に再判定',
    meaning: '過去実績は強くても、今買う根拠としては未完成。',
  },
  {
    rule_id: 'P03',
    condition: '合格線を下回る',
    action: '個別株比率を下げる',
    meaning: 'その銘柄を買うより、指数・投信でよい可能性が高い。',
  },
  {
    rule_id: 'P04',
    condition: 'TOPIXなど比較対象が未取得',
    action: '未取得として記録し、計算に混ぜない',
    meaning: '取れていないデータを仮値で補わない。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '使用できる主比較',
    value: `${usablePrimaryBenchmarks.length}件`,
    interpretation: 'S&P500、日経平均を使用。TOPIXは未取得のため除外。',
  },
  {
    updated_at: generatedAt,
    item: '参考比較',
    value: `${usableReferenceBenchmarks.length}件`,
    interpretation: 'NASDAQ、SMHは参考表示。+1%合格線には混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '最も強い比較対象',
    value: bestBenchmark ? `${bestBenchmark.benchmark_name} ${pct(bestBenchmarkReturn)}` : '未算出',
    interpretation: '個別株候補は、この値に+1%ポイントした水準を超える必要がある。',
  },
  {
    updated_at: generatedAt,
    item: '+1%合格線',
    value: pct(plus1Target),
    interpretation: 'この線を下回る候補は、個別株比率を下げる判断になる。',
  },
  {
    updated_at: generatedAt,
    item: '比較上は有力/通過',
    value: `${candidateRows.filter((row) => row.plus1_status.includes('有力') || row.plus1_status.includes('通過')).length}社`,
    interpretation: 'ただしゲート保留の銘柄は購入検討へ進めない。',
  },
  {
    updated_at: generatedAt,
    item: '指数優位',
    value: `${candidateRows.filter((row) => row.plus1_status.includes('指数優位')).length}社`,
    interpretation: '個別株で狙う理由が弱く、指数・投信優先。',
  },
];

writeCsv('309_benchmark_plus1_reference.csv', benchmarkRows, [
  'updated_at',
  'benchmark_symbol',
  'benchmark_name',
  'role',
  'comparison_group',
  'data_status',
  'start_month',
  'end_month',
  'start_value',
  'end_value',
  'trailing_12m_return_pct',
  'source',
  'treatment',
]);

writeCsv('310_candidate_plus1_gate.csv', candidateRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'category',
  'nisa_score',
  'data_confidence',
  'ret1y_pct',
  'best_benchmark_name',
  'best_benchmark_return_pct',
  'plus1_target_return_pct',
  'excess_vs_plus1_target_pct',
  'validation_status',
  'hard_gate',
  'plus1_status',
  'action',
  'reason',
  'risk_memo',
]);

writeCsv('311_plus1_allocation_rules.csv', allocationRuleRows, [
  'rule_id',
  'condition',
  'action',
  'meaning',
]);

writeCsv('312_plus1_connection_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>+1%目標 接続チェック 2026年5月25日</title>
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
      min-width: 88px;
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
  <h1>+1%目標 接続チェック</h1>
  <div class="lead">
    <p><b>目的:</b> 個別株を選ぶ意味があるかを、S&P500・日経平均・TOPIX等の比較対象と接続します。目標は、比較対象のうち最も強いものを最低+1%ポイント上回ることです。</p>
    <p><b>重要:</b> ここで使う1年騰落率は後ろ向きの確認です。将来リターンを保証しません。ゲートが残る銘柄は、比較上強くても購入検討へ進めません。</p>
    <p><b>TOPIX:</b> 現在の手元CSVにはTOPIX月次がないため、仮値を入れず未取得として扱います。</p>
    <div class="toolbar">
      <a class="button" href="309_benchmark_plus1_reference.csv">309 比較対象CSV</a>
      <a class="button" href="310_candidate_plus1_gate.csv">310 候補別+1%CSV</a>
      <a class="button" href="311_plus1_allocation_rules.csv">311 配分ルールCSV</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </div>

  <div class="kpis">
    ${summaryRows.slice(0, 4).map((row) => `
      <div class="kpi">
        <small>${esc(row.item)}</small>
      <b>${esc(row.value)}</b>
        <span>${esc(row.interpretation)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. 比較対象</h2>
  <div class="card">
    <table>
      <thead><tr><th>比較対象</th><th>区分</th><th>役割</th><th>状態</th><th>期間</th><th>12か月騰落率</th><th>扱い</th></tr></thead>
      <tbody>
        ${benchmarkRows.map((row) => `
          <tr>
            <td>${esc(row.benchmark_name)}</td>
            <td>${esc(row.comparison_group)}</td>
            <td>${esc(row.role)}</td>
            <td><span class="badge ${row.data_status === '取得済み' ? 'ok' : 'stop'}">${esc(row.data_status)}</span></td>
            <td>${esc(row.start_month || '-')} - ${esc(row.end_month || '-')}</td>
            <td>${pct(numericValue(row.trailing_12m_return_pct))}</td>
            <td>${esc(row.treatment)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 候補別 +1%ゲート</h2>
  <div class="card">
    <p class="note">最強の比較対象は ${esc(bestBenchmark?.benchmark_name || '-')}、12か月騰落率は ${pct(bestBenchmarkReturn)}。したがって暫定合格線は ${pct(plus1Target)} です。</p>
    <table>
      <thead>
        <tr>
          <th>順位</th><th>銘柄</th><th>NISA点</th><th>1年騰落</th><th>合格線との差</th><th>過去検証</th><th>状態</th><th>アクション</th><th>理由</th>
        </tr>
      </thead>
      <tbody>
        ${candidateRows.map((row) => `
          <tr>
            <td>${esc(row.rank)}</td>
            <td>${esc(row.ticker)} ${esc(row.company)}</td>
            <td>${esc(row.nisa_score)}点</td>
            <td>${pct(numericValue(row.ret1y_pct))}</td>
            <td>${pct(numericValue(row.excess_vs_plus1_target_pct))}</td>
            <td>${esc(row.validation_status)}</td>
            <td><span class="badge ${row.plus1_status.includes('有力') ? 'ok' : row.plus1_status.includes('通過') ? 'warn' : row.plus1_status.includes('指数優位') ? 'stop' : 'warn'}">${esc(row.plus1_status)}</span></td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.reason)}<br><span class="note">${esc(row.risk_memo)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 個別株比率を下げるとは何をするか</h2>
  <div class="card">
    <table>
      <thead><tr><th>条件</th><th>実際にすること</th><th>意味</th></tr></thead>
      <tbody>
        ${allocationRuleRows.map((row) => `
          <tr>
            <td>${esc(row.condition)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.meaning)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">「個別株比率を下げる」とは、候補から外す・購入額を減らす・指数投信や現金待機へ回す、という具体的な資金配分変更です。</p>
    <p class="note">作成日: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'plus1_benchmark_connection_20260525.html'), html, 'utf8');

console.log('generated plus1_benchmark_connection_20260525.html');
