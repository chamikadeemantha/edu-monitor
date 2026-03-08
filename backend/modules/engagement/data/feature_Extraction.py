import os
import cv2
import math
import pandas as pd
import numpy as np
from ultralytics import YOLO
from tqdm import tqdm

print("Loading YOLO-Pose model...")
model = YOLO('yolov8n-pose.pt') 

# !!! CHANGE THIS TO MATCH YOUR PUBLIC DATASET AFTER RUNNING LOCAL !!!
DATASET_DIR = "Final_YOLO_Dataset"
OUTPUT_CSV = "custom_classroom_features.csv"

def calculate_angle(a, b, c):
    radians = math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / math.pi)
    return 360 - angle if angle > 180.0 else angle

def get_iou(bb1, bb2):
    x_left = max(bb1[0], bb2[0])
    y_top = max(bb1[1], bb2[1])
    x_right = min(bb1[2], bb2[2])
    y_bottom = min(bb1[3], bb2[3])

    if x_right < x_left or y_bottom < y_top: return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    bb1_area = (bb1[2] - bb1[0]) * (bb1[3] - bb1[1])
    bb2_area = (bb2[2] - bb2[0]) * (bb2[3] - bb2[1])
    return intersection_area / float(bb1_area + bb2_area - intersection_area)

dataset_rows = []
total_images_processed = 0
total_poses_extracted = 0

print(f"\nScanning directory: {DATASET_DIR}...")
images_dir = os.path.join(DATASET_DIR, 'images')
labels_dir = os.path.join(DATASET_DIR, 'labels')

# Support both flat structures (your custom dataset) and split structures (train/val for public)
search_dirs = []
if os.path.exists(images_dir) and any(f.endswith('.jpg') for f in os.listdir(images_dir)):
    search_dirs.append((images_dir, labels_dir))
else:
    for split in ['train', 'val']:
        s_img = os.path.join(images_dir, split)
        s_lbl = os.path.join(labels_dir, split)
        if os.path.exists(s_img): search_dirs.append((s_img, s_lbl))

for img_d, lbl_d in search_dirs:
    image_files = [f for f in os.listdir(img_d) if f.endswith(('.jpg', '.png', '.jpeg'))]
    print(f"\n--- Processing: Found {len(image_files)} images in {img_d} ---")

    for img_name in tqdm(image_files, desc="Extracting 9 Advanced Features", unit="img"):
        img_path = os.path.join(img_d, img_name)
        label_path = os.path.join(lbl_d, os.path.splitext(img_name)[0] + '.txt')
        
        if not os.path.exists(label_path): continue

        img = cv2.imread(img_path)
        img_h, img_w, _ = img.shape
        
        ground_truths = []
        with open(label_path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 5:
                    class_id = int(parts[0])
                    cx, cy, w, h = float(parts[1])*img_w, float(parts[2])*img_h, float(parts[3])*img_w, float(parts[4])*img_h
                    x1, y1, x2, y2 = cx - w/2, cy - h/2, cx + w/2, cy + h/2
                    ground_truths.append({'class': class_id, 'box': [x1, y1, x2, y2], 'width': w, 'height': h})

        if not ground_truths: continue

        results = model(img_path, verbose=False)
        for result in results:
            if result.boxes is None or result.keypoints is None: continue
            
            for i in range(len(result.boxes)):
                yolo_box = result.boxes.xyxy[i].cpu().numpy() 
                keypoints = result.keypoints.xy[i].cpu().numpy() 
                if len(keypoints) < 13: continue 

                best_iou, assigned_class, bbox_width, bbox_height = 0, -1, 0, 0
                for gt in ground_truths:
                    iou = get_iou(yolo_box, gt['box'])
                    if iou > best_iou:
                        best_iou, assigned_class, bbox_width, bbox_height = iou, gt['class'], gt['width'], gt['height']
                
                if best_iou > 0.4:
                    nose = keypoints[0]
                    l_eye, r_eye = keypoints[1], keypoints[2]
                    l_sh, r_sh = keypoints[5], keypoints[6]
                    l_wr, r_wr = keypoints[9], keypoints[10]
                    l_hip, r_hip = keypoints[11], keypoints[12]
                    
                    if np.all(l_sh == 0) or np.all(r_sh == 0): continue
                        
                    mid_sh = ((l_sh[0]+r_sh[0])/2, (l_sh[1]+r_sh[1])/2)
                    
                    if not np.all(l_hip == 0) and not np.all(r_hip == 0):
                        mid_hip = ((l_hip[0]+r_hip[0])/2, (l_hip[1]+r_hip[1])/2)
                        torso_angle = calculate_angle(mid_sh, mid_hip, (mid_hip[0] + 100, mid_hip[1]))
                    else:
                        torso_angle = 90.0
                    
                    shoulder_width = math.dist(l_sh, r_sh)
                    shoulder_ratio = shoulder_width / bbox_width if bbox_width > 0 else 0
                    
                    l_wrist_elev = l_sh[1] - l_wr[1] if not np.all(l_wr == 0) else -999
                    r_wrist_elev = r_sh[1] - r_wr[1] if not np.all(r_wr == 0) else -999
                    max_wrist_elevation = max(l_wrist_elev, r_wrist_elev)
                    bbox_aspect_ratio = bbox_width / bbox_height if bbox_height > 0 else 0
                    head_drop = (mid_sh[1] - nose[1]) / bbox_height if not np.all(nose == 0) and bbox_height > 0 else 0 

                    delta_y, delta_x = abs(r_sh[1] - l_sh[1]), abs(r_sh[0] - l_sh[0])
                    shoulder_tilt = math.degrees(math.atan2(delta_y, delta_x)) if delta_x != 0 else 90

                    # --- NEW FEATURE 1: Wrist to Nose Proximity (Sleeping on hands) ---
                    if not np.all(nose == 0):
                        l_wn = math.dist(l_wr, nose) if not np.all(l_wr == 0) else 9999
                        r_wn = math.dist(r_wr, nose) if not np.all(r_wr == 0) else 9999
                        wrist_to_nose = min(l_wn, r_wn) / bbox_height if bbox_height > 0 else 0
                        if wrist_to_nose > 10: wrist_to_nose = 1.0
                    else:
                        wrist_to_nose = 0.0 # Face buried
                        
                    # --- NEW FEATURE 2: Distance between wrists (Folded Arms) ---
                    if not np.all(l_wr == 0) and not np.all(r_wr == 0):
                        wrist_distance = math.dist(l_wr, r_wr) / bbox_width if bbox_width > 0 else 0
                    else:
                        wrist_distance = 1.0 # Hands apart or hidden
                        
                    # --- NEW FEATURE 3: Eye Distance (Face rotation proxy) ---
                    if not np.all(l_eye == 0) and not np.all(r_eye == 0):
                        eye_distance = math.dist(l_eye, r_eye) / bbox_width if bbox_width > 0 else 0
                    else:
                        eye_distance = 0.0 # Face buried
                    
                    dataset_rows.append({
                        'torso_angle': torso_angle,
                        'shoulder_ratio': shoulder_ratio,
                        'max_wrist_elevation': max_wrist_elevation,
                        'bbox_aspect_ratio': bbox_aspect_ratio,
                        'head_drop': head_drop,
                        'shoulder_tilt': shoulder_tilt,
                        'wrist_to_nose': wrist_to_nose,
                        'wrist_distance': wrist_distance,
                        'eye_distance': eye_distance,
                        'target_class': assigned_class
                    })
                    total_poses_extracted += 1

        total_images_processed += 1

print("\n" + "="*40)
print("FEATURE EXTRACTION SUMMARY")
print("="*40)
print(f"Total images processed:       {total_images_processed}")
print(f"Total valid poses extracted:  {total_poses_extracted}")
print("="*40)

if dataset_rows:
    df = pd.DataFrame(dataset_rows)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSuccess! Features saved to '{OUTPUT_CSV}'.")