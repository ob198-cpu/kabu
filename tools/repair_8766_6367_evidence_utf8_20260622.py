from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIN = ROOT / "official_financial_evidence_20260621.csv"
QUAL = ROOT / "qualitative_official_evidence_20260621.csv"
TODAY = "2026-06-22"


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def upsert(rows: list[dict[str, str]], ticker: str, payload: dict[str, str]) -> None:
    for row in rows:
        if row.get("ticker") == ticker:
            row.update(payload)
            return
    rows.append(payload)


FIN_ROWS = {
    "8766.T": {
        "ticker": "8766.T",
        "name": "東京海上HD",
        "updated_at": TODAY,
        "source": "東京海上HD 2025年度期末 決算短信 data/official_ir_pdfs/8766_T_3_決算短信.pdf、決算説明資料 data/official_ir_pdfs/8766_T_4_決算説明資料.pdf",
        "period": "2026年3月期",
        "official_values_confirmed": (
            "経常収益8,872,277百万円（+5.1%）、経常利益1,348,630百万円（-7.6%）、"
            "親会社株主帰属当期純利益980,428百万円（-7.1%）、EPS515.55円（-4.9%）、"
            "自己資本比率17.0%（+0.7pt）、営業CF584,259百万円（-56.6%）、"
            "年間配当218円（+26.7%）、2027年3月期会社予想当期利益830,000百万円をPDF本文照合済み。"
        ),
        "market_derived_items": "PER/PBRは注文前の株価基準日で再計算。保険業のため自己資本比率・CFは一般事業会社と同列比較しない。",
        "gate_change": "文字化けしていた公式財務根拠を修正。financial_status pass 候補として整理。",
        "remaining_checks": "決算後20営業日反応は弱く、通常Aへ上げない。保険セクター、金利、自然災害損害、資本政策を継続確認。",
    },
    "6367.T": {
        "ticker": "6367.T",
        "name": "ダイキン工業",
        "updated_at": TODAY,
        "source": "ダイキン工業 2026年3月期 決算短信 data/official_ir_pdfs/6367_T_5_決算短信.pdf、決算説明資料 data/official_ir_pdfs/6367_T_6_決算説明資料.pdf",
        "period": "2026年3月期",
        "official_values_confirmed": (
            "売上高5,015,036百万円（+5.5%）、営業利益414,991百万円（+3.3%）、"
            "親会社株主帰属当期純利益275,229百万円（+4.0%）、EPS939.92円（+3.9%）、"
            "自己資本比率55.9%（+1.3pt）、営業CF465,848百万円（-9.4%）、"
            "年間配当340円（+3.0%）、2027年3月期会社予想売上高5,150,000百万円（+2.7%）をPDF本文照合済み。"
        ),
        "market_derived_items": "PER/PBRは注文前の株価基準日で再計算。空調・冷却需要はテーマ根拠だが、DC需要寄与率は別途確認。",
        "gate_change": "文字化けしていた公式財務根拠を修正。financial_status pass 候補として整理。",
        "remaining_checks": "決算後20営業日反応は通常A水準未達。AIデータセンター冷却需要の売上寄与、地域別採算、為替影響を継続確認。",
    },
}


QUAL_ROWS = {
    "8766.T": {
        "ticker": "8766.T",
        "name": "東京海上HD",
        "theme": "保険・金利・資本政策",
        "evidence_level": "公式資料確認",
        "official_or_observed_evidence": (
            "公式決算で経常収益+5.1%、年間配当+26.7%、自己資本比率17.0%を確認。"
            "一方、経常利益-7.6%、親会社株主帰属当期純利益-7.1%、営業CF-56.6%で、直近実績は強弱混在。"
        ),
        "source": "東京海上HD 2025年度期末 決算短信・決算説明資料",
        "usage_limit": "保険・金利テーマの監視根拠として使う。決算後反応が弱いため、通常Aへの昇格根拠にはしない。",
        "next_check": "金利、保険セクター指数、自然災害損害、資本政策、次回決算後反応を確認。",
    },
    "6367.T": {
        "ticker": "6367.T",
        "name": "ダイキン工業",
        "theme": "空調・冷却・AIデータセンター周辺需要",
        "evidence_level": "公式資料確認",
        "official_or_observed_evidence": (
            "公式決算で売上高+5.5%、営業利益+3.3%、EPS+3.9%、自己資本比率55.9%を確認。"
            "AIデータセンター冷却需要は構造テーマだが、全社利益への寄与率は未分離。"
        ),
        "source": "ダイキン工業 2026年3月期 決算短信・決算説明資料",
        "usage_limit": "冷却テーマの監視根拠として使う。決算後20営業日反応が通常A水準未達のため、この材料だけで買付候補に上げない。",
        "next_check": "データセンター向け冷却需要、地域別採算、為替、次回決算後反応を確認。",
    },
}


def main() -> None:
    fields, rows = read_csv(FIN)
    for ticker, payload in FIN_ROWS.items():
        upsert(rows, ticker, payload)
    write_csv(FIN, fields, rows)

    fields, rows = read_csv(QUAL)
    for ticker, payload in QUAL_ROWS.items():
        upsert(rows, ticker, payload)
    write_csv(QUAL, fields, rows)
    print({"repaired": list(FIN_ROWS)})


if __name__ == "__main__":
    main()
