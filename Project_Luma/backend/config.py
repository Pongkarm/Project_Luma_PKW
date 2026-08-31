# backend/config.py
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'luma-super-secret-key-2026')
    
    # SQLite Database Config
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        f"sqlite:///{os.path.join(BASE_DIR, 'database', 'luma.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Config
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'luma-jwt-secret-key-2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)

    # Distributed System Nodes
    AI_SERVER_URL = os.environ.get('AI_SERVER_URL', 'http://192.168.1.30:7860')
    CALLBACK_URL = os.environ.get('CALLBACK_URL', 'http://192.168.1.20:5000/api/callback')
    
    # Internal Security Secret
    INTERNAL_SECRET = os.environ.get('LUMA_INTERNAL_SECRET', '')

    # Uploads Storage
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB Max Upload
