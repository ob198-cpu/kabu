from __future__ import annotations

import csv
import html
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent

UNIVERSE_CSV = ROOT / "780_universe100_reselection_metrics_20260528.csv"
EVENT_CSV = ROOT / "106_june_event_engine_output.csv"
FINANCIAL_CSV = ROOT / "candidate10_financial_confirmation_gate_20260614.csv"
QUAL_CSV = ROOT / "889_cross_channel_candidate_comparison_20260605.csv"
THEME_GATE_CSV = ROOT / "890_june_theme_integration_gate_20260605.csv"
PRICE_CSV = DATA_ROOT / "data" / "intraday_snapshots.csv"
PRICE_PATCH_CSV = ROOT / "ultimate_selection_price_patch_20260618.csv"
SUPPLEMENT_CSV = ROOT / "276_candidate_supplement_screening.csv"
TOP20_CSV = ROOT / "274_top20_completion_recalculated_candidates.csv"
QUAL_EXPLORE_CSV = ROOT / "254_qualitative_trend_exploration_score.csv"
REACTION_CSV = ROOT / "273_top20_earnings_reaction_completed.csv"
EVENT_VALIDATION_CSV = ROOT / "306_event_reaction_validation.csv"
CANDIDATE_DISCOVERY_CSV = ROOT / "142_candidate_discovery_funnel_score.csv"

OUT_SCORE = ROOT / "ultimate_selection_scores_20260618.csv"
OUT_PORTFOLIO = ROOT / "ultimate_selection_portfolio_20260618.csv"
OUT_MISSING = ROOT / "ultimate_selection_missing_data_20260618.csv"
OUT_EXECUTION = ROOT / "ultimate_selection_execution_plan_20260618.csv"
OUT_RISK = ROOT / "ultimate_selection_risk_scenarios_20260618.csv"
OUT_TRADE_RULES = ROOT / "ultimate_selection_trade_rules_20260618.csv"
OUT_DAY_CHECKLIST = ROOT / "ultimate_selection_day_checklist_20260618.csv"
OUT_ORDER_LOG_TEMPLATE = ROOT / "ultimate_selection_order_log_template_20260618.csv"
OUT_HTML = ROOT / "ultimate_selection_system_20260618.html"

CAPITAL_YEN = 2_400_000
INITIAL_BUY_CAP_YEN = 360_000
TARGET_EXCESS_PCT = 1.0
STRONG_EXCESS_PCT = 5.0


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def to_float(value: object, default: float = 0.0) -> float:
    if value is None:
        return default
    text = str(value).strip().replace("%", "").replace(",", "")
    if text == "":
        return default
    try:
        return float(text)
    except ValueError:
        return default


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def yen(value: float | int) -> str:
    return f"{round(value):,}円"


def pct(value: float) -> str:
    return f"{value:.1f}%"


def norm_growth(value: float, cap: float = 60.0) -> float:
    return clamp(value / cap * 100.0)


def norm_range(value: float, low: float, high: float) -> float:
    if high == low:
        return 50.0
    return clamp((value - low) / (high - low) * 100.0)


def risk_from_drawdown(drawdown_pct: float) -> float:
    dd = abs(drawdown_pct)
    return clamp(100.0 - (dd / 60.0 * 100.0))


def load_latest_prices() -> dict[str, dict[str, str]]:
    latest: dict[str, dict[str, str]] = {}
    if not PRICE_CSV.exists():
        return latest
    with PRICE_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 12:
                continue
            date, time, code = row[0], row[1], row[2]
            try:
                datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
                float(row[4])
            except Exception:
                continue
            latest[f"{code}.T"] = {
                "date": date,
                "time": time,
                "code": code,
                "name": row[3],
                "price": row[4],
                "change_pct": row[6],
                "high": row[7],
                "low": row[8],
                "volume": row[9],
                "source": row[10],
            }
    for row in read_csv(PRICE_PATCH_CSV):
        code = row.get("code", "").strip()
        price = to_float(row.get("price"), 0)
        if not code or not price:
            continue
        latest[f"{code}.T"] = {
            "date": row.get("date", ""),
            "time": row.get("time", ""),
            "code": code,
            "name": row.get("name", ""),
            "price": row.get("price", ""),
            "change_pct": row.get("change_pct", ""),
            "high": row.get("high", ""),
            "low": row.get("low", ""),
            "volume": row.get("volume", ""),
            "source": row.get("source", ""),
        }
    return latest


def by_ticker(path: Path) -> dict[str, dict[str, str]]:
    return {r.get("ticker", ""): r for r in read_csv(path) if r.get("ticker", "")}


def build_maps() -> tuple[
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, list[dict[str, str]]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
]:
    event = {r.get("ticker", ""): r for r in read_csv(EVENT_CSV)}
    financial = {r.get("ticker", ""): r for r in read_csv(FINANCIAL_CSV)}
    qualitative: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in read_csv(QUAL_CSV):
        qualitative[row.get("ticker", "")].append(row)
    theme_gate = {r.get("target", ""): r for r in read_csv(THEME_GATE_CSV)}
    prices = load_latest_prices()
    supplement = by_ticker(SUPPLEMENT_CSV)
    top20 = by_ticker(TOP20_CSV)
    qual_explore = by_ticker(QUAL_EXPLORE_CSV)
    reaction = by_ticker(REACTION_CSV)
    validation = by_ticker(EVENT_VALIDATION_CSV)
    discovery = by_ticker(CANDIDATE_DISCOVERY_CSV)
    return event, financial, qualitative, theme_gate, prices, supplement, top20, qual_explore, reaction, validation, discovery


def first_value(*values: object) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def supplemental_financial_score(row: dict[str, str]) -> tuple[float, str, list[str]]:
    per = to_float(row.get("per"))
    pbr = to_float(row.get("pbr"))
    roe = to_float(row.get("roe_pct"))
    revenue = to_float(row.get("revenue_yoy_pct"))
    profit = to_float(row.get("profit_yoy_pct"))
    confidence = to_float(row.get("data_confidence"), 50)
    hard_gate = row.get("hard_gate") or row.get("hard_gates_after") or ""

    score = 55.0
    if per:
        score += 8 if per <= 15 else 4 if per <= 25 else -8 if per >= 35 else 0
    if pbr:
        score += 6 if pbr <= 1.5 else 3 if pbr <= 3 else -8 if pbr >= 6 else 0
    if roe:
        score += 8 if roe >= 15 else 4 if roe >= 10 else -4 if roe < 8 else 0
    if revenue:
        score += 3 if revenue >= 5 else -3 if revenue < 0 else 0
    if profit:
        score += 6 if profit >= 20 else 3 if profit > 0 else -8 if profit < 0 else 0
    if confidence >= 90:
        score += 4
    elif confidence < 70:
        score -= 6
    if "なし" in hard_gate:
        score += 3
    elif any(x in hard_gate for x in ["利益減少", "売上減少", "決算後20営業日未到達", "要確認"]):
        score -= 6

    missing = ["公式決算原本照合"]
    if not per:
        missing.append("PER")
    if not pbr:
        missing.append("PBR")
    if not roe:
        missing.append("ROE")
    if not revenue:
        missing.append("売上前年比")
    if not profit:
        missing.append("利益前年比")
    status = "補助" if confidence >= 70 and not any(x in hard_gate for x in ["利益減少", "売上減少"]) else "補助/注意"
    return clamp(score), status, missing


def financial_score(
    row: dict[str, str] | None,
    supplement: dict[str, str] | None = None,
    top20: dict[str, str] | None = None,
    trial: dict[str, str] | None = None,
    discovery: dict[str, str] | None = None,
) -> tuple[float, str, list[str]]:
    if not row:
        for candidate in (top20, supplement, trial, discovery):
            if candidate:
                return supplemental_financial_score(candidate)
        return 55.0, "未取得", ["PER/PBR/ROE/EPS/BPS/営業利益率/FCF/自己資本比率"]
    status = row.get("financial_status", "")
    confidence = row.get("confidence", "")
    missing = [x.strip() for x in row.get("required_items", "").split("/") if x.strip()]
    if status == "pass":
        base = 78.0
        missing = []
    elif status == "partial":
        base = 48.0
    else:
        base = 38.0
    if confidence == "A":
        base += 8
    elif confidence == "B":
        base += 3
    elif confidence == "C":
        base -= 5
    return clamp(base), status or "未取得", missing


def qualitative_score(rows: list[dict[str, str]], explore: dict[str, str] | None = None) -> tuple[float, str]:
    if not rows:
        if explore:
            score = to_float(explore.get("qualitative_score"), 50)
            theme = explore.get("theme_name", "")
            status = explore.get("purchase_score_status", "")
            note = f"{theme}/補助質的スコア"
            if status and "購入スコアではない" in status:
                note += "（購入スコアではない）"
            return clamp(score), note
        return 50.0, "質的データ未接続"
    scores = []
    labels = []
    for r in rows:
        status = r.get("status", "")
        basis = r.get("basis", "")
        risk = r.get("risk", "")
        score = 50.0
        if "主候補" in status:
            score += 22
        elif "複合候補" in status:
            score += 16
        elif "条件付き" in status:
            score += 8
        elif "長期探索" in status:
            score -= 8
        if any(x in basis for x in ["電力", "AI", "半導体", "金利", "資源", "防衛"]):
            score += 6
        if any(x in risk for x in ["高PER", "急騰", "反落", "悪化", "分離が必要"]):
            score -= 8
        labels.append(f"{r.get('channel','')}/{status}")
        scores.append(clamp(score))
    return sum(scores) / len(scores), "、".join(labels[:2])


def event_score(
    row: dict[str, str] | None,
    reaction: dict[str, str] | None = None,
    validation: dict[str, str] | None = None,
) -> tuple[float, str]:
    if not row:
        if reaction:
            score = to_float(reaction.get("earnings_reaction_score"), 50)
            status = reaction.get("reaction_status", "")
            excess = first_value(reaction.get("excess_20d_pct"), reaction.get("excess_5d_pct"), reaction.get("excess_1d_pct"))
            return clamp(score), f"決算反応補助 / {status} / 超過{excess}%"
        if validation:
            avg20 = to_float(validation.get("avg_excess_20d_pct"))
            avg5 = to_float(validation.get("avg_excess_5d_pct"))
            strong = to_float(validation.get("strong_event_count"))
            weak = to_float(validation.get("weak_event_count"))
            score = 50 + avg20 * 2.0 + avg5 * 1.0 + strong * 3.0 - weak * 3.0
            return clamp(score), f"過去イベント反応 / 20日超過{avg20:.2f}%"
        return 50.0, "イベント未接続"
    change = to_float(row.get("one_day_change_pct", "0"))
    market_signal = row.get("market_signal", "")
    status = row.get("event_status", "")
    score = 50.0 + change * 4.0
    if "確認" in market_signal:
        score += 8
    if "保留" in market_signal:
        score -= 12
    if "黄" in status:
        score -= 3
    return clamp(score), f"{market_signal} / {row.get('one_day_change_pct','')}"


def gate_penalty(final_status: str, universe_reason: str, financial_status: str, qualitative_note: str) -> tuple[float, list[str], str]:
    penalties: list[str] = []
    penalty = 0.0
    action = "購入候補"
    if "除外" in final_status:
        penalty += 30
        penalties.append("100社再選定で除外")
        action = "買付不可"
    elif "監視" in final_status:
        penalty += 12
        penalties.append("100社再選定で監視")
        action = "小口または監視"
    if financial_status == "partial":
        penalty += 6
        penalties.append("財務partial")
        if action == "購入候補":
            action = "小口"
    elif financial_status == "補助":
        penalty += 3
        penalties.append("財務は補助データ")
        if action == "購入候補":
            action = "調査優先"
    elif financial_status == "補助/注意":
        penalty += 7
        penalties.append("財務補助データに注意")
        if action == "購入候補":
            action = "監視"
    elif financial_status == "未取得":
        penalty += 4
        penalties.append("財務未取得")
        if action == "購入候補":
            action = "調査優先"
    if any(x in universe_reason for x in ["急騰", "反動", "下落率が大きい", "S&P500に劣後", "60日が弱い"]):
        penalty += 8
        penalties.append("価格過熱・反動・指数劣後注意")
    if "長期探索" in qualitative_note:
        penalty += 10
        penalties.append("長期探索テーマ")
        if action == "購入候補":
            action = "監視"
    return penalty, penalties, action


def expected_value_score(final_score: float, cagr5: float, cagr10: float, one_year: float, max_dd: float, event_s: float) -> tuple[float, float, float, float, float]:
    # This is a relative model, not a forecast promise.
    upside = clamp(0.40 * min(cagr5, 55) + 0.35 * min(cagr10, 40) + 0.15 * min(max(one_year, 0), 80) / 2 + 0.10 * (event_s - 50) / 2, 0, 35)
    downside = clamp(abs(max_dd) * 0.42, 5, 32)
    pu = clamp(0.42 + final_score / 260.0, 0.42, 0.72)
    pd = 1.0 - pu
    ev = pu * upside - pd * downside - 0.4
    ev_score = clamp(50 + ev * 2.0)
    return ev, ev_score, pu, upside, downside


def sector_bucket(name: str, ticker: str, qual_note: str) -> str:
    text = f"{name} {ticker} {qual_note}"
    if any(x in text for x in ["FG", "銀行", "みずほ", "三井住友", "UFJ", "第一生命", "MS&AD", "東京海上"]):
        return "金融"
    if any(x in text for x in ["商事", "物産", "丸紅", "伊藤忠"]):
        return "商社"
    if any(x in text for x in ["INPEX", "ENEOS", "出光"]):
        return "資源"
    if any(x in text for x in ["半導体", "アドバンテスト", "ディスコ", "東京エレクトロン", "SCREEN"]):
        return "半導体"
    if any(x in text for x in ["電力", "電線", "日立", "三菱電機", "住友電工", "フジクラ"]):
        return "AIインフラ"
    if any(x in text for x in ["重工", "防衛", "IHI", "川崎重工"]):
        return "防衛・重工"
    return "その他"


def build_scores() -> list[dict[str, object]]:
    (
        event_map,
        financial_map,
        qual_map,
        _theme_gate,
        price_map,
        supplement_map,
        top20_map,
        qual_explore_map,
        reaction_map,
        validation_map,
        discovery_map,
    ) = build_maps()
    rows: list[dict[str, object]] = []
    for r in read_csv(UNIVERSE_CSV):
        ticker = r.get("コード", "")
        name = r.get("銘柄", "")
        cagr5 = to_float(r.get("5年CAGR"))
        cagr10 = to_float(r.get("10年CAGR"))
        one_year = to_float(r.get("直近1年騰落率"))
        sixty = to_float(r.get("60日騰落率"))
        sp5 = to_float(r.get("5年S&P差"))
        sp1 = to_float(r.get("直近1年S&P差"))
        dd5 = to_float(r.get("5年最大下落率"))
        dd1 = to_float(r.get("直近1年最大下落率"))
        base_reselect = to_float(r.get("再選定点"))
        final_status = r.get("最終扱い", "")
        universe_reason = f"{r.get('除外理由','')} {r.get('確認事項','')}"

        growth_s = clamp(0.42 * norm_growth(cagr5) + 0.35 * norm_growth(cagr10, 45) + 0.23 * norm_growth(max(one_year, 0), 120))
        momentum_s = clamp(0.40 * norm_range(sixty, -25, 60) + 0.30 * norm_range(sp1, -30, 120) + 0.30 * norm_range(one_year, -20, 180))
        benchmark_s = clamp(0.55 * norm_range(sp5, -20, 80) + 0.45 * norm_range(sp1, -30, 120))
        risk_s = clamp(0.55 * risk_from_drawdown(dd5) + 0.45 * risk_from_drawdown(dd1))
        quant_s = clamp(0.34 * growth_s + 0.25 * momentum_s + 0.22 * benchmark_s + 0.19 * risk_s)

        financial_s, financial_status, missing_items = financial_score(
            financial_map.get(ticker),
            supplement_map.get(ticker),
            top20_map.get(ticker),
            qual_explore_map.get(ticker),
            discovery_map.get(ticker),
        )
        qual_s, qual_note = qualitative_score(qual_map.get(ticker, []), qual_explore_map.get(ticker))
        event_s, event_note = event_score(event_map.get(ticker), reaction_map.get(ticker), validation_map.get(ticker))
        reliability = 45.0
        reliability += 20 if ticker in financial_map and financial_status == "pass" else 8 if financial_status == "partial" else 6 if financial_status.startswith("補助") else 0
        reliability += 12 if ticker in event_map else 8 if ticker in reaction_map or ticker in validation_map else 0
        reliability += 12 if ticker in qual_map else 8 if ticker in qual_explore_map else 0
        reliability += 8 if ticker in price_map else 0
        reliability += 3 if base_reselect else 0
        reliability = clamp(reliability)

        pre_score = clamp(
            0.31 * quant_s
            + 0.17 * financial_s
            + 0.15 * qual_s
            + 0.14 * event_s
            + 0.10 * benchmark_s
            + 0.08 * risk_s
            + 0.05 * reliability
        )
        ev, ev_s, pu, upside, downside = expected_value_score(pre_score, cagr5, cagr10, one_year, min(dd5, dd1), event_s)
        penalty, penalties, action = gate_penalty(final_status, universe_reason, financial_status, qual_note)
        final_s = clamp(0.86 * pre_score + 0.14 * ev_s - penalty)
        if final_s < 52 and action not in ["買付不可"]:
            action = "監視"
        if reliability < 55 and action == "購入候補":
            action = "保留"

        price_row = price_map.get(ticker, {})
        price = to_float(price_row.get("price"), 0.0)
        sector = sector_bucket(name, ticker, qual_note)
        data_sources = []
        if ticker in financial_map:
            data_sources.append("公式財務確認")
        elif ticker in top20_map or ticker in supplement_map or ticker in qual_explore_map or ticker in discovery_map:
            data_sources.append("補助財務")
        if ticker in event_map:
            data_sources.append("6月イベント")
        elif ticker in reaction_map or ticker in validation_map:
            data_sources.append("補助イベント反応")
        if ticker in qual_map:
            data_sources.append("チャンネル質的")
        elif ticker in qual_explore_map:
            data_sources.append("補助質的")
        if ticker in price_map:
            data_sources.append("価格")
        rows.append(
            {
                "ticker": ticker,
                "name": name,
                "sector": sector,
                "action": action,
                "final_score": round(final_s, 1),
                "pre_score": round(pre_score, 1),
                "quant_score": round(quant_s, 1),
                "financial_score": round(financial_s, 1),
                "qualitative_score": round(qual_s, 1),
                "event_score": round(event_s, 1),
                "ev_score": round(ev_s, 1),
                "risk_score": round(risk_s, 1),
                "benchmark_score": round(benchmark_s, 1),
                "reliability": round(reliability, 1),
                "expected_value_pct": round(ev, 2),
                "up_probability": round(pu * 100, 1),
                "upside_pct": round(upside, 1),
                "downside_pct": round(downside, 1),
                "reselect_score": round(base_reselect, 1),
                "universe_status": final_status,
                "financial_status": financial_status,
                "qualitative_note": qual_note,
                "event_note": event_note,
                "cagr5": round(cagr5, 1),
                "cagr10": round(cagr10, 1),
                "one_year": round(one_year, 1),
                "sixty_day": round(sixty, 1),
                "sp5_diff": round(sp5, 1),
                "sp1_diff": round(sp1, 1),
                "max_dd5": round(dd5, 1),
                "max_dd1": round(dd1, 1),
                "price": round(price, 2) if price else "",
                "price_time": (price_row.get("date", "") + " " + price_row.get("time", "")).strip(),
                "data_sources": " / ".join(data_sources),
                "gate_notes": " / ".join(penalties),
                "missing_items": " / ".join(missing_items[:6]),
            }
        )
    return sorted(rows, key=lambda x: float(x["final_score"]), reverse=True)


def optimize_portfolio(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    eligible = [
        r
        for r in rows
        if r["action"] in ["購入候補", "小口", "小口または監視", "調査優先"]
        and r["price"] != ""
        and float(r["final_score"]) >= 50
    ]
    selected: list[dict[str, object]] = []
    sector_counts: dict[str, int] = defaultdict(int)
    for r in eligible:
        sector = str(r["sector"])
        if len(selected) >= 10:
            break
        if sector_counts[sector] >= 3:
            continue
        selected.append(r.copy())
        sector_counts[sector] += 1

    raw_weights = []
    for r in selected:
        score = float(r["final_score"])
        ev = max(float(r["expected_value_pct"]), 0.0)
        raw = max(score - 45, 1) * (1 + ev / 30)
        if r["action"] == "小口または監視":
            raw *= 0.55
        if r["action"] == "小口":
            raw *= 0.70
        if r["action"] == "調査優先":
            raw *= 0.65
        raw_weights.append(raw)
    total_raw = sum(raw_weights) or 1

    capped = []
    for r, raw in zip(selected, raw_weights):
        cap = 0.18
        if r["action"] in ["小口", "小口または監視"]:
            cap = 0.08
        if r["action"] == "調査優先":
            cap = 0.10
        capped.append(min(raw / total_raw, cap))

    # Redistribute unused weight to uncapped names.
    for _ in range(8):
        total = sum(capped)
        if total >= 0.999:
            break
        room_indices = []
        for i, r in enumerate(selected):
            cap = 0.08 if r["action"] in ["小口", "小口または監視"] else 0.10 if r["action"] == "調査優先" else 0.18
            if capped[i] + 0.0001 < cap:
                room_indices.append(i)
        if not room_indices:
            break
        add_each = (1.0 - total) / len(room_indices)
        for i in room_indices:
            cap = 0.08 if selected[i]["action"] in ["小口", "小口または監視"] else 0.10 if selected[i]["action"] == "調査優先" else 0.18
            capped[i] = min(cap, capped[i] + add_each)

    total = sum(capped) or 1
    portfolio: list[dict[str, object]] = []
    for rank, (r, w) in enumerate(zip(selected, capped), start=1):
        weight = w / total
        full_amount = CAPITAL_YEN * weight
        initial_amount = INITIAL_BUY_CAP_YEN * weight
        price = float(r["price"])
        initial_shares = math.floor(initial_amount / price) if price else 0
        initial_yen = initial_shares * price
        portfolio.append(
            {
                **r,
                "portfolio_rank": rank,
                "target_weight_pct": round(weight * 100, 1),
                "target_full_amount_yen": round(full_amount),
                "initial_buy_budget_yen": round(initial_amount),
                "initial_shares": initial_shares,
                "initial_buy_yen": round(initial_yen),
            }
        )
    return portfolio


def execution_status(row: dict[str, object]) -> tuple[str, str]:
    action = str(row.get("action", ""))
    financial = str(row.get("financial_status", ""))
    missing = str(row.get("missing_items", ""))
    if action == "購入候補" and financial == "pass" and not missing:
        return "初回候補", "価格・口座・全体ゲートを確認して小さく開始"
    if action == "小口":
        return "小口候補", "財務partialのため、初回は小口。未確認項目が残る間は追加しない"
    if action == "調査優先":
        return "確認後候補", "公式照合または未確認項目の解消後に実行。未解消なら現金待機"
    return "監視", "買付対象にしない。条件改善まで監視"


def build_execution_plan(portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for row in portfolio:
        status, rule = execution_status(row)
        price = float(row.get("price") or 0)
        buy_limit = round(price * 0.995, 1) if price else ""
        chase_stop = round(price * 1.03, 1) if price else ""
        drawdown = abs(float(row.get("max_dd1") or 0))
        stop_line = round(price * (1 - min(max(drawdown * 0.35, 5), 12) / 100), 1) if price else ""
        profit_line = round(price * 1.12, 1) if price else ""
        out.append(
            {
                "rank": row.get("portfolio_rank", ""),
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "execution_status": status,
                "initial_shares": row.get("initial_shares", ""),
                "initial_buy_yen": row.get("initial_buy_yen", ""),
                "limit_price_yen": buy_limit,
                "do_not_chase_price_yen": chase_stop,
                "temporary_stop_line_yen": stop_line,
                "profit_review_line_yen": profit_line,
                "rule": rule,
                "no_buy_conditions": "寄付き成行は避ける / 前日比+3%以上は追わない / 日経平均またはTOPIXが当日-2%以上なら停止 / 未確認項目が残る銘柄は追加しない",
                "increase_conditions": "6月イベント後に指数を上回り、決算・財務確認が崩れず、出来高を伴う上昇なら追加検討",
                "reduce_conditions": "指数に5営業日連続で劣後 / 決算失望 / テーマ前提崩れ / 急落時は半分以下へ減額または停止",
            }
        )
    return out


def build_day_checklist(execution: list[dict[str, object]]) -> list[dict[str, object]]:
    immediate_names = " / ".join(
        str(r.get("name"))
        for r in execution
        if r.get("execution_status") in ["初回候補", "小口候補"]
    )
    conditional_names = " / ".join(
        str(r.get("name"))
        for r in execution
        if r.get("execution_status") == "確認後候補"
    )
    immediate_total = sum(
        float(r.get("initial_buy_yen") or 0)
        for r in execution
        if r.get("execution_status") in ["初回候補", "小口候補"]
    )
    conditional_total = sum(
        float(r.get("initial_buy_yen") or 0)
        for r in execution
        if r.get("execution_status") == "確認後候補"
    )
    return [
        {
            "time": "前日まで",
            "check_item": "本人NISA・買付余力・入金・注文口座区分",
            "action": "本人のスマホ、本人ログイン、本人操作で確認する。口座区分がNISAでなければ当日発注しない。",
            "stop_condition": "NISA口座未開設、買付余力不足、注文口座区分不明、本人操作が確認できない場合は停止。",
            "record": "確認者、確認時刻、買付余力、NISA区分、入金額を記録。",
        },
        {
            "time": "8:30",
            "check_item": "市場全体の急変確認",
            "action": "日経平均先物、TOPIX先物、ドル円、米10年金利、VIX、主要ニュースを確認する。",
            "stop_condition": "日経/TOPIX先物が大きく下落、円高急進、金利急騰、候補銘柄に悪材料が出た場合は新規買付を停止。",
            "record": "指数、為替、金利、VIX、目立つニュースを記録。",
        },
        {
            "time": "9:00-9:15",
            "check_item": "寄付き成行を避ける",
            "action": "寄付き直後は価格確認のみ。成行注文は使わず、初値と出来高を確認する。",
            "stop_condition": "候補が前日比+3%以上で始まる場合は追わない。前日比-3%以上の場合は理由確認まで待つ。",
            "record": "各候補の始値、前日比、出来高、買わなかった理由を記録。",
        },
        {
            "time": "9:30-10:30",
            "check_item": "初回候補だけ小口指値",
            "action": f"初回候補: {immediate_names or '該当なし'}。上限目安は合計{yen(immediate_total)}。指値または分割で小さく入る。",
            "stop_condition": "指数が弱い、価格が追い上げすぎ、候補別の未確認項目が残る場合は買わない。",
            "record": "指値、約定価格、約定株数、未約定理由を記録。",
        },
        {
            "time": "11:30",
            "check_item": "前場の約定確認",
            "action": "約定済み、未約定、買わなかった銘柄を分ける。未約定を無理に追わない。",
            "stop_condition": "前場で指数が崩れた場合、後場の新規買付は停止。",
            "record": "前場終了時点の約定一覧、平均取得単価、残り買付予定額を記録。",
        },
        {
            "time": "12:30-14:30",
            "check_item": "後場の再確認",
            "action": f"確認後候補: {conditional_names or '該当なし'}。上限目安は合計{yen(conditional_total)}。未確認が消えたものだけ検討する。",
            "stop_condition": "未確認項目が残る、指数が弱い、ニュースでテーマが崩れた場合は現金待機。",
            "record": "後場判断、追加しなかった理由、翌営業日に回す項目を記録。",
        },
        {
            "time": "15:00以降",
            "check_item": "当日記録と翌営業日の準備",
            "action": "約定結果、指数差、候補別判断、買わなかった理由を保存する。翌営業日に見る項目を更新する。",
            "stop_condition": "記録が残せない場合、次回追加買付をしない。",
            "record": "約定一覧、未約定一覧、指数差、反省点、次回条件を記録。",
        },
    ]


def build_order_log_template(execution: list[dict[str, object]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in execution:
        rows.append(
            {
                "trade_date": "2026-06-19",
                "check_time": "",
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "planned_status": row.get("execution_status", ""),
                "planned_shares": row.get("initial_shares", ""),
                "planned_yen": row.get("initial_buy_yen", ""),
                "limit_price_yen": row.get("limit_price_yen", ""),
                "do_not_chase_price_yen": row.get("do_not_chase_price_yen", ""),
                "actual_action": "未入力",
                "actual_shares": "",
                "actual_price_yen": "",
                "actual_yen": "",
                "not_bought_reason": "",
                "market_condition": "",
                "index_change_pct": "",
                "usdjpy": "",
                "us10y": "",
                "vix": "",
                "memo": "",
            }
        )
    rows.append(
        {
            "trade_date": "2026-06-19",
            "check_time": "15:00以降",
            "ticker": "全体",
            "name": "当日総括",
            "planned_status": "記録",
            "planned_shares": "",
            "planned_yen": "",
            "limit_price_yen": "",
            "do_not_chase_price_yen": "",
            "actual_action": "未入力",
            "actual_shares": "",
            "actual_price_yen": "",
            "actual_yen": "",
            "not_bought_reason": "",
            "market_condition": "指数、為替、金利、VIX、ニュースの総括",
            "index_change_pct": "",
            "usdjpy": "",
            "us10y": "",
            "vix": "",
            "memo": "買った理由、買わなかった理由、翌営業日に見る項目を記録。",
        }
    )
    return rows


def weighted_portfolio_value(portfolio: list[dict[str, object]], key: str) -> float:
    total_weight = sum(float(r.get("target_weight_pct") or 0) for r in portfolio) or 1.0
    return sum(float(r.get(key) or 0) * float(r.get("target_weight_pct") or 0) for r in portfolio) / total_weight


def scenario_row(name: str, pct_value: float, basis: str, action: str) -> dict[str, object]:
    full_profit = CAPITAL_YEN * pct_value / 100
    initial_profit = INITIAL_BUY_CAP_YEN * pct_value / 100
    return {
        "scenario": name,
        "return_pct": round(pct_value, 1),
        "full_240m_result_yen": yen(CAPITAL_YEN + full_profit),
        "full_240m_profit_yen": yen(full_profit),
        "initial_36m_result_yen": yen(INITIAL_BUY_CAP_YEN + initial_profit),
        "initial_36m_profit_yen": yen(initial_profit),
        "basis": basis,
        "action": action,
    }


def build_risk_scenarios(portfolio: list[dict[str, object]], execution: list[dict[str, object]]) -> list[dict[str, object]]:
    ev = weighted_portfolio_value(portfolio, "expected_value_pct")
    upside = weighted_portfolio_value(portfolio, "upside_pct")
    downside = weighted_portfolio_value(portfolio, "downside_pct")
    dd1 = abs(weighted_portfolio_value(portfolio, "max_dd1"))
    dd5 = abs(weighted_portfolio_value(portfolio, "max_dd5"))

    stop_losses = []
    for row in execution:
        price = float(next((p.get("price") or 0 for p in portfolio if p.get("ticker") == row.get("ticker")), 0) or 0)
        stop = float(row.get("temporary_stop_line_yen") or 0)
        weight = float(next((p.get("target_weight_pct") or 0 for p in portfolio if p.get("ticker") == row.get("ticker")), 0) or 0)
        if price and stop and weight:
            stop_losses.append((1 - stop / price) * 100 * weight)
    stop_loss_pct = sum(stop_losses) / (sum(float(r.get("target_weight_pct") or 0) for r in portfolio) or 1)

    return [
        scenario_row("上振れ", upside, "上昇確率モデルの上昇幅を比率加重", "利確ではなく、決算・指数超過・出来高を確認して一部利益確保を検討"),
        scenario_row("通常EV仮説", ev, "上昇確率×上昇幅 - 下落確率×下落幅 - コスト", "この水準が指数+1%を説明できるか確認"),
        scenario_row("下値確認ライン到達", -stop_loss_pct, "銘柄別の一時停止ラインを比率加重", "新規買付停止。理由確認まで追加しない"),
        scenario_row("下振れ", -downside, "下落幅モデルを比率加重", "個別株比率を下げ、現金またはインデックスへ戻す"),
        scenario_row("直近1年最大下落級", -dd1, "各銘柄の直近1年最大下落を比率加重", "想定外ではなくストレスとして扱い、追加停止・減額"),
        scenario_row("5年最大下落級", -dd5, "各銘柄の5年最大下落を比率加重", "短期テストの範囲を超える。購入計画を再設計"),
        scenario_row("一律-10%機械ストレス", -10.0, "全銘柄が同時に-10%下落する仮定", "ストップ安相当ではなく、急落時の資金ダメージ確認用"),
    ]


def build_trade_rules(portfolio: list[dict[str, object]], execution: list[dict[str, object]]) -> list[dict[str, object]]:
    exec_map = {r.get("ticker"): r for r in execution}
    rows: list[dict[str, object]] = []
    for row in portfolio:
        ex = exec_map.get(row.get("ticker"), {})
        status = ex.get("execution_status", "")
        price = float(row.get("price") or 0)
        stop_line = ex.get("temporary_stop_line_yen", "")
        profit_line = ex.get("profit_review_line_yen", "")
        no_chase = ex.get("do_not_chase_price_yen", "")
        max_dd1 = abs(float(row.get("max_dd1") or 0))
        ev = float(row.get("expected_value_pct") or 0)
        reliability = float(row.get("reliability") or 0)

        if status == "初回候補":
            buy_rule = "価格が落ち着いた後、指値目安以下なら初回候補"
            add_rule = "5営業日で指数を上回り、決算・財務前提が崩れなければ追加検討"
        elif status == "小口候補":
            buy_rule = "財務partialのため、初回のみ小口。追加は未確認解消後"
            add_rule = "PER/PBR/ROE等の未確認が消え、指数超過が続く場合だけ追加"
        else:
            buy_rule = "公式照合・未確認項目が残る間は買わない"
            add_rule = "確認後に再スコア。確認前の追加買いはしない"

        if max_dd1 >= 20:
            stop_rule = f"{stop_line}円付近で理由確認。直近下落が大きいため、追加停止を優先"
        else:
            stop_rule = f"{stop_line}円付近で一時停止。指数連動か個別悪材料か確認"

        if ev >= 13 and reliability >= 80:
            profit_rule = f"{profit_line}円付近で一部利益確保を検討。上昇理由が残れば保有継続"
        else:
            profit_rule = f"{profit_line}円付近で過熱確認。根拠が弱ければ利益確保を優先"

        rows.append(
            {
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "status": status,
                "current_price_yen": yen(float(row.get("price") or 0)) if row.get("price") != "" else "",
                "initial_buy_yen": yen(float(row.get("initial_buy_yen") or 0)),
                "buy_rule": buy_rule,
                "do_not_chase": f"{no_chase}円以上は追わない",
                "add_rule": add_rule,
                "profit_rule": profit_rule,
                "stop_rule": stop_rule,
                "reduce_rule": "指数に5営業日連続で劣後、決算失望、テーマ前提崩れなら追加停止・減額",
            }
        )
    return rows


def short_reason(row: dict[str, object]) -> str:
    strengths: list[str] = []
    if float(row.get("financial_score") or 0) >= 75:
        strengths.append("財務確認が強い")
    if float(row.get("quant_score") or 0) >= 60:
        strengths.append("株価実績が強い")
    if float(row.get("benchmark_score") or 0) >= 55:
        strengths.append("指数比較で優位")
    if float(row.get("event_score") or 0) >= 60:
        strengths.append("イベント後反応が良い")
    if float(row.get("qualitative_score") or 0) >= 70:
        strengths.append("テーマ適合が強い")
    if not strengths:
        strengths.append("総合点で上位に残る")
    return " / ".join(strengths[:3])


def risk_reason(row: dict[str, object]) -> str:
    risks: list[str] = []
    financial_status = str(row.get("financial_status", ""))
    if financial_status == "partial":
        risks.append("財務partial")
    elif financial_status.startswith("補助"):
        risks.append("財務は補助データ")
    missing = str(row.get("missing_items", ""))
    if missing:
        risks.append(f"未確認: {missing}")
    if abs(float(row.get("max_dd1") or 0)) >= 20:
        risks.append("直近最大下落が大きい")
    if float(row.get("sixty_day") or 0) >= 20:
        risks.append("短期上昇後の反動注意")
    if str(row.get("event_note", "")) == "イベント未接続":
        risks.append("イベント未接続")
    if not risks:
        risks.append("大きな未確認なし")
    return " / ".join(risks[:3])


def build_ticker_explanations(portfolio: list[dict[str, object]], not_allocated: list[dict[str, object]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in portfolio:
        status, rule = execution_status(row)
        rows.append(
            {
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "status": status,
                "score": row.get("final_score", ""),
                "reason": short_reason(row),
                "risk": risk_reason(row),
                "action": rule,
            }
        )
    for row in not_allocated:
        rows.append(
            {
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "status": "監視",
                "score": row.get("final_score", ""),
                "reason": short_reason(row),
                "risk": risk_reason(row),
                "action": "確認が弱い間は買付表に混ぜない",
            }
        )
    return rows


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def build_missing(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    out = []
    for r in rows:
        missing = str(r.get("missing_items", ""))
        issues = []
        if r["financial_status"] in ["未取得", "partial"]:
            issues.append("財務")
        elif str(r["financial_status"]).startswith("補助"):
            issues.append("公式照合")
        if r["event_note"] == "イベント未接続":
            issues.append("イベント")
        if r["qualitative_note"] == "質的データ未接続":
            issues.append("質的")
        if r["price"] == "":
            issues.append("価格")
        if issues:
            out.append(
                {
                    "ticker": r["ticker"],
                    "name": r["name"],
                    "priority": "高" if float(r["final_score"]) >= 60 else "中",
                    "missing_area": " / ".join(issues),
                    "missing_items": missing,
                    "data_sources": r.get("data_sources", ""),
                    "impact": "購入比率・期待値の信頼度に影響" if float(r["final_score"]) >= 60 else "監視精度に影響",
                }
            )
    return out


def html_table(rows: list[dict[str, object]], fields: list[tuple[str, str]], limit: int | None = None) -> str:
    shown = rows[:limit] if limit else rows
    head = "".join(f"<th>{esc(label)}</th>" for _, label in fields)
    body = []
    for r in shown:
        tds = "".join(f"<td>{esc(r.get(key, ''))}</td>" for key, _ in fields)
        body.append(f"<tr>{tds}</tr>")
    return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def build_html(
    rows: list[dict[str, object]],
    portfolio: list[dict[str, object]],
    missing: list[dict[str, object]],
    execution: list[dict[str, object]],
    risk_scenarios: list[dict[str, object]],
    trade_rules: list[dict[str, object]],
    day_checklist: list[dict[str, object]],
    order_log_template: list[dict[str, object]],
) -> str:
    generated_at = datetime.now().strftime("%Y/%m/%d %H:%M")
    top = rows[:10]
    score_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("sector", "分類"),
        ("action", "扱い"),
        ("final_score", "統合"),
        ("quant_score", "量的"),
        ("financial_score", "財務"),
        ("qualitative_score", "質的"),
        ("event_score", "イベント"),
        ("expected_value_pct", "EV%"),
        ("reliability", "信頼度"),
        ("data_sources", "使用データ"),
        ("gate_notes", "注意"),
    ]
    port_fields = [
        ("portfolio_rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("target_weight_pct", "比率%"),
        ("target_full_amount_yen", "240万円時"),
        ("initial_shares", "初回株数"),
        ("initial_buy_yen", "初回金額"),
        ("final_score", "統合"),
        ("expected_value_pct", "EV%"),
        ("action", "扱い"),
    ]
    port_tickers = {str(r.get("ticker", "")) for r in portfolio}
    not_allocated_top = [r for r in top if str(r.get("ticker", "")) not in port_tickers]
    not_allocated_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("final_score", "統合"),
        ("action", "扱い"),
        ("financial_status", "財務"),
        ("event_note", "イベント"),
        ("gate_notes", "注意"),
        ("missing_items", "残る確認"),
    ]
    explanation_rows = build_ticker_explanations(portfolio, not_allocated_top)
    explanation_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("status", "扱い"),
        ("score", "統合点"),
        ("reason", "残した理由"),
        ("risk", "警戒点"),
        ("action", "実行方針"),
    ]
    risk_fields = [
        ("scenario", "シナリオ"),
        ("return_pct", "変動率%"),
        ("full_240m_result_yen", "240万円後"),
        ("full_240m_profit_yen", "240万円損益"),
        ("initial_36m_result_yen", "初回36万円後"),
        ("initial_36m_profit_yen", "初回36万円損益"),
        ("basis", "根拠"),
        ("action", "行動"),
    ]
    trade_rule_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("status", "扱い"),
        ("current_price_yen", "現在値"),
        ("initial_buy_yen", "初回金額"),
        ("buy_rule", "買付ルール"),
        ("do_not_chase", "追わない価格"),
        ("add_rule", "追加ルール"),
        ("profit_rule", "上値ルール"),
        ("stop_rule", "下値ルール"),
    ]
    day_check_fields = [
        ("time", "時刻"),
        ("check_item", "確認すること"),
        ("action", "行うこと"),
        ("stop_condition", "止める条件"),
        ("record", "記録すること"),
    ]
    order_log_fields = [
        ("trade_date", "日付"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("planned_status", "予定扱い"),
        ("planned_shares", "予定株数"),
        ("planned_yen", "予定金額"),
        ("limit_price_yen", "指値目安"),
        ("do_not_chase_price_yen", "追わない価格"),
        ("actual_action", "実際の扱い"),
        ("not_bought_reason", "買わなかった理由"),
        ("memo", "メモ"),
    ]
    missing_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("priority", "優先"),
        ("missing_area", "不足領域"),
        ("data_sources", "使用済み"),
        ("impact", "影響"),
    ]
    execution_fields = [
        ("rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("execution_status", "実行扱い"),
        ("initial_shares", "初回株数"),
        ("initial_buy_yen", "初回金額"),
        ("limit_price_yen", "指値目安"),
        ("do_not_chase_price_yen", "追わない価格"),
        ("temporary_stop_line_yen", "下値確認"),
        ("profit_review_line_yen", "上値確認"),
        ("rule", "実行条件"),
    ]
    immediate_total = sum(float(r.get("initial_buy_yen") or 0) for r in execution if r.get("execution_status") in ["初回候補", "小口候補"])
    conditional_total = sum(float(r.get("initial_buy_yen") or 0) for r in execution if r.get("execution_status") == "確認後候補")
    reserve_total = max(INITIAL_BUY_CAP_YEN - immediate_total - conditional_total, 0)
    immediate_names = " / ".join(str(r.get("name")) for r in execution if r.get("execution_status") in ["初回候補", "小口候補"])
    conditional_names = " / ".join(str(r.get("name")) for r in execution if r.get("execution_status") == "確認後候補")
    watch_names = " / ".join(str(r.get("name")) for r in not_allocated_top) or "なし"
    portfolio_ev = weighted_portfolio_value(portfolio, "expected_value_pct")
    portfolio_score = weighted_portfolio_value(portfolio, "final_score")
    portfolio_reliability = weighted_portfolio_value(portfolio, "reliability")
    plus1_index_limit = portfolio_ev - TARGET_EXCESS_PCT
    plus5_index_limit = portfolio_ev - STRONG_EXCESS_PCT
    reliable_amount = sum(float(r.get("target_full_amount_yen") or 0) for r in portfolio if r.get("financial_status") == "pass")
    conditional_amount = sum(float(r.get("target_full_amount_yen") or 0) for r in portfolio if r.get("financial_status") != "pass")
    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>究極版 統合銘柄選定システム</title>
  <style>
    :root{{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}}
    *{{box-sizing:border-box}}
    body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.65}}
    header{{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}}
    header h1{{margin:0 0 8px;font-size:40px;letter-spacing:0}}
    header p{{margin:0;font-weight:850;max-width:1200px}}
    main{{max-width:1420px;margin:0 auto;padding:20px}}
    section{{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 16px;box-shadow:0 8px 20px rgba(20,60,90,.08);overflow-x:auto}}
    h2{{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}}
    .cards{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}}
    .card{{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px}}
    .card b{{display:block;color:var(--navy);font-size:15px}}
    .card strong{{display:block;font-size:28px;color:var(--blue);line-height:1.2}}
    .flow{{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}}
    .step{{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:10px;font-weight:850;min-height:120px}}
    .step b{{display:block;color:var(--navy);font-size:15px;margin-bottom:4px}}
    table{{width:100%;min-width:1080px;border-collapse:collapse;table-layout:fixed;margin-top:8px}}
    th,td{{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;font-size:14px}}
    th{{background:#e6f1fa;color:#063b63;text-align:left;font-size:14px}}
    .note{{border:2px solid #d6a84d;background:#fff8e7;border-radius:10px;padding:12px;font-weight:900}}
    .bad{{color:var(--red);font-weight:900}}
    .ok{{color:var(--green);font-weight:900}}
    .links a{{display:inline-block;margin:4px 8px 4px 0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--navy);font-weight:900;background:#fbfdff}}
  </style>
</head>
<body>
<header>
  <h1>究極版 統合銘柄選定システム</h1>
  <p>100社母集団、量的スコア、財務、質的テーマ、イベント反応、期待値、ポートフォリオ制約、買わない条件を1本の計算表に統合した版です。未取得データは点数に混ぜず、信頼度と不足表に分けます。</p>
</header>
<main>
  <section>
    <div class="cards">
      <div class="card"><b>母集団</b><strong>{len(rows)}社</strong><span>100社再選定表から読込</span></div>
      <div class="card"><b>戦略上位</b><strong>{len(top)}社</strong><span>統合スコア順</span></div>
      <div class="card"><b>配分候補</b><strong>{len(portfolio)}社</strong><span>価格あり・制約通過</span></div>
      <div class="card"><b>初回枠</b><strong>{yen(INITIAL_BUY_CAP_YEN)}</strong><span>イベント注意時15%</span></div>
      <div class="card"><b>生成時刻</b><strong>{esc(generated_at)}</strong><span>ローカル計算</span></div>
    </div>
  </section>

  <section>
    <h2>実行サマリー</h2>
    <table>
      <thead><tr><th>確認順</th><th>見るもの</th><th>現在の扱い</th><th>次の行動</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>本人NISA・買付余力・注文口座区分</td><td>証券会社画面で最終確認</td><td>NISA区分、残枠、入金、本人操作を確認。未確認なら注文しない。</td></tr>
        <tr><td>2</td><td>市場全体</td><td>急落時は停止</td><td>日経平均またはTOPIXが当日-2%以上なら、その日の新規買付を止める。</td></tr>
        <tr><td>3</td><td>初回候補・小口候補</td><td>{esc(immediate_names)}</td><td>合計上限 {yen(immediate_total)}。前日比+3%以上で始まる銘柄は追わない。</td></tr>
        <tr><td>4</td><td>確認後候補</td><td>{esc(conditional_names)}</td><td>合計 {yen(conditional_total)} は、公式照合・未確認項目が解消するまで追加しない。</td></tr>
        <tr><td>5</td><td>監視</td><td>{esc(watch_names)}</td><td>点数が近くても、確認が弱い間は買付表に混ぜない。</td></tr>
      </tbody>
    </table>
    <p class="note">この画面の結論は「候補を全部買う」ではありません。初回は、条件を通った銘柄だけを小さく開始し、確認が弱い銘柄は現金待機に回す設計です。</p>
  </section>

  <section>
    <h2>計算の流れ</h2>
    <div class="flow">
      <div class="step"><b>1. 母集団</b>業績・流動性・指数差・下落率入りの100社表を起点にする。</div>
      <div class="step"><b>2. 量的</b>CAGR、指数差、モメンタム、最大下落から数値化。</div>
      <div class="step"><b>3. 財務</b>PER/PBR/ROE等の確認状況をpass/partial/未取得で分離。</div>
      <div class="step"><b>4. 質的</b>テーマを事実・関連性・反証リスクで評価。</div>
      <div class="step"><b>5. イベント</b>決算後・6月イベント後反応を反映。</div>
      <div class="step"><b>6. 期待値</b>上昇幅・下落幅・確率の仮説で相対比較。</div>
      <div class="step"><b>7. 配分</b>1銘柄比率、業種集中、小口制約で金額化。</div>
    </div>
  </section>

  <section>
    <h2>使用している数式</h2>
    <table>
      <thead><tr><th>項目</th><th>式</th><th>意味</th></tr></thead>
      <tbody>
        <tr><td>成長</td><td>5年CAGR 42% + 10年CAGR 35% + 直近1年 23%</td><td>短期だけでなく、5年・10年で継続して伸びたかを見る。</td></tr>
        <tr><td>勢い</td><td>60日騰落 40% + 直近1年S&P差 30% + 直近1年騰落 30%</td><td>今も市場に買われているかを見る。</td></tr>
        <tr><td>指数比較</td><td>5年S&P差 55% + 直近1年S&P差 45%</td><td>個別株を選ぶ意味があるかを見る。</td></tr>
        <tr><td>下落耐性</td><td>5年最大下落 55% + 直近1年最大下落 45%</td><td>上昇だけでなく、大きく崩れた履歴も見る。</td></tr>
        <tr><td>量的スコア</td><td>成長34% + 勢い25% + 指数比較22% + 下落耐性19%</td><td>株価データ中心の基礎点。</td></tr>
        <tr><td>事前スコア</td><td>量的31% + 財務17% + 質的15% + イベント14% + 指数10% + 下落耐性8% + 信頼度5%</td><td>数値、財務、時流、イベント、データ信頼度を同時に見る。</td></tr>
        <tr><td>期待値</td><td>上昇確率 × 上昇幅 - 下落確率 × 下落幅 - コスト</td><td>上がりそうという雰囲気ではなく、上昇と下落を同じ表で比較する。</td></tr>
        <tr><td>最終スコア</td><td>事前スコア86% + 期待値スコア14% - 買わない条件の減点</td><td>未確認・過熱・監視扱いを最後に落とす。</td></tr>
      </tbody>
    </table>
    <p class="note">質的テーマは単純加点しません。公式資料、ニュース、過去反応が弱い場合は信頼度を下げ、購入候補ではなく監視・確認後候補に回します。</p>
  </section>

  <section>
    <h2>統合スコア 上位10社</h2>
    {html_table(top, score_fields)}
  </section>

  <section>
    <h2>ポートフォリオ最適化案</h2>
    <p class="note">これは「同じ審査で通したうえで、価格があり、業種集中を抑え、初回36万円枠に落とせる候補」です。最終注文は証券会社画面で価格・NISA区分・買付余力を確認してからです。</p>
    {html_table(portfolio, port_fields)}
  </section>

  <section>
    <h2>インデックス超過目標との接続</h2>
    <div class="cards">
      <div class="card"><b>配分EV仮説</b><strong>{pct(portfolio_ev)}</strong><span>候補9社の比率加重</span></div>
      <div class="card"><b>+1%目標の条件</b><strong>{pct(plus1_index_limit)}以下</strong><span>指数見通しがこの水準以下なら説明可能</span></div>
      <div class="card"><b>+5%目標の条件</b><strong>{pct(plus5_index_limit)}以下</strong><span>強気説明が成立する指数水準</span></div>
      <div class="card"><b>加重スコア</b><strong>{portfolio_score:.1f}</strong><span>配分後の平均点</span></div>
      <div class="card"><b>加重信頼度</b><strong>{portfolio_reliability:.1f}</strong><span>公式/補助データ混在</span></div>
    </div>
    <table>
      <thead><tr><th>判定</th><th>条件</th><th>行動</th><th>説明</th></tr></thead>
      <tbody>
        <tr><td>S&P/TOPIX +1%以上</td><td>指数側の1年見通しが {pct(plus1_index_limit)} 以下</td><td>個別株テストを継続</td><td>個別株EV仮説から1%差を引いた水準。ここを超える指数見通しなら、個別株の優位説明が弱くなる。</td></tr>
        <tr><td>S&P/TOPIX +5%以上</td><td>指数側の1年見通しが {pct(plus5_index_limit)} 以下</td><td>攻め配分を検討</td><td>強気目標。指数がかなり強い見通しなら、無理に個別株比率を上げない。</td></tr>
        <tr><td>公式確認済み部分</td><td>240万円中 {yen(reliable_amount)}</td><td>中心候補として扱う</td><td>財務passの銘柄だけを中心にする。補助データ銘柄は確認後候補に落とす。</td></tr>
        <tr><td>確認後候補部分</td><td>240万円中 {yen(conditional_amount)}</td><td>未確認が消えるまで追加しない</td><td>点数は出すが、公式照合・PER・イベント接続が弱いものは買付を急がない。</td></tr>
      </tbody>
    </table>
    <p class="note">この表は利益保証ではなく、個別株を選ぶ説明責任を確認するための逆算表です。指数見通しが高すぎる場合は、個別株比率を落としてインデックス優先に戻します。</p>
  </section>

  <section>
    <h2>19日以降の実行ゲート</h2>
    <div class="cards">
      <div class="card"><b>初回候補・小口候補</b><strong>{yen(immediate_total)}</strong><span>条件通過時に使う上限</span></div>
      <div class="card"><b>確認後候補</b><strong>{yen(conditional_total)}</strong><span>未確認が消えるまで保留</span></div>
      <div class="card"><b>初回枠の残り</b><strong>{yen(reserve_total)}</strong><span>急落・未約定・確認待ち用</span></div>
      <div class="card"><b>買わない条件</b><strong>3つ</strong><span>指数急落・追い買い・未確認</span></div>
      <div class="card"><b>追加条件</b><strong>確認後</strong><span>指数超過と決算維持</span></div>
    </div>
    <p class="note">実行は「候補を全部買う」ではありません。初回は小さく、寄付き成行を避け、価格・市場・未確認項目の3条件を通ったものだけを使います。</p>
    {html_table(execution, execution_fields)}
  </section>

  <section>
    <h2>19日当日チェックリスト</h2>
    <p class="note">当日は「何を買うか」より先に、本人口座・市場急変・高値追い・記録を確認します。ここを通らない場合は、候補銘柄が良くても買付を止めます。</p>
    {html_table(day_checklist, day_check_fields)}
  </section>

  <section>
    <h2>当日記録テンプレート</h2>
    <p class="note">実際に買ったか、買わなかったか、なぜそうしたかを残す欄です。未入力のまま次回判断へ進むと検証できないため、約定・未約定・見送り理由を必ず残します。</p>
    {html_table(order_log_template, order_log_fields)}
  </section>

  <section>
    <h2>銘柄別の判断理由</h2>
    <p class="note">ここは説明用の文章を固定で書くのではなく、スコア・財務確認状況・イベント接続・不足項目から自動生成しています。</p>
    {html_table(explanation_rows, explanation_fields)}
  </section>

  <section>
    <h2>リスク・損益シミュレーション</h2>
    <p class="note">この表は予想を断定するものではありません。既存スコア内の上昇幅、EV、下落幅、最大下落、銘柄別下値確認ラインを使った確認表です。</p>
    {html_table(risk_scenarios, risk_fields)}
  </section>

  <section>
    <h2>銘柄別 売買ルール</h2>
    <p class="note">共通ルールだけでなく、各銘柄の扱い、下値確認ライン、上値確認ライン、未確認項目の有無に応じて行動を分けます。</p>
    {html_table(trade_rules, trade_rule_fields)}
  </section>

  <section>
    <h2>共通売買ルール</h2>
    <table>
      <thead><tr><th>場面</th><th>条件</th><th>行動</th><th>理由</th></tr></thead>
      <tbody>
        <tr><td>買付開始</td><td>9:00直後の成行は避け、価格が落ち着いてから確認</td><td>指値または小口で開始</td><td>寄付きの一時的な過熱・急落を避けるため</td></tr>
        <tr><td>全体停止</td><td>日経平均またはTOPIXが当日-2%以上、または米金利・為替が急変</td><td>当日の新規買付を止める</td><td>個別要因ではなく市場全体の売りに巻き込まれるため</td></tr>
        <tr><td>追い買い禁止</td><td>候補銘柄が前日比+3%以上で始まる</td><td>買わずに翌営業日以降へ回す</td><td>好材料を追いかけて高値をつかむリスクを避けるため</td></tr>
        <tr><td>追加買い</td><td>5営業日で指数を上回り、決算・財務・テーマ前提が崩れていない</td><td>次の分割枠を検討</td><td>上がっている理由が残っているかを確認してから増やすため</td></tr>
        <tr><td>減額</td><td>指数に5営業日連続で劣後、または決算失望・テーマ前提崩れ</td><td>追加停止、必要なら半分以下へ縮小</td><td>個別株を選ぶ根拠が薄れた時点で比率を落とすため</td></tr>
        <tr><td>急落・ストップ安警戒</td><td>出来高急増を伴う-7%以上、またはストップ安気配</td><td>新規買付停止。翌営業日に材料と流動性を確認</td><td>落ちたから買うのではなく、理由が消化されたかを見るため</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>上位10社のうち配分しない銘柄</h2>
    <p class="note">10社に無理やりそろえることはしません。点数が近くても、公式照合・イベント反応・PER確認が弱い場合は、買付ではなく監視に残します。</p>
    {html_table(not_allocated_top, not_allocated_fields) if not_allocated_top else '<p class="ok">上位10社すべてが配分候補です。</p>'}
  </section>

  <section>
    <h2>不足データ 上位候補</h2>
    {html_table(missing, missing_fields, 30)}
  </section>

  <section>
    <h2>出力ファイル</h2>
    <div class="links">
      <a href="ultimate_selection_scores_20260618.csv">統合スコアCSV</a>
      <a href="ultimate_selection_portfolio_20260618.csv">配分案CSV</a>
      <a href="ultimate_selection_execution_plan_20260618.csv">実行ゲートCSV</a>
      <a href="ultimate_selection_risk_scenarios_20260618.csv">リスクシナリオCSV</a>
      <a href="ultimate_selection_trade_rules_20260618.csv">銘柄別売買ルールCSV</a>
      <a href="ultimate_selection_day_checklist_20260618.csv">19日当日チェックCSV</a>
      <a href="ultimate_selection_order_log_template_20260618.csv">当日記録テンプレートCSV</a>
      <a href="ultimate_selection_missing_data_20260618.csv">不足データCSV</a>
    </div>
    <p class="note">この版は、渡された数式群を「量的・質的・イベント・期待値・配分制約」に分解して実装した初回統合版です。未取得の財務・ニュース・イベント長期履歴は信頼度を下げ、欠損表へ出します。</p>
  </section>
</main>
</body>
</html>
"""


def main() -> None:
    rows = build_scores()
    portfolio = optimize_portfolio(rows)
    missing = build_missing(rows)
    execution = build_execution_plan(portfolio)
    risk_scenarios = build_risk_scenarios(portfolio, execution)
    trade_rules = build_trade_rules(portfolio, execution)
    day_checklist = build_day_checklist(execution)
    order_log_template = build_order_log_template(execution)
    write_csv(OUT_SCORE, rows)
    write_csv(OUT_PORTFOLIO, portfolio)
    write_csv(OUT_MISSING, missing)
    write_csv(OUT_EXECUTION, execution)
    write_csv(OUT_RISK, risk_scenarios)
    write_csv(OUT_TRADE_RULES, trade_rules)
    write_csv(OUT_DAY_CHECKLIST, day_checklist)
    write_csv(OUT_ORDER_LOG_TEMPLATE, order_log_template)
    OUT_HTML.write_text(
        build_html(rows, portfolio, missing, execution, risk_scenarios, trade_rules, day_checklist, order_log_template),
        encoding="utf-8",
    )
    print(f"HTML: {OUT_HTML}")
    print(f"Scores: {OUT_SCORE}")
    print(f"Portfolio: {OUT_PORTFOLIO}")
    print(f"Missing: {OUT_MISSING}")
    print(f"Execution: {OUT_EXECUTION}")
    print(f"Risk: {OUT_RISK}")
    print(f"Trade rules: {OUT_TRADE_RULES}")
    print(f"Day checklist: {OUT_DAY_CHECKLIST}")
    print(f"Order log template: {OUT_ORDER_LOG_TEMPLATE}")
    print("Top 10:")
    for r in rows[:10]:
        print(r["ticker"], r["name"], r["final_score"], r["action"])
    print("Portfolio:")
    for r in portfolio:
        print(r["portfolio_rank"], r["ticker"], r["target_weight_pct"], r["initial_buy_yen"])


if __name__ == "__main__":
    main()
