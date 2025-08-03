from datetime import datetime
import importlib
from jose import jwt


def test_access_token_expiration_respects_env(monkeypatch):
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1")
    import app.auth as auth
    importlib.reload(auth)

    token = auth.create_access_token(data={"sub": "test"})
    decoded = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    exp = datetime.utcfromtimestamp(decoded["exp"])
    delta = exp - datetime.utcnow()
    assert 45 <= delta.total_seconds() <= 75

    monkeypatch.delenv("ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    importlib.reload(auth)
