import argparse
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient


def clean_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def infer_category(name: str, description: str) -> str:
    text = f"{name} {description}".lower()
    ethnic_keys = ["kurta", "saree", "lehenga", "salwar", "dupatta", "ethnic", "anarkali", "palazzo"]
    return "Ethnic" if any(k in text for k in ethnic_keys) else "Western"


def load_xlsx_rows(xlsx_path: Path) -> pd.DataFrame:
    raw = pd.read_excel(xlsx_path, header=None)
    cols = [
        "row_no",
        "p_id",
        "name",
        "price",
        "colour",
        "brand",
        "img",
        "ratingCount",
        "avg_rating",
        "description",
        "p_attributes",
    ]
    if raw.shape[1] < len(cols):
        raise RuntimeError(f"Unexpected XLSX format: {raw.shape}")

    df = raw.iloc[:, : len(cols)].copy()
    df.columns = cols

    for col in ["p_id", "price", "ratingCount", "avg_rating"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["p_id", "name", "img", "price"])
    valid_img = df["img"].astype(str).str.startswith("http://") | df["img"].astype(str).str.startswith("https://")
    df = df[valid_img]
    df = df[df["price"] > 0]
    df["p_id"] = df["p_id"].astype(int)
    df = df.drop_duplicates(subset=["p_id"], keep="first").reset_index(drop=True)
    return df


def main():
    parser = argparse.ArgumentParser(description="Load products into MongoDB directly from CSV.xlsx")
    parser.add_argument("--xlsx", default="CSV.xlsx", help="Path to Excel file")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit (0 = all rows)")
    parser.add_argument("--clear", action="store_true", help="Clear products collection before import")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    load_dotenv(dotenv_path=root / "backend" / ".env", override=True)

    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    db_name = os.getenv("DB_NAME", "fashion_recommend").strip()
    if not mongo_uri:
        raise RuntimeError("MONGODB_URI missing in backend/.env")

    xlsx_path = Path(args.xlsx)
    if not xlsx_path.is_absolute():
        xlsx_path = (root / xlsx_path).resolve()
    if not xlsx_path.exists():
        raise FileNotFoundError(f"XLSX not found: {xlsx_path}")

    df = load_xlsx_rows(xlsx_path)
    if args.limit and args.limit > 0:
        df = df.head(args.limit).copy()

    records = []
    for row in df.itertuples(index=False):
        name = clean_text(row.name)
        description = clean_text(row.description)
        brand = clean_text(row.brand)
        colour = clean_text(row.colour)
        img = clean_text(row.img)
        records.append(
            {
                "p_id": int(row.p_id),
                "name": name,
                "description": description,
                "brand": brand,
                "colour": colour,
                "price": float(row.price),
                "ratingCount": int(row.ratingCount) if pd.notna(row.ratingCount) else 0,
                "avg_rating": float(row.avg_rating) if pd.notna(row.avg_rating) else 0.0,
                "p_attributes": clean_text(row.p_attributes),
                "img": img,
                "image": img,
                "category": infer_category(name, description),
                "stock": 50,
            }
        )

    client = MongoClient(mongo_uri)
    db = client[db_name]
    products = db["products"]

    if args.clear:
        products.delete_many({})

    inserted = 0
    for product in records:
        result = products.update_one({"p_id": product["p_id"]}, {"$set": product}, upsert=True)
        if result.upserted_id is not None:
            inserted += 1

    products.create_index("p_id", unique=True)
    total = products.count_documents({})

    print(f"XLSX: {xlsx_path}")
    print(f"Prepared records: {len(records)}")
    print(f"New inserts: {inserted}")
    print(f"Total products in MongoDB: {total}")

    client.close()


if __name__ == "__main__":
    main()
