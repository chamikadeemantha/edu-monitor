from pydantic import BaseModel, EmailStr
from typing import Optional
from .models import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.STUDENT

class UserCreate(UserBase):
    password: str

class StudentRegistration(UserCreate):
    student_id: str
    full_name: str
    age: int
    gender: str
    phone_number: str
    major: str

class TeacherRegistration(UserCreate):
    teacher_id: str
    full_name: str
    position: str
    department: str
    phone_number: str
    specialization: str
    years_of_experience: int

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_approved: bool
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
