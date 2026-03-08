from database import SessionLocal
from models.auth.models import StudentProfile, TeacherProfile, User

db = SessionLocal()

print("=== DATABASE DIAGNOSTIC ===\n")

# Check all users
users = db.query(User).all()
print(f"Total users: {len(users)}")
for user in users:
    print(f"  - {user.username} (ID: {user.id}, Role: {user.role.value}, Approved: {user.is_approved})")

print()

# Check student profiles
students = db.query(StudentProfile).all()
print(f"Total student profiles: {len(students)}")
for s in students:
    has_pic = "YES" if s.profile_picture else "NO"
    size = len(s.profile_picture) if s.profile_picture else 0
    print(f"  - Student ID: {s.student_id}, User ID: {s.user_id}, Profile Picture: {has_pic} ({size} bytes)")

print()

# Check teacher profiles
teachers = db.query(TeacherProfile).all()
print(f"Total teacher profiles: {len(teachers)}")
for t in teachers:
    has_pic = "YES" if t.profile_picture else "NO"
    size = len(t.profile_picture) if t.profile_picture else 0
    print(f"  - Teacher ID: {t.teacher_id}, User ID: {t.user_id}, Profile Picture: {has_pic} ({size} bytes)")

db.close()
