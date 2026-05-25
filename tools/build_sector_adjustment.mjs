import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UNIVERSE_FILE = '199_universe100_screening.csv';
const CANDIDATE_FILE = '280_nisa_test_10_candidate_plan_reaction_updated.csv';

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

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  const nums = values.filter((value) => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
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

function ratioLabel(value, medianValue, lowerIsBetter = true) {
  if (value === null || medianValue === null || medianValue === 0) return '未算出';
  const ratio = value / medianValue;
  if (lowerIsBetter) {
    if (ratio <= 0.8) return '同業比で低い';
    if (ratio <= 1.2) return '同業並み';
    if (ratio <= 1.5) return 'やや高い';
    return '高い';
  }
  if (ratio >= 1.2) return '同業比で高い';
  if (ratio >= 0.8) return '同業並み';
  return '低い';
}

function metricAdjustment(value, medianValue, lowerIsBetter = true, weight = 1) {
  if (value === null || medianValue === null || medianValue === 0) return 0;
  const ratio = value / medianValue;
  if (lowerIsBetter) {
    if (ratio <= 0.8) return 5 * weight;
    if (ratio <= 1.2) return 0;
    if (ratio <= 1.5) return -5 * weight;
    return -10 * weight;
  }
  if (ratio >= 1.2) return 7 * weight;
  if (ratio >= 0.8) return 0;
  return -7 * weight;
}

const universeRows = readCsv(UNIVERSE_FILE);
const candidateRows = readCsv(CANDIDATE_FILE);

const groups = new Map();
for (const row of universeRows) {
  const sector = row.sector || '未分類';
  if (!groups.has(sector)) groups.set(sector, []);
  groups.get(sector).push(row);
}

const peerRows = [...groups.entries()]
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ja'))
  .map(([sector, rows]) => {
    const perValues = rows.map((row) => numericValue(row.per_forecast));
    const pbrValues = rows.map((row) => numericValue(row.pbr_actual));
    const roeValues = rows.map((row) => numericValue(row.roe_actual_pct));
    const perMedian = median(perValues);
    const pbrMedian = median(pbrValues);
    const roeMedian = median(roeValues);
    const enough = rows.length >= 3
      && perValues.filter((value) => value !== null).length >= 3
      && pbrValues.filter((value) => value !== null).length >= 3
      && roeValues.filter((value) => value !== null).length >= 3;
    return {
      updated_at: generatedAt,
      sector,
      peer_count: rows.length,
      per_count: perValues.filter((value) => value !== null).length,
      pbr_count: pbrValues.filter((value) => value !== null).length,
      roe_count: roeValues.filter((value) => value !== null).length,
      per_median: round(perMedian),
      pbr_median: round(pbrMedian),
      roe_median_pct: round(roeMedian),
      adjustment_status: enough ? '参考可' : '比較数不足',
      treatment: enough ? '業種内比較に使用可' : '購入検討用スコアには混ぜない',
    };
  });

const peerBySector = new Map(peerRows.map((row) => [row.sector, row]));

const candidateAdjustmentRows = candidateRows.map((row) => {
  const peer = peerBySector.get(row.sector);
  const per = numericValue(row.per);
  const pbr = numericValue(row.pbr);
  const roe = numericValue(row.roe_pct);
  const perMedian = numericValue(peer?.per_median);
  const pbrMedian = numericValue(peer?.pbr_median);
  const roeMedian = numericValue(peer?.roe_median_pct);
  const enoughPeers = peer?.adjustment_status === '参考可';
  const candidateMetricCount = [per, pbr, roe].filter((value) => value !== null).length;
  const canUse = enoughPeers && candidateMetricCount >= 2;
  const baseValuation = numericValue(row.valuation_score);
  const delta = canUse
    ? metricAdjustment(per, perMedian, true, 1)
      + metricAdjustment(pbr, pbrMedian, true, 0.8)
      + metricAdjustment(roe, roeMedian, false, 1)
    : 0;
  const adjusted = canUse && baseValuation !== null ? clamp(baseValuation + delta) : null;
  let status = '未反映';
  let reason = '同業比較数または候補側指標が不足。';
  if (canUse) {
    status = '補正参考可';
    reason = '同業3社以上かつ候補側指標2項目以上で比較可能。';
  } else if (!peer) {
    reason = '同業グループが母集団に見つからない。';
  } else if (peer.adjustment_status !== '参考可') {
    reason = `同業${peer.peer_count}社、PER ${peer.per_count}件、PBR ${peer.pbr_count}件、ROE ${peer.roe_count}件で基準未満。`;
  } else if (candidateMetricCount < 2) {
    reason = `候補側指標が不足: ${candidateMetricCount}/3項目。`;
  }
  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    peer_count: peer?.peer_count ?? 0,
    candidate_metric_count: candidateMetricCount,
    per: row.per,
    sector_per_median: peer?.per_median ?? '',
    per_vs_sector: ratioLabel(per, perMedian, true),
    pbr: row.pbr,
    sector_pbr_median: peer?.pbr_median ?? '',
    pbr_vs_sector: ratioLabel(pbr, pbrMedian, true),
    roe_pct: row.roe_pct,
    sector_roe_median_pct: peer?.roe_median_pct ?? '',
    roe_vs_sector: ratioLabel(roe, roeMedian, false),
    original_valuation_score: row.valuation_score,
    adjustment_delta: canUse ? round(delta, 1) : '',
    sector_adjusted_valuation_score: adjusted === null ? '' : round(adjusted, 1),
    adjustment_status: status,
    score_treatment: canUse ? '購入検討用スコアへ入れる前の監査値' : '購入検討用スコアには混ぜない',
    reason,
  };
});

const ruleRows = [
  {
    rule_id: 'S01',
    rule_name: '同じ業種内で比較',
    detail: 'PER/PBR/ROEは業種で水準が違うため、候補銘柄の業種と同じ母集団内中央値と比較する。',
    pass_condition: '同業3社以上、かつPER/PBR/ROEの中央値を計算できる。',
    fail_action: '比較数不足として購入検討用スコアには混ぜない。',
  },
  {
    rule_id: 'S02',
    rule_name: '候補側の指標不足を止める',
    detail: '候補銘柄側のPER/PBR/ROEが2項目未満なら、業種別補正を出さない。',
    pass_condition: 'PER/PBR/ROEのうち2項目以上取得済み。',
    fail_action: '補正未反映。追加データ取得へ戻す。',
  },
  {
    rule_id: 'S03',
    rule_name: '自動加点しない',
    detail: '業種別補正値は監査値であり、ただちに最終購入判断へ足し込まない。',
    pass_condition: '補正方向と理由が表示されている。',
    fail_action: '説明できない補正は使用しない。',
  },
  {
    rule_id: 'S04',
    rule_name: '同業不足の扱い',
    detail: 'ネット、食品、空調など、母集団内の同業数が少ない場合は無理に広い業種へ寄せない。',
    pass_condition: '広域分類を作る場合は別ルールで定義する。',
    fail_action: '現段階では未反映にする。',
  },
];

const summaryRows = [
  {
    item: '候補銘柄',
    value: `${candidateAdjustmentRows.length}社`,
    note: CANDIDATE_FILE,
  },
  {
    item: '補正参考可',
    value: `${candidateAdjustmentRows.filter((row) => row.adjustment_status === '補正参考可').length}社`,
    note: '同業3社以上、候補側指標2項目以上。',
  },
  {
    item: '未反映',
    value: `${candidateAdjustmentRows.filter((row) => row.adjustment_status !== '補正参考可').length}社`,
    note: '比較数不足または候補側指標不足。',
  },
  {
    item: '次工程',
    value: '過去検証・バックテスト',
    note: '補正値が本当に有効か、イベント後・決算後反応で検証する。',
  },
];

writeCsv('299_sector_peer_medians.csv', peerRows, [
  'updated_at',
  'sector',
  'peer_count',
  'per_count',
  'pbr_count',
  'roe_count',
  'per_median',
  'pbr_median',
  'roe_median_pct',
  'adjustment_status',
  'treatment',
]);

writeCsv('300_candidate_sector_adjustment.csv', candidateAdjustmentRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'peer_count',
  'candidate_metric_count',
  'per',
  'sector_per_median',
  'per_vs_sector',
  'pbr',
  'sector_pbr_median',
  'pbr_vs_sector',
  'roe_pct',
  'sector_roe_median_pct',
  'roe_vs_sector',
  'original_valuation_score',
  'adjustment_delta',
  'sector_adjusted_valuation_score',
  'adjustment_status',
  'score_treatment',
  'reason',
]);

writeCsv('301_sector_adjustment_rules.csv', ruleRows, ['rule_id', 'rule_name', 'detail', 'pass_condition', 'fail_action']);
writeCsv('302_sector_adjustment_summary.csv', summaryRows, ['item', 'value', 'note']);

const badge = (status) => status === '補正参考可'
  ? '<span class="badge ok">補正参考可</span>'
  : '<span class="badge warn">未反映</span>';

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>業種別補正チェック 2026年5月25日</title>
  <style>
    body { margin:0; font-family:"Yu Gothic", Meiryo, sans-serif; color:#111; background:#f5f8fb; line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:28px 18px 54px; }
    h1 { margin:0 0 8px; color:#073a5a; font-size:28px; }
    h2 { margin:30px 0 12px; padding-left:10px; border-left:8px solid #0b6f9f; color:#073a5a; }
    .lead, .card { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi span { display:block; color:#42526b; font-size:13px; }
    .kpi b { display:block; color:#073a5a; font-size:26px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; margin-top:12px; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; vertical-align:top; overflow-wrap:anywhere; font-size:12.5px; }
    th { background:#e4f1fa; color:#073a5a; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-weight:800; }
    .ok { background:#e9f7ef; color:#007a3d; }
    .warn { background:#fff4df; color:#9a5b00; }
    .formula { font-family:Consolas, "Yu Gothic", Meiryo, sans-serif; background:#f7fbff; border:1px solid #cbddeb; border-radius:8px; padding:12px; }
    a { color:#075985; font-weight:700; }
    @media print { body { background:#fff; } table, tr, td, th, .lead, .card, .kpi { break-inside:avoid; page-break-inside:avoid; box-shadow:none; } }
  </style>
</head>
<body>
<main>
  <h1>業種別補正チェック</h1>
  <div class="lead">
    <p><b>目的:</b> PER/PBR/ROEを全業種共通の閾値で比べる危険を減らし、同じ業種内の中央値と比べて割高・割安・質を確認します。</p>
    <p><b>重要:</b> この補正値は監査値です。まだ最終売買判断へ直接足し込まず、比較数不足や候補側データ不足がある場合は未反映にします。</p>
    <p><a href="index.html">メインページへ戻る</a> / <a href="issue_resolution_flowchart_20260525.html">課題解決フローへ戻る</a></p>
  </div>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>ルール</h2>
  <table>
    <thead><tr><th style="width:8%">ID</th><th style="width:18%">ルール</th><th>内容</th><th style="width:22%">通過条件</th><th style="width:20%">落ちた場合</th></tr></thead>
    <tbody>
      ${ruleRows.map((row) => `<tr>
        <td>${esc(row.rule_id)}</td>
        <td><b>${esc(row.rule_name)}</b></td>
        <td>${esc(row.detail)}</td>
        <td>${esc(row.pass_condition)}</td>
        <td>${esc(row.fail_action)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>候補銘柄の業種別比較</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">順位</th>
        <th style="width:13%">銘柄</th>
        <th style="width:9%">業種</th>
        <th style="width:7%">同業数</th>
        <th style="width:9%">PER</th>
        <th style="width:9%">PBR</th>
        <th style="width:9%">ROE</th>
        <th style="width:10%">元割安点</th>
        <th style="width:10%">補正後</th>
        <th style="width:9%">状態</th>
        <th>理由</th>
      </tr>
    </thead>
    <tbody>
      ${candidateAdjustmentRows.map((row) => `<tr>
        <td>${esc(row.rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b></td>
        <td>${esc(row.sector)}</td>
        <td>${esc(row.peer_count)}社</td>
        <td>${esc(row.per || '-')}<br><small>中央値 ${esc(row.sector_per_median || '-')}</small><br>${esc(row.per_vs_sector)}</td>
        <td>${esc(row.pbr || '-')}<br><small>中央値 ${esc(row.sector_pbr_median || '-')}</small><br>${esc(row.pbr_vs_sector)}</td>
        <td>${esc(row.roe_pct || '-')}%<br><small>中央値 ${esc(row.sector_roe_median_pct || '-')}%</small><br>${esc(row.roe_vs_sector)}</td>
        <td>${esc(row.original_valuation_score || '-')}点</td>
        <td>${row.sector_adjusted_valuation_score ? `${esc(row.sector_adjusted_valuation_score)}点<br><small>${esc(row.adjustment_delta)}点</small>` : '-'}</td>
        <td>${badge(row.adjustment_status)}</td>
        <td>${esc(row.reason)}<br>${esc(row.score_treatment)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>業種別中央値</h2>
  <table>
    <thead><tr><th>業種</th><th>同業数</th><th>PER中央値</th><th>PBR中央値</th><th>ROE中央値</th><th>扱い</th></tr></thead>
    <tbody>
      ${peerRows.map((row) => `<tr>
        <td>${esc(row.sector)}</td>
        <td>${esc(row.peer_count)}社</td>
        <td>${esc(row.per_median || '-')}</td>
        <td>${esc(row.pbr_median || '-')}</td>
        <td>${esc(row.roe_median_pct || '-')}%</td>
        <td>${esc(row.treatment)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>次の工程</h2>
  <div class="card">
    <p>次は、過去検証・バックテストへ進みます。業種別補正で見えた割高/割安が、実際にその後の株価反応や指数超過に役立つかを確認します。</p>
    <p>更新日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'sector_adjustment_20260525.html'), html, 'utf8');

console.log(`generated sector adjustment: ${candidateAdjustmentRows.length} candidates`);
