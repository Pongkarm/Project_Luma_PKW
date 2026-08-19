# Stage 1: Build & Python Base
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for Pillow and PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ app/
COPY main.py .
COPY mock_ai_server.py .
COPY pytest.ini .
COPY tests/ tests/

# Create runtime directories
RUN mkdir -p uploads outputs

# Expose ports
EXPOSE 8000

# Health check using the new /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# Default start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
