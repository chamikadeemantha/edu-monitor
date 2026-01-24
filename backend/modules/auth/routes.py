from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import timedelta
from typing import List
from database import get_db
from . import models, schemas, utils, dependencies

router = APIRouter(
    tags=["Authentication"]
)

@router.post("/register/student", response_model=schemas.UserResponse)
def register_student(user_data: schemas.StudentRegistration, db: Session = Depends(get_db)):
    # Check if email or username exists
    db_user = db.query(models.User).filter(
        or_(models.User.email == user_data.email, models.User.username == user_data.username)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or Username already registered")
    
    hashed_password = utils.get_password_hash(user_data.password)
    # Create User
    new_user = models.User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        role=models.UserRole.STUDENT,
        is_approved=False # Requires admin approval
    )
    db.add(new_user)
    db.flush() # Flush to get the new_user.id
    
    # Create Student Profile
    new_profile = models.StudentProfile(
        user_id=new_user.id,
        student_id=user_data.student_id,
        full_name=user_data.full_name,
        age=user_data.age,
        gender=user_data.gender,
        phone_number=user_data.phone_number,
        major=user_data.major
    )
    db.add(new_profile)
    
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/register/teacher", response_model=schemas.UserResponse)
def register_teacher(user_data: schemas.TeacherRegistration, db: Session = Depends(get_db)):
    # Check if email or username exists
    db_user = db.query(models.User).filter(
        or_(models.User.email == user_data.email, models.User.username == user_data.username)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or Username already registered")
    
    hashed_password = utils.get_password_hash(user_data.password)
    # Create User
    new_user = models.User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        role=models.UserRole.TEACHER,
        is_approved=False # Requires admin approval
    )
    db.add(new_user)
    db.flush()
    
    # Create Teacher Profile
    new_profile = models.TeacherProfile(
        user_id=new_user.id,
        teacher_id=user_data.teacher_id,
        full_name=user_data.full_name,
        position=user_data.position,
        department=user_data.department,
        phone_number=user_data.phone_number,
        specialization=user_data.specialization,
        years_of_experience=user_data.years_of_experience
    )
    db.add(new_profile)
    
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm expects username field, but we might want to use email login.
    # We'll check if the username is an email or username in the DB.
    # For simplicity, assuming username field contains the username as defined in our model.
    
    # Support login with either username or email
    user = db.query(models.User).filter(
        or_(
            models.User.username == form_data.username,
            models.User.email == form_data.username
        )
    ).first()
    
    if not user or not utils.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending approval. Please contact the administrator.",
        )
    
    access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = utils.create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/admin/pending-users", response_model=List[schemas.UserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.require_role(models.UserRole.ADMIN))
):
    users = db.query(models.User).filter(models.User.is_approved == False).all()
    return users

@router.post("/admin/approve/{user_id}", response_model=schemas.UserResponse)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.require_role(models.UserRole.ADMIN))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = True
    db.commit()
    db.refresh(user)
    return user

@router.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(dependencies.get_current_user)):
    return current_user
