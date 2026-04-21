import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import numpy as np
import pandas as pd
from scipy.sparse import hstack, csr_matrix, save_npz, load_npz
from sklearn.metrics.pairwise import cosine_similarity
from tqdm import tqdm # For progress bars
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import ast

# ==========================================
# 1. Custom PyTorch Dataset for Images
# ==========================================
class FashionImageDataset(Dataset):
    def __init__(self, image_paths, transform=None):
        self.image_paths = image_paths
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        try:
            # Convert to RGB to handle grayscale/RGBA images safely
            image = Image.open(img_path).convert('RGB')
            if self.transform:
                image = self.transform(image)
            return image
        except Exception as e:
            # If an image is missing or corrupted, return a blank tensor
            # You should ideally filter these out beforehand!
            print(f"Error loading {img_path}: {e}")
            return torch.zeros((3, 224, 224)) 
# ==========================================
# Text Processing (TF-IDF)
# ==========================================
def build_text_features(df):
    print("Generating TF-IDF features...")
    # 1. Fill missing values with empty strings to avoid errors
    text_cols = ['name', 'description', 'p_attributes', 'brand', 'colour']
    for col in text_cols:
        # Check if column exists first
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str).str.lower()
    
    # 2. Combine all text into a single 'combined_text' column
    # We add a space between each column's text
    df['combined_text'] = ""
    for col in text_cols:
        if col in df.columns:
            df['combined_text'] += df[col] + " "
            
    # 3. Create TF-IDF Vectorizer
    # max_features limits the vocabulary to the top 5000 most important words to save memory
    # stop_words='english' removes common useless words (the, and, is, etc.)
    tfidf = TfidfVectorizer(stop_words='english', max_features=5000)
    
    # 4. Fit and transform the text into a sparse matrix
    tfidf_matrix = tfidf.fit_transform(df['combined_text'])
    
    return tfidf_matrix

# ==========================================
# Numeric Processing (Scaling)
# ==========================================
def build_numeric_features(df):
    print("Scaling numeric features...")
    # 1. Define the numeric columns you want to use
    numeric_cols = ['price', 'ratingCount', 'avg_rating']
    
    # 2. Handle missing values (Fill with 0 or the column mean)
    for col in numeric_cols:
        if col in df.columns:
            # Converting to numeric just in case they were read as strings
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # 3. Extract just those columns
    numeric_data = df[numeric_cols].values
    
    # 4. Scale the data so that price (e.g., 5000) doesn't overpower avg_rating (e.g., 4.5)
    # MinMaxScaler shrinks all values to be between 0 and 1
    scaler = MinMaxScaler()
    scaled_matrix = scaler.fit_transform(numeric_data)
    
    return scaled_matrix
# ==========================================
# 2. Extract Image Embeddings
# ==========================================
def extract_image_features(df, image_col='local_img_path', batch_size=32):
    # Standard ImageNet preprocessing
    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                             std=[0.229, 0.224, 0.225]),
    ])

    # Setup DataLoader for efficient batch processing
    dataset = FashionImageDataset(df[image_col].tolist(), transform=preprocess)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=4)

    # Load Pretrained ResNet50
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Load model and remove the final classification layer
    weights = models.ResNet50_Weights.IMAGENET1K_V2
    resnet = models.resnet50(weights=weights)
    # list(resnet.children())[:-1] gets everything except the final Linear layer
    headless_resnet = nn.Sequential(*list(resnet.children())[:-1]).to(device)
    headless_resnet.eval() # Set to evaluation mode

    all_features = []
    
    print("Extracting Image Features...")
    with torch.no_grad(): # Do not compute gradients to save memory and speed up
        for images in tqdm(dataloader):
            images = images.to(device)
            # Forward pass
            features = headless_resnet(images)
            # Output shape is (Batch, 2048, 1, 1). Flatten it to (Batch, 2048)
            features = features.squeeze(-1).squeeze(-1)
            all_features.append(features.cpu().numpy())

    return np.vstack(all_features)

# ==========================================
# 3. Combine Features & Compute Similarity
# ==========================================
def build_hybrid_features(tfidf_matrix, numeric_matrix, image_matrix):
    """
    Combines sparse TF-IDF and dense Numeric/Image features efficiently.
    """
    print("Combining features...")
    # Convert dense arrays to sparse matrices to match TF-IDF
    # This prevents RAM crashes when merging with highly dimensional TF-IDF
    sparse_image = csr_matrix(image_matrix)
    sparse_numeric = csr_matrix(numeric_matrix)
    
    # Horizontally stack (concatenate) the matrices
    hybrid_matrix = hstack([tfidf_matrix, sparse_numeric, sparse_image])
    return hybrid_matrix.tocsr() # Return as Compressed Sparse Row for math efficiency

# ==========================================
# 4. Recommendation Engine
# ==========================================
class FashionRecommender:
    def __init__(self, df, feature_matrix):
        self.df = df.reset_index(drop=True)
        self.feature_matrix = feature_matrix
        
        # Precompute the similarity matrix (Memory warning: 14k x 14k = ~800MB)
        # If your dataset grows > 50k, compute this on-the-fly inside the function instead!
        print("Computing Cosine Similarity Matrix...")
        self.sim_matrix = cosine_similarity(self.feature_matrix)

    def recommend(self, product_id, top_n=5):
        # 1. Find the index of the product
        if product_id not in self.df['p_id'].values:
            return "Product ID not found."
        
        idx = self.df[self.df['p_id'] == product_id].index[0]
        
        # 2. Get similarity scores for this product
        sim_scores = list(enumerate(self.sim_matrix[idx]))
        
        # 3. Sort products based on similarity scores (descending)
        # Skip the first one because it's the product itself (score = 1.0)
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[1:top_n+1]
        
        # 4. Get the indices
        product_indices = [i[0] for i in sim_scores]
        scores = [i[1] for i in sim_scores]
        
        # 5. Return the top N most similar products
        results = self.df.iloc[product_indices].copy()
        results['similarity_score'] = scores
        return results[['p_id', 'name', 'brand', 'similarity_score', 'local_img_path']]

# ==========================================
# 5. Accuracy & Evaluation Report (Train/Test Split)
# ==========================================
def evaluate_model_accuracy(df, feature_matrix, test_size=0.1, top_k=5):
    print(f"\n--- Running Evaluation Report (Test Size: {test_size*100}%) ---")
    
    # 1. Train/Test Split (Split indices to separate features and dataframe cleanly)
    indices = np.arange(len(df))
    train_idx, test_idx = train_test_split(indices, test_size=test_size, random_state=42)
    
    train_df = df.iloc[train_idx].reset_index(drop=True)
    test_df = df.iloc[test_idx].reset_index(drop=True)
    
    train_features = feature_matrix[train_idx]
    test_features = feature_matrix[test_idx]
    
    print(f"Catalog (Train) Size: {len(train_df)} | Queries (Test) Size: {len(test_df)}")
    
    # 2. Compute similarity between Test (queries) and Train (catalog)
    # This simulates a user clicking a new item, and the system searching the existing catalog
    print("Computing similarity between test queries and train catalog...")
    sim_matrix = cosine_similarity(test_features, train_features)
    
    # Helper to extract 'Type' (e.g., 'Pullover', 'Kurta') from the p_attributes string
    def get_type(attr_str):
        try:
            attrs = ast.literal_eval(str(attr_str))
            return attrs.get('Type', '').lower()
        except:
            return ''
            
    # 3. Evaluate Metrics
    precision_scores = []
    hit_rates = []
    
    for i in tqdm(range(len(test_df)), desc="Evaluating Queries"):
        query_brand = str(test_df.iloc[i]['brand']).lower()
        query_type = get_type(test_df.iloc[i]['p_attributes'])
        
        # Get top K indices from train set for this test query
        top_k_indices = sim_matrix[i].argsort()[::-1][:top_k]
        
        # Retrieve recommended items
        recs = train_df.iloc[top_k_indices]
        
        # 4. Check Relevance (Does the recommendation match the brand OR type?)
        relevance_mask = []
        for _, rec in recs.iterrows():
            rec_brand = str(rec['brand']).lower()
            rec_type = get_type(rec['p_attributes'])
            
            # It is a "Hit" if it's the same brand, or if the product types match
            is_match = bool(
                (rec_brand == query_brand) or 
                (query_type != '' and query_type in rec_type) or 
                (rec_type != '' and rec_type in query_type)
            )
            relevance_mask.append(is_match)
            
        num_relevant = sum(relevance_mask)
        
        # Precision@K: % of the K recommended items that were relevant
        precision_scores.append(num_relevant / top_k)
        # Hit Rate@K: 1 if at least one relevant item was found, else 0
        hit_rates.append(1 if num_relevant > 0 else 0)
        
    print("\n" + "="*50)
    print("FINAL ACCURACY REPORT")
    print("="*50)
    print(f"Mean Precision@{top_k}: {np.mean(precision_scores):.4f} (Avg % of relevant items per query)")
    print(f"Hit Rate@{top_k}:      {np.mean(hit_rates)*100:.2f}% (Queries with at least 1 relevant match)")
    print("="*50)
    print("Note: An item is considered 'relevant' if it matches the Query's Brand or Product Type.")
if __name__ == "__main__":
    # 1. Load your dataset
    print("Loading dataset...")
    df = pd.read_csv("Fashion_Dataset_Cleaned.csv")
    
    # 2. Build Text Features (TF-IDF)
    tfidf_features = build_text_features(df)
    print(f"TF-IDF Shape: {tfidf_features.shape}")
    
    # 3. Build Numeric Features (Scaled)
    scaled_numeric_features = build_numeric_features(df)
    print(f"Numeric Shape: {scaled_numeric_features.shape}")
    
    # 4. Extract Image features (2048 dimensions)
    # (If you get memory/multiprocessing errors on Windows, set batch_size=32 and num_workers=0 in the DataLoader)
    image_embeddings = extract_image_features(df, batch_size=64)
    print(f"Image Feature Shape: {image_embeddings.shape}")
    
    # 5. Combine them all into one massive hybrid feature matrix
    final_hybrid_features = build_hybrid_features(tfidf_features, scaled_numeric_features, image_embeddings)
    print(f"Final Hybrid Matrix Shape: {final_hybrid_features.shape}")
    
    # 6. Save the combined embeddings for later use
    save_npz("hybrid_feature_matrix.npz", final_hybrid_features)
    print("Features saved successfully to 'hybrid_feature_matrix.npz'.")
    
    # 7. Build Recommender and Test
    recommender = FashionRecommender(df, final_hybrid_features)
    
    sample_pid = df['p_id'].iloc[0]
    print(f"\nRecommendations for Product ID {sample_pid}:")
    recommendations = recommender.recommend(sample_pid, top_n=5)
    print(recommendations)

    evaluate_model_accuracy(df, final_hybrid_features, test_size=0.10, top_k=5)