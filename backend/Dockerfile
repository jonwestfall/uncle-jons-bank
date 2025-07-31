FROM python:3.11-slim

WORKDIR /app

# Install dependencies first
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt fastapi[all] sqlmodel uvicorn

# Copy application code
COPY ./app ./app

ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
