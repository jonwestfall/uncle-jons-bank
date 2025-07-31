FROM python:3.11-slim

WORKDIR /app
COPY ./app ./app

RUN pip install fastapi[all] sqlmodel uvicorn

ENV PYTHONPATH=/app
RUN echo "Listing /app:" && ls /app && echo "Listing /app/app:" && ls /app/app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
