import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

def train_engagement_model():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(BASE_DIR, "data", "labeled_dataset_new.csv")
    model_dir = os.path.join(BASE_DIR, "models")
    model_path = os.path.join(model_dir, "engagement_model.pkl")

    if not os.path.exists(model_dir):
        os.makedirs(model_dir)

    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print(f"Error: {data_path} not found.")
        return

    # Features and Target
    # Features and Target
    feature_cols = ['avg_pitch', 'ratio_head_down', 'ratio_head_on_desk', 'ratio_lean_forward',
                    'ratio_writing_like', 'pitch_delta_mean', 'pitch_delta_std']
    target_col = 'label_engaged'

    # Drop rows where target is missing (just in case, though we cleaned it)
    df = df.dropna(subset=[target_col])

    X = df[feature_cols]
    y = df[target_col]

    print(f"Training with {len(df)} samples.")
    print(f"Class distribution:\n{y.value_counts()}")

    # Split Data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Initialize and Train Model
    print("Training Random Forest Classifier...")
    # Using class_weight='balanced' to handle potential imbalance
    clf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    clf.fit(X_train, y_train)

    # Evaluate
    print("\n--- Evaluation on Test Set ---")
    y_pred = clf.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc:.4f}")
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    print("\nClassification Report:")
    report = classification_report(y_test, y_pred)
    print(report)
    
    with open("results.txt", "w") as f:
        f.write(report)
        f.write(f"\nAccuracy: {acc:.4f}\n")

    # Feature Importance
    print("\nFeature Importances:")
    importances = clf.feature_importances_
    for name, imp in zip(feature_cols, importances):
        print(f"  {name}: {imp:.4f}")

    # Save Model
    print(f"\nSaving model to {model_path}...")
    with open(model_path, 'wb') as f:
        pickle.dump(clf, f)
    print("Done.")

if __name__ == "__main__":
    train_engagement_model()
