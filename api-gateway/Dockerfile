FROM python:alpine

WORKDIR /app

COPY requirements.txt .
RUN apk add --no-cache python3-dev build-base && pip install --no-cache-dir -r requirements.txt

COPY apiGateway.py .

EXPOSE 8000

CMD ["uvicorn", "apiGateway:app", "--host", "0.0.0.0", "--port", "8000"]