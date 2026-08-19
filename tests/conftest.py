"""
Pytest Fixtures for LUMA Backend Tests
- Client fixture (FastAPI TestClient)
- DB Session management
- Authenticated user & headers fixtures
- Secondary user for Data Isolation tests
- Mock image generator fixture
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.db.database import get_db, SessionLocal
from app.models import User, Generation
from app.core.security import hash_password, create_access_token
from mock_ai_server import generate_mock_image_base64


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient fixture สำหรับยิงคำขอ HTTP ในการทดสอบ"""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    """Database Session fixture พร้อมปิด connection อัตโนมัติหลังจบ test"""
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(db: Session):
    """สร้าง Test User หลักสำหรับใช้ในชุดทดสอบ"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        username=f"tester_{unique_id}",
        email=f"tester_{unique_id}@luma.ai",
        password_hash=hash_password("SecureTestPass123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User):
    """ส่งคืน HTTP Header Authorization Bearer Token สำหรับ test_user"""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_user(db: Session):
    """สร้าง User คนที่สองสำหรับทดสอบ Data Isolation (สิทธิ์ข้าม User)"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        username=f"other_{unique_id}",
        email=f"other_{unique_id}@luma.ai",
        password_hash=hash_password("OtherSecret456!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def other_auth_headers(other_user: User):
    """Authorization Header สำหรับ other_user"""
    token = create_access_token(data={"sub": str(other_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_image_base64():
    """ส่งคืน Valid PNG Base64 String สำหรับทดสอบ Callback / Image processing"""
    return generate_mock_image_base64("sample prompt for test", 512, 512)
