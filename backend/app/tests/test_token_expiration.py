import os
from datetime import datetime
import importlib
from jose import jwt


def test_access_token_expiration_respects_env(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("JWT_ISSUER", "test-issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "test-audience")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1")

    import app.auth as auth
    importlib.reload(auth)

    token = auth.create_access_token(subject="user:1")
    decoded = jwt.decode(
        token,
        auth.SECRET_KEY,
        algorithms=[auth.ALGORITHM],
        issuer=auth.JWT_ISSUER,
        audience=auth.JWT_AUDIENCE,
    )
    exp = datetime.utcfromtimestamp(decoded["exp"])
    delta = exp - datetime.utcnow()
    assert 45 <= delta.total_seconds() <= 75

    monkeypatch.delenv("ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    importlib.reload(auth)
