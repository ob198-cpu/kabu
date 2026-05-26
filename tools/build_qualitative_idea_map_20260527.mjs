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

const ideaRows = [
  {
    theme: 'AI半導体投資',
    event: 'AIサーバー投資、GPU需要、先端半導体投資の継続',
    chain: 'AI計算需要 -> 先端GPU/ASIC増加 -> ウエハ処理・検査・後工程需要 -> 装置・部材・検査企業に波及',
    beneficiary_type: '半導体製造装置、検査装置、精密加工、電子部品',
    japan_examples: '東京エレクトロン、SCREEN、ディスコ、レーザーテック、アドバンテスト、TDKなどを候補化して確認',
    hypothesis_layer: 'S',
    evidence_layer: '未接続',
    required_numbers: '対象セグメント売上、受注高、受注残、営業利益率、会社コメント、SOX/NASDAQ/日経半導体株指数との相対株価',
    reject_condition: '主要顧客の投資延期、在庫調整、輸出規制、利益率悪化、決算後20営業日で指数劣後',
    scoring_use: '候補抽出と確認条件。単純加点しない。',
  },
  {
    theme: '半導体工程の寡占・高シェア',
    event: '先端工程で特定プロセスの能力が不足する',
    chain: '先端半導体増産 -> エッチング/成膜/洗浄/露光/検査の工程負荷増 -> 高シェア工程企業の稼働・受注確認',
    beneficiary_type: '工程別に高シェアを持つ装置・部材企業',
    japan_examples: '東京エレクトロン、SCREEN、レーザーテック、ディスコなど。各社の工程・シェアは公式資料または業界資料で確認',
    hypothesis_layer: 'S',
    evidence_layer: '未接続',
    required_numbers: '工程別売上、WFE投資、受注残、顧客集中度、粗利率、PERが成長率で説明可能か',
    reject_condition: 'シェア根拠が確認できない、工程需要が数字に出ない、PER調整に耐えない',
    scoring_use: '質的S候補。ただし公式数字と株価反応がそろうまで統合Sにしない。',
  },
  {
    theme: 'HBM・先端パッケージ',
    event: 'AI向けメモリ、HBM、先端パッケージ投資が増える',
    chain: 'AIサーバー増加 -> HBM/先端パッケージ不足 -> 後工程装置、テスター、基板、材料需要',
    beneficiary_type: '後工程装置、検査、基板、材料、電子部品',
    japan_examples: 'アドバンテスト、イビデン、TDK、ディスコなどを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: '該当事業の売上成長、受注、利益率、顧客需要コメント、メモリ市況指標',
    reject_condition: 'メモリ投資鈍化、顧客在庫増、需要コメント悪化',
    scoring_use: '候補抽出。量的評価B以下なら上限をB以下に抑える。',
  },
  {
    theme: 'データセンター電力不足',
    event: 'AIデータセンター増加で電力・変電・配電設備が不足する',
    chain: 'データセンター建設 -> 電力容量不足 -> 変圧器/配電/UPS/電源部品/工事需要',
    beneficiary_type: '重電、電源、変圧器、電設、インフラ機器',
    japan_examples: '三菱電機、日立、明電舎、フジクラ、古河電工などを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: '電力インフラ関連売上、受注残、データセンター向け比率、設備投資計画、電力需要統計',
    reject_condition: '需要が一般設備投資に埋もれる、利益率が伸びない、受注残が増えない',
    scoring_use: '時流候補抽出。受注・利益率確認が通過条件。',
  },
  {
    theme: 'データセンター冷却',
    event: 'AIサーバー高発熱化で冷却投資が増える',
    chain: 'GPU高密度化 -> 空調/液冷/熱管理需要 -> 空調機器・制御・部材需要',
    beneficiary_type: '空調、冷却、熱管理、制御部品',
    japan_examples: 'ダイキン工業、三菱電機、電子部品企業などを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: 'データセンター向け売上、地域別利益、中国/欧米需要、会社コメント',
    reject_condition: 'データセンター寄与が小さい、空調全体の需要鈍化、中国需要悪化',
    scoring_use: '質的Bから開始。数値接続でA化を検討。',
  },
  {
    theme: '円安',
    event: 'ドル円上昇、海外売上の円換算増加',
    chain: '円安 -> 海外売上の円換算増 -> 輸出/海外比率高い企業の利益押し上げ',
    beneficiary_type: '輸出、海外売上比率の高い製造業、商社',
    japan_examples: '電子部品、自動車、機械、商社など。企業別海外売上比率で確認',
    hypothesis_layer: 'B',
    evidence_layer: '一部接続可',
    required_numbers: '海外売上比率、為替感応度、ドル円変化率、営業利益見通し、ヘッジ状況',
    reject_condition: '円安でもコスト増が上回る、為替感応度が小さい、円高反転',
    scoring_use: 'マクロ感応度ゲート。単独では候補にしない。',
  },
  {
    theme: '円高',
    event: '日銀政策変更、米金利低下などで円高が進む',
    chain: '円高 -> 輸入コスト低下/海外利益目減り -> 輸入企業と輸出企業で明暗',
    beneficiary_type: '輸入比率が高い企業、内需企業、原材料輸入企業',
    japan_examples: '食品、日用品、電力・ガス、航空などを候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '一部接続可',
    required_numbers: '輸入原価比率、為替感応度、原材料価格、価格転嫁状況',
    reject_condition: '需要数量が落ちる、価格競争で利益に残らない、海外利益減が大きい',
    scoring_use: '候補のリスク分岐と追い風分岐に使う。',
  },
  {
    theme: '金利上昇',
    event: '日銀利上げ、米長期金利上昇',
    chain: '金利上昇 -> 銀行利ざや改善期待/グロース割引率上昇 -> 銀行・保険と高PER株で明暗',
    beneficiary_type: '銀行、保険、金利感応株',
    japan_examples: '三井住友FG、三菱UFJ、東京海上HDなどを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '一部接続可',
    required_numbers: '資金利益、信用コスト、保険引受利益、政策保有株売却、日銀後の株価反応',
    reject_condition: '信用コスト増、景気悪化扱い、長期金利急低下、金融株が指数劣後',
    scoring_use: '市場ゲートと候補別ゲートに使う。',
  },
  {
    theme: '原油・ナフサ下落',
    event: '原油、ナフサ、化学原料価格が下がる',
    chain: '原材料価格下落 -> 原価低下 -> 化学/食品/運輸などの利益率改善余地',
    beneficiary_type: '化学、食品、包装、運輸、航空',
    japan_examples: '化学・食品・運輸企業を候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '未接続',
    required_numbers: 'ナフサ価格、原材料費率、売価維持率、在庫影響、営業利益率',
    reject_condition: '売価下落が先行、需要減、在庫評価損、原材料データが取得できない',
    scoring_use: '業界テーマ候補。データ取得できる範囲を明示して扱う。',
  },
  {
    theme: '原油・中東リスク',
    event: '戦争、海上輸送リスク、ホルムズ海峡リスク',
    chain: '供給不安 -> 原油/海運/保険料上昇 -> エネルギー・商社・海運に追い風、航空・化学に逆風',
    beneficiary_type: 'エネルギー、商社、海運、防衛関連',
    japan_examples: 'ENEOS、INPEX、商社、海運企業などを候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '一部接続可',
    required_numbers: '油価、精製マージン、在庫影響、海運市況、会社の感応度',
    reject_condition: '停戦、油価急落、精製マージン悪化、在庫評価損',
    scoring_use: 'イベント監視。短期反応が大きいため1年保有適性を別確認。',
  },
  {
    theme: '食品値上げ耐性',
    event: '物価高、原材料高、値上げ後の数量維持',
    chain: '原材料高 -> 値上げ -> 数量維持できるブランド企業の利益率回復',
    beneficiary_type: '食品、調味料、生活必需品、ブランド力企業',
    japan_examples: '味の素、キッコーマン、花王などを候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '一部接続可',
    required_numbers: '価格要因/数量要因、原材料費、営業利益率、国内外セグメント成長',
    reject_condition: '値上げ後の数量減、原材料再上昇、PERが成長率を上回りすぎる',
    scoring_use: '守り寄り候補の確認条件に使う。',
  },
  {
    theme: '防衛・安全保障',
    event: '防衛予算、地政学リスク、装備更新',
    chain: '安全保障需要 -> 防衛予算増 -> 防衛電子、造船、航空宇宙、通信機器需要',
    beneficiary_type: '防衛、重工、電子、通信、宇宙関連',
    japan_examples: '三菱重工、川崎重工、IHI、NECなどを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: '防衛関連受注、受注残、売上比率、利益率、政府予算',
    reject_condition: '受注が利益に結びつかない、採算悪化、政策変更',
    scoring_use: 'テーマ抽出。政策だけでは加点せず、受注と利益率を必須確認。',
  },
  {
    theme: '災害・インフラ強靭化',
    event: '地震、水害、老朽インフラ、復旧・防災投資',
    chain: '災害リスク -> 防災/復旧/点検/通信維持需要 -> 建設、通信、発電、測量、資材需要',
    beneficiary_type: '建設、通信、電力設備、測量、インフラ点検',
    japan_examples: '建設、通信、電設、測量機器企業を候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '未接続',
    required_numbers: '公共投資、受注、災害復旧関連売上、利益率、短期株価反応',
    reject_condition: '一過性で利益貢献が小さい、資材高で利益率が悪化',
    scoring_use: '社会インフラテーマ。倫理的配慮を含め、防災・復旧需要として整理。',
  },
  {
    theme: '新商品・ゲーム機サイクル',
    event: '新型ゲーム機、主力商品の大型発売',
    chain: '新製品発売 -> ハード販売/ソフト販売/部品需要 -> プラットフォーム企業と部品供給企業に波及',
    beneficiary_type: 'ゲーム、電子部品、物流、小売',
    japan_examples: '任天堂、関連部品・流通企業を候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: '販売計画、初動販売、ソフト装着率、利益率、在庫、会社予想',
    reject_condition: '供給不足、販売計画未達、期待先行で決算反応が弱い',
    scoring_use: '個別イベント候補。決算数字と初動販売確認が通過条件。',
  },
  {
    theme: 'TOB・M&A・大型提携',
    event: 'TOB、M&A、資本業務提携、大型顧客獲得',
    chain: '企業イベント -> 価格発見/シナジー期待/資本効率改善 -> 対象企業と関連企業の再評価',
    beneficiary_type: 'TOB対象、買収企業、同業再編候補',
    japan_examples: '発生企業をイベントごとに個別登録',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: 'TOB価格、プレミアム、買収資金、EPS影響、同業比較、発表後リターン',
    reject_condition: '買収条件不成立、希薄化、買収負担、材料出尽くし',
    scoring_use: '通常のNISA 1年保有とは別枠で監視。発生後に個別検証。',
  },
  {
    theme: '自社株買い・増配・資本効率',
    event: '自社株買い、増配、PBR改善、政策保有株売却',
    chain: '資本政策改善 -> EPS/ROE改善期待 -> 低PBR・現金保有企業の再評価',
    beneficiary_type: '低PBR、キャッシュリッチ、株主還元強化企業',
    japan_examples: '商社、金融、製造業などを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '一部接続可',
    required_numbers: '自社株買い規模、発行株比率、配当性向、ROE、PBR、FCF',
    reject_condition: '一時的還元、業績悪化、FCF不足、還元後もROE改善しない',
    scoring_use: '量的評価の質/還元項目へ接続可能。ただし発表だけでは加点しない。',
  },
  {
    theme: 'インバウンド・観光',
    event: '訪日客増加、円安、国際線回復',
    chain: '訪日客増 -> 宿泊/鉄道/小売/娯楽需要 -> レジャー・交通・百貨店に波及',
    beneficiary_type: '鉄道、ホテル、レジャー、小売、外食',
    japan_examples: '鉄道、空港、ホテル、百貨店、レジャー企業を候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '一部接続可',
    required_numbers: '訪日客数、客単価、稼働率、既存店売上、営業利益率',
    reject_condition: '円高、旅行需要鈍化、コスト増、人手不足で利益が伸びない',
    scoring_use: '景気・為替感応候補として抽出。営業利益率確認が必須。',
  },
  {
    theme: '人手不足・省人化',
    event: '賃上げ、人手不足、物流2024年問題、現場省人化',
    chain: '人件費上昇/人手不足 -> 自動化投資 -> FA、ロボット、ソフト、センサー需要',
    beneficiary_type: 'FA、ロボット、物流自動化、SaaS、センサー',
    japan_examples: 'キーエンス、ファナック、オムロン、物流機器企業などを候補化して確認',
    hypothesis_layer: 'A',
    evidence_layer: '未接続',
    required_numbers: '受注、設備投資統計、営業利益率、地域別需要、在庫循環',
    reject_condition: '設備投資減速、中国需要鈍化、在庫調整、PER調整',
    scoring_use: '中期テーマ候補。景気循環とPERリスクを同時確認。',
  },
  {
    theme: '医薬品承認・パイプライン',
    event: '新薬承認、臨床試験成功、適応拡大',
    chain: '臨床/承認イベント -> 将来売上期待 -> 製薬企業・関連企業の再評価',
    beneficiary_type: '製薬、バイオ、医療機器',
    japan_examples: '中外製薬、第一三共、武田薬品などを候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '未接続',
    required_numbers: '薬剤別売上、承認地域、ピークセールス、薬価、特許期限、研究開発費',
    reject_condition: '臨床失敗、承認遅延、薬価改定、主力薬依存',
    scoring_use: '個別イベントゲート。通常の景気循環と別に扱う。',
  },
  {
    theme: 'サイバーセキュリティ',
    event: '大規模障害、情報漏えい、規制強化',
    chain: 'リスク顕在化 -> セキュリティ投資増 -> セキュリティ製品/運用/クラウド需要',
    beneficiary_type: 'セキュリティ、SI、クラウド運用、認証',
    japan_examples: 'セキュリティ専業、SI、通信系IT企業を候補化して確認',
    hypothesis_layer: 'B',
    evidence_layer: '未接続',
    required_numbers: 'セキュリティ売上、ARR、受注、利益率、顧客数',
    reject_condition: 'テーマは強いが企業別売上比率が小さい、競争激化、利益率低下',
    scoring_use: 'テーマ候補抽出。企業別売上比率確認まで主候補化しない。',
  },
  {
    theme: 'IPO・未上場メガイベント',
    event: '大型IPO、未上場企業の資金調達、上場観測',
    chain: 'IPO観測 -> 関連上場企業/取引先/投資会社の思惑 -> 実需と期待を分離して確認',
    beneficiary_type: '直接上場企業、出資企業、取引先、類似上場企業',
    japan_examples: 'SpaceX、OpenAIなどは通常NISA対象外の可能性が高く、関連上場企業またはETF/投信で別枠監視',
    hypothesis_layer: 'B',
    evidence_layer: '未接続',
    required_numbers: '上場有無、NISA対象可否、出資比率、取引関係、関連企業の売上寄与',
    reject_condition: '未上場のまま、NISA対象外、関連企業の寄与が小さい、思惑だけで株価反応が続かない',
    scoring_use: '特別枠。通常候補スコアには混ぜない。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '登録テーマ数',
    value: `${ideaRows.length}件`,
    meaning: '時流・イベント・需要連鎖を、銘柄選定前の質的データとして整理。',
  },
  {
    updated_at: generatedAt,
    item: '使い方',
    value: '候補抽出・通過条件・除外条件',
    meaning: '質的アイデアは量的スコアへ直接足さず、確認すべき数字を決める入口に使う。',
  },
  {
    updated_at: generatedAt,
    item: '半導体テーマ',
    value: `${ideaRows.filter((row) => row.theme.includes('半導体') || row.theme.includes('HBM') || row.theme.includes('AI')).length}件`,
    meaning: 'AI、工程別高シェア、HBM、電力・冷却まで分解。',
  },
  {
    updated_at: generatedAt,
    item: '次工程',
    value: '銘柄候補との接続',
    meaning: '各テーマを100社前後の母集団に接続し、該当理由と確認数字を銘柄別に持たせる。',
  },
];

const ruleRows = [
  {
    rule: '質的アイデアは仮説で止めない',
    detail: '出来事、需要連鎖、恩恵業種、候補企業、確認数字、否定条件まで分解する。',
  },
  {
    rule: '質的アイデアは直接加点しない',
    detail: '量的スコアへ足さず、候補抽出、上限、通過条件、除外条件として使う。',
  },
  {
    rule: '必然性は数字で検証する',
    detail: '「儲かるはず」は、売上、受注、利益率、株価反応、同業比較で確認してから評価する。',
  },
  {
    rule: '反証条件を必ず持つ',
    detail: 'シェア根拠なし、需要が数字に出ない、PER調整に耐えない、指数劣後などを除外条件にする。',
  },
];

writeCsv('568_qualitative_idea_map_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('569_qualitative_idea_map_detail.csv', ideaRows, [
  'theme',
  'event',
  'chain',
  'beneficiary_type',
  'japan_examples',
  'hypothesis_layer',
  'evidence_layer',
  'required_numbers',
  'reject_condition',
  'scoring_use',
]);

writeCsv('570_qualitative_idea_map_rules.csv', ruleRows, [
  'rule',
  'detail',
]);

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的アイデア地図 2026年5月27日</title>
  <style>
    :root { --ink:#071f3a; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#0a426b; color:#fff; border-radius:14px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,42px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:940px; color:#edf7ff; font-weight:700; }
    section,.card { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); }
    section { padding:22px; margin-top:18px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0; }
    .card { padding:16px; }
    .card small { display:block; color:var(--muted); font-weight:700; }
    .card b { display:block; font-size:28px; margin-top:4px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .flow { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:12px; }
    .flow div { border:1px solid var(--line); background:var(--soft); border-radius:10px; padding:12px; min-height:112px; }
    .flow b { display:block; color:var(--blue); margin-bottom:6px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:1040px; }
    .wide table { min-width:1700px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:10px 12px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .actions a.secondary { background:#fff; color:var(--blue); border:1px solid var(--line); }
    @media (max-width:900px) { .cards,.flow { grid-template-columns:1fr; } main { padding:14px 10px 40px; } header,section { padding:18px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>質的アイデア地図</h1>
      <p class="lead">「半導体が買われるなら工程別に誰が得るか」のような仮説を、水平に多数整理し、銘柄選定の入口として使うための質的データ台帳です。</p>
    </header>

    <div class="cards">
      <div class="card"><small>登録テーマ</small><b>${ideaRows.length}件</b></div>
      <div class="card"><small>半導体・AI周辺</small><b>${ideaRows.filter((row) => row.theme.includes('半導体') || row.theme.includes('HBM') || row.theme.includes('AI')).length}件</b></div>
      <div class="card"><small>使い方</small><b>非加点</b></div>
      <div class="card"><small>次工程</small><b>銘柄接続</b></div>
    </div>

    <section>
      <h2>1. 目的</h2>
      <p>ニュースやイベントをそのまま点数にせず、「何が起きる」「どこに需要が流れる」「どの企業に数字として出る可能性がある」「どの条件なら否定する」を分けます。これにより、時流アイデアを銘柄選定に使いながら、思いつきや雰囲気で候補を上げることを抑えます。</p>
      <div class="note">この資料は質的仮説の台帳です。投資実行判断ではなく、6月テスト候補を探すための入口として使います。</div>
    </section>

    <section>
      <h2>2. 使う順番</h2>
      <div class="flow">
        <div><b>出来事</b>AI投資、金利、為替、原油、戦争、新商品などを登録。</div>
        <div><b>需要連鎖</b>一次需要、二次需要、ボトルネックを分解。</div>
        <div><b>候補抽出</b>恩恵を受ける業種と日本株候補を広げる。</div>
        <div><b>数字確認</b>売上、受注、利益率、株価反応で検証。</div>
        <div><b>判定</b>通過、保留、除外を決める。点数へ単純加算しない。</div>
      </div>
    </section>

    <section>
      <h2>3. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'value', label: '内容' },
        { key: 'meaning', label: '意味' },
      ], summaryRows)}
    </section>

    <section>
      <h2>4. 質的アイデア一覧</h2>
      ${table([
        { key: 'theme', label: 'テーマ' },
        { key: 'event', label: '出来事' },
        { key: 'chain', label: '需要連鎖' },
        { key: 'beneficiary_type', label: '恩恵業種' },
        { key: 'japan_examples', label: '日本株候補例' },
        { key: 'hypothesis_layer', label: '仮説層' },
        { key: 'evidence_layer', label: '実績層' },
        { key: 'required_numbers', label: '確認する数字' },
        { key: 'reject_condition', label: '否定条件' },
        { key: 'scoring_use', label: 'スコアでの扱い' },
      ], ideaRows, 'wide')}
    </section>

    <section>
      <h2>5. 運用ルール</h2>
      ${table([
        { key: 'rule', label: 'ルール' },
        { key: 'detail', label: '内容' },
      ], ruleRows)}
      <div class="actions">
        <a href="568_qualitative_idea_map_summary.csv">要約CSV</a>
        <a href="569_qualitative_idea_map_detail.csv">詳細CSV</a>
        <a href="570_qualitative_idea_map_rules.csv">ルールCSV</a>
        <a class="secondary" href="qualitative_gate_scoring_20260527.html">質的評価ゲートへ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qualitative_idea_map_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  themes: ideaRows.length,
  output: 'qualitative_idea_map_20260527.html',
}, null, 2));
