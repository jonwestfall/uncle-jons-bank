FROM python:3.11-slim
WORKDIR /app
COPY ./app /app
RUN pip install fastapi[all] sqlmodel uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
