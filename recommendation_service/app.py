import io
import json
import os
import pickle
import threading
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from pydantic import BaseModel
from bson import ObjectId
from dotenv import load_dotenv
from scipy.sparse import csr_matrix, hstack, load_npz, save_npz, vstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from torchvision import models, transforms

app = FastAPI(title="Fashion Recommender Runtime Index")

SERVICE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVICE_DIR.parent

BASE_MODEL_PATH = PROJECT_ROOT / "model" / "hybrid_feature_matrix.npz"
RUNTIME_MODEL_PATH = PROJECT_ROOT / "model" / "hybrid_feature_matrix_runtime.npz"
XLSX_PATH = PROJECT_ROOT / "CSV.xlsx"
CSV_PATH = PROJECT_ROOT / "Fashion_Dataset_Cleaned.csv"
TFIDF_PATH = PROJECT_ROOT / "model" / "tfidf.pkl"
SCALER_PATH = PROJECT_ROOT / "model" / "scaler.pkl"
META_PATH = PROJECT_ROOT / "model" / "runtime_index_meta.json"
BACKEND_ENV_PATH = PROJECT_ROOT / "backend" / ".env"

load_dotenv(BACKEND_ENV_PATH)
MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.getenv("DB_NAME", "").strip()

BASE_LIMIT = int(os.getenv("RECOMMENDER_BASE_LIMIT", "500"))
TEXT_COLS = ["name", "description", "p_attributes", "brand", "colour"]
NUMERIC_COLS = ["price", "ratingCount", "avg_rating"]
EXPECTED_FIXED_DIMS = 2051  # 3 numeric + 2048 image

index_lock = threading.Lock()
runtime_matrix = None
tfidf: TfidfVectorizer | None = None
scaler: MinMaxScaler | None = None
headless_resnet = None
image_preprocess = None
p_id_to_idx: Dict[str, int] = {}
rows_meta: List[Dict[str, Any]] = []
mongo_client = None
mongo_db = None


class RecommendationResponse(BaseModel):
    p_id: str
    name: str
    brand: str
    price: float


class VectorizeProductRequest(BaseModel):
    p_id: str
    name: str = ""
    description: str = ""
    p_attributes: Any = ""
    brand: str = ""
    colour: str = ""
    price: float = 0.0
    ratingCount: int = 0
    avg_rating: float = 0.0
    image_url: str | None = None


def normalize_text_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def build_combined_text(row: Dict[str, Any]) -> str:
    return " ".join(normalize_text_value(row.get(col, "")) for col in TEXT_COLS).strip()


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def atomic_save_npz(path: Path, matrix) -> None:
    ensure_parent_dir(path)
    tmp_path = path.with_name(path.stem + ".tmp.npz")
    save_npz(tmp_path, matrix)
    os.replace(tmp_path, path)


def atomic_save_json(path: Path, payload: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=True)
    os.replace(tmp_path, path)


def load_or_fit_preprocessors(df_base: pd.DataFrame):
    global tfidf, scaler

    if TFIDF_PATH.exists() and SCALER_PATH.exists():
        with TFIDF_PATH.open("rb") as f:
            tfidf = pickle.load(f)
        with SCALER_PATH.open("rb") as f:
            scaler = pickle.load(f)
        return

    df_fit = df_base.copy()
    for col in TEXT_COLS:
        if col in df_fit.columns:
            df_fit[col] = df_fit[col].fillna("").astype(str).str.lower()
        else:
            df_fit[col] = ""

    df_fit["combined_text"] = ""
    for col in TEXT_COLS:
        df_fit["combined_text"] += df_fit[col] + " "

    tfidf_local = TfidfVectorizer(stop_words="english", max_features=5000)
    tfidf_local.fit(df_fit["combined_text"])

    for col in NUMERIC_COLS:
        if col in df_fit.columns:
            df_fit[col] = pd.to_numeric(df_fit[col], errors="coerce").fillna(0)
        else:
            df_fit[col] = 0
    scaler_local = MinMaxScaler()
    scaler_local.fit(df_fit[NUMERIC_COLS].values)

    ensure_parent_dir(TFIDF_PATH)
    with TFIDF_PATH.open("wb") as f:
        pickle.dump(tfidf_local, f)
    with SCALER_PATH.open("wb") as f:
        pickle.dump(scaler_local, f)

    tfidf = tfidf_local
    scaler = scaler_local


def load_image_model():
    global headless_resnet, image_preprocess

    image_preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights = models.ResNet50_Weights.IMAGENET1K_V2
    resnet = models.resnet50(weights=weights)
    headless_resnet = nn.Sequential(*list(resnet.children())[:-1]).to(device)
    headless_resnet.eval()
    return device


def build_base_rows_meta(df_base: pd.DataFrame) -> List[Dict[str, Any]]:
    meta = []
    for _, row in df_base.iterrows():
        if pd.isna(row.get("p_id")):
            meta.append({"p_id": "", "name": "Unknown", "brand": "Unknown", "price": 0.0})
            continue
        p_id = str(int(float(row["p_id"])))
        name = str(row.get("name", "Unknown")) if pd.notna(row.get("name")) else "Unknown"
        brand = str(row.get("brand", "Unknown")) if pd.notna(row.get("brand")) else "Unknown"
        price = float(row.get("price", 0.0)) if pd.notna(row.get("price")) else 0.0
        meta.append({"p_id": p_id, "name": name, "brand": brand, "price": price})
    return meta


def rebuild_p_id_map():
    global p_id_to_idx
    p_id_to_idx = {}
    for idx, meta in enumerate(rows_meta):
        p_id = str(meta.get("p_id", "")).strip()
        if p_id:
            p_id_to_idx[p_id] = idx


def align_sparse_cols(row_vec, target_cols: int):
    current_cols = row_vec.shape[1]
    if current_cols == target_cols:
        return row_vec
    if current_cols < target_cols:
        return hstack([row_vec, csr_matrix((1, target_cols - current_cols))]).tocsr()
    return row_vec[:, :target_cols].tocsr()


def image_embedding_from_url(image_url: str | None):
    # If no image is available, keep the vector length valid using zeros.
    if not image_url:
        return np.zeros((1, 2048), dtype=np.float32)

    try:
        with urllib.request.urlopen(image_url, timeout=8) as response:
            raw = response.read()
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        tensor = image_preprocess(image).unsqueeze(0)
        device = next(headless_resnet.parameters()).device
        tensor = tensor.to(device)
        with torch.no_grad():
            features = headless_resnet(tensor).squeeze(-1).squeeze(-1)
        return features.cpu().numpy().astype(np.float32)
    except Exception:
        return np.zeros((1, 2048), dtype=np.float32)


def vectorize_product(payload: VectorizeProductRequest):
    combined_text = build_combined_text(payload.model_dump())
    text_vec = tfidf.transform([combined_text])

    numeric_raw = np.array([
        [
            float(payload.price or 0.0),
            float(payload.ratingCount or 0),
            float(payload.avg_rating or 0.0),
        ]
    ])
    numeric_vec = scaler.transform(numeric_raw)
    image_vec = image_embedding_from_url(payload.image_url)

    row_vec = hstack([text_vec, csr_matrix(numeric_vec), csr_matrix(image_vec)]).tocsr()
    row_vec = align_sparse_cols(row_vec, runtime_matrix.shape[1])
    return row_vec


def get_mongo_db():
    global mongo_client, mongo_db
    if mongo_db is not None:
        return mongo_db
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not set for recommendation service")

    mongo_client = MongoClient(MONGODB_URI)
    if MONGODB_DB_NAME:
        mongo_db = mongo_client[MONGODB_DB_NAME]
    else:
        default_db = mongo_client.get_default_database()
        if default_db is None:
            raise RuntimeError("Could not determine MongoDB database name")
        mongo_db = default_db
    return mongo_db


def build_response_from_meta(p_id: str) -> Dict[str, Any] | None:
    idx = p_id_to_idx.get(str(p_id))
    if idx is None:
        return None
    meta = rows_meta[idx] if idx < len(rows_meta) else {}
    rec_id = str(meta.get("p_id", "")).strip()
    if not rec_id:
        return None
    return {
        "p_id": rec_id,
        "name": str(meta.get("name", "Unknown")),
        "brand": str(meta.get("brand", "Unknown")),
        "price": float(meta.get("price", 0.0) or 0.0),
    }


def fallback_popular_products(top_n: int) -> List[Dict[str, Any]]:
    db = get_mongo_db()
    docs = (
        db["products"]
        .find(
            {
                "$or": [
                    {"image_id": {"$exists": True, "$ne": None}},
                    {"img": {"$exists": True, "$ne": ""}},
                ]
            }
        )
        .sort([("ratingCount", -1), ("avg_rating", -1), ("p_id", -1)])
        .limit(top_n)
    )

    results = []
    for doc in docs:
        p_id = doc.get("p_id")
        if p_id is None:
            continue
        results.append({
            "p_id": str(int(p_id)) if isinstance(p_id, (int, float)) else str(p_id),
            "name": str(doc.get("name", "Unknown")),
            "brand": str(doc.get("brand", "Unknown")),
            "price": float(doc.get("price", 0.0) or 0.0),
        })
    return results


def fallback_complete_look_random(source_category: str, top_n: int) -> List[str]:
    db = get_mongo_db()
    match_filter: Dict[str, Any] = {
        "$or": [
            {"image_id": {"$exists": True, "$ne": None}},
            {"img": {"$exists": True, "$ne": ""}},
        ]
    }
    if source_category:
        match_filter["category"] = {"$ne": source_category}

    docs = list(
        db["products"].aggregate(
            [
                {"$match": match_filter},
                {"$sample": {"size": max(top_n * 3, 12)}},
                {"$project": {"p_id": 1}},
            ]
        )
    )
    ids: List[str] = []
    seen = set()
    for doc in docs:
        p_id = doc.get("p_id")
        if p_id is None:
            continue
        try:
            p_str = str(int(float(p_id)))
        except Exception:
            p_str = str(p_id).strip()
        if not p_str or p_str in seen:
            continue
        seen.add(p_str)
        ids.append(p_str)
        if len(ids) >= top_n:
            break
    return ids


def initialize_runtime_index():
    global runtime_matrix, rows_meta

    print("\n=== STARTING PYTHON RECOMMENDATION SERVER ===")

    if BASE_MODEL_PATH.exists():
        base_matrix = load_npz(BASE_MODEL_PATH)
    elif RUNTIME_MODEL_PATH.exists():
        print(f"[WARN] Base model missing, using runtime model: {RUNTIME_MODEL_PATH}")
        base_matrix = load_npz(RUNTIME_MODEL_PATH)
    else:
        raise RuntimeError(
            f"No model found. Expected {BASE_MODEL_PATH} or {RUNTIME_MODEL_PATH}"
        )

    df_original = None
    if XLSX_PATH.exists():
        # CSV.xlsx layout: first column is row number, then product fields.
        raw = pd.read_excel(XLSX_PATH, header=None)
        if raw.shape[1] >= 11:
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
            df_original = raw.iloc[:, : len(cols)].copy()
            df_original.columns = cols
            df_original = df_original.drop(columns=["row_no"])
            print(f"[OK] Loaded base matrix shape={base_matrix.shape} and XLSX rows={len(df_original)}")
    elif CSV_PATH.exists():
        df_original = pd.read_csv(CSV_PATH)
        print(f"[OK] Loaded base matrix shape={base_matrix.shape} and dataset rows={len(df_original)}")
    else:
        print(
            f"[WARN] Dataset file not found: {XLSX_PATH} or {CSV_PATH}. Using metadata/runtime fallback."
        )

    # We only need CSV for fitting preprocessors if pickles do not already exist.
    if TFIDF_PATH.exists() and SCALER_PATH.exists():
        load_or_fit_preprocessors(pd.DataFrame(columns=TEXT_COLS + NUMERIC_COLS))
        if df_original is not None:
            df_base = df_original.iloc[:BASE_LIMIT].reset_index(drop=True)
        else:
            df_base = pd.DataFrame(columns=["p_id", "name", "brand", "price"])
    else:
        if df_original is None:
            raise RuntimeError(
                f"Dataset not found: {XLSX_PATH} or {CSV_PATH}. Needed to fit preprocessors because tfidf/scaler pickle files are missing."
            )
        df_base = df_original.iloc[:BASE_LIMIT].reset_index(drop=True)
        load_or_fit_preprocessors(df_base)

    # Runtime matrix persists incremental appends. If missing, bootstrap from base slice.
    if RUNTIME_MODEL_PATH.exists():
        runtime_matrix_local = load_npz(RUNTIME_MODEL_PATH).tocsr()
    else:
        runtime_matrix_local = base_matrix[:BASE_LIMIT].tocsr()
        atomic_save_npz(RUNTIME_MODEL_PATH, runtime_matrix_local)

    if df_base.empty:
        base_rows_meta = []
    else:
        base_rows_meta = build_base_rows_meta(df_base)
    if META_PATH.exists():
        with META_PATH.open("r", encoding="utf-8") as f:
            meta_payload = json.load(f)
        loaded_rows = meta_payload.get("rows", [])
        if isinstance(loaded_rows, list) and len(loaded_rows) == runtime_matrix_local.shape[0]:
            rows_meta = loaded_rows
        else:
            rows_meta = base_rows_meta
    else:
        rows_meta = base_rows_meta

    # If runtime matrix has more rows than metadata, add placeholders to keep alignment valid.
    while len(rows_meta) < runtime_matrix_local.shape[0]:
        rows_meta.append({"p_id": "", "name": "Unknown", "brand": "Unknown", "price": 0.0})
    # If metadata is longer than matrix, trim safely.
    rows_meta = rows_meta[:runtime_matrix_local.shape[0]]

    # Keep the base slice metadata aligned with the active dataset (XLSX/CSV).
    # This avoids stale p_id mappings after dataset replacement.
    if base_rows_meta:
        base_count = min(len(base_rows_meta), len(rows_meta), BASE_LIMIT)
        rows_meta[:base_count] = base_rows_meta[:base_count]

    runtime_matrix = runtime_matrix_local
    rebuild_p_id_map()

    # Save normalized metadata payload so future restarts are deterministic.
    atomic_save_json(META_PATH, {"base_limit": BASE_LIMIT, "rows": rows_meta})
    print(f"[OK] Runtime index ready: rows={runtime_matrix.shape[0]}, cols={runtime_matrix.shape[1]}")


@app.on_event("startup")
def on_startup():
    initialize_runtime_index()
    load_image_model()
    print("[OK] Image model loaded (ResNet50).")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "rows": int(runtime_matrix.shape[0]),
        "cols": int(runtime_matrix.shape[1]),
        "indexed_products": len(p_id_to_idx),
    }


@app.get("/recommend", response_model=List[RecommendationResponse])
async def recommend(product_id: str, top_n: int = 4):
    if product_id not in p_id_to_idx:
        raise HTTPException(status_code=404, detail="Product not found in runtime recommendation index")

    query_idx = p_id_to_idx[product_id]
    query_vec = runtime_matrix[query_idx]
    sim_scores = cosine_similarity(query_vec, runtime_matrix).flatten()
    top_indices = np.argsort(sim_scores)[::-1]

    results = []
    for i in top_indices:
        idx = int(i)
        if len(results) >= top_n:
            break
        if idx == query_idx:
            continue

        meta = rows_meta[idx] if idx < len(rows_meta) else {}
        rec_id = str(meta.get("p_id", "")).strip()
        if not rec_id:
            continue

        results.append({
            "p_id": rec_id,
            "name": str(meta.get("name", "Unknown")),
            "brand": str(meta.get("brand", "Unknown")),
            "price": float(meta.get("price", 0.0) or 0.0),
        })
    return results


@app.get("/recommend/user/{user_id}", response_model=List[RecommendationResponse])
async def recommend_for_user(user_id: str, top_n: int = 8):
    db = get_mongo_db()

    # Purchase-history recommender from existing matrix: average purchased vectors.
    orders = list(db["orders"].find({"userId": user_id}))
    purchased_ids: List[str] = []
    for order in orders:
        for item in order.get("items", []):
            product_id = item.get("productId")
            if product_id is None:
                continue
            try:
                purchased_ids.append(str(int(float(product_id))))
            except Exception:
                purchased_ids.append(str(product_id))

    if not purchased_ids:
        return fallback_popular_products(top_n)

    unique_purchased = list(dict.fromkeys(purchased_ids))
    purchased_indices = [p_id_to_idx[p_id] for p_id in unique_purchased if p_id in p_id_to_idx]

    if not purchased_indices:
        return fallback_popular_products(top_n)

    purchased_matrix = runtime_matrix[purchased_indices]
    user_taste_vector = csr_matrix(np.asarray(purchased_matrix.mean(axis=0)))
    sim_scores = cosine_similarity(user_taste_vector, runtime_matrix).flatten()
    ranked_indices = np.argsort(sim_scores)[::-1]

    purchased_set = set(unique_purchased)
    results = []
    for idx in ranked_indices:
        if len(results) >= top_n:
            break
        meta = rows_meta[int(idx)] if int(idx) < len(rows_meta) else {}
        rec_id = str(meta.get("p_id", "")).strip()
        if not rec_id or rec_id in purchased_set:
            continue
        results.append({
            "p_id": rec_id,
            "name": str(meta.get("name", "Unknown")),
            "brand": str(meta.get("brand", "Unknown")),
            "price": float(meta.get("price", 0.0) or 0.0),
        })

    if not results:
        return fallback_popular_products(top_n)
    return results


@app.get("/recommend/browsing/{user_id}", response_model=List[RecommendationResponse])
async def recommend_for_browsing(user_id: str, top_n: int = 8):
    db = get_mongo_db()
    history_docs = list(
        db["browsingHistory"]
        .find({"userId": user_id})
        .sort([("viewedAt", -1), ("_id", -1)])
        .limit(10)
    )

    viewed_ids: List[str] = []
    for doc in history_docs:
        product_id = doc.get("productId")
        if product_id is None:
            continue
        try:
            viewed_ids.append(str(int(float(product_id))))
        except Exception:
            viewed_ids.append(str(product_id))

    if not viewed_ids:
        return await recommend_for_user(user_id, top_n=top_n)

    unique_viewed = list(dict.fromkeys(viewed_ids))
    viewed_indices = [p_id_to_idx[p_id] for p_id in unique_viewed if p_id in p_id_to_idx]

    if not viewed_indices:
        return await recommend_for_user(user_id, top_n=top_n)

    viewed_matrix = runtime_matrix[viewed_indices]
    browsing_taste_vector = csr_matrix(np.asarray(viewed_matrix.mean(axis=0)))
    sim_scores = cosine_similarity(browsing_taste_vector, runtime_matrix).flatten()
    ranked_indices = np.argsort(sim_scores)[::-1]

    viewed_set = set(unique_viewed)
    results = []
    for idx in ranked_indices:
        if len(results) >= top_n:
            break
        meta = rows_meta[int(idx)] if int(idx) < len(rows_meta) else {}
        rec_id = str(meta.get("p_id", "")).strip()
        if not rec_id or rec_id in viewed_set:
            continue
        results.append({
            "p_id": rec_id,
            "name": str(meta.get("name", "Unknown")),
            "brand": str(meta.get("brand", "Unknown")),
            "price": float(meta.get("price", 0.0) or 0.0),
        })

    if not results:
        return await recommend_for_user(user_id, top_n=top_n)
    return results


@app.get("/recommend/complete-look/{product_id}", response_model=List[str])
async def recommend_complete_look(product_id: str, top_n: int = 4):
    db = get_mongo_db()

    source_doc = None
    if ObjectId.is_valid(product_id):
        source_doc = db["products"].find_one({"_id": ObjectId(product_id)})
    if source_doc is None:
        try:
            source_p_id = int(float(product_id))
            source_doc = db["products"].find_one({"p_id": source_p_id})
        except Exception:
            source_doc = None

    if source_doc is None:
        return []

    source_category = str(source_doc.get("category", "") or "").strip()
    source_pid_raw = source_doc.get("p_id")
    if source_pid_raw is None:
        return fallback_complete_look_random(source_category, top_n)
    try:
        source_pid = str(int(float(source_pid_raw)))
    except Exception:
        source_pid = str(source_pid_raw).strip()

    if not source_pid or source_pid not in p_id_to_idx:
        return fallback_complete_look_random(source_category, top_n)

    source_idx = p_id_to_idx[source_pid]
    source_vec = runtime_matrix[source_idx]
    sim_scores = cosine_similarity(source_vec, runtime_matrix).flatten()
    ranked_indices = np.argsort(sim_scores)[::-1]

    # Keep complete-look visually distinct from the default "You May Also Like" list.
    base_recommend_ids: List[str] = []
    for idx in ranked_indices:
        idx = int(idx)
        if idx == source_idx:
            continue
        meta = rows_meta[idx] if idx < len(rows_meta) else {}
        rec_id = str(meta.get("p_id", "")).strip()
        if not rec_id:
            continue
        base_recommend_ids.append(rec_id)
        if len(base_recommend_ids) >= 4:
            break
    base_recommend_set = set(base_recommend_ids)

    similar_ids: List[str] = []
    for idx in ranked_indices:
        if len(similar_ids) >= 20:
            break
        idx = int(idx)
        if idx == source_idx:
            continue
        meta = rows_meta[idx] if idx < len(rows_meta) else {}
        rec_id = str(meta.get("p_id", "")).strip()
        if not rec_id:
            continue
        similar_ids.append(rec_id)

    if not similar_ids:
        return fallback_complete_look_random(source_category, top_n)

    in_values = []
    for pid in similar_ids:
        try:
            in_values.append(int(float(pid)))
        except Exception:
            pass
    if not in_values:
        return fallback_complete_look_random(source_category, top_n)

    docs = list(
        db["products"].find(
            {"p_id": {"$in": in_values}},
            {"p_id": 1, "category": 1},
        )
    )
    category_map: Dict[str, str] = {}
    for doc in docs:
        p_id = doc.get("p_id")
        if p_id is None:
            continue
        cat = str(doc.get("category", "") or "").strip()
        category_map[str(int(float(p_id)))] = cat

    results: List[str] = []
    for pid in similar_ids:
        if pid in base_recommend_set:
            continue
        cat = category_map.get(pid, "")
        if source_category and cat == source_category:
            continue
        if not cat and source_category:
            continue
        results.append(pid)
        if len(results) >= top_n:
            break

    if not results:
        return fallback_complete_look_random(source_category, top_n)
    return results


@app.post("/vectorize")
async def vectorize(req: VectorizeProductRequest):
    p_id = str(req.p_id).strip()
    if not p_id:
        raise HTTPException(status_code=400, detail="p_id is required")

    with index_lock:
        if p_id in p_id_to_idx:
            return {"status": "already_indexed", "p_id": p_id, "index": p_id_to_idx[p_id]}

        row_vec = vectorize_product(req)

        global runtime_matrix
        runtime_matrix = vstack([runtime_matrix, row_vec]).tocsr()
        new_idx = runtime_matrix.shape[0] - 1

        rows_meta.append({
            "p_id": p_id,
            "name": req.name or "Unknown",
            "brand": req.brand or "Unknown",
            "price": float(req.price or 0.0),
        })
        p_id_to_idx[p_id] = new_idx

        atomic_save_npz(RUNTIME_MODEL_PATH, runtime_matrix)
        atomic_save_json(META_PATH, {"base_limit": BASE_LIMIT, "rows": rows_meta})

    return {"status": "indexed", "p_id": p_id, "index": new_idx, "rows": runtime_matrix.shape[0]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
