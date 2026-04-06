from datetime import datetime
import importlib

from jose import jwt


def test_access_token_expiration_and_standard_claims(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("JWT_ISSUER", "uncle-jons-bank")
    monkeypatch.setenv("JWT_AUDIENCE", "uncle-jons-bank-api")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1")

    import app.auth as auth

    importlib.reload(auth)

    token = auth.create_access_token(data={"sub": "user:123"})
    decoded = jwt.decode(
        token,
        auth.SECRET_KEY,
        algorithms=[auth.ALGORITHM],
        audience=auth.JWT_AUDIENCE,
        issuer=auth.JWT_ISSUER,
        options={"require_iat": True, "require_nbf": True},
    )

    assert decoded["sub"] == "user:123"
    assert decoded["iss"] == auth.JWT_ISSUER
    assert decoded["aud"] == auth.JWT_AUDIENCE
    assert decoded["typ"] == "access"
    assert isinstance(decoded["iat"], int)
    assert isinstance(decoded["nbf"], int)

    exp = datetime.utcfromtimestamp(decoded["exp"])
    delta = exp - datetime.utcnow()
    assert 45 <= delta.total_seconds() <= 75

    monkeypatch.delenv("ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    importlib.reload(auth)
