import os

# Ensure auth configuration is present when tests import app.auth/app.main.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_ISSUER", "uncle-jons-bank")
os.environ.setdefault("JWT_AUDIENCE", "uncle-jons-bank-api")
