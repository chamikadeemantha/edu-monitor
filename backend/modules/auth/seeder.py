from sqlalchemy.orm import Session
from . import models, utils
import logging

logger = logging.getLogger(__name__)

def seed_users(db: Session):
    """
    Seeds the database with default users if they don't exist.
    """
    users_to_create = [
        {
            "username": "admin",
            "email": "admin@edumonitor.com",
            "password": "adminpassword",
            "role": models.UserRole.ADMIN
        },
        {
            "username": "teacher",
            "email": "teacher@edumonitor.com",
            "password": "teacherpassword",
            "role": models.UserRole.TEACHER
        },
        {
            "username": "student",
            "email": "student@edumonitor.com",
            "password": "studentpassword",
            "role": models.UserRole.STUDENT
        }
    ]

    for user_data in users_to_create:
        user = db.query(models.User).filter(models.User.email == user_data["email"]).first()
        if not user:
            logger.info(f"Seeding user: {user_data['username']}")
            hashed_password = utils.get_password_hash(user_data["password"])
            new_user = models.User(
                username=user_data["username"],
                email=user_data["email"],
                password_hash=hashed_password,
                role=user_data["role"]
            )
            db.add(new_user)
        else:
            logger.info(f"User already exists: {user_data['username']}")
    
    db.commit()
