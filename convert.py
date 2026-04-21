import os
import pandas as pd

# Load your original data
df = pd.read_csv("Fashion Dataset.csv")
base_image_path = r"D:\Games\clothing_recommendation\Images\Images"

# Create the full path based on the index
# We'll use .apply to build the path: D:\Games\...\Images\0.jpg, 1.jpg, etc.
df['local_img_path'] = df.index.to_series().apply(
    lambda i: os.path.join(base_image_path, f"{i}.jpg")
)

# Verify one last time
exists_count = df['local_img_path'].apply(os.path.exists).sum()
print(f"Verified {exists_count} images ready for use.")

# Save this to a NEW CSV so you don't lose the original
df.to_csv("Fashion_Dataset_Cleaned.csv", index=False)
print("Saved to: Fashion_Dataset_Cleaned.csv")