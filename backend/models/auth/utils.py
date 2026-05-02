import bcrypt as _bcrypt

# --- Monkey-patch bcrypt to work with passlib (bcrypt >= 4.0.0 compat) ---
# passlib is unmaintained and its internal bug-detection sends a 255-byte
# test password, which bcrypt >= 4.0.0 rejects with a ValueError.
# This patch auto-truncates passwords to 72 bytes, restoring old behavior.
_original_hashpw = _bcrypt.hashpw
_original_checkpw = _bcrypt.checkpw

def _patched_hashpw(password, salt):
    if isinstance(password, str):
        password = password.encode("utf-8")
    return _original_hashpw(password[:72], salt)

def _patched_checkpw(password, hashed_password):
    if isinstance(password, str):
        password = password.encode("utf-8")
    return _original_checkpw(password[:72], hashed_password)

_bcrypt.hashpw = _patched_hashpw
_bcrypt.checkpw = _patched_checkpw
# --- End monkey-patch ---

from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    # Bcrypt limits passwords to 72 bytes. Make sure to truncate.
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # Bcrypt limits passwords to 72 bytes. Make sure to truncate.
    if isinstance(password, str):
        password = password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
