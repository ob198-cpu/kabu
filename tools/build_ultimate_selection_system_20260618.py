from __future__ import annotations

import csv
import html
import math
from collections import defaultdict
from datetime import datetime, timedelta
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
WEEKLY_PRICE_CSV = ROOT / "152_trend_candidate_weekly_prices.csv"

OUT_SCORE = ROOT / "ultimate_selection_scores_20260618.csv"
OUT_PORTFOLIO = ROOT / "ultimate_selection_portfolio_20260618.csv"
OUT_MISSING = ROOT / "ultimate_selection_missing_data_20260618.csv"
OUT_EXECUTION = ROOT / "ultimate_selection_execution_plan_20260618.csv"
OUT_RISK = ROOT / "ultimate_selection_risk_scenarios_20260618.csv"
OUT_TRADE_RULES = ROOT / "ultimate_selection_trade_rules_20260618.csv"
OUT_DAY_CHECKLIST = ROOT / "ultimate_selection_day_checklist_20260618.csv"
OUT_ORDER_LOG_TEMPLATE = ROOT / "ultimate_selection_order_log_template_20260618.csv"
OUT_CORRELATION = ROOT / "ultimate_selection_correlation_risk_20260618.csv"
OUT_CONSTRAINTS = ROOT / "ultimate_selection_constraints_20260618.csv"
OUT_ARCHITECTURE_AUDIT = ROOT / "ultimate_selection_architecture_audit_20260618.csv"
OUT_THEME_EVIDENCE = ROOT / "ultimate_selection_theme_evidence_20260618.csv"
OUT_NO_BUY_GATE = ROOT / "ultimate_selection_no_buy_reduce_gate_20260618.csv"
OUT_BENCHMARK_ALLOCATION_GATE = ROOT / "ultimate_selection_benchmark_allocation_gate_20260618.csv"
OUT_PREDICTION_REVIEW = ROOT / "ultimate_selection_prediction_review_20260619.csv"
OUT_MODEL_REVISION_QUEUE = ROOT / "ultimate_selection_model_revision_queue_20260619.csv"
OUT_REVIEW_INPUT_TEMPLATE = ROOT / "ultimate_selection_review_input_template_20260619.csv"
OUT_REVIEW_RESULT = ROOT / "ultimate_selection_review_result_20260619.csv"
OUT_ULTIMATE_REQUIREMENT_MATRIX = ROOT / "ultimate_selection_requirement_matrix_20260619.csv"
OUT_PURCHASE_READINESS_GATE = ROOT / "ultimate_selection_purchase_readiness_gate_20260619.csv"
OUT_UNIVERSE_RULES = ROOT / "ultimate_selection_universe_rules_20260619.csv"
OUT_UNIVERSE_AUDIT = ROOT / "ultimate_selection_universe_audit_20260619.csv"
OUT_EXPECTED_VALUE_AUDIT = ROOT / "ultimate_selection_expected_value_audit_20260619.csv"
OUT_SCORE_TRACE = ROOT / "ultimate_selection_score_trace_20260619.csv"
OUT_ACTION_COCKPIT = ROOT / "ultimate_selection_action_cockpit_20260619.csv"
OUT_BUY_BLOCKER_TRIAGE = ROOT / "ultimate_selection_buy_blocker_triage_20260619.csv"
OUT_ALLOCATION_TRACE = ROOT / "ultimate_selection_allocation_trace_20260619.csv"
OUT_TODAY_ORDER_TICKET = ROOT / "ultimate_selection_today_order_ticket_20260619.csv"
OUT_STRUCTURAL_GATE = ROOT / "ultimate_selection_structural_gate_20260619.csv"
OUT_HTML = ROOT / "ultimate_selection_system_20260618.html"

CAPITAL_YEN = 2_400_000
INITIAL_BUY_CAP_YEN = 360_000
TARGET_EXCESS_PCT = 1.0
STRONG_EXCESS_PCT = 5.0
TARGET_STOCK_EXPOSURE_PCT = 85.0
CASH_RESERVE_PCT = 100.0 - TARGET_STOCK_EXPOSURE_PCT
MAX_SINGLE_STOCK_SLEEVE_PCT = 18.0
MAX_SECTOR_COUNT = 3


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


def optimize_portfolio_v2(rows: list[dict[str, object]]) -> list[dict[str, object]]:
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
        if sector_counts[sector] >= MAX_SECTOR_COUNT:
            continue
        selected.append(r.copy())
        sector_counts[sector] += 1

    raw_weights = []
    allocation_multipliers = []
    allocation_caps = []
    for r in selected:
        score = float(r["final_score"])
        ev = max(float(r["expected_value_pct"]), 0.0)
        action_multiplier = 1.0
        raw = max(score - 45, 1) * (1 + ev / 30)
        if r["action"] == "小口または監視":
            action_multiplier = 0.55
            raw *= action_multiplier
        if r["action"] == "小口":
            action_multiplier = 0.70
            raw *= action_multiplier
        if r["action"] == "調査優先":
            action_multiplier = 0.65
            raw *= action_multiplier
        raw_weights.append(raw)
        allocation_multipliers.append(action_multiplier)
    total_raw = sum(raw_weights) or 1

    capped = []
    for r, raw in zip(selected, raw_weights):
        cap = MAX_SINGLE_STOCK_SLEEVE_PCT / 100
        if r["action"] in ["小口", "小口または監視"]:
            cap = 0.08
        if r["action"] == "調査優先":
            cap = 0.10
        allocation_caps.append(cap)
        capped.append(min(raw / total_raw, cap))

    for _ in range(8):
        total = sum(capped)
        if total >= 0.999:
            break
        room_indices = []
        for i, r in enumerate(selected):
            cap = MAX_SINGLE_STOCK_SLEEVE_PCT / 100
            if r["action"] in ["小口", "小口または監視"]:
                cap = 0.08
            if r["action"] == "調査優先":
                cap = 0.10
            if capped[i] + 0.0001 < cap:
                room_indices.append(i)
        if not room_indices:
            break
        add_each = (1.0 - total) / len(room_indices)
        for i in room_indices:
            cap = MAX_SINGLE_STOCK_SLEEVE_PCT / 100
            if selected[i]["action"] in ["小口", "小口または監視"]:
                cap = 0.08
            if selected[i]["action"] == "調査優先":
                cap = 0.10
            capped[i] = min(cap, capped[i] + add_each)

    total = sum(capped) or 1
    portfolio: list[dict[str, object]] = []
    for rank, (r, w) in enumerate(zip(selected, capped), start=1):
        idx = rank - 1
        sleeve_weight = w / total
        total_weight = sleeve_weight * (TARGET_STOCK_EXPOSURE_PCT / 100)
        full_amount = CAPITAL_YEN * total_weight
        initial_amount = INITIAL_BUY_CAP_YEN * sleeve_weight
        price = float(r["price"])
        initial_shares = math.floor(initial_amount / price) if price else 0
        initial_yen = initial_shares * price
        score_component = max(float(r["final_score"]) - 45, 1)
        ev_multiplier = 1 + max(float(r["expected_value_pct"]), 0.0) / 30
        raw_share = raw_weights[idx] / total_raw
        cap = allocation_caps[idx]
        if r["action"] in ["小口", "小口または監視"]:
            cap_reason = "小口扱いのため株式枠8%上限"
        elif r["action"] == "調査優先":
            cap_reason = "調査優先のため株式枠10%上限"
        else:
            cap_reason = f"通常候補のため株式枠{MAX_SINGLE_STOCK_SLEEVE_PCT:.0f}%上限"
        portfolio.append(
            {
                **r,
                "portfolio_rank": rank,
                "allocation_formula": "raw = max(総合点-45,1) × (1+EV/30) × 扱い別係数",
                "allocation_score_component": round(score_component, 2),
                "allocation_ev_multiplier": round(ev_multiplier, 3),
                "allocation_action_multiplier": allocation_multipliers[idx],
                "allocation_raw_weight": round(raw_weights[idx], 3),
                "allocation_raw_share_before_cap_pct": round(raw_share * 100, 1),
                "allocation_cap_pct": round(cap * 100, 1),
                "allocation_cap_reason": cap_reason,
                "stock_sleeve_weight_pct": round(sleeve_weight * 100, 1),
                "target_weight_pct": round(total_weight * 100, 1),
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
        initial_yen = float(row.get("initial_buy_yen") or 0)
        executable_today_yen = initial_yen if status in ["初回候補", "小口候補"] else 0
        hold_yen = 0 if executable_today_yen else initial_yen
        if status == "初回候補":
            execution_bucket = "本日小口実行枠"
        elif status == "小口候補":
            execution_bucket = "条件付き小口実行枠"
        elif status == "確認後候補":
            execution_bucket = "確認後まで保留"
        else:
            execution_bucket = "監視のみ"
        out.append(
            {
                "rank": row.get("portfolio_rank", ""),
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "execution_status": status,
                "execution_bucket": execution_bucket,
                "initial_shares": row.get("initial_shares", ""),
                "initial_buy_yen": row.get("initial_buy_yen", ""),
                "executable_today_yen": round(executable_today_yen),
                "hold_until_confirmed_yen": round(hold_yen),
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
                "execution_bucket": row.get("execution_bucket", ""),
                "planned_shares": row.get("initial_shares", ""),
                "candidate_yen": row.get("initial_buy_yen", ""),
                "planned_yen": row.get("executable_today_yen", ""),
                "hold_until_confirmed_yen": row.get("hold_until_confirmed_yen", ""),
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
            "execution_bucket": "",
            "planned_shares": "",
            "candidate_yen": "",
            "planned_yen": "",
            "hold_until_confirmed_yen": "",
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


def build_today_order_ticket(execution: list[dict[str, object]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in execution:
        amount = float(row.get("executable_today_yen") or 0)
        if amount <= 0:
            continue
        rows.append(
            {
                "order_rank": row.get("rank", ""),
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "order_bucket": row.get("execution_bucket", ""),
                "max_today_yen": round(amount),
                "planned_shares": row.get("initial_shares", ""),
                "limit_price_yen": row.get("limit_price_yen", ""),
                "do_not_chase_price_yen": row.get("do_not_chase_price_yen", ""),
                "temporary_stop_line_yen": row.get("temporary_stop_line_yen", ""),
                "order_method": "寄付き成行は使わず、価格確認後に指値または小口で検討",
                "before_order_check": "本人NISA区分、買付余力、本人操作、当日指数、個別ニュースを確認",
                "do_not_order_if": row.get("no_buy_conditions", ""),
                "record_after_order": "約定価格、約定株数、買わなかった理由、指数変化を注文ログへ記録",
            }
        )
    rows.append(
        {
            "order_rank": "STOP",
            "ticker": "全体停止条件",
            "name": "注文前に必ず確認",
            "order_bucket": "停止ゲート",
            "max_today_yen": 0,
            "planned_shares": "",
            "limit_price_yen": "",
            "do_not_chase_price_yen": "",
            "temporary_stop_line_yen": "",
            "order_method": "条件に触れた場合は全銘柄の新規買付を止める",
            "before_order_check": "NISA未確認、本人操作不可、日経/TOPIX-2%以上、前日比+3%以上の追い買い、重大悪材料",
            "do_not_order_if": "証券会社画面でNISA区分・余力・本人操作が確認できない / 市場急落 / 高値追い / 未確認項目が残る",
            "record_after_order": "買わなかった理由を記録し、翌営業日に再判定",
        }
    )
    return rows


def add_business_days(start: str, days: int) -> str:
    current = datetime.strptime(start, "%Y-%m-%d")
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current.strftime("%Y-%m-%d")


def build_prediction_review(
    portfolio: list[dict[str, object]],
    execution: list[dict[str, object]],
) -> list[dict[str, object]]:
    trade_date = "2026-06-19"
    execution_by_ticker = {str(row.get("ticker", "")): row for row in execution}
    review_points = [
        {
            "review_point": "D+1営業日",
            "review_date": add_business_days(trade_date, 1),
            "judgement_rule": "指数比で-1%以内なら継続観察。-2%以上劣後、または悪材料発生なら追加停止。",
            "action_if_good": "記録のみ。追い買いはしない。",
            "action_if_bad": "理由を記録し、次回買付候補から一時除外。",
        },
        {
            "review_point": "D+5営業日",
            "review_date": add_business_days(trade_date, 5),
            "judgement_rule": "指数比+1%以上なら候補維持。-3%以上劣後なら次回買付を半分以下に減額。",
            "action_if_good": "追加候補として残す。",
            "action_if_bad": "テーマ・決算・需給の仮説を見直す。",
        },
        {
            "review_point": "D+20営業日",
            "review_date": add_business_days(trade_date, 20),
            "judgement_rule": "指数比+3%以上なら仮説有効候補。-5%以上劣後なら購入候補から外す方向で再審査。",
            "action_if_good": "追加買付または保有継続を検討。",
            "action_if_bad": "モデルの該当スコアを減点候補にする。",
        },
        {
            "review_point": "1年",
            "review_date": "2027-06-19",
            "judgement_rule": "S&P500/TOPIXを+1%以上上回ればモデル有効候補。劣後なら個別株比率を下げる。",
            "action_if_good": "翌年も同系統の選定条件を継続検証。",
            "action_if_bad": "個別株比率を下げ、指数・現金比率を上げる。",
        },
    ]
    rows: list[dict[str, object]] = []
    portfolio_ev = weighted_portfolio_value(portfolio, "expected_value_pct")
    portfolio_up = weighted_portfolio_value(portfolio, "up_probability")
    initial_total = sum(float(r.get("initial_buy_yen") or 0) for r in execution)
    for point in review_points:
        rows.append(
            {
                "trade_date": trade_date,
                "review_point": point["review_point"],
                "review_date": point["review_date"],
                "ticker": "PORTFOLIO",
                "name": "全体",
                "planned_status": "全体検証",
                "expected_value_pct": round(portfolio_ev, 2),
                "up_probability_pct": round(portfolio_up, 1),
                "target_weight_pct": TARGET_STOCK_EXPOSURE_PCT,
                "initial_buy_yen": round(initial_total),
                "actual_buy_yen": "",
                "actual_return_pct": "",
                "benchmark_return_pct": "",
                "excess_return_pct": "",
                "judgement_rule": point["judgement_rule"],
                "action_if_good": point["action_if_good"],
                "action_if_bad": point["action_if_bad"],
                "model_feedback": "全体の個別株比率、指数比、現金比率を見直す。",
            }
        )
        for row in portfolio:
            ticker = str(row.get("ticker", ""))
            planned = execution_by_ticker.get(ticker, {})
            rows.append(
                {
                    "trade_date": trade_date,
                    "review_point": point["review_point"],
                    "review_date": point["review_date"],
                    "ticker": ticker,
                    "name": row.get("name", ""),
                    "planned_status": planned.get("execution_status", ""),
                    "expected_value_pct": row.get("expected_value_pct", ""),
                    "up_probability_pct": row.get("up_probability", ""),
                    "target_weight_pct": row.get("target_weight_pct", ""),
                    "initial_buy_yen": planned.get("initial_buy_yen", ""),
                    "actual_buy_yen": "",
                    "actual_return_pct": "",
                    "benchmark_return_pct": "",
                    "excess_return_pct": "",
                    "judgement_rule": point["judgement_rule"],
                    "action_if_good": point["action_if_good"],
                    "action_if_bad": point["action_if_bad"],
                    "model_feedback": "予想との差を記録し、量的・質的・イベント・リスクのどこが外れたか分類する。",
                }
            )
    return rows


def build_model_revision_queue(
    portfolio: list[dict[str, object]],
    prediction_review_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    portfolio_tickers = ", ".join(str(r.get("ticker", "")) for r in portfolio)
    return [
        {
            "priority": "最重要",
            "review_timing": "D+1営業日",
            "trigger": "全体または主要銘柄が指数比-2%以上劣後",
            "check_formula": "excess_return_pct = actual_return_pct - benchmark_return_pct",
            "score_layer_to_review": "リスク / イベント / 需給",
            "revision_action": "追加買付を止め、寄付き過熱・市場急落・出来高急増下落のゲートが効いたか確認する。",
            "do_not_do": "1日だけの下落で長期スコアを自動で大幅変更しない。",
            "evidence_required": "実績%、指数%、当日ニュース、出来高、為替、金利",
            "target_rows": "全体 + 初回候補",
        },
        {
            "priority": "高",
            "review_timing": "D+5営業日",
            "trigger": "指数比-3%以上劣後、または上位候補の半数以上が劣後",
            "check_formula": "winner_rate = excess_return_pct > 0 の銘柄数 / 保有銘柄数",
            "score_layer_to_review": "量的 / 質的 / イベント",
            "revision_action": "テーマ仮説、決算後反応、直近モメンタムが実際の需給と合っていたかを再分類する。",
            "do_not_do": "テーマが強いという理由だけで買い増ししない。",
            "evidence_required": "5営業日株価、TOPIX/S&P比較、同業比較、関連ニュース",
            "target_rows": portfolio_tickers,
        },
        {
            "priority": "高",
            "review_timing": "D+20営業日",
            "trigger": "指数比-5%以上劣後、または期待値上位が継続して弱い",
            "check_formula": "model_error_pct = expected_value_pct - actual_return_pct",
            "score_layer_to_review": "期待値 / ポートフォリオ配分 / 銘柄別上限",
            "revision_action": "期待値の上昇確率・上昇幅・下落幅を見直し、次回の配分上限を下げる。",
            "do_not_do": "期待値の外れを放置して同じ比率で次回投入しない。",
            "evidence_required": "20営業日リターン、最大下落、ボラティリティ、指数差、セクター差",
            "target_rows": "全銘柄",
        },
        {
            "priority": "中",
            "review_timing": "D+20営業日",
            "trigger": "指数比+3%以上で上回り、悪材料が出ていない",
            "check_formula": "excess_return_pct >= 3 and no_negative_event",
            "score_layer_to_review": "質的テーマ / イベント実績",
            "revision_action": "仮説層を実績層へ昇格候補にし、次回の監視優先度を上げる。ただし自動増額はしない。",
            "do_not_do": "短期勝ちだけで1年期待値を過大評価しない。",
            "evidence_required": "上昇理由、出来高、同業反応、決算・IRとの接続",
            "target_rows": "勝ち銘柄",
        },
        {
            "priority": "最重要",
            "review_timing": "1年",
            "trigger": "ポートフォリオがS&P500/TOPIXを+1%以上上回らない",
            "check_formula": "portfolio_excess_return_pct < 1",
            "score_layer_to_review": "全体配分 / 母集団 / 指標重み",
            "revision_action": "個別株比率を下げ、指数・現金比率を上げる。母集団条件と重みを再検証する。",
            "do_not_do": "負けたモデルを同じ説明で翌年継続しない。",
            "evidence_required": "1年実績、指数比較、売買記録、コスト、税引後結果",
            "target_rows": "PORTFOLIO",
        },
        {
            "priority": "最重要",
            "review_timing": "各レビュー日",
            "trigger": "実績値が未入力",
            "check_formula": "actual_return_pct is blank",
            "score_layer_to_review": "データ運用",
            "revision_action": "未入力の間は次回買付判断へ進めない。データ取得・転記・検算を先に行う。",
            "do_not_do": "記録なしで、感覚的に成功/失敗を判断しない。",
            "evidence_required": "約定価格、評価額、指数、為替、金利、更新日時",
            "target_rows": f"{len(prediction_review_rows)}レビュー行",
        },
    ]


def build_review_input_template(
    portfolio: list[dict[str, object]],
    execution: list[dict[str, object]],
) -> list[dict[str, object]]:
    execution_by_ticker = {str(row.get("ticker", "")): row for row in execution}
    review_dates = [
        ("D+1営業日", "2026-06-22"),
        ("D+5営業日", "2026-06-26"),
        ("D+20営業日", "2026-07-17"),
        ("1年", "2027-06-19"),
    ]
    rows: list[dict[str, object]] = []
    for point, review_date in review_dates:
        rows.append(
            {
                "review_point": point,
                "review_date": review_date,
                "ticker": "PORTFOLIO",
                "name": "全体",
                "actual_buy_price_yen": "",
                "review_price_yen": "",
                "actual_return_formula": "各銘柄の実績%を購入金額で加重平均",
                "benchmark_name": "TOPIXまたはS&P500",
                "benchmark_start_level": "",
                "benchmark_review_level": "",
                "benchmark_return_formula": "(benchmark_review_level / benchmark_start_level - 1) * 100",
                "excess_return_formula": "actual_return_pct - benchmark_return_pct",
                "input_required": "実績%、指数%、指数差、ニュース要因",
                "decision_output": "継続 / 追加停止 / 減額 / 再審査",
                "memo": "全体の勝ち負けを指数比で確認する。",
            }
        )
        for row in portfolio:
            ticker = str(row.get("ticker", ""))
            planned = execution_by_ticker.get(ticker, {})
            rows.append(
                {
                    "review_point": point,
                    "review_date": review_date,
                    "ticker": ticker,
                    "name": row.get("name", ""),
                    "actual_buy_price_yen": "",
                    "review_price_yen": "",
                    "actual_return_formula": "(review_price_yen / actual_buy_price_yen - 1) * 100",
                    "benchmark_name": "TOPIXまたは同業指数",
                    "benchmark_start_level": "",
                    "benchmark_review_level": "",
                    "benchmark_return_formula": "(benchmark_review_level / benchmark_start_level - 1) * 100",
                    "excess_return_formula": "actual_return_pct - benchmark_return_pct",
                    "input_required": "約定価格、確認日終値、比較指数の開始値と確認日値",
                    "decision_output": "継続 / 追加停止 / 減額 / 再審査",
                    "memo": f"予定金額 {planned.get('initial_buy_yen', '')} 円。実績未入力なら次回買付へ進めない。",
                }
            )
    return rows


def merge_existing_review_input(generated_rows: list[dict[str, object]]) -> list[dict[str, object]]:
    existing_rows = read_csv(OUT_REVIEW_INPUT_TEMPLATE)
    if not existing_rows:
        return generated_rows
    editable_fields = {
        "actual_buy_price_yen",
        "review_price_yen",
        "benchmark_name",
        "benchmark_start_level",
        "benchmark_review_level",
        "memo",
    }
    existing_by_key = {
        (r.get("review_point", ""), r.get("review_date", ""), r.get("ticker", "")): r
        for r in existing_rows
    }
    merged: list[dict[str, object]] = []
    for row in generated_rows:
        key = (str(row.get("review_point", "")), str(row.get("review_date", "")), str(row.get("ticker", "")))
        old = existing_by_key.get(key, {})
        new_row = dict(row)
        for field in editable_fields:
            old_value = str(old.get(field, "")).strip()
            if old_value:
                new_row[field] = old_value
        merged.append(new_row)
    return merged


def pct_change_from_levels(start_value: object, end_value: object) -> float | None:
    start = to_float(start_value, 0)
    end = to_float(end_value, 0)
    if start <= 0 or end <= 0:
        return None
    return (end / start - 1) * 100


def review_decision(review_point: str, excess_pct: float | None, actual_pct: float | None) -> tuple[str, str]:
    if actual_pct is None:
        return "未入力", "実績価格を入力するまで次回買付判断に進まない。"
    if excess_pct is None:
        return "指数比較未入力", "比較指数の開始値と確認日値を入力する。"
    if "D+1" in review_point:
        if excess_pct <= -2:
            return "追加停止", "当日要因、出来高、指数急落、ニュースを確認する。"
        if excess_pct < -1:
            return "継続観察", "翌営業日も指数差を確認する。"
        return "記録継続", "追い買いはせず、次の確認日まで観察する。"
    if "D+5" in review_point:
        if excess_pct <= -3:
            return "次回買付半減", "テーマ仮説と決算後反応を再確認する。"
        if excess_pct >= 1:
            return "候補維持", "追加候補として残すが、買い増しは次ゲートで判断する。"
        return "継続観察", "D+20まで結論を急がない。"
    if "D+20" in review_point:
        if excess_pct <= -5:
            return "再審査", "購入候補から外す方向で量的・質的・イベントを見直す。"
        if excess_pct >= 3:
            return "仮説有効候補", "仮説層を実績層へ昇格できるか確認する。"
        return "継続観察", "追加買付は次の決算・指数比較後に判断する。"
    if "1年" in review_point:
        if excess_pct >= 1:
            return "モデル有効候補", "翌年も同系統の条件を検証対象として残す。"
        return "個別株比率引き下げ", "指数・現金比率を上げ、母集団と重みを再検証する。"
    return "継続観察", "次のレビュー日に再確認する。"


def build_review_results(
    input_rows: list[dict[str, object]],
    execution: list[dict[str, object]],
) -> list[dict[str, object]]:
    amount_by_ticker = {
        str(r.get("ticker", "")): to_float(r.get("initial_buy_yen"), 0)
        for r in execution
    }
    individual_results: list[dict[str, object]] = []
    grouped: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    portfolio_inputs: dict[tuple[str, str], dict[str, object]] = {}
    for row in input_rows:
        key = (str(row.get("review_point", "")), str(row.get("review_date", "")))
        if str(row.get("ticker", "")) == "PORTFOLIO":
            portfolio_inputs[key] = row
            continue
        actual_pct = pct_change_from_levels(row.get("actual_buy_price_yen"), row.get("review_price_yen"))
        benchmark_pct = pct_change_from_levels(row.get("benchmark_start_level"), row.get("benchmark_review_level"))
        excess_pct = actual_pct - benchmark_pct if actual_pct is not None and benchmark_pct is not None else None
        decision, action = review_decision(str(row.get("review_point", "")), excess_pct, actual_pct)
        result = {
            "review_point": row.get("review_point", ""),
            "review_date": row.get("review_date", ""),
            "ticker": row.get("ticker", ""),
            "name": row.get("name", ""),
            "actual_return_pct": "" if actual_pct is None else round(actual_pct, 2),
            "benchmark_return_pct": "" if benchmark_pct is None else round(benchmark_pct, 2),
            "excess_return_pct": "" if excess_pct is None else round(excess_pct, 2),
            "decision": decision,
            "action": action,
            "missing_input": "なし" if actual_pct is not None and benchmark_pct is not None else "実績価格または指数値",
            "calculation_basis": "実績%=(確認日価格/約定価格-1)*100、指数差=実績%-指数%",
        }
        individual_results.append(result)
        grouped[key].append(result)

    results: list[dict[str, object]] = []
    for key in sorted(grouped.keys(), key=lambda k: (k[1], k[0])):
        point, date = key
        p_input = portfolio_inputs.get(key, {})
        weighted_actual = 0.0
        weighted_benchmark = 0.0
        actual_weight = 0.0
        benchmark_weight = 0.0
        for row in grouped[key]:
            ticker = str(row.get("ticker", ""))
            weight = amount_by_ticker.get(ticker, 0)
            actual_pct = to_float(row.get("actual_return_pct"), math.nan)
            benchmark_pct = to_float(row.get("benchmark_return_pct"), math.nan)
            if weight and not math.isnan(actual_pct):
                weighted_actual += actual_pct * weight
                actual_weight += weight
            if weight and not math.isnan(benchmark_pct):
                weighted_benchmark += benchmark_pct * weight
                benchmark_weight += weight
        portfolio_actual = weighted_actual / actual_weight if actual_weight else None
        portfolio_benchmark = pct_change_from_levels(
            p_input.get("benchmark_start_level", ""),
            p_input.get("benchmark_review_level", ""),
        )
        if portfolio_benchmark is None and benchmark_weight:
            portfolio_benchmark = weighted_benchmark / benchmark_weight
        portfolio_excess = (
            portfolio_actual - portfolio_benchmark
            if portfolio_actual is not None and portfolio_benchmark is not None
            else None
        )
        decision, action = review_decision(point, portfolio_excess, portfolio_actual)
        results.append(
            {
                "review_point": point,
                "review_date": date,
                "ticker": "PORTFOLIO",
                "name": "全体",
                "actual_return_pct": "" if portfolio_actual is None else round(portfolio_actual, 2),
                "benchmark_return_pct": "" if portfolio_benchmark is None else round(portfolio_benchmark, 2),
                "excess_return_pct": "" if portfolio_excess is None else round(portfolio_excess, 2),
                "decision": decision,
                "action": action,
                "missing_input": "なし" if portfolio_actual is not None and portfolio_benchmark is not None else "銘柄実績または指数値",
                "calculation_basis": "各銘柄実績を初回金額で加重平均。指数は全体行入力、未入力なら個別指数を加重平均。",
            }
        )
        results.extend(grouped[key])
    return results


def count_rows(path: Path) -> int:
    return len(read_csv(path))


def build_ultimate_requirement_matrix(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    total = len(rows)
    portfolio_count = len(portfolio)
    price_count = sum(1 for r in rows if r.get("price") != "")
    financial_pass = sum(1 for r in rows if r.get("financial_status") == "pass")
    financial_partial = sum(1 for r in rows if r.get("financial_status") == "partial")
    financial_supplement = sum(1 for r in rows if str(r.get("financial_status", "")).startswith("補助"))
    qualitative_connected = sum(1 for r in rows if "質的データ未接続" not in str(r.get("qualitative_note", "")))
    event_connected = sum(1 for r in rows if "イベント未接続" not in str(r.get("event_note", "")))
    rows_out = [
        {
            "layer": "候補母集団",
            "requirement": "業績成長、流動性、時価総額、テーマ適合で100社前後を作る",
            "current_status": "一部実装",
            "current_data": f"{total}社。再選定CSV={UNIVERSE_CSV.name}",
            "score_usage": "母集団の入口。final_scoreの前提。",
            "purchase_gate": "母集団外、除外、監視は購入候補へ上げない。",
            "gap": "時価総額・流動性の完全再現条件は追加固定が必要。",
            "next_action": "母集団作成条件を別CSVで固定し、入替履歴を残す。",
        },
        {
            "layer": "量的スコア",
            "requirement": "株価モメンタム、下落率、指数差、出来高を見る",
            "current_status": "一部実装",
            "current_data": f"価格あり {price_count}/{total}社。5年/10年CAGR、1年、60日、S&P差、最大下落を使用。",
            "score_usage": "quant_score、benchmark_score、risk_scoreに使用。",
            "purchase_gate": "価格未取得は配分対象外。",
            "gap": "出来高倍率は一部データに限定。全社統一の日次出来高DBは追加余地あり。",
            "next_action": "出来高20日平均、出来高急増下落を全社で定期計算する。",
        },
        {
            "layer": "量的スコア",
            "requirement": "売上成長、利益成長、EPS、ROE、PER/PBR、FCF、営業利益率、自己資本比率",
            "current_status": "一部実装",
            "current_data": f"公式pass {financial_pass}社、partial {financial_partial}社、補助 {financial_supplement}社。",
            "score_usage": "financial_scoreに使用。ただし補助値・未確認値は信頼度とgate_notesへ分離。",
            "purchase_gate": "pass以外は初回候補ではなく、小口・確認後候補・調査優先へ落とす。",
            "gap": "FCF、自己資本比率、営業利益率は全社統一の数値入力が未完成。",
            "next_action": "公式決算PDF/短信からEPS、BPS、ROE、営業利益率、FCF、自己資本比率の入力表を埋める。",
        },
        {
            "layer": "質的スコア",
            "requirement": "AI、半導体、電力、防衛、金利、資源、政策、新商品、業界シェア、構造優位を評価",
            "current_status": "一部実装",
            "current_data": f"質的接続 {qualitative_connected}/{total}社。チャンネル比較、探索スコア、テーマ証拠台帳を使用。",
            "score_usage": "qualitative_scoreに使用。ただしニュース未検証は購入確定に使わず補助扱い。",
            "purchase_gate": "仮説層だけの銘柄は監視・調査優先。実績層がない場合は比率を上げない。",
            "gap": "ニュース本文の定期取得、業界シェアの公式確認、過去反応DBが未完成。",
            "next_action": "仮説層、実績層、公式資料、過去反応を分けた質的イベント台帳を増やす。",
        },
        {
            "layer": "イベント検証",
            "requirement": "決算、上方修正、TOB、新製品、政策、金利、為替、戦争、商品市況後の株価反応を見る",
            "current_status": "一部実装",
            "current_data": f"イベント接続 {event_connected}/{total}社。決算後反応、6月イベント、イベント反応検証CSVを使用。",
            "score_usage": "event_scoreと買わない・減額条件に使用。",
            "purchase_gate": "イベント未接続または悪化は追加入金停止・確認後候補へ落とす。",
            "gap": "TOB、新製品、政策、戦争、商品市況の長期履歴DBは未完成。",
            "next_action": "イベント種別、発生日、対象銘柄、D+1/D+5/D+20超過リターンを蓄積する。",
        },
        {
            "layer": "期待値",
            "requirement": "期待値 = 上昇確率 × 上昇幅 - 下落確率 × 下落幅 - コスト",
            "current_status": "実装済み",
            "current_data": "expected_value_pct、up_probability、upside_pct、downside_pctを各銘柄に出力。",
            "score_usage": "ev_scoreと配分ウェイトに使用。",
            "purchase_gate": "期待値が高くても、財務・イベント・価格ゲートを通らなければ購入確定にしない。",
            "gap": "確率は検証用仮説であり、過去検証による校正が必要。",
            "next_action": "予実差レビュー結果で上昇確率と上下幅を更新する。",
        },
        {
            "layer": "ポートフォリオ最適化",
            "requirement": "相関、業種偏り、最大下落、1銘柄比率、現金比率で配分する",
            "current_status": "実装済み",
            "current_data": f"配分 {portfolio_count}社。株式85%、現金15%、1銘柄上限{MAX_SINGLE_STOCK_SLEEVE_PCT}%、業種上限{MAX_SECTOR_COUNT}社。",
            "score_usage": "portfolio CSV、constraints CSV、correlation risk CSVに出力。",
            "purchase_gate": "業種集中・相関集中・現金不足は減額または監視。",
            "gap": "相関は実測とproxyが混在。全社日次相関DBは追加余地あり。",
            "next_action": "日次/週次リターンを蓄積し、相関と最大下落を再計算する。",
        },
        {
            "layer": "買わない・減額条件",
            "requirement": "市場急落、指数劣後、テーマ崩れ、決算失望、円高、金利急騰、出来高急増下落",
            "current_status": "実装済み",
            "current_data": "no-buy gate、execution plan、trade rules、review resultに接続。",
            "score_usage": "購入停止、追加停止、減額、再審査の判定に使用。",
            "purchase_gate": "実績未入力、指数劣後、市場急落、未確認財務は買付停止または減額。",
            "gap": "当日の実績入力が入るまで、ルールが実運用で効いたかは検証中。",
            "next_action": "D+1/D+5/D+20/1年レビューで、ルールの効き方を記録する。",
        },
    ]
    return rows_out


def build_structural_gate(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    total = len(rows)
    portfolio_count = len(portfolio)
    price_count = sum(1 for r in rows if r.get("price") != "")
    financial_pass = sum(1 for r in rows if r.get("financial_status") == "pass")
    financial_partial = sum(1 for r in rows if r.get("financial_status") == "partial")
    qualitative_ready = len({r.get("ticker", "") for r in read_csv(QUAL_CSV) if r.get("ticker", "")})
    event_ready = len(
        {r.get("ticker", "") for r in read_csv(EVENT_CSV) if r.get("ticker", "")}
        | {r.get("ticker", "") for r in read_csv(REACTION_CSV) if r.get("ticker", "")}
        | {r.get("ticker", "") for r in read_csv(EVENT_VALIDATION_CSV) if r.get("ticker", "")}
    )
    ev_ready = sum(1 for r in rows if r.get("expected_value_pct") != "")

    return [
        {
            "layer": "1. 候補母集団",
            "required_structure": "業績成長、流動性、時価総額、テーマ適合で100社前後を作る",
            "implementation_status": "PARTIAL",
            "current_evidence": f"{total}社を母集団化。スコア計算対象としては利用可能。",
            "can_use_for_buy_decision": "PARTIAL",
            "buy_decision_usage": "候補探索の入口として使う。母集団外の銘柄を急に買付候補へ上げないための制御に使う。",
            "blocking_gap": "時価総額、流動性、除外条件の完全な再現ルールはまだ固定し切っていない。",
            "current_system_control": "母集団外、除外、監視の銘柄は初回買付候補へ上げない。",
            "next_hardening_step": "母集団作成条件、入替日、除外理由をCSVで固定し、翌回以降も同じ条件で再現できるようにする。",
        },
        {
            "layer": "2. 量的スコア",
            "required_structure": "売上成長、利益成長、EPS、ROE、PER/PBR、FCF、営業利益率、自己資本、株価モメンタム、出来高、下落率、指数差",
            "implementation_status": "PARTIAL",
            "current_evidence": f"価格あり {price_count}/{total}社。公式財務pass {financial_pass}社、partial {financial_partial}社。CAGR、指数差、最大下落、PER/PBR/ROEの一部を使用。",
            "can_use_for_buy_decision": "PARTIAL",
            "buy_decision_usage": "順位付けと減額判断に使う。ただし未確認財務や補助値だけの銘柄は購入確定へ直結させない。",
            "blocking_gap": "FCF、営業利益率、自己資本、出来高倍率の全社統一入力が未完成。",
            "current_system_control": "未取得値は点数に混ぜず、信頼度・不足データ・買付停止理由へ分離する。",
            "next_hardening_step": "公式決算PDF/短信からFCF、営業利益率、自己資本、出来高20日平均を埋め、スコア反映前後を監査表に残す。",
        },
        {
            "layer": "3. 質的スコア",
            "required_structure": "AI、半導体、電力、防衛、金利、資源、政策、新商品、業界シェア、構造優位をニュース・公式資料・過去反応で評価する",
            "implementation_status": "PARTIAL",
            "current_evidence": f"質的スコアあり {qualitative_ready}/{total}社。テーマ台帳、チャンネル比較、構造優位メモを使用。",
            "can_use_for_buy_decision": "PARTIAL",
            "buy_decision_usage": "量的スコアの補助、調査優先順位、テーマ崩れ時の減額条件に使う。単独では買付確定に使わない。",
            "blocking_gap": "ニュース本文、公式資料、業界シェア、過去イベント反応の接続が銘柄ごとに完全ではない。",
            "current_system_control": "仮説層だけの材料は監視・調査優先に留め、実績層がない場合は買付比率を上げない。",
            "next_hardening_step": "仮説層、実績層、公式資料、過去反応を分けた質的イベント台帳を増やす。",
        },
        {
            "layer": "4. イベント検証",
            "required_structure": "決算、上方修正、TOB、新製品、政策、金利、為替、戦争、商品市況後に株価がどう動いたかを見る",
            "implementation_status": "PARTIAL",
            "current_evidence": f"イベントスコアあり {event_ready}/{total}社。決算後反応、6月イベント、イベント反応検証CSVを使用。",
            "can_use_for_buy_decision": "PARTIAL",
            "buy_decision_usage": "買付日、追加可否、減額条件に使う。イベント未接続なら初回比率を下げる。",
            "blocking_gap": "TOB、新製品、政策、戦争、商品市況の長期イベント履歴DBは未完成。",
            "current_system_control": "イベント未接続または悪化は、追加入金停止・確認後候補へ落とす。",
            "next_hardening_step": "イベント種別、発生日、対象銘柄、D+1/D+5/D+20超過リターンを継続蓄積する。",
        },
        {
            "layer": "5. 期待値",
            "required_structure": "期待値 = 上昇確率 × 上昇幅 - 下落確率 × 下落幅 - コスト",
            "implementation_status": "YES",
            "current_evidence": f"期待値入力あり {ev_ready}/{total}社。expected_value_pct、up_probability、upside、downside、costを出力。",
            "can_use_for_buy_decision": "PARTIAL",
            "buy_decision_usage": "銘柄間の相対比較と配分の補助に使う。勝率保証としては使わない。",
            "blocking_gap": "上昇確率と上下幅は検証用仮説で、予実差レビューによる校正が必要。",
            "current_system_control": "期待値が高くても、財務・イベント・価格ゲートを通らなければ購入確定にしない。",
            "next_hardening_step": "D+20、3か月、1年レビューで実績を入れ、確率と上下幅を更新する。",
        },
        {
            "layer": "6. ポートフォリオ最適化",
            "required_structure": "相関、業種偏り、最大下落、1銘柄比率、現金比率を制約にして配分する",
            "implementation_status": "YES",
            "current_evidence": f"配分対象 {portfolio_count}社。株式{TARGET_STOCK_EXPOSURE_PCT:.1f}%、現金{CASH_RESERVE_PCT:.1f}%、1銘柄上限{MAX_SINGLE_STOCK_SLEEVE_PCT:.1f}%、業種上限{MAX_SECTOR_COUNT}社。",
            "can_use_for_buy_decision": "YES",
            "buy_decision_usage": "初回金額、1銘柄上限、業種集中回避、現金待機の決定に使う。",
            "blocking_gap": "相関は実測とproxyが混在。全社日次相関DBは追加余地あり。",
            "current_system_control": "集中しすぎる銘柄・業種は上限で抑え、未確認分は現金待機または小口にする。",
            "next_hardening_step": "日次/週次リターンから実測相関を再計算し、proxy依存を減らす。",
        },
        {
            "layer": "7. 買わない・減額条件",
            "required_structure": "市場急落、指数劣後、テーマ崩れ、決算失望、円高、金利急騰、出来高急増下落を明文化する",
            "implementation_status": "YES",
            "current_evidence": "no-buy gate、execution plan、trade rules、review resultに接続済み。",
            "can_use_for_buy_decision": "YES",
            "buy_decision_usage": "買付停止、追加停止、減額、現金待機、再審査の実行条件に使う。",
            "blocking_gap": "実売買ログ入力後に、ルールが過剰停止・過少停止になっていないか検証が必要。",
            "current_system_control": "市場急落、指数劣後、未確認財務、イベント悪化は買付停止または減額にする。",
            "next_hardening_step": "実行ログと予実差レビューを入れ、停止条件の有効性を月次で検証する。",
        },
    ]


def build_purchase_readiness_gate(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    portfolio_tickers = {str(r.get("ticker", "")) for r in portfolio}
    candidates = [r for r in rows[:20] if str(r.get("ticker", "")) in portfolio_tickers or str(r.get("action", "")) != "監視"]
    out: list[dict[str, object]] = []
    for r in candidates[:20]:
        financial_status = str(r.get("financial_status", ""))
        event_note = str(r.get("event_note", ""))
        qualitative_note = str(r.get("qualitative_note", ""))
        action = str(r.get("action", ""))
        official_financial = financial_status == "pass"
        price_ready = r.get("price") != ""
        event_ready = "未接続" not in event_note
        qualitative_ready = "未接続" not in qualitative_note
        in_portfolio = str(r.get("ticker", "")) in portfolio_tickers
        hard_stops = []
        if not price_ready:
            hard_stops.append("価格未取得")
        if not official_financial:
            hard_stops.append("公式財務未完了")
        if not event_ready:
            hard_stops.append("イベント未接続")
        if not qualitative_ready:
            hard_stops.append("質的根拠未接続")
        if action in ["買付不可", "監視"]:
            hard_stops.append("スコア上の購入対象外")

        if official_financial and price_ready and event_ready and qualitative_ready and action == "購入候補":
            readiness = "初回買付候補"
            next_action = "証券会社画面でNISA区分、余力、指値、本人操作を確認して小口実行候補。"
        elif in_portfolio and price_ready and action in ["小口", "調査優先", "購入候補"]:
            readiness = "条件付き候補"
            next_action = "不足項目を確認し、初回は小口または確認後候補として扱う。未確認なら増額しない。"
        else:
            readiness = "買付停止"
            next_action = "不足項目を解消するまで購入候補へ戻さない。"

        out.append(
            {
                "ticker": r.get("ticker", ""),
                "name": r.get("name", ""),
                "in_current_portfolio": "YES" if in_portfolio else "NO",
                "final_score": r.get("final_score", ""),
                "action": action,
                "financial_status": financial_status,
                "official_financial_ready": "YES" if official_financial else "NO",
                "price_ready": "YES" if price_ready else "NO",
                "event_ready": "YES" if event_ready else "NO",
                "qualitative_ready": "YES" if qualitative_ready else "NO",
                "nisa_account_ready": "証券会社画面で当日確認",
                "purchase_readiness": readiness,
                "hard_stop_reasons": " / ".join(hard_stops) if hard_stops else "なし",
                "next_action": next_action,
            }
        )
    return out


def build_buy_blocker_triage(
    portfolio: list[dict[str, object]], purchase_readiness_rows: list[dict[str, object]]
) -> list[dict[str, object]]:
    readiness_by_ticker = {str(r.get("ticker", "")): r for r in purchase_readiness_rows}
    out: list[dict[str, object]] = []
    for row in portfolio:
        ticker = str(row.get("ticker", ""))
        readiness = readiness_by_ticker.get(ticker, {})
        status = str(readiness.get("purchase_readiness", ""))
        action = str(row.get("action", ""))
        financial_status = str(row.get("financial_status", ""))
        missing = str(row.get("missing_items", ""))
        hard_stops = str(readiness.get("hard_stop_reasons", "")) or "なし"

        if status == "初回買付候補":
            permission = "初回小口可"
            amount_policy = "予定初回金額まで。追加はD+1/D+5と指数差確認後。"
            full_buy_blocker = "なし。ただしNISA区分・本人操作・当日市場ゲート未確認なら停止。"
        elif action == "小口":
            permission = "条件付き小口"
            amount_policy = "予定初回金額以下。追加は公式財務不足の解消後。"
            full_buy_blocker = hard_stops
        elif action == "調査優先":
            permission = "確認後まで保留"
            amount_policy = "原則は現金待機。買う場合でも別枠の小口扱い。"
            full_buy_blocker = hard_stops
        else:
            permission = "初回買付しない"
            amount_policy = "監視のみ。"
            full_buy_blocker = hard_stops

        if financial_status == "pass":
            financial_gap = "主要公式財務はpass"
        elif financial_status == "partial":
            financial_gap = "公式財務の一部が未確認"
        elif financial_status.startswith("補助"):
            financial_gap = "補助データ扱い。公式原本照合が必要"
        else:
            financial_gap = "財務未取得"

        out.append(
            {
                "rank": row.get("portfolio_rank", ""),
                "ticker": ticker,
                "name": row.get("name", ""),
                "permission": permission,
                "initial_buy_yen": row.get("initial_buy_yen", ""),
                "target_full_amount_yen": row.get("target_full_amount_yen", ""),
                "financial_gap": financial_gap,
                "event_gap": "イベント接続あり" if "未接続" not in str(row.get("event_note", "")) else "イベント未接続",
                "qualitative_gap": "質的根拠あり" if "未接続" not in str(row.get("qualitative_note", "")) else "質的根拠未接続",
                "critical_blocker": full_buy_blocker,
                "noncritical_backlog": missing or "なし",
                "amount_policy": amount_policy,
                "next_action": readiness.get("next_action", ""),
            }
        )
    return out


def build_allocation_trace(portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for row in portfolio:
        out.append(
            {
                "rank": row.get("portfolio_rank", ""),
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "action": row.get("action", ""),
                "final_score": row.get("final_score", ""),
                "expected_value_pct": row.get("expected_value_pct", ""),
                "raw_formula": row.get("allocation_formula", ""),
                "score_component": row.get("allocation_score_component", ""),
                "ev_multiplier": row.get("allocation_ev_multiplier", ""),
                "action_multiplier": row.get("allocation_action_multiplier", ""),
                "raw_weight": row.get("allocation_raw_weight", ""),
                "raw_share_before_cap_pct": row.get("allocation_raw_share_before_cap_pct", ""),
                "cap_pct": row.get("allocation_cap_pct", ""),
                "cap_reason": row.get("allocation_cap_reason", ""),
                "stock_sleeve_weight_pct": row.get("stock_sleeve_weight_pct", ""),
                "total_portfolio_weight_pct": row.get("target_weight_pct", ""),
                "target_full_amount_yen": row.get("target_full_amount_yen", ""),
                "initial_budget_yen": row.get("initial_buy_budget_yen", ""),
                "initial_buy_yen": row.get("initial_buy_yen", ""),
                "audit_note": "配分は利益保証ではなく、同一ルールで候補間の相対配分を出すための計算。未確認銘柄は扱い別係数と上限で小さくする。",
            }
        )
    return out


def build_universe_rules(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    total = len(rows)
    price_count = sum(1 for r in rows if r.get("price") != "")
    pass_count = sum(1 for r in rows if r.get("financial_status") == "pass")
    portfolio_count = len(portfolio)
    return [
        {
            "step": "1",
            "stage": "母集団ソース",
            "rule": "100社前後の再選定CSVを読み込み、全銘柄を同じ列で評価する。",
            "current_implementation": f"{UNIVERSE_CSV.name} から {total}社を読み込み。",
            "used_for_score": "YES",
            "hard_gate": "母集団外の銘柄はこのシステムのランキング対象外。",
            "remaining_gap": "母集団を作った元の検索条件の履歴はさらに固定化が必要。",
        },
        {
            "step": "2",
            "stage": "一次数値条件",
            "rule": "5年CAGR、10年CAGR、直近1年、60日、S&P差、最大下落率を同じ式で評価する。",
            "current_implementation": "growth_score、momentum_score、benchmark_score、risk_scoreとして実装。",
            "used_for_score": "YES",
            "hard_gate": "価格データがない銘柄は配分対象外。",
            "remaining_gap": "出来高倍率、時価総額、流動性条件は全社統一では未完成。",
        },
        {
            "step": "3",
            "stage": "財務条件",
            "rule": "PER/PBR/ROE、売上成長、利益成長、EPS、営業利益率、FCF、自己資本を確認する。",
            "current_implementation": f"公式pass {pass_count}社。partial/補助は信頼度とゲートで分離。",
            "used_for_score": "YES。ただし補助値は購入確定ではなく条件付き扱い。",
            "hard_gate": "公式財務passでない銘柄は初回買付候補にしない。",
            "remaining_gap": "FCF、自己資本、営業利益率の全社公式入力が未完成。",
        },
        {
            "step": "4",
            "stage": "質的テーマ条件",
            "rule": "AI、半導体、電力、防衛、金利、資源、政策、新商品、業界シェア、構造優位を仮説層と実績層に分ける。",
            "current_implementation": "チャンネル質的、探索スコア、テーマ証拠台帳に接続。",
            "used_for_score": "YES。ただし未検証ニュースは補助扱い。",
            "hard_gate": "仮説層だけでは買付確定にしない。",
            "remaining_gap": "ニュース本文、公式資料、過去反応の長期DBが未完成。",
        },
        {
            "step": "5",
            "stage": "イベント条件",
            "rule": "決算、上方修正、TOB、新製品、政策、金利、為替、商品市況後の反応を見る。",
            "current_implementation": "決算後反応、6月イベント、イベント反応検証CSVを接続。",
            "used_for_score": "YES",
            "hard_gate": "イベント未接続または悪化は、追加停止・確認後候補へ落とす。",
            "remaining_gap": "TOB、新製品、政策、商品市況の長期履歴は未完成。",
        },
        {
            "step": "6",
            "stage": "購入候補化",
            "rule": "スコア上位をそのまま買わず、価格・公式財務・イベント・質的根拠・NISA口座を通す。",
            "current_implementation": f"価格あり {price_count}/{total}社。配分候補 {portfolio_count}社。購入レディネスゲートで分離。",
            "used_for_score": "YES",
            "hard_gate": "NISA/口座/本人操作が未確認なら買付しない。",
            "remaining_gap": "当日証券会社画面との自動連動は未実装。",
        },
        {
            "step": "7",
            "stage": "ポートフォリオ化",
            "rule": "10社を無理に埋めず、相関、業種偏り、最大下落、1銘柄上限、現金比率で配分する。",
            "current_implementation": f"現在は {portfolio_count}社配分。株式85%、現金15%。",
            "used_for_score": "YES",
            "hard_gate": "条件を満たす銘柄が不足する場合、10社に水増ししない。",
            "remaining_gap": "全社日次相関と出来高リスクの継続取得が必要。",
        },
    ]


def build_universe_audit(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    portfolio_tickers = {str(r.get("ticker", "")) for r in portfolio}
    out: list[dict[str, object]] = []
    for idx, row in enumerate(rows, start=1):
        ticker = str(row.get("ticker", ""))
        price_ready = row.get("price") != ""
        financial_status = str(row.get("financial_status", ""))
        official_financial = financial_status == "pass"
        qualitative_ready = "質的データ未接続" not in str(row.get("qualitative_note", ""))
        event_ready = "イベント未接続" not in str(row.get("event_note", ""))
        in_portfolio = ticker in portfolio_tickers
        action = str(row.get("action", ""))
        if official_financial and price_ready and event_ready and qualitative_ready and action == "購入候補":
            audit_status = "初回買付候補"
        elif in_portfolio:
            audit_status = "条件付き配分候補"
        elif action in ["監視", "買付不可"]:
            audit_status = "監視/除外"
        else:
            audit_status = "候補外"
        missing = []
        if not price_ready:
            missing.append("価格")
        if not official_financial:
            missing.append("公式財務")
        if not event_ready:
            missing.append("イベント")
        if not qualitative_ready:
            missing.append("質的根拠")
        out.append(
            {
                "audit_rank": idx,
                "ticker": ticker,
                "name": row.get("name", ""),
                "sector": row.get("sector", ""),
                "universe_status": row.get("universe_status", ""),
                "reselect_score": row.get("reselect_score", ""),
                "final_score": row.get("final_score", ""),
                "action": action,
                "audit_status": audit_status,
                "in_portfolio": "YES" if in_portfolio else "NO",
                "price_ready": "YES" if price_ready else "NO",
                "official_financial_ready": "YES" if official_financial else "NO",
                "event_ready": "YES" if event_ready else "NO",
                "qualitative_ready": "YES" if qualitative_ready else "NO",
                "missing_gate": " / ".join(missing) if missing else "なし",
                "reason": row.get("gate_notes", "") or row.get("missing_items", "") or "主要ゲート上は大きな停止理由なし",
                "next_action": "初回小口候補" if audit_status == "初回買付候補" else "不足確認後に再判定" if in_portfolio else "監視または候補外",
            }
        )
    return out


def build_expected_value_audit(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    portfolio_tickers = {str(r.get("ticker", "")) for r in portfolio}
    out: list[dict[str, object]] = []
    for idx, row in enumerate(rows, start=1):
        pu = to_float(row.get("up_probability"))
        pd = round(100.0 - pu, 1) if pu else ""
        upside = to_float(row.get("upside_pct"))
        downside = to_float(row.get("downside_pct"))
        cost = 0.4
        ev = to_float(row.get("expected_value_pct"))
        status = "配分対象" if str(row.get("ticker", "")) in portfolio_tickers else "非配分"
        if str(row.get("action", "")) in ["雋ｷ莉倅ｸ榊庄", "買付不可"]:
            status = "除外"
        out.append(
            {
                "rank": idx,
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "portfolio_status": status,
                "expected_value_pct": round(ev, 2),
                "up_probability_pct": pu,
                "upside_pct": upside,
                "down_probability_pct": pd,
                "downside_pct": downside,
                "cost_pct": cost,
                "formula": "EV = 上昇確率×上昇幅 - 下落確率×下落幅 - コスト",
                "inputs": f"5年CAGR {row.get('cagr5','')} / 10年CAGR {row.get('cagr10','')} / 直近1年 {row.get('one_year','')} / 最大下落 {row.get('max_dd1','')}",
                "calculation_note": "相対比較用の仮説値。利益予測の確約ではなく、候補間の優先順位と買付比率の検討に使う。",
                "data_gate": "公式財務・価格・イベント・質的根拠が不足する場合は、EVが高くても買付候補にしない。",
            }
        )
    return out


def build_score_trace(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for idx, row in enumerate(rows, start=1):
        pre_score = to_float(row.get("pre_score"))
        ev_score = to_float(row.get("ev_score"))
        final_score = to_float(row.get("final_score"))
        implied_penalty = round(max(0.0, 0.86 * pre_score + 0.14 * ev_score - final_score), 1)
        out.append(
            {
                "rank": idx,
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "action": row.get("action", ""),
                "final_score": row.get("final_score", ""),
                "pre_score": row.get("pre_score", ""),
                "quant_score": row.get("quant_score", ""),
                "financial_score": row.get("financial_score", ""),
                "qualitative_score": row.get("qualitative_score", ""),
                "event_score": row.get("event_score", ""),
                "benchmark_score": row.get("benchmark_score", ""),
                "risk_score": row.get("risk_score", ""),
                "reliability": row.get("reliability", ""),
                "ev_score": row.get("ev_score", ""),
                "implied_gate_penalty": implied_penalty,
                "pre_score_formula": "事前スコア = 量的31% + 財務17% + 質的15% + イベント14% + 指数10% + リスク8% + 信頼度5%",
                "final_score_formula": "総合点 = 事前スコア86% + EVスコア14% - ゲート減点",
                "gate_notes": row.get("gate_notes", ""),
                "missing_items": row.get("missing_items", ""),
                "data_sources": row.get("data_sources", ""),
                "audit_note": "点数は候補比較用。ゲート減点や未確認項目がある場合、総合点が高くても買付対象とは限らない。",
            }
        )
    return out


def build_action_cockpit(
    portfolio: list[dict[str, object]],
    execution: list[dict[str, object]],
    missing: list[dict[str, object]],
    benchmark_allocation_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    first = [r for r in execution if r.get("execution_status") == "初回候補"]
    small = [r for r in execution if r.get("execution_status") == "小口候補"]
    immediate = first + small
    conditional = [r for r in execution if r.get("execution_status") == "確認後候補"]
    first_names = " / ".join(f"{r.get('ticker')} {r.get('name')}" for r in first) or "該当なし"
    small_names = " / ".join(f"{r.get('ticker')} {r.get('name')}" for r in small) or "該当なし"
    conditional_names = " / ".join(f"{r.get('ticker')} {r.get('name')}" for r in conditional) or "該当なし"
    first_total = sum(float(r.get("initial_buy_yen") or 0) for r in first)
    small_total = sum(float(r.get("initial_buy_yen") or 0) for r in small)
    immediate_total = first_total + small_total
    conditional_total = sum(float(r.get("initial_buy_yen") or 0) for r in conditional)
    reserve_total = max(INITIAL_BUY_CAP_YEN - immediate_total - conditional_total, 0)
    portfolio_ev = weighted_portfolio_value(portfolio, "expected_value_pct")
    portfolio_reliability = weighted_portfolio_value(portfolio, "reliability")
    missing_count = sum(1 for r in missing if str(r.get("missing_items", "")).strip())
    top_missing = " / ".join(
        f"{r.get('ticker')}:{r.get('missing_items')}" for r in missing[:5] if r.get("missing_items")
    ) or "主要不足なし"
    allocation_rule = next(
        (
            f"{r.get('stock_allocation_pct')} / {r.get('action')}"
            for r in benchmark_allocation_rows
            if str(r.get("case", "")).startswith("標準")
        ),
        "指数見通し入力後に分岐",
    )
    return [
        {
            "block": "本日の扱い",
            "current_status": f"中心初回 {len(first)}社、小口 {len(small)}社、確認後 {len(conditional)}社。10社を無理に埋めず、条件を通った分だけ使う。",
            "action": "本人NISA、買付余力、注文口座区分、当日市場を確認してから小口で実行。",
            "stop_or_next": "NISA区分・本人操作・市場急落・未確認データのどれかが崩れたら停止。",
        },
        {
            "block": "中心初回候補",
            "current_status": f"{first_names} / 上限目安 {yen(first_total)}",
            "action": "寄付き成行を避け、指値目安以下でのみ検討。",
            "stop_or_next": "前日比+3%以上で始まる銘柄は追わず、翌営業日以降に回す。",
        },
        {
            "block": "小口候補",
            "current_status": f"{small_names} / 上限目安 {yen(small_total)}",
            "action": "財務partialまたは確認不足が残るため、初回だけ小さく扱う。",
            "stop_or_next": "不足確認が消えるまで追加しない。違和感があれば監視へ戻す。",
        },
        {
            "block": "確認後候補",
            "current_status": f"{conditional_names} / 予定枠 {yen(conditional_total)}",
            "action": "公式財務、PER/PBR/ROE、イベント反応の不足が消えるまで追加しない。",
            "stop_or_next": "未確認のまま買付表に混ぜない。",
        },
        {
            "block": "現金待機",
            "current_status": f"初回枠の残り目安 {yen(reserve_total)}。全体では現金15%を残す設計。",
            "action": "急落時、確認後候補の再判定、指数優位時の見送りに使う。",
            "stop_or_next": "無理に銘柄数を増やして消化しない。",
        },
        {
            "block": "指数比較",
            "current_status": f"配分EV仮説 {pct(portfolio_ev)}、加重信頼度 {portfolio_reliability:.1f}。標準分岐: {allocation_rule}",
            "action": "S&P500/TOPIXを+1%以上上回る説明が弱い場合は、個別株比率を落とす。",
            "stop_or_next": "指数見通しが個別株EVを上回る場合は、個別株を観察扱いに戻す。",
        },
        {
            "block": "不足データ",
            "current_status": f"不足あり {missing_count}件。上位不足: {top_missing}",
            "action": "不足はスコアへ混ぜず、信頼度・ゲート・確認後候補として分離。",
            "stop_or_next": "不足が購入根拠の中核にある銘柄は初回買付しない。",
        },
        {
            "block": "記録",
            "current_status": "注文ログ、実績入力、D+1/D+5/D+20/1年レビューを用意済み。",
            "action": "買った価格、買わなかった理由、指数との差を必ず残す。",
            "stop_or_next": "記録できない場合は、次回追加買付に進まない。",
        },
    ]


def weighted_portfolio_value(portfolio: list[dict[str, object]], key: str) -> float:
    total_weight = sum(float(r.get("target_weight_pct") or 0) for r in portfolio) or 1.0
    return sum(float(r.get(key) or 0) * float(r.get("target_weight_pct") or 0) for r in portfolio) / total_weight


def scenario_row(name: str, pct_value: float, basis: str, action: str) -> dict[str, object]:
    stock_capital = CAPITAL_YEN * (TARGET_STOCK_EXPOSURE_PCT / 100)
    full_profit = stock_capital * pct_value / 100
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


def load_weekly_returns() -> dict[str, list[tuple[str, float]]]:
    prices: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for row in read_csv(WEEKLY_PRICE_CSV):
        ticker = row.get("ticker", "").strip()
        week_end = row.get("week_end", "").strip()
        close = to_float(row.get("close"), 0.0)
        if ticker and week_end and close:
            prices[ticker].append((week_end, close))

    returns: dict[str, list[tuple[str, float]]] = {}
    for ticker, points in prices.items():
        points = sorted(points, key=lambda x: x[0])
        ticker_returns: list[tuple[str, float]] = []
        for (prev_date, prev_close), (date, close) in zip(points, points[1:]):
            if prev_close:
                ticker_returns.append((date, (close / prev_close - 1.0) * 100.0))
        if ticker_returns:
            returns[ticker] = ticker_returns
    return returns


def pearson_from_returns(a: list[tuple[str, float]], b: list[tuple[str, float]]) -> tuple[float | None, int]:
    a_map = {date: value for date, value in a}
    b_map = {date: value for date, value in b}
    dates = sorted(set(a_map) & set(b_map))
    if len(dates) < 8:
        return None, len(dates)
    xs = [a_map[d] for d in dates]
    ys = [b_map[d] for d in dates]
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return None, len(dates)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return cov / math.sqrt(vx * vy), len(dates)


def proxy_correlation(a: dict[str, object], b: dict[str, object]) -> tuple[float, str]:
    sector_a = str(a.get("sector", ""))
    sector_b = str(b.get("sector", ""))
    name_a = str(a.get("name", ""))
    name_b = str(b.get("name", ""))
    text = f"{sector_a} {sector_b} {name_a} {name_b}"
    if sector_a and sector_a == sector_b:
        return 0.78, "業種proxy: 同業のため高めに仮置き"
    if any(x in text for x in ["金融", "銀行", "保険"]) and any(x in text for x in ["金融", "銀行", "保険"]):
        return 0.62, "業種proxy: 金利・信用サイクル連動"
    if any(x in text for x in ["半導体", "電機", "電子", "AI", "データセンター"]):
        return 0.58, "テーマproxy: AI・半導体・電力周辺の同時連動"
    if any(x in text for x in ["商社", "資源", "エネルギー"]):
        return 0.56, "業種proxy: 資源・景気・為替連動"
    return 0.35, "保守proxy: 実リターン相関未取得"


def build_correlation_risk(portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    weekly_returns = load_weekly_returns()
    rows: list[dict[str, object]] = []
    for i, a in enumerate(portfolio):
        for b in portfolio[i + 1:]:
            ticker_a = str(a.get("ticker", ""))
            ticker_b = str(b.get("ticker", ""))
            corr_value: float | None = None
            method = ""
            observations = 0
            if ticker_a in weekly_returns and ticker_b in weekly_returns:
                corr_value, observations = pearson_from_returns(weekly_returns[ticker_a], weekly_returns[ticker_b])
                if corr_value is not None:
                    method = f"実測: 週次リターン{observations}本"
            if corr_value is None:
                corr_value, method = proxy_correlation(a, b)
                observations = 0
            if corr_value >= 0.75:
                risk = "高: 同時下落時は片方または両方を減額候補"
            elif corr_value >= 0.55:
                risk = "中: 同テーマ・同業の連動を監視"
            else:
                risk = "低〜中: 分散効果を期待。ただし市場急落時は連動"
            rows.append(
                {
                    "ticker_a": ticker_a,
                    "name_a": a.get("name", ""),
                    "sector_a": a.get("sector", ""),
                    "ticker_b": ticker_b,
                    "name_b": b.get("name", ""),
                    "sector_b": b.get("sector", ""),
                    "correlation_value": round(corr_value, 2),
                    "method": method,
                    "observations": observations,
                    "risk_comment": risk,
                }
            )
    return rows


def build_constraints(
    rows: list[dict[str, object]],
    portfolio: list[dict[str, object]],
    correlation_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    sector_counts: dict[str, int] = defaultdict(int)
    for row in portfolio:
        sector_counts[str(row.get("sector", ""))] += 1
    max_sector = max(sector_counts.values(), default=0)
    max_sleeve = max((float(r.get("stock_sleeve_weight_pct") or r.get("target_weight_pct") or 0) for r in portfolio), default=0.0)
    max_total = max((float(r.get("target_weight_pct") or 0) for r in portfolio), default=0.0)
    initial_total = sum(float(r.get("initial_buy_yen") or 0) for r in portfolio)
    stock_total = sum(float(r.get("target_full_amount_yen") or 0) for r in portfolio)
    cash_total = CAPITAL_YEN - stock_total
    max_corr = max((float(r.get("correlation_value") or 0) for r in correlation_rows), default=0.0)
    dd1 = abs(weighted_portfolio_value(portfolio, "max_dd1"))
    dd5 = abs(weighted_portfolio_value(portfolio, "max_dd5"))

    return [
        {
            "check_item": "母集団",
            "rule": "業績成長・流動性・時価総額・テーマ適合で100社前後を作る",
            "current_value": f"{len(rows)}社",
            "status": "OK" if len(rows) >= 80 else "要補強",
            "action": "母集団CSVを固定し、追加・除外条件を記録する",
        },
        {
            "check_item": "候補数",
            "rule": "購入候補は無理に10社へ埋めず、条件通過銘柄だけ採用",
            "current_value": f"{len(portfolio)}社",
            "status": "OK" if 6 <= len(portfolio) <= 10 else "要確認",
            "action": "10社に満たない場合は現金待機または指数へ戻す",
        },
        {
            "check_item": "1銘柄比率",
            "rule": f"株式枠内で1銘柄最大{MAX_SINGLE_STOCK_SLEEVE_PCT:.0f}%、総資金ではその85%まで",
            "current_value": f"株式枠最大{max_sleeve:.1f}% / 総資金最大{max_total:.1f}%",
            "status": "OK" if max_sleeve <= MAX_SINGLE_STOCK_SLEEVE_PCT + 0.1 else "減額",
            "action": "上限超過時は次点候補または現金へ配分",
        },
        {
            "check_item": "現金比率",
            "rule": f"初期設計では株式{TARGET_STOCK_EXPOSURE_PCT:.0f}%、現金{CASH_RESERVE_PCT:.0f}%を残す",
            "current_value": f"株式{yen(stock_total)} / 現金{yen(cash_total)}",
            "status": "OK" if cash_total >= CAPITAL_YEN * 0.10 else "現金不足",
            "action": "6月イベント後も不安定なら現金比率を引き上げる",
        },
        {
            "check_item": "業種偏り",
            "rule": f"同一業種は原則{MAX_SECTOR_COUNT}社まで",
            "current_value": f"最大{max_sector}社",
            "status": "OK" if max_sector <= MAX_SECTOR_COUNT else "偏り",
            "action": "同業集中時は相関と下落率を見て片方を減額",
        },
        {
            "check_item": "相関・集中",
            "rule": "高相関の組み合わせは同時下落リスクとして扱う",
            "current_value": f"最大相関/proxy {max_corr:.2f}",
            "status": "注意" if max_corr >= 0.75 else "OK",
            "action": "高相関ペアは両方を同時に増額しない",
        },
        {
            "check_item": "最大下落",
            "rule": "過去の最大下落をストレスとして買付額に反映",
            "current_value": f"1年加重{dd1:.1f}% / 5年加重{dd5:.1f}%",
            "status": "注意" if dd1 >= 20 or dd5 >= 35 else "OK",
            "action": "急落時は追加停止、理由確認後に再判定",
        },
        {
            "check_item": "初回買付枠",
            "rule": f"初回は最大{yen(INITIAL_BUY_CAP_YEN)}まで",
            "current_value": f"予定{yen(initial_total)}",
            "status": "OK" if initial_total <= INITIAL_BUY_CAP_YEN + 1 else "超過",
            "action": "超過時は指値優先順位で後順位を削る",
        },
    ]


def build_architecture_audit(
    rows: list[dict[str, object]],
    portfolio: list[dict[str, object]],
    correlation_rows: list[dict[str, object]],
    constraint_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    return [
        {
            "layer": "1. 候補母集団",
            "status": "実装済み",
            "data_used": "100社前後の再選定CSV、株価、テーマ候補、財務補完候補",
            "formula_or_rule": "業績成長、流動性、時価総額、テーマ適合、除外条件で母集団化",
            "output_file": OUT_SCORE.name,
            "remaining_gap": "母集団の入替履歴と除外理由はさらに固定化する余地あり",
        },
        {
            "layer": "2. 量的スコア",
            "status": "実装済み",
            "data_used": "CAGR、直近騰落、S&P差、最大下落、PER/PBR/ROE等",
            "formula_or_rule": "成長、勢い、指数比較、下落耐性、財務を0〜100点化",
            "output_file": OUT_SCORE.name,
            "remaining_gap": "PER/PBRは株価基準日と公式EPS/BPSの整合確認が必要",
        },
        {
            "layer": "3. 質的スコア",
            "status": "部分実装",
            "data_used": "半導体、AIインフラ、電力、防衛、金利、資源、政策、構造優位",
            "formula_or_rule": "公式資料・ニュース・過去反応の有無で信頼度を分け、未検証は買付確定に使わない",
            "output_file": OUT_SCORE.name,
            "remaining_gap": "個別ニュース本文の定期取得と過去イベント反応DBは追加余地あり",
        },
        {
            "layer": "4. イベント検証",
            "status": "部分実装",
            "data_used": "決算後反応、6月イベント、イベント反応検証CSV",
            "formula_or_rule": "イベント後の指数超過、個別反応、未接続イベントを分ける",
            "output_file": OUT_SCORE.name,
            "remaining_gap": "TOB、新製品、政策、商品市況などの長期イベント履歴は未完成",
        },
        {
            "layer": "5. 期待値",
            "status": "実装済み",
            "data_used": "上昇確率、上昇幅、下落確率、下落幅、コスト",
            "formula_or_rule": "期待値 = 上昇確率 × 上昇幅 - 下落確率 × 下落幅 - コスト",
            "output_file": OUT_RISK.name,
            "remaining_gap": "確率は検証用仮説であり、勝率保証ではない",
        },
        {
            "layer": "6. ポートフォリオ最適化",
            "status": "実装済み",
            "data_used": "最終スコア、期待値、業種、相関/proxy、現金比率",
            "formula_or_rule": "株式85%・現金15%、1銘柄上限、業種上限、相関警告で配分",
            "output_file": f"{OUT_PORTFOLIO.name} / {OUT_CONSTRAINTS.name}",
            "remaining_gap": "相関は一部実測、一部proxy。完全な日次相関DBは追加余地あり",
        },
        {
            "layer": "7. 買わない・減額条件",
            "status": "実装済み",
            "data_used": "市場急落、指数劣後、テーマ崩れ、決算失望、円高、金利急騰、出来高急増下落",
            "formula_or_rule": "初回停止、追加停止、減額、現金待機を実行計画・売買ルールへ接続",
            "output_file": f"{OUT_EXECUTION.name} / {OUT_TRADE_RULES.name}",
            "remaining_gap": "当日の実売買ログ入力後に、ルールの効き方を検証する",
        },
    ]


def qualitative_rating(row: dict[str, object], has_observed: bool) -> tuple[str, str]:
    q = float(row.get("qualitative_score") or 0)
    e = float(row.get("event_score") or 0)
    reliability = float(row.get("reliability") or 0)
    if q >= 70 and e >= 55 and reliability >= 80 and has_observed:
        return "A", "補助根拠として使用可。単独では買付決定に使わない"
    if q >= 65 and has_observed:
        return "B", "比較・監視根拠として使用。量的スコアの裏付けが必要"
    if q >= 60:
        return "C", "仮説層。過去反応または公式数値が不足"
    return "C", "質的根拠は弱い。購入候補の根拠にしない"


def build_theme_evidence(rows: list[dict[str, object]], portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    score_map = {str(r.get("ticker", "")): r for r in rows}
    qual_by_ticker: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in read_csv(QUAL_CSV):
        qual_by_ticker[r.get("ticker", "")].append(r)
    explore = by_ticker(QUAL_EXPLORE_CSV)
    validation = by_ticker(EVENT_VALIDATION_CSV)
    event = by_ticker(EVENT_CSV)
    target_tickers = [str(r.get("ticker", "")) for r in portfolio]
    top_tickers = [str(r.get("ticker", "")) for r in rows[:10]]
    for ticker in top_tickers:
        if ticker not in target_tickers:
            target_tickers.append(ticker)

    out: list[dict[str, object]] = []
    for idx, ticker in enumerate(target_tickers, start=1):
        base = score_map.get(ticker, {})
        qrows = qual_by_ticker.get(ticker, [])
        exp = explore.get(ticker)
        val = validation.get(ticker)
        ev = event.get(ticker)
        has_observed = bool(val or ev)
        rating, usage = qualitative_rating(base, has_observed)
        observed_parts = []
        if val:
            observed_parts.append(
                f"過去イベント{val.get('event_count_calculated','')}件、5日超過{val.get('avg_excess_5d_pct','')}%、20日超過{val.get('avg_excess_20d_pct','')}%、強{val.get('strong_event_count','')}件/弱{val.get('weak_event_count','')}件"
            )
        if ev:
            observed_parts.append(
                f"6月イベント後: {ev.get('market_signal','')} / {ev.get('one_day_change_pct','')} / {ev.get('event_status','')}"
            )
        observed_layer = " / ".join(observed_parts) if observed_parts else "未接続。点数ではなく監視メモ扱い"

        if qrows:
            for q in qrows:
                out.append(
                    {
                        "rank": idx,
                        "ticker": ticker,
                        "name": base.get("name", q.get("name", "")),
                        "theme_or_channel": q.get("channel", ""),
                        "rating": rating,
                        "qualitative_score": base.get("qualitative_score", ""),
                        "event_score": base.get("event_score", ""),
                        "hypothesis_layer": q.get("basis", ""),
                        "observed_layer": observed_layer,
                        "evidence_source": "チャンネル比較CSV / 6月イベント / 過去イベント反応",
                        "score_usage": usage,
                        "risks": q.get("risk", ""),
                        "next_check": q.get("nextCheck", ""),
                    }
                )
        elif exp:
            out.append(
                {
                    "rank": idx,
                    "ticker": ticker,
                    "name": base.get("name", exp.get("company", "")),
                    "theme_or_channel": exp.get("theme_name", ""),
                    "rating": rating,
                    "qualitative_score": base.get("qualitative_score", exp.get("qualitative_score", "")),
                    "event_score": base.get("event_score", ""),
                    "hypothesis_layer": f"材料強度{exp.get('material_strength','')} / 資金流入連鎖{exp.get('capital_chain_score','')} / 企業適合{exp.get('company_fit','')}",
                    "observed_layer": observed_layer,
                    "evidence_source": "質的探索CSV / 6月イベント / 過去イベント反応",
                    "score_usage": usage,
                    "risks": exp.get("next_gate", ""),
                    "next_check": exp.get("purchase_score_status", ""),
                }
            )
        else:
            out.append(
                {
                    "rank": idx,
                    "ticker": ticker,
                    "name": base.get("name", ""),
                    "theme_or_channel": base.get("sector", ""),
                    "rating": rating,
                    "qualitative_score": base.get("qualitative_score", ""),
                    "event_score": base.get("event_score", ""),
                    "hypothesis_layer": base.get("qualitative_note", "未接続"),
                    "observed_layer": observed_layer,
                    "evidence_source": "スコア表の質的メモのみ",
                    "score_usage": usage,
                    "risks": "ニュース本文・公式資料・過去反応の接続が不足",
                    "next_check": "購入根拠に使う前に公式資料またはイベント反応を追加",
                }
            )
    return out


def build_no_buy_reduce_gate(
    portfolio: list[dict[str, object]],
    correlation_rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    high_corr_pairs = [
        f"{r.get('name_a')}×{r.get('name_b')}"
        for r in correlation_rows
        if float(r.get("correlation_value") or 0) >= 0.75
    ]
    semi_names = " / ".join(str(r.get("name")) for r in portfolio if any(x in str(r.get("sector", "")) + str(r.get("qualitative_note", "")) for x in ["半導体", "AI", "電機", "フィジカル"]))
    all_names = " / ".join(str(r.get("name")) for r in portfolio)
    return [
        {
            "gate": "市場急落",
            "condition": "日経平均またはTOPIXが当日-2%以上、または先物が大きく下落",
            "affected": all_names,
            "action": "当日の新規買付を停止。買わなかった理由を記録",
            "status_now": "当日確認",
            "evidence_needed": "指数、先物、主要ニュース",
        },
        {
            "gate": "指数劣後",
            "condition": "保有後5営業日連続でTOPIXまたは日経平均に劣後",
            "affected": all_names,
            "action": "追加買付を停止。次回買付額を半分以下にする",
            "status_now": "運用後に判定",
            "evidence_needed": "約定後の銘柄リターン、TOPIX/日経平均リターン",
        },
        {
            "gate": "テーマ崩れ",
            "condition": "AI、半導体、電力、防衛、金利などの前提と逆方向の公式情報が出る",
            "affected": all_names,
            "action": "該当テーマ銘柄を監視へ戻し、未購入分は現金待機",
            "status_now": "要ニュース確認",
            "evidence_needed": "企業IR、政策発表、業界統計、主要ニュース",
        },
        {
            "gate": "決算失望",
            "condition": "会社予想下方修正、受注鈍化、営業利益率悪化、決算後5日で指数に-3%以上劣後",
            "affected": all_names,
            "action": "その銘柄の追加停止。既保有は半分以下への減額を検討",
            "status_now": "決算到来時に判定",
            "evidence_needed": "決算短信、説明資料、決算後1/5/20営業日リターン",
        },
        {
            "gate": "円高ショック",
            "condition": "ドル円が短時間で大きく円高、または輸出・海外売上比率が高い銘柄が一斉安",
            "affected": semi_names or all_names,
            "action": "輸出・半導体・電子部品の追加買付を停止",
            "status_now": "当日確認",
            "evidence_needed": "ドル円、セクター別反応、各社海外売上比率",
        },
        {
            "gate": "金利急騰",
            "condition": "米10年金利が急騰し、高PER・半導体・グロースが同時に弱い",
            "affected": semi_names or all_names,
            "action": "高PER・高ボラ銘柄を小口または見送りへ落とす",
            "status_now": "当日確認",
            "evidence_needed": "米10年金利、SOX、NASDAQ、PER",
        },
        {
            "gate": "出来高急増下落",
            "condition": "出来高が20日平均の1.8倍以上で、株価が-3%以上下落",
            "affected": all_names,
            "action": "その銘柄の平均取得単価を下げる買いはしない。理由確認まで停止",
            "status_now": "運用後に判定",
            "evidence_needed": "出来高、20日平均出来高、当日株価変化",
        },
        {
            "gate": "高相関集中",
            "condition": "相関またはproxyが0.75以上の組み合わせを同時に増額しようとしている",
            "affected": " / ".join(high_corr_pairs[:8]) if high_corr_pairs else "該当なし",
            "action": "片方を現金待機または低相関候補へ振替。両方同時の追加はしない",
            "status_now": "注意" if high_corr_pairs else "OK",
            "evidence_needed": "相関リスクCSV、業種・テーマ集中",
        },
        {
            "gate": "NISA・口座未確認",
            "condition": "NISA口座区分、本人操作、買付余力、注文パスワードが未確認",
            "affected": all_names,
            "action": "実注文しない。システム上の候補と実売買を分ける",
            "status_now": "注文前確認",
            "evidence_needed": "証券会社画面、本人スマホ、本人ログイン、買付余力",
        },
    ]


def build_benchmark_allocation_gate(portfolio: list[dict[str, object]]) -> list[dict[str, object]]:
    portfolio_ev = weighted_portfolio_value(portfolio, "expected_value_pct")
    plus1_limit = portfolio_ev - TARGET_EXCESS_PCT
    plus5_limit = portfolio_ev - STRONG_EXCESS_PCT
    current_stock_yen = sum(float(r.get("target_full_amount_yen") or 0) for r in portfolio)
    current_stock_pct = current_stock_yen / CAPITAL_YEN * 100 if CAPITAL_YEN else 0
    current_cash_yen = CAPITAL_YEN - current_stock_yen
    rows = [
        {
            "case": "強気個別株",
            "benchmark_outlook_condition": f"S&P500/TOPIXの1年見通しが{plus5_limit:.1f}%以下",
            "stock_allocation_pct": 85,
            "index_or_cash_pct": 15,
            "initial_buy_cap_yen": yen(INITIAL_BUY_CAP_YEN),
            "action": "現行の最大株式枠まで検討。ただし初回は小口で開始",
            "reason": "個別株EV仮説が指数を+5%以上上回る説明が成立するため",
        },
        {
            "case": "+1%目標は説明可能",
            "benchmark_outlook_condition": f"指数見通しが{plus5_limit:.1f}%超〜{plus1_limit:.1f}%以下",
            "stock_allocation_pct": 70,
            "index_or_cash_pct": 30,
            "initial_buy_cap_yen": yen(INITIAL_BUY_CAP_YEN * 0.8),
            "action": "個別株テストは継続。ただし確認後候補を急いで増やさない",
            "reason": "+1%目標は説明できるが、強気配分にするほどの差ではないため",
        },
        {
            "case": "優位が薄い",
            "benchmark_outlook_condition": f"指数見通しが{plus1_limit:.1f}%超〜{portfolio_ev:.1f}%未満",
            "stock_allocation_pct": 50,
            "index_or_cash_pct": 50,
            "initial_buy_cap_yen": yen(INITIAL_BUY_CAP_YEN * 0.5),
            "action": "初回候補だけ検証。残りは現金または指数候補へ待機",
            "reason": "個別株を選ぶ説明は残るが、手間とリスクに対する上乗せが薄いため",
        },
        {
            "case": "個別株優位なし",
            "benchmark_outlook_condition": f"指数見通しが{portfolio_ev:.1f}%以上",
            "stock_allocation_pct": 15,
            "index_or_cash_pct": 85,
            "initial_buy_cap_yen": yen(INITIAL_BUY_CAP_YEN * 0.25),
            "action": "個別株は観察のみ。実買付は原則見送り",
            "reason": "指数と同等以下なら、個別株を選ぶ合理性が弱いため",
        },
        {
            "case": "当日市場急落",
            "benchmark_outlook_condition": "日経平均/TOPIXが当日-2%以上、または米金利・為替が急変",
            "stock_allocation_pct": 0,
            "index_or_cash_pct": 100,
            "initial_buy_cap_yen": yen(0),
            "action": "当日の新規買付を停止。翌営業日以降に再判定",
            "reason": "個別要因ではなく市場全体の売りに巻き込まれるため",
        },
        {
            "case": "保有後に指数劣後",
            "benchmark_outlook_condition": "保有後5営業日連続でTOPIX/日経平均に劣後",
            "stock_allocation_pct": "次回予定の50%以下",
            "index_or_cash_pct": "減額分を現金または指数へ",
            "initial_buy_cap_yen": "次回分を半減",
            "action": "追加買付を停止し、劣後理由を記録",
            "reason": "期待値仮説が実績で崩れ始めた可能性があるため",
        },
        {
            "case": "現行設定",
            "benchmark_outlook_condition": "指数見通し未入力。現時点は検証用の上限設定",
            "stock_allocation_pct": round(current_stock_pct, 1),
            "index_or_cash_pct": round(100 - current_stock_pct, 1),
            "initial_buy_cap_yen": yen(INITIAL_BUY_CAP_YEN),
            "action": f"株式{yen(current_stock_yen)}、現金{yen(current_cash_yen)}を上限として表示",
            "reason": "指数見通し入力前なので、買付確定ではなく上限計画として扱う",
        },
    ]
    return rows


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


def order_ticket_cards(rows: list[dict[str, object]]) -> str:
    cards: list[str] = []
    for row in rows:
        if str(row.get("order_rank", "")).upper() == "STOP":
            continue
        if to_float(row.get("max_today_yen"), 0) <= 0:
            continue
        ticker = esc(row.get("ticker", ""))
        name = esc(row.get("name", ""))
        bucket = esc(row.get("order_bucket", ""))
        max_yen = yen(to_float(row.get("max_today_yen"), 0))
        shares = esc(row.get("planned_shares", ""))
        limit_price = esc(row.get("limit_price_yen", ""))
        no_chase = esc(row.get("do_not_chase_price_yen", ""))
        stop_line = esc(row.get("temporary_stop_line_yen", ""))
        cards.append(
            f"""
      <div class="order-card">
        <div class="order-head"><b>{ticker}</b><span>{name}</span></div>
        <p class="order-bucket">{bucket}</p>
        <div class="order-metrics">
          <div><b>{max_yen}</b><span>本日上限</span></div>
          <div><b>{shares}株</b><span>予定株数</span></div>
          <div><b>{limit_price}円</b><span>指値目安</span></div>
        </div>
        <p class="order-note">追わない: {no_chase}円 / 下値停止: {stop_line}円</p>
      </div>"""
        )
    if not cards:
        return '<p class="note">本日実行対象の注文候補はありません。停止条件または確認後候補を確認してください。</p>'
    return '<div class="order-cards">' + "\n".join(cards) + "\n    </div>"


def action_cockpit_cards(rows: list[dict[str, object]]) -> str:
    cards: list[str] = []
    for row in rows:
        block = esc(row.get("block", ""))
        current_status = esc(row.get("current_status", ""))
        action = esc(row.get("action", ""))
        stop_or_next = esc(row.get("stop_or_next", ""))
        cards.append(
            f"""
      <div class="cockpit-card">
        <b>{block}</b>
        <p class="cockpit-state">{current_status}</p>
        <details class="cockpit-more">
          <summary>実行内容と停止条件を見る</summary>
          <dl>
            <dt>実行すること</dt><dd>{action}</dd>
            <dt>止める条件・次の処理</dt><dd>{stop_or_next}</dd>
          </dl>
        </details>
      </div>"""
        )
    if not cards:
        return '<p class="note">実用コックピットの表示対象がありません。</p>'
    return '<div class="cockpit-cards">' + "\n".join(cards) + "\n    </div>"


def buy_blocker_cards(rows: list[dict[str, object]]) -> str:
    cards: list[str] = []
    for row in rows:
        rank = esc(row.get("rank", ""))
        ticker = esc(row.get("ticker", ""))
        name = esc(row.get("name", ""))
        permission = esc(row.get("permission", ""))
        initial_yen = yen(to_float(row.get("initial_buy_yen"), 0))
        financial_gap = esc(row.get("financial_gap", ""))
        event_gap = esc(row.get("event_gap", ""))
        qualitative_gap = esc(row.get("qualitative_gap", ""))
        critical_blocker = esc(row.get("critical_blocker", ""))
        amount_policy = esc(row.get("amount_policy", ""))
        next_action = esc(row.get("next_action", ""))
        cards.append(
            f"""
      <div class="triage-card">
        <div class="triage-head"><b>{rank}. {ticker}</b><span>{name}</span></div>
        <p class="triage-permission">{permission}</p>
        <div class="triage-metrics">
          <div><b>{initial_yen}</b><span>初回候補額</span></div>
          <div><b>{financial_gap}</b><span>財務確認</span></div>
        </div>
        <p class="triage-gap">{event_gap} / {qualitative_gap}</p>
        <details class="triage-more">
          <summary>停止理由・金額方針・次アクションを見る</summary>
          <dl>
            <dt>全額を止める理由</dt><dd>{critical_blocker}</dd>
            <dt>金額方針</dt><dd>{amount_policy}</dd>
            <dt>次アクション</dt><dd>{next_action}</dd>
          </dl>
        </details>
      </div>"""
        )
    if not cards:
        return '<p class="note">買付不足トリアージの表示対象がありません。</p>'
    return '<div class="triage-cards">' + "\n".join(cards) + "\n    </div>"


def trade_rule_cards(rows: list[dict[str, object]]) -> str:
    cards: list[str] = []
    for row in rows:
        ticker = esc(row.get("ticker", ""))
        name = esc(row.get("name", ""))
        status = esc(row.get("status", ""))
        current_price = esc(row.get("current_price_yen", ""))
        initial_buy = esc(row.get("initial_buy_yen", ""))
        do_not_chase = esc(row.get("do_not_chase", ""))
        profit_rule = esc(row.get("profit_rule", ""))
        stop_rule = esc(row.get("stop_rule", ""))
        buy_rule = esc(row.get("buy_rule", ""))
        add_rule = esc(row.get("add_rule", ""))
        cards.append(
            f"""
      <div class="rule-card">
        <div class="rule-head"><b>{ticker}</b><span>{name}</span></div>
        <p class="rule-status">{status}</p>
        <div class="rule-metrics">
          <div><b>{current_price}</b><span>現在値</span></div>
          <div><b>{initial_buy}</b><span>初回候補額</span></div>
        </div>
        <ul class="rule-list">
          <li><b>追わない:</b> {do_not_chase}</li>
          <li><b>上値:</b> {profit_rule}</li>
          <li><b>下値:</b> {stop_rule}</li>
        </ul>
        <details class="rule-more">
          <summary>買付・追加ルールを見る</summary>
          <dl>
            <dt>買付ルール</dt><dd>{buy_rule}</dd>
            <dt>追加ルール</dt><dd>{add_rule}</dd>
          </dl>
        </details>
      </div>"""
        )
    if not cards:
        return '<p class="note">銘柄別売買ルールの表示対象がありません。</p>'
    return '<div class="rule-cards">' + "\n".join(cards) + "\n    </div>"


def build_html(
    rows: list[dict[str, object]],
    portfolio: list[dict[str, object]],
    missing: list[dict[str, object]],
    execution: list[dict[str, object]],
    risk_scenarios: list[dict[str, object]],
    trade_rules: list[dict[str, object]],
    day_checklist: list[dict[str, object]],
    order_log_template: list[dict[str, object]],
    today_order_ticket_rows: list[dict[str, object]],
    correlation_rows: list[dict[str, object]],
    constraint_rows: list[dict[str, object]],
    architecture_rows: list[dict[str, object]],
    theme_evidence_rows: list[dict[str, object]],
    no_buy_gate_rows: list[dict[str, object]],
    benchmark_allocation_rows: list[dict[str, object]],
    prediction_review_rows: list[dict[str, object]],
    model_revision_rows: list[dict[str, object]],
    review_input_rows: list[dict[str, object]],
    review_result_rows: list[dict[str, object]],
    requirement_matrix_rows: list[dict[str, object]],
    purchase_readiness_rows: list[dict[str, object]],
    universe_rules_rows: list[dict[str, object]],
    universe_audit_rows: list[dict[str, object]],
    expected_value_audit_rows: list[dict[str, object]],
    action_cockpit_rows: list[dict[str, object]],
    structural_gate_rows: list[dict[str, object]],
    buy_blocker_triage_rows: list[dict[str, object]],
    allocation_trace_rows: list[dict[str, object]],
    score_trace_rows: list[dict[str, object]],
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
    score_trace_fields = [
        ("rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("action", "判定"),
        ("final_score", "総合点"),
        ("pre_score", "事前"),
        ("quant_score", "量的"),
        ("financial_score", "財務"),
        ("qualitative_score", "質的"),
        ("event_score", "イベント"),
        ("benchmark_score", "指数"),
        ("risk_score", "リスク"),
        ("reliability", "信頼度"),
        ("ev_score", "EV"),
        ("implied_gate_penalty", "ゲート減点"),
        ("pre_score_formula", "事前式"),
        ("final_score_formula", "総合式"),
        ("gate_notes", "減点理由"),
        ("missing_items", "不足"),
        ("data_sources", "データ源"),
        ("audit_note", "注意"),
    ]
    action_cockpit_fields = [
        ("block", "項目"),
        ("current_status", "現在の状態"),
        ("action", "実行すること"),
        ("stop_or_next", "止める条件・次の処理"),
    ]
    structural_gate_fields = [
        ("layer", "層"),
        ("required_structure", "必要な構造"),
        ("implementation_status", "実装状況"),
        ("current_evidence", "現在の根拠"),
        ("can_use_for_buy_decision", "買付判断への使用"),
        ("buy_decision_usage", "実際の使い方"),
        ("blocking_gap", "残る穴"),
        ("current_system_control", "現在の制御"),
        ("next_hardening_step", "次の強化"),
    ]
    buy_blocker_fields = [
        ("rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("permission", "初回扱い"),
        ("initial_buy_yen", "初回金額"),
        ("financial_gap", "財務確認"),
        ("event_gap", "イベント"),
        ("qualitative_gap", "質的根拠"),
        ("critical_blocker", "全額を止める理由"),
        ("amount_policy", "金額方針"),
        ("next_action", "次アクション"),
    ]
    allocation_trace_fields = [
        ("rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("action", "扱い"),
        ("final_score", "総合点"),
        ("expected_value_pct", "EV%"),
        ("score_component", "点数成分"),
        ("ev_multiplier", "EV倍率"),
        ("action_multiplier", "扱い係数"),
        ("raw_share_before_cap_pct", "上限前比率%"),
        ("cap_pct", "上限%"),
        ("cap_reason", "上限理由"),
        ("stock_sleeve_weight_pct", "株式枠内比率%"),
        ("total_portfolio_weight_pct", "全体比率%"),
        ("target_full_amount_yen", "240万円時"),
        ("initial_budget_yen", "初回予算"),
        ("initial_buy_yen", "初回実行候補"),
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
        ("execution_bucket", "実行枠"),
        ("planned_shares", "予定株数"),
        ("candidate_yen", "候補金額"),
        ("planned_yen", "本日実行額"),
        ("hold_until_confirmed_yen", "確認後保留額"),
        ("limit_price_yen", "指値目安"),
        ("do_not_chase_price_yen", "追わない価格"),
        ("actual_action", "実際の扱い"),
        ("not_bought_reason", "買わなかった理由"),
        ("memo", "メモ"),
    ]
    today_order_ticket_fields = [
        ("order_rank", "順"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("order_bucket", "注文枠"),
        ("max_today_yen", "本日上限"),
        ("planned_shares", "予定株数"),
        ("limit_price_yen", "指値目安"),
        ("do_not_chase_price_yen", "追わない価格"),
        ("temporary_stop_line_yen", "下値停止目安"),
        ("order_method", "注文方法"),
        ("before_order_check", "注文前確認"),
        ("do_not_order_if", "注文しない条件"),
    ]
    architecture_fields = [
        ("layer", "層"),
        ("status", "実装状況"),
        ("data_used", "使用データ"),
        ("formula_or_rule", "数式・ルール"),
        ("output_file", "出力"),
        ("remaining_gap", "残る課題"),
    ]
    requirement_matrix_fields = [
        ("layer", "層"),
        ("requirement", "必要な構造"),
        ("current_status", "現状"),
        ("current_data", "現在使えるデータ"),
        ("score_usage", "点数への使い方"),
        ("purchase_gate", "購入判断での扱い"),
        ("gap", "残る不足"),
        ("next_action", "次アクション"),
    ]
    purchase_readiness_fields = [
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("in_current_portfolio", "現配分"),
        ("final_score", "総合点"),
        ("action", "スコア扱い"),
        ("official_financial_ready", "公式財務"),
        ("price_ready", "価格"),
        ("event_ready", "イベント"),
        ("qualitative_ready", "質的根拠"),
        ("nisa_account_ready", "NISA/口座"),
        ("purchase_readiness", "買付可否"),
        ("hard_stop_reasons", "停止理由"),
        ("next_action", "次アクション"),
    ]
    universe_rule_fields = [
        ("step", "ルール"),
        ("stage", "段階"),
        ("rule", "固定条件"),
        ("current_implementation", "現状の実装"),
        ("used_for_score", "スコア利用"),
        ("hard_gate", "買付ゲート"),
        ("remaining_gap", "残る課題"),
    ]
    universe_audit_fields = [
        ("audit_rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("sector", "業種"),
        ("universe_status", "母集団上の扱い"),
        ("reselect_score", "元スコア"),
        ("final_score", "総合"),
        ("action", "判定"),
        ("audit_status", "監査判定"),
        ("in_portfolio", "配分"),
        ("price_ready", "価格"),
        ("official_financial_ready", "公式財務"),
        ("event_ready", "イベント"),
        ("qualitative_ready", "質的根拠"),
        ("missing_gate", "不足ゲート"),
        ("reason", "理由"),
        ("next_action", "次アクション"),
    ]
    expected_value_audit_fields = [
        ("rank", "順位"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("portfolio_status", "配分扱い"),
        ("expected_value_pct", "EV%"),
        ("up_probability_pct", "上昇確率%"),
        ("upside_pct", "上昇幅%"),
        ("down_probability_pct", "下落確率%"),
        ("downside_pct", "下落幅%"),
        ("cost_pct", "コスト%"),
        ("formula", "式"),
        ("inputs", "入力"),
        ("calculation_note", "注意"),
        ("data_gate", "ゲート"),
    ]
    constraint_fields = [
        ("check_item", "確認項目"),
        ("rule", "制約・ルール"),
        ("current_value", "現在値"),
        ("status", "判定"),
        ("action", "対応"),
    ]
    correlation_fields = [
        ("ticker_a", "銘柄A"),
        ("name_a", "社名A"),
        ("ticker_b", "銘柄B"),
        ("name_b", "社名B"),
        ("correlation_value", "相関"),
        ("method", "計算方法"),
        ("risk_comment", "扱い"),
    ]
    theme_evidence_fields = [
        ("ticker", "銘柄"),
        ("name", "社名"),
        ("theme_or_channel", "テーマ・チャンネル"),
        ("rating", "評価"),
        ("hypothesis_layer", "仮説層"),
        ("observed_layer", "実績層"),
        ("score_usage", "点数への使い方"),
        ("risks", "注意点"),
        ("next_check", "次確認"),
    ]
    no_buy_gate_fields = [
        ("gate", "ゲート"),
        ("condition", "条件"),
        ("affected", "対象"),
        ("action", "実行内容"),
        ("status_now", "現状"),
        ("evidence_needed", "確認データ"),
    ]
    benchmark_allocation_fields = [
        ("case", "ケース"),
        ("benchmark_outlook_condition", "指数側の条件"),
        ("stock_allocation_pct", "個別株比率"),
        ("index_or_cash_pct", "現金・指数比率"),
        ("initial_buy_cap_yen", "初回上限"),
        ("action", "実行"),
        ("reason", "理由"),
    ]
    prediction_review_fields = [
        ("trade_date", "購入日"),
        ("review_point", "確認時点"),
        ("review_date", "確認日"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("planned_status", "予定扱い"),
        ("expected_value_pct", "事前EV%"),
        ("up_probability_pct", "上昇確率%"),
        ("target_weight_pct", "目標比率%"),
        ("initial_buy_yen", "初回金額"),
        ("actual_return_pct", "実績%"),
        ("benchmark_return_pct", "指数%"),
        ("excess_return_pct", "指数差%"),
        ("judgement_rule", "判定ルール"),
        ("model_feedback", "モデル修正先"),
    ]
    model_revision_fields = [
        ("priority", "優先度"),
        ("review_timing", "確認時点"),
        ("trigger", "発動条件"),
        ("check_formula", "確認式"),
        ("score_layer_to_review", "見直す層"),
        ("revision_action", "修正アクション"),
        ("do_not_do", "禁止事項"),
        ("evidence_required", "必要証拠"),
        ("target_rows", "対象"),
    ]
    review_input_fields = [
        ("review_point", "確認時点"),
        ("review_date", "確認日"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("actual_buy_price_yen", "約定価格"),
        ("review_price_yen", "確認日価格"),
        ("actual_return_formula", "実績%の式"),
        ("benchmark_name", "比較指数"),
        ("benchmark_start_level", "指数開始値"),
        ("benchmark_review_level", "指数確認値"),
        ("benchmark_return_formula", "指数%の式"),
        ("excess_return_formula", "指数差の式"),
        ("decision_output", "出力判断"),
    ]
    review_result_fields = [
        ("review_point", "確認時点"),
        ("review_date", "確認日"),
        ("ticker", "銘柄"),
        ("name", "名称"),
        ("actual_return_pct", "実績%"),
        ("benchmark_return_pct", "指数%"),
        ("excess_return_pct", "指数差%"),
        ("decision", "判定"),
        ("action", "次アクション"),
        ("missing_input", "未入力"),
        ("calculation_basis", "計算根拠"),
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
        ("execution_bucket", "実行枠"),
        ("initial_shares", "初回株数"),
        ("initial_buy_yen", "候補金額"),
        ("executable_today_yen", "本日実行額"),
        ("hold_until_confirmed_yen", "確認後保留額"),
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
    .quick-nav{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}}
    .quick-nav a{{display:block;border:1px solid #8db9d8;border-radius:10px;padding:12px;text-decoration:none;background:#fff;color:var(--navy);font-weight:950;text-align:center}}
    .ops-note{{border:2px solid #6aa8ce;background:#f2f9ff;border-radius:10px;padding:12px;font-weight:950;margin-top:12px}}
    .operation-steps{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}}
    .op-card{{border:2px solid #6aa8ce;border-radius:12px;background:#f7fcff;padding:12px;min-height:132px}}
    .op-card b{{display:block;color:var(--navy);font-size:18px;margin-bottom:5px}}
    .op-card span{{display:block;font-weight:850;color:#253f58;font-size:14px}}
    .decision-board{{display:grid;grid-template-columns:1.25fr repeat(3,minmax(0,1fr));gap:12px}}
    .decision-card{{border:2px solid #6aa8ce;border-radius:14px;background:#f7fcff;padding:14px;min-height:128px}}
    .decision-card b{{display:block;color:var(--navy);font-size:17px;margin-bottom:6px}}
    .decision-card strong{{display:block;color:var(--blue);font-size:34px;line-height:1.2}}
    .decision-card span{{display:block;color:#263e55;font-weight:850;font-size:15px}}
    .decision-card.stop{{border-color:#d6a84d;background:#fff8e7}}
    .cockpit-cards{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}}
    .cockpit-card{{border:2px solid #9dbbd1;border-radius:14px;background:#fbfdff;padding:14px}}
    .cockpit-card b{{display:block;color:var(--navy);font-size:20px;margin-bottom:8px}}
    .cockpit-state{{margin:0 0 10px;font-size:15px;font-weight:900;color:#253f58}}
    .cockpit-more{{border-top:1px solid var(--line);padding-top:8px}}
    .cockpit-more summary{{cursor:pointer;color:var(--blue);font-weight:950}}
    .cockpit-more dl{{margin:8px 0 0}}
    .cockpit-more dt{{font-weight:950;color:var(--navy);font-size:13px;margin-top:8px}}
    .cockpit-more dd{{margin:2px 0 0;font-size:13px;font-weight:850;color:#263e55}}
    .triage-cards{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}}
    .triage-card{{border:2px solid #d4e2ed;border-radius:14px;background:#fff;padding:14px}}
    .triage-head{{display:flex;gap:10px;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px}}
    .triage-head b{{color:var(--navy);font-size:20px}}
    .triage-head span{{font-weight:950;color:#263e55}}
    .triage-permission{{display:inline-block;margin:0 0 8px;padding:4px 10px;border-radius:999px;background:#e6f1fa;color:#063b63;font-weight:950}}
    .triage-metrics{{display:grid;grid-template-columns:1fr 1.45fr;gap:8px}}
    .triage-metrics div{{border:1px solid var(--line);border-radius:10px;background:#f6fbff;padding:8px}}
    .triage-metrics b{{display:block;font-size:17px;color:var(--blue)}}
    .triage-metrics span{{display:block;font-size:12px;font-weight:900;color:#526b82}}
    .triage-gap{{margin:10px 0;font-size:14px;font-weight:900;color:#263e55}}
    .triage-more{{border-top:1px solid var(--line);padding-top:8px}}
    .triage-more summary{{cursor:pointer;color:var(--blue);font-weight:950}}
    .triage-more dl{{margin:8px 0 0}}
    .triage-more dt{{font-weight:950;color:var(--navy);font-size:13px;margin-top:8px}}
    .triage-more dd{{margin:2px 0 0;font-size:13px;font-weight:850;color:#263e55}}
    .rule-cards{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}}
    .rule-card{{border:2px solid #9dbbd1;border-radius:14px;background:#fbfdff;padding:14px}}
    .rule-head{{display:flex;gap:10px;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px}}
    .rule-head b{{color:var(--navy);font-size:21px}}
    .rule-head span{{font-weight:950;color:#263e55}}
    .rule-status{{display:inline-block;margin:0 0 8px;padding:4px 10px;border-radius:999px;background:#e6f1fa;color:#063b63;font-weight:950}}
    .rule-metrics{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
    .rule-metrics div{{border:1px solid var(--line);border-radius:10px;background:#fff;padding:8px}}
    .rule-metrics b{{display:block;font-size:18px;color:var(--blue)}}
    .rule-metrics span{{display:block;font-size:12px;font-weight:900;color:#526b82}}
    .rule-list{{margin:10px 0;padding-left:20px;font-size:14px;font-weight:850;color:#263e55}}
    .rule-list li{{margin:4px 0}}
    .rule-more{{border-top:1px solid var(--line);padding-top:8px}}
    .rule-more summary{{cursor:pointer;color:var(--blue);font-weight:950}}
    .rule-more dl{{margin:8px 0 0}}
    .rule-more dt{{font-weight:950;color:var(--navy);font-size:13px;margin-top:8px}}
    .rule-more dd{{margin:2px 0 0;font-size:13px;font-weight:850;color:#263e55}}
    .order-cards{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}}
    .order-card{{border:2px solid #9dbbd1;border-radius:14px;background:#fbfdff;padding:14px}}
    .order-head{{display:flex;gap:10px;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px}}
    .order-head b{{color:var(--navy);font-size:22px}}
    .order-head span{{font-weight:950;color:#263e55}}
    .order-bucket{{font-weight:950;color:#063b63;margin:0 0 8px}}
    .order-metrics{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}}
    .order-metrics div{{border:1px solid var(--line);border-radius:10px;background:#f6fbff;padding:8px}}
    .order-metrics b{{display:block;font-size:20px;color:var(--blue)}}
    .order-metrics span{{display:block;font-size:12px;font-weight:900;color:#526b82}}
    .order-note{{margin:10px 0 0;font-size:14px;font-weight:900;color:#263e55}}
    details.inline-detail{{border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;margin-top:12px}}
    details.inline-detail > summary{{cursor:pointer;font-weight:950;color:var(--navy);font-size:18px}}
    details.archive-block{{background:#fff;border:2px dashed #9dbbd1;border-radius:14px;padding:14px;margin:0 0 16px}}
    details.archive-block > summary{{cursor:pointer;font-size:24px;font-weight:950;color:var(--navy);padding:8px 4px}}
    details.archive-block > .archive-intro{{margin:8px 0 14px;border-left:6px solid #9dbbd1;padding:8px 12px;background:#f6fbff;font-weight:850}}
    .priority-label{{display:inline-block;background:#e6f1fa;color:#063b63;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:14px;font-weight:950;margin-right:6px}}
    @media(max-width:1100px){{.operation-steps,.decision-board,.cockpit-cards,.triage-cards,.rule-cards,.order-cards{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
    @media(max-width:900px){{.quick-nav{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
    @media(max-width:560px){{.quick-nav,.operation-steps,.decision-board,.cockpit-cards,.triage-cards,.rule-cards,.order-cards{{grid-template-columns:1fr}}}}
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
    <div class="quick-nav">
      <a href="#daily-decision">1. 最短判断</a>
      <a href="#operation-flow">2. 操作順</a>
      <a href="#today-order-ticket">3. 注文票</a>
      <a href="#trade-rules">4. 売買ルール</a>
      <a href="#archive-materials">5. 補足資料</a>
    </div>
    <p class="ops-note"><span class="priority-label">運用優先</span>普段見るのは「実用コックピット」「本日注文票」「買付不足トリアージ」「実行サマリー」「売買ルール」です。監査表、計算根拠、古い確認用データは下部の補足資料へ退避しました。</p>
  </section>

  <section id="daily-decision">
    <h2>今日の最短判断</h2>
    <div class="decision-board">
      <div class="decision-card stop"><b>最初に止める条件</b><strong>5つ確認</strong><span>本人NISA区分、本人操作、買付余力、市場急落、前日比+3%以上の高値追い。どれか不明なら注文しません。</span></div>
      <div class="decision-card"><b>本日使う上限</b><strong>{yen(immediate_total)}</strong><span>初回候補・小口候補だけ。確認後候補は混ぜません。</span></div>
      <div class="decision-card"><b>確認後に回す額</b><strong>{yen(conditional_total)}</strong><span>公式照合や未確認項目が消えるまで保留します。</span></div>
      <div class="decision-card"><b>初回枠の現金待機</b><strong>{yen(reserve_total)}</strong><span>急落、未約定、再確認用に残します。</span></div>
    </div>
    <p class="note">このカードが今日の入口です。買付は「全候補を買う」ではなく、止める条件に触れず、注文票に出ているものだけを小さく扱います。</p>
  </section>

  <section id="operation-flow">
    <h2>今日の操作順</h2>
    <div class="operation-steps">
      <div class="op-card"><b>1. 止める条件</b><span>本人NISA区分、本人操作、買付余力、市場急落、前日比+3%以上の高値追いを確認。ここで引っかかれば買いません。</span></div>
      <div class="op-card"><b>2. 買う候補</b><span>実用コックピットで初回候補・小口候補・確認後候補を分けて確認します。全銘柄を無理に買いません。</span></div>
      <div class="op-card"><b>3. 注文票</b><span>本日注文票で金額、株数、指値目安、追わない価格を確認してから証券会社画面へ移ります。</span></div>
      <div class="op-card"><b>4. 記録</b><span>買った価格、買わなかった理由、次に見る日を注文ログに残します。記録できない場合は追加買付へ進みません。</span></div>
      <div class="op-card"><b>5. 保有中ルール</b><span>上値、下値、追加、停止、途中決済は銘柄別売買ルールで確認します。</span></div>
    </div>
  </section>

  <section id="action-cockpit">
    <h2>実用コックピット</h2>
    <p class="note">毎日見る前提の要約です。候補名、初回上限、保留理由、現金待機、止める条件を1枚にまとめます。ここで止まる条件が出た場合は、ランキングが高くても買付に進みません。</p>
    {action_cockpit_cards(action_cockpit_rows)}
    <details class="inline-detail">
      <summary>詳細コックピット表を開く</summary>
      {html_table(action_cockpit_rows, action_cockpit_fields)}
    </details>
  </section>

  <section id="today-order-ticket">
    <h2>本日注文票</h2>
    <p class="note">証券会社画面で見るための表です。本日実行額が0円の確認後候補はここに出しません。STOP行の条件に触れた場合は、全銘柄の新規買付を止めます。</p>
    {order_ticket_cards(today_order_ticket_rows)}
    <details class="inline-detail">
      <summary>詳細注文表・STOP条件を開く</summary>
      {html_table(today_order_ticket_rows, today_order_ticket_fields)}
    </details>
  </section>

  <section id="buy-blocker-triage">
    <h2>買付不足トリアージ</h2>
    <p class="note">「不足がある」とだけ表示すると判断できないため、現配分候補ごとに、初回小口可、条件付き小口、確認後保留へ分けます。全額投入を止める理由と、後で埋める調査項目を分離します。</p>
    {buy_blocker_cards(buy_blocker_triage_rows)}
    <details class="inline-detail">
      <summary>詳細トリアージ表を開く</summary>
      {html_table(buy_blocker_triage_rows, buy_blocker_fields)}
    </details>
  </section>

  <section id="trade-rules">
    <h2>銘柄別 売買ルール</h2>
    <p class="note">普段はここまで見れば十分です。各銘柄の扱い、下値確認ライン、上値確認ライン、未確認項目の有無に応じて行動を分けます。</p>
    {trade_rule_cards(trade_rules)}
    <details class="inline-detail">
      <summary>詳細売買ルール表を開く</summary>
      {html_table(trade_rules, trade_rule_fields)}
    </details>
  </section>

  <details id="archive-materials" class="archive-block">
    <summary>補足資料・監査ログ（必要時だけ開く）</summary>
    <p class="archive-intro">ここは普段の運用では開かなくてよい領域です。計算根拠、母集団監査、スコア分解、期待値監査、予実差レビューなど、説明や検算が必要な時だけ確認します。</p>

  <section id="structural-gate">
    <h2>究極構造ゲート</h2>
    <p class="note">7層構造を「買付判断に使えるか」で監査します。YESは実行条件に使用、PARTIALは補助または減額条件まで、NOは買付判断に使わない扱いです。未検証の仮説や未取得データが、そのまま購入根拠に混ざることを防ぎます。</p>
    {html_table(structural_gate_rows, structural_gate_fields)}
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
    <h2>究極システム 要件チェック</h2>
    <p class="note">提示された「本当にやるべき構造」を、現行システムでどこまで実装できているかを対応表にしました。未取得・未実装の項目は、点数に混ぜず、残る不足と次アクションに分けています。</p>
    {html_table(requirement_matrix_rows, requirement_matrix_fields)}
  </section>

  <section>
    <h2>購入レディネスゲート</h2>
    <p class="note">ランキングと実際の買付判断を分けるためのゲートです。公式財務、価格、イベント、質的根拠、NISA/口座確認が揃わないものは、スコアが高くても初回買付候補にしません。</p>
    {html_table(purchase_readiness_rows, purchase_readiness_fields, 20)}
  </section>

  <section>
    <h2>母集団固定ルール</h2>
    <p class="note">「100社前後から選んだ」と説明できるよう、母集団を作る条件、スコアへ使う条件、買付候補へ進める条件を分けて固定します。未確認データは点数に混ぜず、ゲートまたは不足項目として残します。</p>
    {html_table(universe_rules_rows, universe_rule_fields)}
  </section>

  <section>
    <h2>100社母集団監査</h2>
    <p class="note">各銘柄が、初回買付候補、条件付き候補、監視、候補外のどこにいるかを一覧化します。候補に残らない理由も残すため、後から恣意的に選んだように見えないようにします。</p>
    {html_table(universe_audit_rows, universe_audit_fields, 100)}
  </section>

  <section>
    <h2>7層構造 実装監査</h2>
    <p class="note">この表は、要望された「母集団、量的、質的、イベント、期待値、最適化、買わない条件」が、実際にどこまで実装されているかを分けて示します。未完成部分を点数に混ぜず、残る課題として表示します。</p>
    {html_table(architecture_rows, architecture_fields)}
  </section>

  <section>
    <h2>ポートフォリオ制約チェック</h2>
    <p class="note">10社をただ並べるのではなく、1銘柄比率、業種偏り、現金比率、初回買付枠、最大下落を制約として確認します。条件に合わない場合は、買付額を減らすか現金待機に戻します。</p>
    {html_table(constraint_rows, constraint_fields)}
  </section>

  <section>
    <h2>相関・集中リスク</h2>
    <p class="note">実測できる銘柄は週次リターンで相関を計算し、未取得銘柄は業種・テーマのproxyとして明示します。proxyは実測ではないため、購入確定の根拠ではなく、集中リスクの注意表示として使います。</p>
    {html_table(correlation_rows, correlation_fields, 30)}
  </section>

  <section>
    <h2>質的テーマ証拠台帳</h2>
    <p class="note">AI、半導体、電力、防衛、金利、資源、政策、構造優位などの質的材料を、仮説層と実績層に分けます。実績層が弱い材料は、購入決定ではなく監視・比較材料として扱います。</p>
    {html_table(theme_evidence_rows, theme_evidence_fields, 40)}
  </section>

  <section>
    <h2>買わない・減額ゲート</h2>
    <p class="note">買う銘柄を選ぶだけでなく、買わない条件、減額条件、現金待機条件を先に固定します。条件に触れた場合は、点数が高くても追加買付を止めます。</p>
    {html_table(no_buy_gate_rows, no_buy_gate_fields)}
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
    <h2>スコア分解監査</h2>
    <p class="note">総合点が、どの層から来ているかを分解します。量的、財務、質的、イベント、指数、リスク、信頼度、EV、ゲート減点を同じ表で確認し、未確認データを点数に混ぜたように見えない形にします。</p>
    {html_table(score_trace_rows, score_trace_fields, 100)}
  </section>

  <section>
    <h2>ポートフォリオ最適化案</h2>
    <p class="note">これは「同じ審査で通したうえで、価格があり、業種集中を抑え、初回36万円枠に落とせる候補」です。最終注文は証券会社画面で価格・NISA区分・買付余力を確認してからです。</p>
    {html_table(portfolio, port_fields)}
  </section>

  <section>
    <h2>配分計算監査</h2>
    <p class="note">なぜその比率・金額になったかを見る表です。総合点、EV、扱い別係数、1銘柄上限を使って配分しています。調査優先・小口銘柄は、点数があっても係数と上限で小さくします。</p>
    {html_table(allocation_trace_rows, allocation_trace_fields)}
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
    <h2>指数比較から買付比率への分岐</h2>
    <p class="note">S&P500/TOPIXを上回る説明が強い時だけ個別株比率を上げます。説明が弱い場合は、無理に個別株へ寄せず、現金または指数へ戻します。</p>
    {html_table(benchmark_allocation_rows, benchmark_allocation_fields)}
  </section>

  <section>
    <h2>期待値分解監査</h2>
    <p class="note">期待値は、単なる雰囲気の加点ではなく「上昇確率×上昇幅 - 下落確率×下落幅 - コスト」で分解して確認します。EVが高くても、財務・価格・イベント・質的根拠のゲートが不足する銘柄は買付候補へ進めない扱いを明示します。</p>
    {html_table(expected_value_audit_rows, expected_value_audit_fields, 100)}
  </section>

  <section>
    <h2>実績入力テンプレート</h2>
    <p class="note">購入後の検証に必要な入力欄です。約定価格、確認日の株価、比較指数の開始値と確認日値を入れると、実績%、指数%、指数差を計算できます。実績未入力の間は、次回買付判断に進めない扱いにします。</p>
    {html_table(review_input_rows, review_input_fields, 45)}
  </section>

  <section>
    <h2>レビュー計算結果</h2>
    <p class="note">実績入力テンプレートに入れた数値から、実績%、指数%、指数差を計算し、継続・追加停止・減額・再審査を出す欄です。未入力が残る行は、判定を進めず未入力として表示します。</p>
    {html_table(review_result_rows, review_result_fields, 45)}
  </section>

  <section>
    <h2>予実差レビュー</h2>
    <p class="note">買付後に、D+1営業日、D+5営業日、D+20営業日、1年で、事前の期待値と実績、指数との差を記録します。外れた場合は、量的スコア、質的テーマ、イベント仮説、リスク条件のどこが原因だったかを残し、次回の候補選定に戻します。</p>
    {html_table(prediction_review_rows, prediction_review_fields, 45)}
  </section>

  <section>
    <h2>モデル改善キュー</h2>
    <p class="note">予実差レビューで外れが出た場合に、どの層を疑い、どの証拠を確認し、何をしてはいけないかを固定した表です。実績が未入力のまま次の買付へ進まないための運用ゲートとして使います。</p>
    {html_table(model_revision_rows, model_revision_fields)}
  </section>

  </details>

  <details id="operation-support" class="archive-block">
    <summary>運用補助・記録・リスク確認（必要時だけ開く）</summary>
    <p class="archive-intro">普段は上の操作順、実用コックピット、本日注文票、銘柄別売買ルールを見ます。ここは、記録を残す時、実行ゲートを再確認する時、リスク表や共通ルールを説明する時だけ開きます。</p>

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

  </details>

  <details class="archive-block">
    <summary>候補外・不足データ・CSV出力（必要時だけ開く）</summary>
    <p class="archive-intro">ここは運用時の補足です。候補から外した理由、不足データ、各CSVへのリンクを確認するための領域です。</p>

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
      <a href="ultimate_selection_action_cockpit_20260619.csv">実用コックピットCSV</a>
      <a href="ultimate_selection_structural_gate_20260619.csv">究極構造ゲートCSV</a>
      <a href="ultimate_selection_today_order_ticket_20260619.csv">本日注文票CSV</a>
      <a href="ultimate_selection_buy_blocker_triage_20260619.csv">買付不足トリアージCSV</a>
      <a href="ultimate_selection_allocation_trace_20260619.csv">配分計算監査CSV</a>
      <a href="ultimate_selection_score_trace_20260619.csv">スコア分解監査CSV</a>
      <a href="ultimate_selection_portfolio_20260618.csv">配分案CSV</a>
      <a href="ultimate_selection_execution_plan_20260618.csv">実行ゲートCSV</a>
      <a href="ultimate_selection_risk_scenarios_20260618.csv">リスクシナリオCSV</a>
      <a href="ultimate_selection_trade_rules_20260618.csv">銘柄別売買ルールCSV</a>
      <a href="ultimate_selection_day_checklist_20260618.csv">19日当日チェックCSV</a>
      <a href="ultimate_selection_order_log_template_20260618.csv">当日記録テンプレートCSV</a>
      <a href="ultimate_selection_requirement_matrix_20260619.csv">究極要件チェックCSV</a>
      <a href="ultimate_selection_purchase_readiness_gate_20260619.csv">購入レディネスゲートCSV</a>
      <a href="ultimate_selection_universe_rules_20260619.csv">母集団固定ルールCSV</a>
      <a href="ultimate_selection_universe_audit_20260619.csv">100社母集団監査CSV</a>
      <a href="ultimate_selection_expected_value_audit_20260619.csv">期待値分解監査CSV</a>
      <a href="ultimate_selection_architecture_audit_20260618.csv">7層構造監査CSV</a>
      <a href="ultimate_selection_constraints_20260618.csv">配分制約チェックCSV</a>
      <a href="ultimate_selection_correlation_risk_20260618.csv">相関リスクCSV</a>
      <a href="ultimate_selection_theme_evidence_20260618.csv">質的テーマ証拠台帳CSV</a>
      <a href="ultimate_selection_no_buy_reduce_gate_20260618.csv">買わない・減額ゲートCSV</a>
      <a href="ultimate_selection_benchmark_allocation_gate_20260618.csv">指数比較配分ゲートCSV</a>
      <a href="ultimate_selection_review_input_template_20260619.csv">実績入力テンプレートCSV</a>
      <a href="ultimate_selection_review_result_20260619.csv">レビュー計算結果CSV</a>
      <a href="ultimate_selection_prediction_review_20260619.csv">予実差レビューCSV</a>
      <a href="ultimate_selection_model_revision_queue_20260619.csv">モデル改善キューCSV</a>
      <a href="ultimate_selection_missing_data_20260618.csv">不足データCSV</a>
    </div>
    <p class="note">この版は、渡された数式群を「量的・質的・イベント・期待値・配分制約」に分解して実装した初回統合版です。未取得の財務・ニュース・イベント長期履歴は信頼度を下げ、欠損表へ出します。</p>
  </section>

  </details>
</main>
</body>
</html>
"""


def main() -> None:
    rows = build_scores()
    portfolio = optimize_portfolio_v2(rows)
    missing = build_missing(rows)
    execution = build_execution_plan(portfolio)
    correlation_rows = build_correlation_risk(portfolio)
    constraint_rows = build_constraints(rows, portfolio, correlation_rows)
    architecture_rows = build_architecture_audit(rows, portfolio, correlation_rows, constraint_rows)
    theme_evidence_rows = build_theme_evidence(rows, portfolio)
    no_buy_gate_rows = build_no_buy_reduce_gate(portfolio, correlation_rows)
    benchmark_allocation_rows = build_benchmark_allocation_gate(portfolio)
    risk_scenarios = build_risk_scenarios(portfolio, execution)
    trade_rules = build_trade_rules(portfolio, execution)
    day_checklist = build_day_checklist(execution)
    order_log_template = build_order_log_template(execution)
    today_order_ticket_rows = build_today_order_ticket(execution)
    prediction_review_rows = build_prediction_review(portfolio, execution)
    model_revision_rows = build_model_revision_queue(portfolio, prediction_review_rows)
    review_input_rows = merge_existing_review_input(build_review_input_template(portfolio, execution))
    review_result_rows = build_review_results(review_input_rows, execution)
    requirement_matrix_rows = build_ultimate_requirement_matrix(rows, portfolio)
    purchase_readiness_rows = build_purchase_readiness_gate(rows, portfolio)
    universe_rules_rows = build_universe_rules(rows, portfolio)
    universe_audit_rows = build_universe_audit(rows, portfolio)
    expected_value_audit_rows = build_expected_value_audit(rows, portfolio)
    score_trace_rows = build_score_trace(rows)
    action_cockpit_rows = build_action_cockpit(portfolio, execution, missing, benchmark_allocation_rows)
    structural_gate_rows = build_structural_gate(rows, portfolio)
    buy_blocker_triage_rows = build_buy_blocker_triage(portfolio, purchase_readiness_rows)
    allocation_trace_rows = build_allocation_trace(portfolio)
    write_csv(OUT_SCORE, rows)
    write_csv(OUT_PORTFOLIO, portfolio)
    write_csv(OUT_MISSING, missing)
    write_csv(OUT_EXECUTION, execution)
    write_csv(OUT_RISK, risk_scenarios)
    write_csv(OUT_TRADE_RULES, trade_rules)
    write_csv(OUT_DAY_CHECKLIST, day_checklist)
    write_csv(OUT_ORDER_LOG_TEMPLATE, order_log_template)
    write_csv(OUT_TODAY_ORDER_TICKET, today_order_ticket_rows)
    write_csv(OUT_CORRELATION, correlation_rows)
    write_csv(OUT_CONSTRAINTS, constraint_rows)
    write_csv(OUT_ARCHITECTURE_AUDIT, architecture_rows)
    write_csv(OUT_THEME_EVIDENCE, theme_evidence_rows)
    write_csv(OUT_NO_BUY_GATE, no_buy_gate_rows)
    write_csv(OUT_BENCHMARK_ALLOCATION_GATE, benchmark_allocation_rows)
    write_csv(OUT_PREDICTION_REVIEW, prediction_review_rows)
    write_csv(OUT_MODEL_REVISION_QUEUE, model_revision_rows)
    write_csv(OUT_REVIEW_INPUT_TEMPLATE, review_input_rows)
    write_csv(OUT_REVIEW_RESULT, review_result_rows)
    write_csv(OUT_ULTIMATE_REQUIREMENT_MATRIX, requirement_matrix_rows)
    write_csv(OUT_PURCHASE_READINESS_GATE, purchase_readiness_rows)
    write_csv(OUT_UNIVERSE_RULES, universe_rules_rows)
    write_csv(OUT_UNIVERSE_AUDIT, universe_audit_rows)
    write_csv(OUT_EXPECTED_VALUE_AUDIT, expected_value_audit_rows)
    write_csv(OUT_SCORE_TRACE, score_trace_rows)
    write_csv(OUT_ACTION_COCKPIT, action_cockpit_rows)
    write_csv(OUT_STRUCTURAL_GATE, structural_gate_rows)
    write_csv(OUT_BUY_BLOCKER_TRIAGE, buy_blocker_triage_rows)
    write_csv(OUT_ALLOCATION_TRACE, allocation_trace_rows)
    OUT_HTML.write_text(
        build_html(
            rows,
            portfolio,
            missing,
            execution,
            risk_scenarios,
            trade_rules,
            day_checklist,
            order_log_template,
            today_order_ticket_rows,
            correlation_rows,
            constraint_rows,
            architecture_rows,
            theme_evidence_rows,
            no_buy_gate_rows,
            benchmark_allocation_rows,
            prediction_review_rows,
            model_revision_rows,
            review_input_rows,
            review_result_rows,
            requirement_matrix_rows,
            purchase_readiness_rows,
            universe_rules_rows,
            universe_audit_rows,
            expected_value_audit_rows,
            action_cockpit_rows,
            structural_gate_rows,
            buy_blocker_triage_rows,
            allocation_trace_rows,
            score_trace_rows,
        ),
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
    print(f"Today order ticket: {OUT_TODAY_ORDER_TICKET}")
    print(f"Structural gate: {OUT_STRUCTURAL_GATE}")
    print(f"Correlation risk: {OUT_CORRELATION}")
    print(f"Constraints: {OUT_CONSTRAINTS}")
    print(f"Architecture audit: {OUT_ARCHITECTURE_AUDIT}")
    print(f"Theme evidence: {OUT_THEME_EVIDENCE}")
    print(f"No-buy gate: {OUT_NO_BUY_GATE}")
    print(f"Benchmark allocation gate: {OUT_BENCHMARK_ALLOCATION_GATE}")
    print(f"Prediction review: {OUT_PREDICTION_REVIEW}")
    print(f"Model revision queue: {OUT_MODEL_REVISION_QUEUE}")
    print(f"Review input template: {OUT_REVIEW_INPUT_TEMPLATE}")
    print(f"Review result: {OUT_REVIEW_RESULT}")
    print(f"Requirement matrix: {OUT_ULTIMATE_REQUIREMENT_MATRIX}")
    print(f"Purchase readiness gate: {OUT_PURCHASE_READINESS_GATE}")
    print(f"Universe rules: {OUT_UNIVERSE_RULES}")
    print(f"Universe audit: {OUT_UNIVERSE_AUDIT}")
    print(f"Expected value audit: {OUT_EXPECTED_VALUE_AUDIT}")
    print(f"Score trace: {OUT_SCORE_TRACE}")
    print(f"Action cockpit: {OUT_ACTION_COCKPIT}")
    print(f"Buy blocker triage: {OUT_BUY_BLOCKER_TRIAGE}")
    print(f"Allocation trace: {OUT_ALLOCATION_TRACE}")
    print(f"Order log template: {OUT_ORDER_LOG_TEMPLATE}")
    print("Top 10:")
    for r in rows[:10]:
        print(r["ticker"], r["name"], r["final_score"], r["action"])
    print("Portfolio:")
    for r in portfolio:
        print(r["portfolio_rank"], r["ticker"], r["target_weight_pct"], r["initial_buy_yen"])


if __name__ == "__main__":
    main()
