# Stage 1: Build the React frontend
FROM node:22-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the FastAPI backend runtime
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies if any, clean up to keep image lightweight
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first to optimize layer caching
COPY backend/requirements.txt ./backend/requirements.txt
# Force package installation into the global python site-packages environment 
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy the remaining application source code
COPY backend/ ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Set correct working directory to launch the server
WORKDIR /app/backend

# Expose default port
EXPOSE 8080

# Run using the globally available python environment
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
