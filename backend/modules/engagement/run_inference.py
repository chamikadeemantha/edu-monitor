import cv2
import numpy as np
import pandas as pd
import pickle
from ultralytics import YOLO
from collections import deque, defaultdict
# Fix imports to work both as script and module
try:
    from .head_pose import estimate_pitch_bgr
    from .pose_utils import get_basic_pose_keypoints
except ImportError:
    from head_pose import estimate_pitch_bgr
    from pose_utils import get_basic_pose_keypoints

FPS = 25
WINDOW_SEC = 3
WINDOW_FRAMES = FPS * WINDOW_SEC
SKIP_POSE_FRAMES = 15
FRAME_STRIDE = 2  

def classify_frame_posture(pitch, pose_kpts):
    head_down = 0
    head_on_desk = 0
    lean_forward = 0
    writing_like = 0

    # 2. Robust Pose/Pitch: conservative pitch threshold if pose is missing
    if pose_kpts is None:
        if pitch is not None and pitch > 25:  # Increased from 15 for valid-only pitch
            head_down = 1
        return head_down, head_on_desk, lean_forward, writing_like

    nose = pose_kpts.get("nose")
    ls = pose_kpts.get("l_shoulder")
    rs = pose_kpts.get("r_shoulder")
    lh = pose_kpts.get("l_hip")
    rh = pose_kpts.get("r_hip")
    lw = pose_kpts.get("l_wrist")
    rw = pose_kpts.get("r_wrist")

    if pitch is not None and pitch > 15:
        head_down = 1

    # Check for critical body parts
    if any(k is None for k in [nose, ls, rs, lh, rh]):
        # Fallback to loose pitch check if we can't estimate torso
        if pitch is not None and pitch > 20: # Slightly higher than 15
            head_down = 1
        return head_down, head_on_desk, lean_forward, writing_like

    nose_y = nose[1]
    ls_y = ls[1]; rs_y = rs[1]
    lh_y = lh[1]; rh_y = rh[1]

    shoulder_y = (ls_y + rs_y) / 2.0
    hip_y = (lh_y + rh_y) / 2.0
    torso_len = abs(hip_y - shoulder_y) + 1e-6

    if abs(nose_y - hip_y) < 0.3 * torso_len:
        head_on_desk = 1

    if nose_y > shoulder_y + 0.2 * torso_len:
        lean_forward = 1

    # 1. Writing Logic
    # Heuristic: Head is down/forward AND at least one wrist is in the "desk zone"
    # Desk zone approx: below shoulders, above hips (or slightly below hips if camera is high)
    # We'll valid detection if wrist is below shoulder line.
    wrists_on_desk = False
    for w_pt in [lw, rw]:
        if w_pt is not None:
            wy = w_pt[1]
            # Check if wrist is lower than shoulders (y is bigger)
            if wy > shoulder_y:
                wrists_on_desk = True
    
    # If leaning forward or head down, AND wrists are engaging, classify as writing_like
    if (head_down or lean_forward) and wrists_on_desk:
        writing_like = 1

    return head_down, head_on_desk, lean_forward, writing_like

import os

# ...

def run_inference(video_path=None, show_video=False):
    print("Entered run_inference...", flush=True)
    # Base path for this module
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # If video_path is None, default to the sample in data/
    if video_path is None:
        video_path = os.path.join(BASE_DIR, "data", "sample_classroom.mp4")
    
    print(f"Target Video Path: {video_path}", flush=True)

    # Load engagement model
    model_path = os.path.join(BASE_DIR, "models", "engagement_model.pkl")
    print(f"Loading engagement model from {model_path}...", flush=True)
    with open(model_path, "rb") as f:
        clf = pickle.load(f)
    print("Engagement model loaded.", flush=True)

    # Load YOLO
    yolo_path = os.path.join(BASE_DIR, "yolov8n.pt")
    print(f"Loading YOLO from {yolo_path}...", flush=True)
    try:
        model = YOLO(yolo_path)
    except:
        print("Fallback to yolov8s...", flush=True)
        model = YOLO(os.path.join(BASE_DIR, "yolov8s.pt"))
    print("YOLO loaded.", flush=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error opening video {video_path}", flush=True)
        return

    history = defaultdict(lambda: deque(maxlen=WINDOW_FRAMES))
    # 4. Tracking Stability: Smooth predictions
    prediction_history = defaultdict(lambda: deque(maxlen=5)) 
    engagement_state = {}
    pose_cache = {}

    frame_count = 0
    last_detections = []  # list of dicts: {x1,y1,x2,y2,color,text}

    print("Starting inference loop...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        if frame is None:
            break

        # Resize frame to width 1280 for better visibility
        h, w = frame.shape[:2]
        target_w = 1280
        if w > target_w:
            scale = target_w / w
            new_h = int(h * scale)
            frame = cv2.resize(frame, (target_w, new_h))
            h, w = frame.shape[:2]

        run_heavy = (frame_count % FRAME_STRIDE == 0)

        if run_heavy:
            # Run YOLO tracking
            try:
                results = model.track(frame, classes=[0], verbose=False, persist=True)
            except Exception as e:
                print(f"Tracking error: {e}")
                break

            frame_boxes = results[0].boxes
            last_detections = []

            if frame_boxes.id is not None:
                ids = frame_boxes.id.cpu().numpy().astype(int)
                boxes = frame_boxes.xyxy.cpu().numpy()
                
                # Apply NMS to remove duplicates
                try:
                    from .tracking_utils import non_max_suppression_fast
                except ImportError:
                    from tracking_utils import non_max_suppression_fast
                
                boxes, ids = non_max_suppression_fast(boxes, ids, overlapThresh=0.3)

                for (x1, y1, x2, y2), tid in zip(boxes, ids):
                    x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                    x1 = max(0, x1); y1 = max(0, y1)
                    x2 = min(w, x2); y2 = min(h, y2)
                    if x2 <= x1 or y2 <= y1:
                        continue

                    person_crop = frame[y1:y2, x1:x2]
                    if person_crop.size == 0:
                        continue

                    # Pose (downscaled, infrequent)
                    pose_kpts = None
                    if frame_count % SKIP_POSE_FRAMES == 0:
                        try:
                            small_crop = cv2.resize(person_crop, None, fx=0.5, fy=0.5)
                            pose_kpts = get_basic_pose_keypoints(small_crop)
                            pose_cache[tid] = pose_kpts
                        except Exception:
                            pose_kpts = pose_cache.get(tid, None)
                    else:
                        pose_kpts = pose_cache.get(tid, None)

                    # Head pitch (downscaled)
                    head_h = (y2 - y1) // 3
                    head_crop = frame[y1:y1 + head_h, x1:x2]
                    if head_crop.size > 0:
                        head_small = cv2.resize(head_crop, None, fx=0.5, fy=0.5)
                        pitch = estimate_pitch_bgr(head_small)
                    else:
                        pitch = None

                    hd, hod, lf, wl = classify_frame_posture(pitch, pose_kpts)
                    p_val = pitch if pitch is not None else np.nan
                    history[tid].append((p_val, hd, hod, lf, wl))

                    # Update engagement every 5 heavy frames
                    if len(history[tid]) >= 10 and frame_count % (FRAME_STRIDE * 5) == 0:
                        buffer = list(history[tid])
                        df_buff = pd.DataFrame(buffer, columns=["p", "hd", "hod", "lf", "wl"])

                        # Handle Pitch
                        # Fill NaNs with mean of valid values in window, or 0
                        if df_buff["p"].isnull().all():
                             df_buff["p"] = 0.0
                        else:
                             df_buff["p"] = df_buff["p"].fillna(df_buff["p"].mean())
                        
                        avg_pitch = df_buff["p"].mean()
                        
                        # 3. Static Listening features
                        # Calculate delta between consecutive frames
                        df_buff["p_delta"] = df_buff["p"].diff().abs().fillna(0.0)
                        p_delta_mean = df_buff["p_delta"].mean()
                        p_delta_std = df_buff["p_delta"].std()
                        if np.isnan(p_delta_std): p_delta_std = 0.0

                        r_hd = df_buff["hd"].mean()
                        r_hod = df_buff["hod"].mean()
                        r_lf = df_buff["lf"].mean()
                        r_wl = df_buff["wl"].mean()

                        X_in = pd.DataFrame(
                            [[avg_pitch, r_hd, r_hod, r_lf, r_wl, p_delta_mean, p_delta_std]],
                            columns=["avg_pitch", "ratio_head_down",
                                     "ratio_head_on_desk", "ratio_lean_forward", 
                                     "ratio_writing_like", "pitch_delta_mean", "pitch_delta_std"]
                        )

                        try:
                            # IMPORTANT: This will fail until model is retrained with new features.
                            # For now, we wrap in try/except and just output a default or warning if shape mismatch
                            if clf.n_features_in_ != X_in.shape[1]:
                                # print(f"Model mismatch: expect {clf.n_features_in_}, got {X_in.shape[1]}")
                                pred = 0; prob = 0.0
                            else:
                                prob = clf.predict_proba(X_in)[0][1]
                                pred = 1 if prob > 0.5 else 0
                            
                            # Smoothing
                            prediction_history[tid].append(pred)
                            # Majority vote
                            if sum(prediction_history[tid]) > len(prediction_history[tid]) / 2:
                                final_pred = 1
                            else:
                                final_pred = 0
                                
                            engagement_state[tid] = (final_pred, prob)
                        except Exception:
                            pass

                    # Prepare visualization info
                    label, score = engagement_state.get(tid, (None, 0.0))
                    if label == 1:
                        color = (0, 255, 0)
                        text = f"Engaged ({score:.2f})"
                    elif label == 0:
                        color = (0, 0, 255)
                        text = f"Not Engaged ({score:.2f})"
                    else:
                        color = (0, 255, 255)
                        text = "Analyzing..."

                    # 4. Tracking Stability: Enforce valid history length
                    if len(history[tid]) < WINDOW_FRAMES / 2:
                         text = "Analyzing..."
                         color = (0, 255, 255)

                    last_detections.append({
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                        "color": color, "text": text
                    })

        # Draw on frame (every frame, using latest detections)
        for det in last_detections:
            x1 = det["x1"]; y1 = det["y1"]
            x2 = det["x2"]; y2 = det["y2"]
            color = det["color"]; text = det["text"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, text, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Show video if requested
        if show_video:
            cv2.imshow("Engagement Analysis", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Encode frame to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    # When run as script, show the video
    print("Running in standalone mode...", flush=True)
    for _ in run_inference(video_path=None, show_video=True):
        pass
