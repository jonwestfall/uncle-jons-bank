FROM python:3.11-slim

WORKDIR /app

# Install dependencies first
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt fastapi[all] sqlmodel uvicorn pytest

# Copy application code
COPY ./app ./app
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV PYTHONPATH=/app

CMD ["./entrypoint.sh"]
