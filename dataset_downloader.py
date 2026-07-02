"""
============================================================
Paw Classifier - Dataset Downloader
============================================================

Purpose
-------
This script downloads high-quality Cat and Dog images from the
Pixabay API to build the training dataset used for the
"Paw Classifier" machine learning model.

The downloaded images are organized into:

images/
├── Cats/
└── Dogs/

These images can then be uploaded to Google Teachable Machine
to train the Cat vs Dog image classification model.

------------------------------------------------------------
Pixabay API Key
------------------------------------------------------------

1. Create a free Pixabay account:
   https://pixabay.com/

2. Generate your free API key:
   https://pixabay.com/api/docs/

3. Run this script and paste your API key when prompted.

The free plan is more than sufficient for this project.

------------------------------------------------------------
Requirements

pip install requests pillow

------------------------------------------------------------
Author
------------------------------------------------------------

M Kishore
GitHub: https://github.com/mkishoredev

============================================================
"""

import hashlib
import io
import time
from pathlib import Path

import requests
from PIL import Image

# ============================================================
# Configuration
# ============================================================

# Enter your Pixabay API Key when prompted.
# Get one for free:
# https://pixabay.com/api/docs/

API_KEY = input("Enter your Pixabay API Key: ").strip()

# Number of images to download for each class.

IMAGES_PER_CLASS = 100

# Folder where images will be saved.

OUTPUT_DIR = Path("images")

# Classes used for training.

CLASSES = {
    "Cats": "cat",
    "Dogs": "dog"
}

OUTPUT_DIR.mkdir(exist_ok=True)

session = requests.Session()

HEADERS = {
    "User-Agent": "PawClassifierDatasetDownloader/1.0"
}

total_downloaded = 0


def sha256(data):
    """
    Returns a SHA-256 hash of image bytes.

    Used to detect and skip duplicate images.
    """
    return hashlib.sha256(data).hexdigest()


# ============================================================
# Download Images
# ============================================================

for cls, query in CLASSES.items():

    folder = OUTPUT_DIR / cls
    folder.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"Downloading {cls}")
    print(f"{'=' * 60}")

    hashes = set()
    downloaded = 0
    page = 1

    while downloaded < IMAGES_PER_CLASS:

        # Search Pixabay

        response = session.get(
            "https://pixabay.com/api/",
            params={
                "key": API_KEY,
                "q": query,
                "image_type": "photo",
                "orientation": "all",
                "per_page": 200,
                "page": page,
                "safesearch": "true",
            },
            headers=HEADERS,
            timeout=30,
        )

        if response.status_code != 200:
            print(f"API Error: {response.status_code}")
            print(response.text)
            break

        data = response.json()
        hits = data.get("hits", [])

        if not hits:
            print("No more images found.")
            break

        for hit in hits:

            if downloaded >= IMAGES_PER_CLASS:
                break

            # Prefer higher resolution images

            image_url = (
                hit.get("largeImageURL")
                or hit.get("webformatURL")
            )

            if not image_url:
                continue

            try:

                img = session.get(
                    image_url,
                    headers=HEADERS,
                    timeout=30,
                )

                if img.status_code != 200:
                    continue

                content = img.content

                # Skip exact duplicate images

                image_hash = sha256(content)

                if image_hash in hashes:
                    continue

                image = Image.open(
                    io.BytesIO(content)
                ).convert("RGB")

                # Ignore very small images

                if image.width < 300 or image.height < 300:
                    continue

                hashes.add(image_hash)

                filename = folder / f"{downloaded + 1:03}.jpg"

                image.save(
                    filename,
                    "JPEG",
                    quality=95,
                )

                downloaded += 1
                total_downloaded += 1

                print(
                    f"\r{cls}: {downloaded}/{IMAGES_PER_CLASS}",
                    end="",
                    flush=True,
                )

            except Exception:
                # Skip corrupted or invalid images.
                continue

        page += 1

        # Small delay to avoid hitting API rate limits.

        time.sleep(0.5)

    print(f"\nFinished {cls}: {downloaded} images")


# ============================================================
# Summary
# ============================================================

print("\n" + "=" * 60)
print("Dataset Download Complete")
print("=" * 60)
print(f"Total Images Downloaded : {total_downloaded}")
print(f"Saved To : {OUTPUT_DIR.resolve()}")