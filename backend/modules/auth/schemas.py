from pydantic import BaseModel, EmailStr
from typing import Optional
from .models import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.STUDENT

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
