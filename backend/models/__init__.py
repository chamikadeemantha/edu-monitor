# Import all models so they are registered with SQLAlchemy Base
from models.auth.models import User, StudentProfile, TeacherProfile
from models.attendance.models import AttendanceSession, AttendanceRecord

# This ensures all models are imported when 'import models' is called in main.py
# so that Base.metadata.create_all() can create all tables
