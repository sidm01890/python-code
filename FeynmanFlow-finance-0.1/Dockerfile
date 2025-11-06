# Simple Dockerfile to run the FastAPI app
FROM python:3.10-slim

# Keep Python output buffered and avoid writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install small set of system dependencies required by some packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       git \
       libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to use Docker layer caching
COPY requirements.txt /app/requirements.txt

# Upgrade pip and install Python requirements
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

# Copy the application code
COPY . /app

# Expose FastAPI default port
EXPOSE 8000

# Run the app with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
