FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY data /app/data

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8000

WORKDIR /app/backend
EXPOSE 8000
CMD ["python", "main.py"]
