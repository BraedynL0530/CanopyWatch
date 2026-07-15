FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch numpy # too heavy downloads adding a buffer
COPY backend/requirements.txt /app/

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app/

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]