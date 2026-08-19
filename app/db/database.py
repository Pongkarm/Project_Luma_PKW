from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# สร้าง "สายเชื่อม" ไปยัง Database
engine = create_engine(settings.DATABASE_URL)

# สร้าง "ตัวกลาง" สำหรับคุยกับ Database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# สร้าง "ฐาน" สำหรับให้ Models มาสืบทอด
Base = declarative_base()

# ฟังก์ชันสำหรับเปิด-ปิดการเชื่อมต่อ
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
