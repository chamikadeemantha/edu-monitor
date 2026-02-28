# Complete Master Plan — ML-Powered Edu-Monitor System

## Everything You Need: Research + Model + System + Panel Presentation

---

# SECTION 1: YOUR RESEARCH — WHAT YOU DID

## 1.1 Research Objective

**Title**: Identifying and Validating Student-Affected Factors with Attendance Data Using Machine Learning

**Goal**: Design a survey instrument that measures factors affecting student attendance, validate it using ML against real attendance data, and build a system that uses these findings to provide prescriptive insights for educators.

## 1.2 Data Collection

| Item | Details |
|---|---|
| **Survey Respondents** | 115 students |
| **Survey Questions** | 28 Likert-scale questions (Strongly Disagree to Strongly Agree) |
| **Attendance Data** | Historical 14-week semester attendance records (obtained from lecturer) |
| **Dataset Format** | CSV with 38 columns (Student ID, Gender, 28 survey questions, Attendance_Percentage, etc.) |

## 1.3 The 6 Survey Factors

| Factor | Name | Questions | What It Measures |
|---|---|---|---|
| **A** | Health & Well-Being | A1–A4 (4 questions) | Physical/mental health barriers |
| **B** | Personal & Self-Regulation | B1–B4 (4 questions) | Motivation, time management |
| **C** | Peer & Social Influence | C1–C5 (5 questions) | Friend groups, social pressure |
| **D** | Environmental & Classroom | D1–D5 (5 questions) | Room conditions, infrastructure |
| **E** | Academic & Teaching-Related | E1–E4 (4 questions) | Teaching quality, engagement |
| **F** | Temporal & Institutional | F1–F6 (6 questions) | Scheduling, timetable conflicts |

## 1.4 Data Processing

**Step 1**: Convert Likert text to numbers:
```
Strongly Disagree = 1, Disagree = 2, Neutral = 3, Agree = 4, Strongly Agree = 5
```

**Step 2**: Reverse-score positively-worded questions:
```
If a question uses words like "motivate", "encourage", "improve", "enhance":
    Score = 6 - original_value
This ensures higher score ALWAYS means MORE barriers to attendance.
```

**Step 3**: Compute factor scores:
```
Factor_A = average of (A1, A2, A3, A4)
Factor_B = average of (B1, B2, B3, B4)
Factor_C = average of (C1, C2, C3, C4, C5)
Factor_D = average of (D1, D2, D3, D4, D5)
Factor_E = average of (E1, E2, E3, E4)
Factor_F = average of (F1, F2, F3, F4, F5, F6)
```

## 1.5 Correlation Findings

Correlation between each factor and Attendance_Percentage:

| Factor | Correlation | Interpretation |
|---|---|---|
| **Factor F** (Temporal) | **-0.887** | Strongest barrier — scheduling is the #1 cause of absenteeism |
| **Factor A** (Health) | **-0.860** | Second strongest — health issues significantly reduce attendance |
| **Factor E** (Academic) | -0.630 | Moderate — teaching quality affects attendance |
| **Factor B** (Personal) | -0.540 | Moderate — motivation and self-regulation matter |
| **Factor C** (Peer) | -0.368 | Weaker — peer influence has some effect |
| **Factor D** (Environmental) | -0.142 | Weakest — classroom environment has minimal direct effect |

*All correlations are negative: higher factor score = more barriers = lower attendance.*

---

# SECTION 2: YOUR ML MODEL — HOW IT WORKS

## 2.1 Why Random Forest?

Random Forest was chosen for three reasons:
1. **Non-linear relationships**: It captures complex interactions between factors
2. **Robust with small data**: It avoids overfitting with 115 samples (unlike deep learning)
3. **Feature importance**: It tells us WHICH factors matter most — critical for recommendations

## 2.2 Model Architecture

```
Algorithm:          Random Forest Regressor
Number of Trees:    400
Features (X):       6 factor scores (Factor_A through Factor_F)
Target (y):         Attendance_Percentage
Train/Test Split:   80% training / 20% testing
Random State:       42 (for reproducibility)
Missing Data:       SimpleImputer with median strategy
Validation:         5-fold cross-validation
```

## 2.3 How Random Forest Works (Simple Explanation)

```
Step 1: Create 400 decision trees
Step 2: Each tree gets a random sample of students and random subset of factors
Step 3: Each tree learns its own rules, e.g.:
        "If Factor_F > 3.5 AND Factor_A > 3.0 → predict ~60% attendance"
Step 4: For a new student, all 400 trees make predictions
Step 5: Final prediction = average of all 400 predictions
        This averaging makes the model robust and reduces errors

Feature Importance:
- Measures how much each factor reduces prediction error
- Factor with highest importance = strongest predictor of attendance
```

## 2.4 Model Code (Your Existing Colab — Explained)

```python
# === IMPORT LIBRARIES ===
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_absolute_error

# === PREPARE DATA ===
# X = the 6 factor scores (features)
factor_cols = ['Factor_A', 'Factor_B', 'Factor_C', 'Factor_D', 'Factor_E', 'Factor_F']
X = df[factor_cols]

# y = attendance percentage (what we want to predict)
y = df['Attendance_Percentage']

# Split: 80% for training, 20% for testing
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# === BUILD MODEL ===
# Pipeline: first handle missing values, then train Random Forest
model = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),    # Fill any missing values
    ("rf", RandomForestRegressor(n_estimators=400, random_state=42))
])

# Train the model
model.fit(X_train, y_train)

# === EVALUATE ===
y_pred = model.predict(X_test)
r2 = r2_score(y_test, y_pred)           # How well the model fits (0-1, higher = better)
mae = mean_absolute_error(y_test, y_pred) # Average prediction error in %

# Cross-validation (5-fold)
cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
cv_mean = cv_scores.mean()               # Average R² across 5 folds

print(f"R² Score: {r2:.3f}")
print(f"MAE: {mae:.1f}%")
print(f"Cross-Validated R²: {cv_mean:.3f}")

# === FEATURE IMPORTANCE ===
rf_model = model.named_steps['rf']
importance = dict(zip(factor_cols, rf_model.feature_importances_))
# This tells us which factors matter most for predicting attendance
```

## 2.5 Evaluation Metrics — What They Mean

| Metric | What It Means | Your Goal |
|---|---|---|
| **R² (R-squared)** | Percentage of attendance variation explained by factors. R²=0.78 means 78% of why students are absent can be explained by the 6 factors | > 0.60 is good, > 0.75 is very good |
| **MAE (Mean Absolute Error)** | Average prediction error. MAE=5.2 means predictions are off by ~5.2% on average | Lower is better |
| **Cross-Validated R²** | R² tested on 5 different data splits to ensure consistency | Close to the test R² means model is stable |
| **Feature Importance** | Percentage contribution of each factor to the prediction | Used for teacher recommendations |

## 2.6 Common Panel Questions & Answers

**Q: "Why not use Neural Networks / Deep Learning?"**
> "With only 115 samples and 6 features, neural networks would overfit badly. Random Forest is the standard choice for small tabular datasets and provides interpretable results, which is essential for generating actionable recommendations."

**Q: "Is 115 students enough?"**
> "For 6 features, a minimum of 10-15 samples per feature is recommended (60-90 minimum). With 115 samples, we have sufficient data. The strong correlations (up to -0.887) confirm the signal is clear."

**Q: "What about overfitting?"**
> "I used two safeguards: (1) Random Forest's ensemble approach naturally reduces overfitting by averaging 400 trees, and (2) 5-fold cross-validation confirms the model generalizes to unseen data."

**Q: "Why not just use correlation? Why use ML?"**
> "Correlation only measures linear relationships between individual factors and attendance. Random Forest captures non-linear interactions — for example, a student with moderate health issues AND scheduling conflicts may have much worse attendance than either factor alone would suggest. Also, ML provides a prediction model that can be deployed in the live system."

**Q: "How is Feature Importance different from correlation?"**
> "Correlation measures linear relationship between one factor and attendance independently. Feature importance measures each factor's contribution within the context of ALL other factors simultaneously. A factor might have moderate correlation but high importance if it captures unique information not covered by other factors."

---

# SECTION 3: YOUR SYSTEM — WHAT IT DOES

## 3.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Edu-Monitor System                        │
│                                                                  │
│  ┌─── Student Side ──────────────┐  ┌─── Teacher Side ────────┐ │
│  │                                │  │                          │ │
│  │  • Login / Register            │  │  • Login                 │ │
│  │  • Face Recognition Check-in   │  │  • Create Sessions       │ │
│  │  • Fill Survey (28 questions)  │  │  • View Attendance       │ │
│  │  • View Attendance History     │  │  • At-Risk Detection     │ │
│  │                                │  │  • View Survey Results   │ │
│  │                                │  │  • ML Insights Dashboard │ │
│  └────────────────────────────────┘  └──────────────────────────┘ │
│                                                                  │
│  ┌─── Backend ───────────────────────────────────────────────┐   │
│  │  FastAPI + PostgreSQL + SQLAlchemy                         │   │
│  │  Face Recognition (DeepFace)                               │   │
│  │  ML Engine (scikit-learn Random Forest)                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Frontend ──────────────────────────────────────────────┐   │
│  │  Next.js + React + TypeScript                              │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 3.2 Key System Components

| Component | Technology | Purpose |
|---|---|---|
| **Attendance Tracking** | Face Recognition (DeepFace) | Real-time attendance with facial verification |
| **Survey Collection** | React form + PostgreSQL | Same 28-question instrument from research |
| **At-Risk Detection** | Rule-based (< 80% threshold) | Flags students with low attendance |
| **ML Insights** *(NEW)* | scikit-learn Random Forest | Prescriptive analytics for educators |
| **Authentication** | JWT + bcrypt | Secure login for students, teachers, admin |
| **Admin Panel** | Role-based access | User approval, system management |

## 3.3 How Research Data and System Data Connect

```
RESEARCH (validation):
  115 students' survey CSV + 14-week attendance from lecturer
  → Proved the model works (R² > 0.60, strong correlations)

SYSTEM (production):
  Live survey_submissions table + live attendance_records table
  → Applies the same model methodology in real-time
  → Generates actionable insights for teachers

CONNECTION:
  Same survey instrument (28 questions, 6 factors)
  Same ML algorithm (Random Forest Regressor)
  Same factor computation (Likert averages with reverse scoring)
  Different data source (historical vs real-time face recognition)
```

**Key phrase for panel**: "The research validates the methodology; the system operationalizes it."

---

# SECTION 4: ML INTEGRATION INTO SYSTEM — IMPLEMENTATION PLAN

## 4.1 What Will Be Built

| # | Component | Type | Description |
|---|---|---|---|
| 1 | `backend/ml/__init__.py` | NEW file | Empty init for Python package |
| 2 | `backend/ml/insights_engine.py` | NEW file | ML engine — data pipeline + model + insights |
| 3 | `backend/models/attendance/routes.py` | MODIFY | Add 3 new API endpoints |
| 4 | `frontend/app/teacher/attendance/ml-insights/page.tsx` | NEW file | Teacher ML dashboard |

**Nothing else changes.** Existing survey, attendance, database, and face recognition code remain untouched.

## 4.2 Step-by-Step Implementation Details

### Step 1: Install Python Libraries (2 minutes)

```bash
pip install scikit-learn pandas numpy
```
These are installed in the backend virtual environment only.

### Step 2: Create ML Engine — `backend/ml/insights_engine.py` (15 minutes)

This file contains 4 functions:

#### Function 1: `build_dataset(db)` — Build the ML Dataset

What it does:
- Queries the database to get all students who have BOTH survey submissions AND attendance records
- For each student: computes 6 factor scores from their survey answers
- For each student × module: computes their attendance percentage
- Returns a pandas DataFrame ready for ML

Data flow:
```
survey_submissions table → survey_answers table → factor scores (A-F)
                                                          ↓
attendance_sessions table → attendance_records table → attendance % per module
                                                          ↓
Combined DataFrame: [student_id, Factor_A..F, module_code, attendance_pct]
```

SQL joins used:
```
survey_submissions.student_user_id → student_profiles.user_id → student_profiles.student_id
student_profiles.student_id → attendance_records.student_id
attendance_records.session_id → attendance_sessions.session_id (to get module_code)
```

#### Function 2: `train_and_analyze(df)` — Train the Model

What it does:
- Takes the DataFrame from Function 1
- Splits into X (factor scores) and y (attendance percentage)
- Trains a Random Forest Regressor (same parameters as your Colab)
- Computes feature importance, R², MAE

Uses the exact same model as your research:
```python
Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("rf", RandomForestRegressor(n_estimators=400, random_state=42))
])
```

#### Function 3: `get_module_insights(db, module_code)` — Module-Wise Analysis

What it does:
- Filters the dataset to students in a specific module
- Trains the model on that subset
- Returns which factors matter most FOR THAT MODULE
- Generates specific recommendations based on top factors

Output example:
```json
{
    "module_code": "IT2030",
    "model_r2": 0.78,
    "students_analyzed": 35,
    "factor_importance": [
        {"factor": "F", "name": "Temporal & Institutional", "importance_pct": 42.1},
        {"factor": "A", "name": "Health & Well-Being", "importance_pct": 25.3},
        {"factor": "E", "name": "Academic & Teaching-Related", "importance_pct": 18.2}
    ],
    "recommendations": [
        "Scheduling conflicts are the primary attendance barrier in this module",
        "Consider rescheduling sessions that conflict with other commitments",
        "Health-related absences suggest morning sessions may be problematic"
    ]
}
```

#### Function 4: `get_overall_insights(db)` — Global Analysis

What it does:
- Uses ALL data across all modules
- Provides system-wide factor importance
- Shows which factors matter most across the entire institution

### Step 3: Create API Endpoints (10 minutes)

Added to `backend/models/attendance/routes.py`:

```
GET /api/attendance/ml/overview
  → Call get_overall_insights()
  → Returns global factor importance + model metrics

GET /api/attendance/ml/module/{module_code}
  → Call get_module_insights(module_code)
  → Returns module-specific factor importance + recommendations

GET /api/attendance/ml/student/{student_user_id}
  → Returns individual student's factor profile + predicted attendance
```

### Step 4: Create Teacher Dashboard Page (20 minutes)

New page: `frontend/app/teacher/attendance/ml-insights/page.tsx`

What the teacher sees:

```
┌──────────────────────────────────────────────────────────────┐
│  📊 ML-Powered Attendance Insights                            │
│                                                               │
│  Model Performance: R² = 0.78  |  MAE = 5.2%                │
│  Students Analyzed: 87  |  Modules: 5                        │
│                                                               │
│  ┌─── Factor Importance (Global) ──────────────────────────┐ │
│  │  Factor F (Temporal)      ████████████████░░░░░░ 42.1%  │ │
│  │  Factor A (Health)        ██████████░░░░░░░░░░░░ 25.3%  │ │
│  │  Factor E (Academic)      ████████░░░░░░░░░░░░░░ 18.2%  │ │
│  │  Factor B (Personal)      ████░░░░░░░░░░░░░░░░░░  8.5%  │ │
│  │  Factor C (Peer)          ███░░░░░░░░░░░░░░░░░░░  4.1%  │ │
│  │  Factor D (Environment)   █░░░░░░░░░░░░░░░░░░░░░  1.8%  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─── Recommendations ────────────────────────────────────┐  │
│  │  🔴 Critical: Temporal factors dominate (42.1%)         │  │
│  │     → Most absences correlate with scheduling conflicts │  │
│  │     → Recommendation: Review session timing              │  │
│  │                                                          │  │
│  │  🟡 Warning: Health factors are significant (25.3%)     │  │
│  │     → Fatigue and health issues affect attendance        │  │
│  │     → Recommendation: Add breaks in long sessions       │  │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─── Per Module Breakdown ───────────────────────────────┐  │
│  │  Module      | Top Factor        | Importance | Avg Att │  │
│  │  IT2030      | Factor F          | 52.0%      | 72.5%  │  │
│  │  IT2040      | Factor A          | 38.0%      | 68.1%  │  │
│  │  IT2050      | Factor E          | 41.0%      | 81.3%  │  │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Step 5: Seed Demo Data (Optional, for panel demo) (10 minutes)

A Python script that creates sample students with survey responses and attendance records, so the ML dashboard has data to display during the demo.

---

## 4.3 Total Implementation Effort

| Step | Time | Lines of Code |
|---|---|---|
| Install libraries | 2 min | 0 |
| ML Engine (insights_engine.py) | 15 min | ~150 lines |
| API Endpoints | 10 min | ~50 lines |
| Teacher Dashboard | 20 min | ~200 lines |
| Seed Demo Data (optional) | 10 min | ~100 lines |
| **Total** | **~60 min** | **~500 lines** |

---

# SECTION 5: NOVELTY & RESEARCH CONTRIBUTION

## 5.1 The Three Levels of Analytics

| Level | What It Does | Who Has This | Your System |
|---|---|---|---|
| **Descriptive** | "Student X attended 62%" | Every attendance system | ✅ Yes (attendance tracking) |
| **Predictive** | "Student X will likely have 65% attendance" | Some ML research papers | ✅ Yes (Random Forest model) |
| **Prescriptive** | "Student X is absent due to Factor F. Recommendation: reschedule sessions." | **Very few systems** | ✅ **Yes — THIS is your novelty** |

## 5.2 What Makes Your Work Novel

```
Most systems:  Track attendance → Flag low attendance → End

Your system:   Track attendance → Collect survey → ML analysis
               → Identify WHY students are absent (which factors)
               → Recommend WHAT teachers should do (specific actions)
               → Closed-loop improvement
```

## 5.3 One-Line Summaries

**Research summary:**
> "This research develops and validates a 28-item survey instrument measuring 6 factors affecting student attendance, using Random Forest machine learning to establish predictive validity against actual attendance data from 115 students."

**System summary:**
> "Edu-Monitor is an intelligent attendance management system that integrates face-recognition-based attendance tracking with ML-powered prescriptive analytics, using a validated survey instrument to explain attendance barriers and recommend specific interventions to educators."

**Novelty summary:**
> "The novelty lies in the prescriptive analytics layer — the system goes beyond detecting at-risk students to explaining root causes through ML-validated survey factors and recommending data-driven interventions for educators."

---

# SECTION 6: PANEL DEMO SCRIPT (15 Minutes)

## 6.1 How Research & System Connect (What to Explain)

> "For my research validation, I used historical attendance data from the lecturer covering a 14-week semester. I needed complete semester records to validate the survey instrument. The system uses face recognition for real-time attendance tracking, which is the production deployment. The ML methodology is identical — same survey, same model, same factors. The research proves it works; the system applies it in real-time for educators."

## 6.2 Minute-by-Minute Script

| Time | Action | What to Say |
|---|---|---|
| **0:00** | Show dataset screenshot | "I collected survey responses from 115 students and attendance records from the lecturer for a 14-week semester" |
| **1:00** | Show the 6 factors table | "The survey covers 6 factor categories with 28 Likert-scale questions" |
| **2:00** | Show correlation table | "Correlation analysis shows Factor F (Temporal) at -0.887 is the strongest predictor" |
| **3:00** | Show Random Forest explanation | "I used a Random Forest Regressor with 400 decision trees to predict attendance from factor scores" |
| **4:00** | Show model metrics (R², MAE) | "The model achieves R² of X, validated with 5-fold cross-validation" |
| **5:00** | Show feature importance | "Feature importance confirms Factor F and A are the dominant predictors, consistent with correlation analysis" |
| **6:00** | **Open Edu-Monitor system** | "Based on these findings, I built the Edu-Monitor system" |
| **7:00** | Login as student, show survey | "The same survey instrument is embedded in the student dashboard" |
| **8:00** | Show face recognition flow | "Students mark attendance with face recognition — the system verifies their identity" |
| **9:00** | Login as teacher | "Teachers create sessions with modules, PINs, and time slots" |
| **10:00** | Show attendance dashboard | "Real-time attendance tracking with at-risk detection" |
| **11:00** | Show students-progress page | "Students below 80% are flagged with risk badges per module" |
| **12:00** | **Navigate to ML Insights** | "This is the ML component — prescriptive insights for educators" |
| **13:00** | Show factor importance chart | "The system trains the same Random Forest on live data, identifying which factors drive absenteeism" |
| **14:00** | Show recommendations | "Unlike just flagging risks, it explains WHY and recommends WHAT to do" |
| **15:00** | Conclusion | "This creates a closed loop: Survey → ML → Insights → Teacher Action → Better Attendance" |

## 6.3 Dealing With Limited Demo Data

**Your situation**: Only 1 student (Chama) is registered in the live system.

**Solution**: A seed data script can populate the system with 15-20 sample students who have survey responses and attendance records. This gives the ML dashboard realistic data to display.

**What to tell panel if asked**: "For the live demo, I used seed data to simulate a classroom scenario. The system works with any number of students — the more data, the more accurate the ML insights."

## 6.4 Panel Q&A — Ready Answers

**Q: "You used historical data but the system uses face recognition. How is this valid?"**
> "The ML model works with attendance percentages regardless of how they were collected. Whether marked by face recognition, QR code, or manual roll call, the model input is the same — 6 factor scores and an attendance percentage. The research proves the model works on real data; the system provides a modern, automated way to collect that data."

**Q: "Why Random Forest and not something more advanced?"**
> "For tabular data with 6 features and 115 samples, Random Forest is the standard recommendation in the ML literature. It provides interpretable feature importance, which is essential for generating actionable recommendations. More complex models like neural networks would overfit and lose interpretability."

**Q: "Is 115 students statistically sufficient?"**
> "With 6 features, the rule of thumb is 10-15 samples per feature minimum (60-90 samples). At 115, we exceed this. Additionally, the very strong correlations (up to -0.887) confirm robust signal. Cross-validation further validates generalizability."

**Q: "What's the practical benefit for teachers?"**
> "Instead of just seeing 'Student X has 62% attendance', teachers see 'The primary barrier is scheduling conflicts (Factor F = 42%). Recommendation: consider rescheduling the late-evening session.' This is actionable — teachers can make specific changes."

**Q: "What's the novelty compared to existing attendance systems?"**
> "Existing systems are descriptive — they track and report. Some are predictive — they flag at-risk students. Ours is prescriptive — it explains why students are absent using validated survey factors and recommends specific interventions. This three-level analytics approach is the contribution."

**Q: "Can this scale to more students?"**
> "Yes. The model trains in under a second for 100-500 students. For thousands, we'd cache the model and retrain periodically. The system architecture supports this growth."

---

# SECTION 7: SURVEY FACTORS → TEACHER ACTION MAPPING

| Factor | What ML Might Reveal | What Teacher / Educator Can Do |
|---|---|---|
| **A** (Health & Well-Being) | Fatigue drives morning absenteeism | Adjust morning lecture formats, shorter sessions, breaks |
| **B** (Personal & Self-Regulation) | Lack of motivation correlates with attendance drops | Introduce mentoring, incentive structures, reminders |
| **C** (Peer & Social Influence) | Absenteeism clusters in friend groups | Peer learning activities, reassign seating, group work |
| **D** (Environmental & Classroom) | Room conditions affect specific modules | Request room changes, report facility issues to admin |
| **E** (Academic & Teaching-Related) | Non-interactive lectures lose students | Add quizzes, polls, interactive Q&A segments |
| **F** (Temporal & Institutional) | Pre-exam + late-evening = worst attendance | Reschedule, plan targeted revision sessions, flexible slots |

---

# SECTION 8: DATA FLOW DIAGRAM

```
RESEARCH SIDE                          SYSTEM SIDE
(Proving it works)                     (Applying it in practice)

Historical Attendance ──┐              Face Recognition ──────┐
(14 weeks from lecturer) │              (Real-time check-in)    │
                         ├─→ ML Model                          ├─→ ML Model
Survey CSV (115 students)│   (Random Forest)                   │   (Same Random Forest)
                         │              Survey Database ───────┘
                         ↓              (Students fill in-app)
                                                    ↓
R², MAE, Correlations                  Live Dashboard
Feature Importance                     Factor Importance Charts
(Research Paper Results)               Recommendations for Teachers
                                       At-Risk Explanations
```

**Key phrase**: "The research validates the approach; the system operationalizes it."

---

# SECTION 9: FILES SUMMARY

## System Files to be Created/Modified

| File | Action |
|---|---|
| `backend/ml/__init__.py` | NEW — empty init |
| `backend/ml/insights_engine.py` | NEW — ML engine (~150 lines) |
| `backend/models/attendance/routes.py` | MODIFY — add 3 API endpoints (~50 lines) |
| `frontend/app/teacher/attendance/ml-insights/page.tsx` | NEW — dashboard (~200 lines) |
| `backend/ml/seed_demo_data.py` | NEW (optional) — seed data for demo |

## What Does NOT Change

- ❌ No changes to the survey form or survey collection
- ❌ No changes to the attendance tracking or face recognition
- ❌ No changes to existing database tables
- ❌ No new database tables needed

Everything is **read-only** from existing data. The ML just reads what you already have and produces insights.

---

## Final Summary

**One survey per student is enough** — no module-wise surveys needed. The ML uses the same factor scores but correlates them against attendance in different modules to find module-specific patterns.

**When you are ready, tell me to implement it. I will not change any code until you say so.**
