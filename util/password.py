from passlib.handlers.pbkdf2 import pbkdf2_sha256
from typing import AnyStr

password_hasher = pbkdf2_sha256.using(rounds=16)


def hash_password(plain_password):
    # type: (AnyStr) -> AnyStr
    """Securely hash password."""
    return password_hasher.hash(plain_password)


def verify_password(plain_password, hashed_password):
    # type: (AnyStr) -> bool
    """Verify if plain password matches the hashed password."""
    return password_hasher.verify(plain_password, hashed_password)