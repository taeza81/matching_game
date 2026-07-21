import cv2
import numpy as np

# Load image
img = cv2.imread('images/characters.jpg')
if img is None:
    print("Cannot read image")
    exit(1)

# Create mask for floodfill
h, w = img.shape[:2]
mask = np.zeros((h+2, w+2), np.uint8)

# Flood fill from top-left corner
cv2.floodFill(img, mask, (0,0), (255, 255, 255), (10, 10, 10), (10, 10, 10), cv2.FLOODFILL_MASK_ONLY)

# Convert to BGRA (add alpha channel)
img_bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

# Where mask is 1 (filled area), set alpha to 0
img_bgra[mask[1:-1, 1:-1] == 1] = [0, 0, 0, 0]

# Write to file
cv2.imwrite('images/characters_transparent.png', img_bgra)
print("Saved transparent PNG")
