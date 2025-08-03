#!/bin/sh
set -e

if [ "$SKIP_TESTS" = "true" ]; then
  echo "Skipping tests"
else
  if [ -d backend/app/tests ]; then
    pytest backend/app/tests
  else
    pytest app/tests
  fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
