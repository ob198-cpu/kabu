import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  if (row.length) rows.push(row);
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function tickerOf(text) {
  return String(text || '').split(/\s+/)[0];
}

function numFrom(text, pattern) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(digits));
}

function scoreProfitGrowth(value) {
  if (value === null) return 50;
  return clamp(50 + value * 0.8);
}

function scoreSalesGrowth(value) {
  if (value === null) return 50;
  return clamp(50 + value * 1.1);
}

function scoreRoe(value) {
  if (value === null) return 50;
  return clamp(50 + (value - 8) * 3);
}

function industryTailwindScore(themeText, ticker) {
  const text = `${themeText || ''} ${ticker || ''}`;
  if (/AI|半導体|電子部品/.test(text)) return 70;
  if (/銀行|金利/.test(text)) return 66;
  if (/商社|資源|バフェット/.test(text)) return 64;
  if (/食品|生活|ABF|ヘルスケア/.test(text)) return 63;
  if (/防衛|重工|発電/.test(text)) return 61;
  return 58;
}

function shareholderReturnScore(themeText, ticker) {
  const text = `${themeText || ''} ${ticker || ''}`;
  if (/商社|株主還元|バフェット/.test(text)) return 70;
  if (/銀行|金利/.test(text)) return 65;
  if (/食品|生活/.test(text)) return 58;
  if (/半導体|電子部品|AI/.test(text)) return 55;
  if (/9984/.test(text)) return 50;
  return 55;
}

function macroRiskPenalty(themeText, ticker) {
  const text = `${themeText || ''} ${ticker || ''}`;
  if (/9984/.test(text)) return 8;
  if (/AI|半導体|電子部品/.test(text)) return 6;
  if (/銀行|金利|防衛|重工/.test(text)) return 5;
  if (/商社|資源/.test(text)) return 4;
  if (/食品|生活/.test(text)) return 3;
  return 4;
}

function overheatingPenalty({ per, pbr, oneYear, peerMultiple }) {
  const oneYearPenalty = oneYear === null ? 2 : clamp((oneYear - 50) * 0.08, 0, 18);
  const peerPenalty = peerMultiple === null ? 2 : clamp((peerMultiple - 1.2) * 12, 0, 12);
  const perPenalty = per === null ? 2 : clamp((per - 35) * 0.25, 0, 12);
  const pbrPenalty = pbr === null ? 1 : clamp((pbr - 5) * 1.2, 0, 10);
  return round(oneYearPenalty + peerPenalty + perPenalty + pbrPenalty, 1);
}

function judgement(score, confidence, penalty) {
  if (score >= 65 && confidence >= 70 && penalty <= 18) return '継続候補';
  if (score >= 55 && confidence >= 60) return '条件付き継続';
  if (score >= 45) return '再確認';
  return '見送り';
}

function expectedBand(score) {
  if (score >= 75) return '+11〜16%を説明できる可能性';
  if (score >= 65) return '+9〜13%を確認対象';
  if (score >= 55) return '+7〜11%目安。+11%には追加根拠が必要';
  if (score >= 45) return '+11%目標には追加データと条件改善が必要';
  return '+11%目標には不足';
}

const candidateRows = readCsv('720_client_send_pack_10_candidates.csv');
const finalRows = readCsv('679_final_report_1600_candidates.csv');
const finalByTicker = new Map(finalRows.map((row) => [tickerOf(row['銘柄']), row]));

const detailRows = candidateRows.map((row) => {
  const ticker = tickerOf(row['銘柄']);
  const final = finalByTicker.get(ticker) || {};
  const metrics = row['主な数値根拠'] || '';
  const combinedText = `${metrics} ${final['注意点'] || ''} ${final['6月に確認する条件'] || ''}`;
  const per = numFrom(metrics, /PER([0-9.]+)倍/);
  const pbr = numFrom(metrics, /PBR([0-9.]+)倍/);
  const roe = numFrom(metrics, /ROE(-?[0-9.]+)%/);
  const profit = numFrom(metrics, /利益(-?[0-9.]+)%/);
  const oneYear = numFrom(metrics, /1年(-?[0-9.]+)%/);
  const reaction = numFrom(metrics, /反応(-?[0-9.]+)点/);
  const sales = numFrom(combinedText, /売上(-?[0-9.]+)%/);
  const peerMultiple = numFrom(row['同業比較'], /PER倍率\s*([0-9.]+)倍/);
  const profitScore = scoreProfitGrowth(profit);
  const salesScore = scoreSalesGrowth(sales);
  const roeScore = scoreRoe(roe);
  const reactionScore = reaction ?? 50;
  const tailwind = industryTailwindScore(final['質的テーマ'], ticker);
  const returnScore = shareholderReturnScore(final['質的テーマ'], ticker);
  const rawScore =
    profitScore * 0.30 +
    salesScore * 0.20 +
    roeScore * 0.15 +
    reactionScore * 0.15 +
    tailwind * 0.10 +
    returnScore * 0.10;
  const overheat = overheatingPenalty({ per, pbr, oneYear, peerMultiple });
  const macro = macroRiskPenalty(final['質的テーマ'], ticker);
  const score = clamp(rawScore - overheat - macro);
  const present = [per, pbr, roe, profit, oneYear, reaction, sales, peerMultiple]
    .filter((value) => value !== null).length;
  const confidence = round((present / 8) * 100, 0);
  const missing = [];
  if (sales === null) missing.push('売上成長');
  if (per === null) missing.push('PER');
  if (pbr === null) missing.push('PBR');
  if (roe === null) missing.push('ROE');
  if (reaction === null) missing.push('決算後反応');
  const caution = [];
  if (oneYear !== null && oneYear >= 100) caution.push('過去1年上昇が大きく、反落リスク確認');
  if (peerMultiple !== null && peerMultiple >= 1.4) caution.push('同業PER比で割高説明が必要');
  if (profit !== null && profit < 5) caution.push('利益成長が弱く、来期見通し確認');
  if (missing.length) caution.push(`未取得: ${missing.join('・')}`);
  const formula =
    `0.30×${round(profitScore)} + 0.20×${round(salesScore)} + 0.15×${round(roeScore)} + ` +
    `0.15×${round(reactionScore)} + 0.10×${round(tailwind)} + 0.10×${round(returnScore)} ` +
    `- 過熱${overheat} - マクロ${macro} = ${round(score)}`;
  return {
    '順位': '',
    '銘柄': row['銘柄'],
    '現在の扱い': row['現在の扱い'],
    '過去1年上昇率': oneYear === null ? '未取得' : `${round(oneYear)}%`,
    '利益成長率': profit === null ? '未取得' : `${round(profit)}%`,
    '売上成長率': sales === null ? '未取得' : `${round(sales)}%`,
    'ROE': roe === null ? '未取得' : `${round(roe)}%`,
    '決算後反応': reaction === null ? '未取得' : `${round(reaction)}点`,
    'PER倍率': peerMultiple === null ? '未取得' : `${round(peerMultiple, 2)}倍`,
    '継続期待スコア': round(score),
    '判定': judgement(score, confidence, overheat),
    '期待年利の見方': expectedBand(score),
    '量的スコア内訳': `利益${round(profitScore)} / 売上${round(salesScore)} / ROE${round(roeScore)} / 反応${round(reactionScore)}`,
    '質的補助内訳': `業界追い風${tailwind} / 還元${returnScore}`,
    '減点': `過熱${overheat} / マクロ${macro}`,
    'データ信頼度': `${confidence}%`,
    '式': formula,
    '確認事項': caution.join('。') || '6月イベント後の価格維持と決算後20営業日反応を確認'
  };
}).sort((a, b) => Number(b['継続期待スコア']) - Number(a['継続期待スコア']))
  .map((row, index) => ({ ...row, '順位': index + 1 }));

const summary = {
  averageScore: round(detailRows.reduce((sum, row) => sum + Number(row['継続期待スコア']), 0) / detailRows.length),
  passCount: detailRows.filter((row) => ['継続候補', '条件付き継続'].includes(row['判定'])).length,
  strictCount: detailRows.filter((row) => row['判定'] === '継続候補').length,
  averageOneYear: round(candidateRows.reduce((sum, row) => {
    const oneYear = numFrom(row['主な数値根拠'] || '', /1年(-?[0-9.]+)%/);
    return sum + (oneYear ?? 0);
  }, 0) / candidateRows.length)
};

const formulaRows = [
  {
    '項目': '基本思想',
    '内容': '過去1年上昇率はそのまま期待値にしない。利益成長、売上成長、ROE、決算後反応で説明できる部分だけを評価し、PER/PBR/過去上昇の過熱は減点する。'
  },
  {
    '項目': '継続期待スコア',
    '内容': '0.30×利益成長スコア + 0.20×売上成長スコア + 0.15×ROEスコア + 0.15×決算後反応スコア + 0.10×業界追い風 + 0.10×還元 - 過熱ペナルティ - マクロリスク'
  },
  {
    '項目': '過熱ペナルティ',
    '内容': '過去1年上昇率、同業PER倍率、PER、PBRが高いほど減点。過去に上がった銘柄ほど、利益成長で説明できるかを厳しく見る。'
  },
  {
    '項目': '合格目安',
    '内容': 'S&P500平均10%を前提に、個別株は年+11%以上を説明できる候補だけを中心に残す。60点台は条件付き、50点台は保留。'
  }
];

writeCsv('723_candidate_continuation_score.csv', detailRows, [
  '順位',
  '銘柄',
  '現在の扱い',
  '過去1年上昇率',
  '利益成長率',
  '売上成長率',
  'ROE',
  '決算後反応',
  'PER倍率',
  '継続期待スコア',
  '判定',
  '期待年利の見方',
  '量的スコア内訳',
  '質的補助内訳',
  '減点',
  'データ信頼度',
  '式',
  '確認事項'
]);
writeCsv('724_candidate_continuation_formula.csv', formulaRows, ['項目', '内容']);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 継続期待スコア</title>
  <style>
    :root { --ink:#050b14; --muted:#45566a; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --soft:#f4f8fc; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#123d63; color:#fff; border-radius:10px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; line-height:1.25; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); font-size:22px; }
    p { margin:0 0 10px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .card b { display:block; color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; word-break:normal; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .score th:nth-child(1), .score td:nth-child(1) { width:5%; text-align:center; }
    .score th:nth-child(2), .score td:nth-child(2) { width:15%; font-weight:800; }
    .score th:nth-child(3), .score td:nth-child(3) { width:10%; text-align:center; }
    .score th:nth-child(4), .score td:nth-child(4) { width:10%; text-align:right; }
    .score th:nth-child(5), .score td:nth-child(5) { width:11%; text-align:center; }
    .score th:nth-child(6), .score td:nth-child(6) { width:17%; }
    .score th:nth-child(7), .score td:nth-child(7) { width:12%; }
    .badge { display:inline-block; border-radius:8px; padding:4px 8px; color:#fff; font-weight:900; white-space:nowrap; }
    .ok { background:var(--green); }
    .watch { background:var(--amber); }
    .stop { background:var(--red); }
    .formula { background:#f8fbff; border:1px solid var(--line); border-radius:8px; padding:14px; font-family:Consolas,"Noto Sans JP",monospace; font-size:13px; }
    .note { color:var(--muted); font-size:12px; }
    header .note { color:#dbeeff; }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>候補10社 継続期待スコア</h1>
    <p>過去1年で大きく上がった銘柄について、その上昇が次の1年も続く根拠を、利益成長・売上成長・ROE・決算後反応・PER/PBR過熱で分解して確認します。</p>
    <p class="note">作成: ${esc(generatedAt)} / 本表は購入確定ではなく、6月イベント後に再判定するための確認表です。</p>
  </header>

  <div class="grid">
    <div class="card"><b>過去1年平均</b><div class="value">+${esc(summary.averageOneYear)}%</div><p>候補10社の単純平均</p></div>
    <div class="card"><b>継続期待スコア平均</b><div class="value">${esc(summary.averageScore)}点</div><p>過熱・マクロ減点後</p></div>
    <div class="card"><b>継続/条件付き</b><div class="value">${esc(summary.passCount)}社</div><p>60点以上</p></div>
    <div class="card"><b>中心候補</b><div class="value">${esc(summary.strictCount)}社</div><p>70点以上かつ信頼度条件</p></div>
  </div>

  <section>
    <h2>計算式</h2>
    <div class="formula">継続期待スコア = 0.30×利益成長 + 0.20×売上成長 + 0.15×ROE + 0.15×決算後反応 + 0.10×業界追い風 + 0.10×還元 - 過熱ペナルティ - マクロリスク</div>
    <p class="note">過去1年上昇率は直接加点しません。上がりすぎている場合は過熱ペナルティとして扱い、利益成長や決算後反応で説明できるかを確認します。</p>
  </section>

  <section>
    <h2>候補10社の継続期待スコア</h2>
    <table class="score">
      <thead><tr><th>順位</th><th>銘柄</th><th>スコア</th><th>判定</th><th>信頼度</th><th>期待年利の見方</th><th>確認事項</th></tr></thead>
      <tbody>
        ${detailRows.map((row) => {
          const score = Number(row['継続期待スコア']);
          const cls = row['判定'] === '継続候補' ? 'ok' : row['判定'] === '条件付き継続' ? 'watch' : 'stop';
          return `<tr><td>${esc(row['順位'])}</td><td>${esc(row['銘柄'])}</td><td>${esc(score)}点</td><td><span class="badge ${cls}">${esc(row['判定'])}</span></td><td>${esc(row['データ信頼度'])}</td><td>${esc(row['期待年利の見方'])}</td><td>${esc(row['確認事項'])}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>代入値と減点</h2>
    <table>
      <thead><tr><th>銘柄</th><th>量的スコア</th><th>質的補助</th><th>減点</th><th>式</th></tr></thead>
      <tbody>
        ${detailRows.map((row) => `<tr><td>${esc(row['銘柄'])}</td><td>${esc(row['量的スコア内訳'])}</td><td>${esc(row['質的補助内訳'])}</td><td>${esc(row['減点'])}</td><td>${esc(row['式'])}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>出力CSV</h2>
    <p><a href="723_candidate_continuation_score.csv">継続期待スコアCSV</a> / <a href="724_candidate_continuation_formula.csv">計算式CSV</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'candidate_continuation_score_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'candidate_continuation_score_20260527.html',
  rows: detailRows.length,
  averageScore: summary.averageScore,
  passCount: summary.passCount
}, null, 2));
