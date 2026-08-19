
# 📋 แผนงานละเอียด - Distributed Image Project (P2P Connection)
## 👥 ทีม 4 คน

> [!NOTE]
> งานของคนที่ 5 (Nginx / Reverse Proxy / Routing) ถูกรวมเข้ากับ **คนที่ 4 (QA/DevOps)** เนื่องจากเป็นงานด้าน Infrastructure ที่เกี่ยวข้องกันโดยตรง

---

## 🌐 ภาพรวมระบบ P2P Network (4 PCs)

```mermaid
graph TB
    subgraph Network["🌐 P2P Network - LAN 192.168.1.0/24"]
        direction TB
        
        PC1["🖥️ PC1 - Frontend + Nginx<br/>192.168.1.10<br/>คนที่ 1 (ดูแล Frontend)<br/>คนที่ 4 (ติดตั้ง Nginx)"]
        PC2["🖥️ PC2 - Backend + DB<br/>192.168.1.20<br/>คนที่ 2"]
        PC3["🖥️ PC3 - AI Server<br/>192.168.1.30<br/>คนที่ 3"]
        
        PC1 <-->|"HTTP :80/443<br/>Reverse Proxy"| PC2
        PC1 <-->|"HTTP :80/443<br/>Reverse Proxy"| PC3
        PC2 <-->|"REST API :5000 ↔ :7860<br/>AI Request / Callback"| PC3
    end
    
    style PC1 fill:#4CAF50,stroke:#333,color:#fff
    style PC2 fill:#2196F3,stroke:#333,color:#fff
    style PC3 fill:#FF9800,stroke:#333,color:#fff
```

---

## 📊 สรุปการแบ่งงาน 4 คน

| สมาชิก | หน้าที่หลัก | สิ่งที่ส่งมอบ | PC |
|--------|------------|--------------|-----|
| **คนที่ 1** | UX/UI Frontend | หน้าเว็บ, Bootstrap, JavaScript, API Integration | 192.168.1.10 |
| **คนที่ 2** | Flask Backend | Authentication, REST API, Database, Queue, Logging | 192.168.1.20 |
| **คนที่ 3** | AI Engineer | Image Generation, Image Editing, Model/LoRA, AI API | 192.168.1.30 |
| **คนที่ 4** | QA / DevOps + **Nginx** | Testing, **Nginx/Reverse Proxy**, Deployment, Dashboard, Backup, Docs | 192.168.1.10 (Nginx) + ทุก PC |

---

## 👤 คนที่ 1 — UX/UI Frontend Developer

### 📊 Workflow Diagram

```mermaid
graph TD
    subgraph Person1["👤 คนที่ 1 - UX/UI Frontend | PC: 192.168.1.10"]
        direction TB
        
        subgraph Design["🎨 Phase 1: Design"]
            D1["Wireframe / Mockup<br/>ออกแบบ UI ทุกหน้า"]
            D2["Design System<br/>สี, Font, Component"]
            D3["Responsive Layout<br/>Desktop + Mobile"]
            D1 --> D2 --> D3
        end
        
        subgraph Develop["💻 Phase 2: Development"]
            F1["หน้า Login / Register"]
            F2["หน้า Dashboard"]
            F3["หน้า Image Generation<br/>Form + Preview"]
            F4["หน้า Image Editing<br/>Canvas + Tools"]
            F5["หน้า Gallery<br/>แสดงรูปทั้งหมด"]
            F6["หน้า History / Profile"]
            F1 --> F2 --> F3 --> F4 --> F5 --> F6
        end
        
        subgraph Connect["🔗 Phase 3: API Integration"]
            C1["เชื่อม Login API<br/>→ /api/login"]
            C2["เชื่อม Generate API<br/>→ /api/generate"]
            C3["เชื่อม Edit API<br/>→ /api/edit"]
            C4["Polling / WebSocket<br/>รับ Progress Update"]
            C1 --> C2 --> C3 --> C4
        end
        
        Design --> Develop --> Connect
    end
    
    style Person1 fill:#E8F5E9,stroke:#4CAF50
```

### 🛠️ Tools ที่ต้องใช้

| หมวด | Tool | วัตถุประสงค์ |
|------|------|-------------|
| **Editor** | VS Code | เขียน HTML/CSS/JS |
| **Design** | Figma / Canva | ออกแบบ UI Mockup |
| **CSS Framework** | Bootstrap 5 | Responsive Layout + Components |
| **JavaScript** | Vanilla JS / jQuery | DOM Manipulation, Event Handling |
| **API Client** | Fetch API / Axios | เรียก REST API จาก Backend |
| **WebSocket** | Socket.IO Client | รับ real-time progress update |
| **Image Preview** | Canvas API | แสดงผลภาพ, crop, rotate |
| **Version Control** | Git + GitHub | จัดการ Source Code |
| **Browser Dev** | Chrome DevTools | Debug, Network Monitor |

### 🔌 การเชื่อมต่อ P2P ของคนที่ 1

```mermaid
sequenceDiagram
    participant User as 🧑 User Browser
    participant Nginx as 🔀 Nginx<br/>192.168.1.10:80
    participant FE as 🖥️ Static Files<br/>192.168.1.10
    participant BE as ⚙️ Backend<br/>192.168.1.20:5000
    
    User->>Nginx: GET / (เข้าเว็บ port 80)
    Nginx->>FE: Serve index.html + CSS + JS
    FE-->>User: แสดงหน้าเว็บ
    
    User->>Nginx: POST /api/login (กรอก Login)
    Nginx->>BE: Reverse Proxy → 192.168.1.20:5000
    BE-->>Nginx: {"token": "jwt..."}
    Nginx-->>User: Login สำเร็จ

    User->>Nginx: POST /api/generate (สร้างรูป)
    Nginx->>BE: Reverse Proxy → 192.168.1.20:5000
    BE-->>Nginx: {"task_id": "abc123", "status": "queued"}
    Nginx-->>User: แสดง Loading...
    
    loop Polling ทุก 3 วินาที
        User->>Nginx: GET /api/task/abc123
        Nginx->>BE: Reverse Proxy
        BE-->>Nginx: {"status": "completed", "image_url": "..."}
        Nginx-->>User: แสดงรูปที่สร้างเสร็จ
    end
```

### 📁 ไฟล์ที่ต้องส่งมอบ

```
frontend/
├── index.html              # หน้าแรก / Landing
├── login.html              # หน้า Login
├── register.html           # หน้า Register
├── dashboard.html          # หน้า Dashboard
├── generate.html           # หน้า Generate Image
├── edit.html               # หน้า Edit Image
├── gallery.html            # หน้า Gallery
├── profile.html            # หน้า Profile / History
├── css/
│   ├── style.css           # Global Styles
│   ├── bootstrap.min.css   # Bootstrap Framework
│   └── components.css      # Custom Components
├── js/
│   ├── app.js              # Main App Logic
│   ├── auth.js             # Login/Register Logic
│   ├── api.js              # API Helper (Fetch wrapper)
│   ├── generate.js         # Image Generation Logic
│   ├── edit.js             # Image Editing Logic (Canvas)
│   └── gallery.js          # Gallery Logic
└── assets/
    ├── images/             # Static Images / Logo
    └── icons/              # Icons
```

---

## 👤 คนที่ 2 — Flask Backend Developer

### 📊 Workflow Diagram

```mermaid
graph TD
    subgraph Person2["👤 คนที่ 2 - Flask Backend | PC: 192.168.1.20"]
        direction TB
        
        subgraph Setup["🔧 Phase 1: Setup"]
            S1["ติดตั้ง Python + Flask"]
            S2["สร้าง Virtual Environment"]
            S3["ออกแบบ Database Schema"]
            S4["สร้าง SQLite Database"]
            S1 --> S2 --> S3 --> S4
        end
        
        subgraph API["🔌 Phase 2: API Development"]
            A1["Auth API<br/>POST /api/register<br/>POST /api/login<br/>POST /api/logout"]
            A2["Image API<br/>POST /api/generate<br/>POST /api/edit<br/>GET /api/images"]
            A3["User API<br/>GET /api/profile<br/>PUT /api/profile<br/>GET /api/history"]
            A4["Task API<br/>GET /api/task/:id<br/>POST /api/callback"]
            A1 --> A2 --> A3 --> A4
        end
        
        subgraph Security["🔒 Phase 3: Security & Logging"]
            SEC1["JWT Authentication"]
            SEC2["Input Validation<br/>ป้องกัน SQL Injection"]
            SEC3["Rate Limiting"]
            SEC4["Logging System<br/>บันทึกทุก Request"]
            SEC1 --> SEC2 --> SEC3 --> SEC4
        end
        
        Setup --> API --> Security
    end
    
    style Person2 fill:#E3F2FD,stroke:#2196F3
```

### 🛠️ Tools ที่ต้องใช้

| หมวด | Tool | วัตถุประสงค์ |
|------|------|-------------|
| **Language** | Python 3.10+ | ภาษาหลัก |
| **Framework** | Flask 3.x | Web Framework |
| **Database** | SQLite3 | เก็บข้อมูล User, Image, Task |
| **ORM** | Flask-SQLAlchemy | จัดการ Database ผ่าน Python Object |
| **Auth** | Flask-JWT-Extended | JWT Token Authentication |
| **Validation** | Marshmallow / Flask-WTF | Input Validation |
| **CORS** | Flask-CORS | อนุญาต Cross-Origin จาก Frontend |
| **HTTP Client** | requests (Python) | ส่ง Request ไป AI Server |
| **Logging** | Python logging module | บันทึก Log ระบบ |
| **API Testing** | Postman / Thunder Client | ทดสอบ API ระหว่างพัฒนา |
| **Editor** | VS Code + Python Extension | เขียนโค้ด |
| **Version Control** | Git + GitHub | จัดการ Source Code |
| **Process Manager** | Waitress (Windows) / Gunicorn (Linux) | Production Server |

### 🔌 การเชื่อมต่อ P2P ของคนที่ 2

```mermaid
sequenceDiagram
    participant Nginx as 🔀 Nginx<br/>192.168.1.10:80
    participant BE as ⚙️ Flask Backend<br/>192.168.1.20:5000
    participant DB as 🗄️ SQLite<br/>192.168.1.20 (local file)
    participant AI as 🤖 AI Server<br/>192.168.1.30:7860
    
    Nginx->>BE: POST /api/generate {"prompt": "a cute cat"}
    BE->>DB: INSERT INTO tasks (status='pending')
    BE->>AI: POST http://192.168.1.30:7860/ai/generate<br/>{"prompt": "a cute cat", "task_id": "abc123"}
    AI-->>BE: {"status": "accepted", "task_id": "abc123"}
    BE-->>Nginx: {"task_id": "abc123", "status": "queued"}
    
    Note over AI: 🤖 AI กำลังสร้างรูป (30-60 วินาที)...
    
    AI->>BE: POST http://192.168.1.20:5000/api/callback<br/>{"task_id": "abc123", "image_base64": "...", "status": "done"}
    BE->>DB: UPDATE tasks SET status='completed'<br/>INSERT INTO images (filepath, prompt, ...)
    
    Nginx->>BE: GET /api/task/abc123 (Frontend polling)
    BE->>DB: SELECT * FROM tasks WHERE id='abc123'
    DB-->>BE: {status: 'completed', image_url: '/uploads/abc123.png'}
    BE-->>Nginx: {"status": "completed", "image_url": "/uploads/abc123.png"}
```

### 📊 Database Schema (ER Diagram)

```mermaid
erDiagram
    USERS {
        int id PK
        string username UK
        string email UK
        string password_hash
        string avatar_url
        datetime created_at
        datetime updated_at
    }
    
    IMAGES {
        int id PK
        int user_id FK
        string filename
        string filepath
        string prompt
        string model_used
        string status
        datetime created_at
    }
    
    TASKS {
        int id PK
        string task_id UK
        int user_id FK
        int image_id FK
        string task_type
        string status
        text params_json
        datetime created_at
        datetime completed_at
    }
    
    USERS ||--o{ IMAGES : "creates"
    USERS ||--o{ TASKS : "submits"
    IMAGES ||--o| TASKS : "generated_by"
```

### 📁 ไฟล์ที่ต้องส่งมอบ

```
backend/
├── app.py                  # Flask App Entry Point
├── config.py               # Configuration (DB path, Secret Key, AI URL)
├── requirements.txt        # Python Dependencies
├── models/
│   ├── __init__.py
│   ├── user.py             # User Model
│   ├── image.py            # Image Model
│   └── task.py             # Task Model
├── routes/
│   ├── __init__.py
│   ├── auth.py             # POST /api/register, /api/login, /api/logout
│   ├── image.py            # POST /api/generate, /api/edit
│   ├── task.py             # GET /api/task/:id, POST /api/callback
│   ├── user.py             # GET/PUT /api/profile
│   └── gallery.py          # GET /api/images
├── services/
│   ├── __init__.py
│   ├── ai_client.py        # HTTP Client → AI Server (192.168.1.30)
│   ├── auth_service.py     # Hash password, JWT Logic
│   └── image_service.py    # Save/Resize image
├── utils/
│   ├── validators.py       # Input Validation
│   ├── logger.py           # Logging Config
│   └── helpers.py          # Helper Functions
├── uploads/                # ที่เก็บรูปที่ Generate แล้ว
├── database/
│   └── app.db              # SQLite Database File
└── logs/
    └── app.log             # Application Logs
```

---

## 👤 คนที่ 3 — AI Engineer

### 📊 Workflow Diagram

```mermaid
graph TD
    subgraph Person3["👤 คนที่ 3 - AI Engineer | PC: 192.168.1.30"]
        direction TB
        
        subgraph ModelSetup["🧠 Phase 1: Model Setup"]
            M1["ติดตั้ง CUDA + cuDNN"]
            M2["ติดตั้ง PyTorch"]
            M3["Download Base Model<br/>Stable Diffusion (Forge)"]
            M4["Download LoRA Models<br/>สำหรับ Style ต่างๆ"]
            M5["ทดสอบ Inference<br/>สร้างรูปทดสอบ"]
            M1 --> M2 --> M3 --> M4 --> M5
        end
        
        subgraph AIService["🤖 Phase 2: AI API Service"]
            AI1["สร้าง API Server<br/>FastAPI on port 7860"]
            AI2["POST /ai/generate<br/>txt2img - สร้างรูปจาก Prompt"]
            AI3["POST /ai/edit<br/>img2img - แก้ไขรูป"]
            AI4["POST /ai/inpaint<br/>Inpaint - ลบ/เพิ่มส่วนของรูป"]
            AI5["GET /ai/models<br/>ดูรายชื่อ Model ทั้งหมด"]
            AI1 --> AI2 --> AI3 --> AI4 --> AI5
        end
        
        subgraph Optimize["⚡ Phase 3: Queue & Optimization"]
            Q1["Request Queue<br/>จัดคิวงานไม่ให้ GPU ล่ม"]
            Q2["VRAM Management<br/>จัดการหน่วยความจำ GPU"]
            Q3["Callback to Backend<br/>ส่งผลลัพธ์กลับ 192.168.1.20"]
            Q4["Error Handling<br/>Retry + Fallback"]
            Q1 --> Q2 --> Q3 --> Q4
        end
        
        ModelSetup --> AIService --> Optimize
    end
    
    style Person3 fill:#FFF3E0,stroke:#FF9800
```

### 🛠️ Tools ที่ต้องใช้

| หมวด | Tool | วัตถุประสงค์ |
|------|------|-------------|
| **Language** | Python 3.10+ | ภาษาหลัก |
| **AI Framework** | PyTorch 2.x | Deep Learning Framework |
| **GPU Driver** | CUDA 11.8+ / cuDNN | GPU Acceleration |
| **Image Gen** | Stable Diffusion WebUI Forge | Image Generation Engine |
| **Model Format** | Safetensors | Model Weight Files |
| **LoRA** | LoRA / LoHa adapters | Fine-tuned Style (anime, realistic, etc.) |
| **API Server** | FastAPI + Uvicorn | Serve AI เป็น REST API |
| **Image Processing** | Pillow (PIL) | Resize, Crop, Format Convert |
| **HTTP Client** | requests / httpx | Callback กลับ Backend |
| **GPU Monitor** | nvidia-smi / GPUtil | Monitor VRAM Usage |
| **Editor** | VS Code + Jupyter Notebook | เขียนโค้ด + ทดลอง Model |
| **Version Control** | Git + Git LFS | จัดการ Source + Model Files ขนาดใหญ่ |

### 🔌 การเชื่อมต่อ P2P ของคนที่ 3

```mermaid
sequenceDiagram
    participant BE as ⚙️ Backend<br/>192.168.1.20:5000
    participant AI as 🤖 AI Server (FastAPI)<br/>192.168.1.30:7860
    participant Queue as 📋 Queue<br/>(in-memory)
    participant GPU as 🎮 GPU<br/>Local VRAM
    
    BE->>AI: POST /ai/generate<br/>{"prompt": "a cat", "model": "sd-v1.5",<br/>"lora": "anime", "steps": 30, "task_id": "abc123"}
    AI->>Queue: เพิ่มเข้าคิว (position: 2)
    AI-->>BE: {"task_id": "abc123", "queue_position": 2}
    
    Note over Queue,GPU: ⏳ Queue ทำงานทีละ 1 task...
    
    Queue->>AI: Dequeue task "abc123"
    AI->>GPU: Load Model + LoRA → VRAM
    GPU->>GPU: Inference (30 steps diffusion)
    GPU-->>AI: Generated Image Tensor
    AI->>AI: Post-process (resize, PNG encode)
    
    AI->>BE: POST http://192.168.1.20:5000/api/callback<br/>{"task_id": "abc123", "image_base64": "...",<br/>"status": "done", "generation_time": 42.5}
    
    Note over BE: ✅ Backend บันทึกรูปลง DB + uploads/
```

### 📁 ไฟล์ที่ต้องส่งมอบ

```
ai_server/
├── server.py               # Main AI API Server (FastAPI + Uvicorn)
├── config.py               # AI Config (model path, default params)
├── requirements.txt        # Python Dependencies
├── models/
│   ├── checkpoints/        # Base Models (.safetensors)
│   │   └── sd-v1-5.safetensors
│   ├── lora/               # LoRA Adapters
│   │   ├── anime_style.safetensors
│   │   └── realistic_style.safetensors
│   ├── vae/                # VAE Models
│   └── embeddings/         # Textual Inversions
├── services/
│   ├── __init__.py
│   ├── generator.py        # txt2img Generation Service
│   ├── editor.py           # img2img + Inpaint Service
│   ├── model_manager.py    # Load/Switch Model + LoRA
│   └── queue_manager.py    # Request Queue (FIFO)
├── utils/
│   ├── image_utils.py      # Resize, Encode, Format Convert
│   ├── gpu_monitor.py      # VRAM Usage Monitor
│   └── callbacks.py        # HTTP Callback → Backend
├── tests/
│   ├── test_generate.py    # ทดสอบ txt2img API
│   └── test_edit.py        # ทดสอบ img2img API
└── logs/
    └── ai_server.log       # AI Server Logs
```

---

## 👤 คนที่ 4 — QA / DevOps + Nginx Reverse Proxy

> [!IMPORTANT]
> คนที่ 4 รับงาน **Nginx / Reverse Proxy** จากคนที่ 5 เพิ่มเติม เพราะเป็นงาน Infrastructure ที่เกี่ยวข้องกับ Deployment โดยตรง

### 📊 Workflow Diagram

```mermaid
graph TD
    subgraph Person4["👤 คนที่ 4 - QA/DevOps + Nginx | ทุก PC"]
        direction TB
        
        subgraph NginxSetup["🔀 Phase 1: Nginx + Network (งานจากคนที่ 5)"]
            N1["ติดตั้ง Nginx<br/>บน PC1 (192.168.1.10)"]
            N2["Config Reverse Proxy<br/>/api/* → 192.168.1.20:5000<br/>/ai/* → 192.168.1.30:7860"]
            N3["ตั้งค่า Firewall<br/>เปิด Port ที่จำเป็น"]
            N4["Gzip + Caching<br/>Optimization"]
            N1 --> N2 --> N3 --> N4
        end
        
        subgraph Testing["🧪 Phase 2: Testing"]
            T1["เขียน Test Cases<br/>ครอบคลุมทุก API"]
            T2["Unit Test - Backend API"]
            T3["Integration Test<br/>Frontend ↔ Backend ↔ AI"]
            T4["Load Test<br/>ทดสอบ Performance"]
            T1 --> T2 --> T3 --> T4
        end
        
        subgraph Deploy["🚀 Phase 3: Deployment"]
            DEP1["เขียน Deploy Script<br/>สำหรับแต่ละ PC"]
            DEP2["Deploy Frontend → PC1"]
            DEP3["Deploy Backend → PC2"]
            DEP4["Deploy AI Server → PC3"]
            DEP1 --> DEP2 --> DEP3 --> DEP4
        end
        
        subgraph Docs["📝 Phase 4: Monitor + Docs"]
            MON1["Monitoring Dashboard<br/>Health Check ทุก PC"]
            MON2["Backup Strategy<br/>Database + รูปภาพ"]
            MON3["คู่มือผู้ใช้งาน<br/>User Manual"]
            MON4["คู่มือ Deploy<br/>Admin Manual"]
            MON1 --> MON2 --> MON3 --> MON4
        end
        
        NginxSetup --> Testing --> Deploy --> Docs
    end
    
    style Person4 fill:#F3E5F5,stroke:#9C27B0
```

### 🛠️ Tools ที่ต้องใช้

| หมวด | Tool | วัตถุประสงค์ |
|------|------|-------------|
| **Web Server** | Nginx | Reverse Proxy + Static File Serving |
| **SSL** | OpenSSL | สร้าง Self-signed Certificate (optional) |
| **Testing** | pytest | Unit/Integration Test สำหรับ Python |
| **API Testing** | Postman / Newman (CLI) | ทดสอบ API ทุก Endpoint |
| **Load Testing** | Locust | ทดสอบ Performance / Concurrent Users |
| **Browser Test** | Selenium / Playwright | UI Automation Test (optional) |
| **SSH Client** | OpenSSH / PuTTY | Remote Access ทุก PC |
| **Deploy** | Shell Scripts (Bash/PowerShell) | Automate Deployment |
| **Backup** | rsync / robocopy | Backup Database + Images |
| **Monitoring** | Custom HTML Dashboard + cron | Monitor Health ทุก Service |
| **Network** | curl / ping / netstat | ทดสอบ Connection ระหว่าง PC |
| **Docs** | Markdown | เขียนคู่มือ |
| **Diagrams** | draw.io / Mermaid | System Architecture Diagrams |
| **Version Control** | Git + GitHub | จัดการ Source Code |

### 🔌 การเชื่อมต่อ P2P ของคนที่ 4 (DevOps View)

```mermaid
graph TD
    subgraph DevOps["👤 คนที่ 4 - QA/DevOps"]
        direction TB
        NginxConfig["🔀 Nginx Config"]
        TestRunner["🧪 Test Runner"]
        Deployer["🚀 Deploy Scripts"]
        Monitor["📊 Health Monitor"]
        Backup["💾 Backup"]
    end
    
    subgraph PC1["🖥️ PC1 - Frontend + Nginx (192.168.1.10)"]
        Nginx["Nginx :80"]
        FE["Static Files"]
    end
    
    subgraph PC2["🖥️ PC2 - Backend + DB (192.168.1.20)"]
        Flask["Flask :5000"]
        DB["SQLite DB"]
    end
    
    subgraph PC3["🖥️ PC3 - AI Server (192.168.1.30)"]
        AI["FastAPI :7860"]
        GPU["GPU"]
    end
    
    NginxConfig -->|"SSH :22<br/>ติดตั้ง + config Nginx"| PC1
    
    Deployer -->|"SSH :22 + SCP<br/>อัพ HTML/CSS/JS"| FE
    Deployer -->|"SSH :22 + SCP<br/>อัพ Python code + pip install"| Flask
    Deployer -->|"SSH :22 + SCP<br/>อัพ AI code + models"| AI
    
    TestRunner -->|"HTTP :80<br/>UI Test"| Nginx
    TestRunner -->|"HTTP :5000<br/>API Test"| Flask
    TestRunner -->|"HTTP :7860<br/>AI API Test"| AI
    
    Monitor -->|"GET /health"| Nginx
    Monitor -->|"GET /api/health"| Flask
    Monitor -->|"GET /ai/health"| AI
    
    Backup -->|"SSH + rsync"| DB
    
    style DevOps fill:#F3E5F5,stroke:#9C27B0
    style PC1 fill:#E8F5E9,stroke:#4CAF50
    style PC2 fill:#E3F2FD,stroke:#2196F3
    style PC3 fill:#FFF3E0,stroke:#FF9800
```

### 📁 ไฟล์ที่ต้องส่งมอบ

```
devops/
├── nginx/
│   └── nginx.conf              # ⭐ Nginx Reverse Proxy Config
├── tests/
│   ├── test_auth_api.py        # Auth API Tests
│   ├── test_image_api.py       # Image API Tests
│   ├── test_ai_api.py          # AI API Tests
│   ├── test_integration.py     # Full Integration Tests (FE↔BE↔AI)
│   ├── test_load.py            # Load/Performance Tests (Locust)
│   └── conftest.py             # Test Configuration + Fixtures
├── deploy/
│   ├── deploy_frontend.sh      # Deploy Frontend → PC1
│   ├── deploy_backend.sh       # Deploy Backend → PC2
│   ├── deploy_ai.sh            # Deploy AI Server → PC3
│   ├── deploy_nginx.sh         # ⭐ Deploy Nginx Config → PC1
│   ├── deploy_all.sh           # Deploy ทั้งหมด
│   └── rollback.sh             # Rollback Script
├── monitoring/
│   ├── dashboard.html          # Simple Monitoring Dashboard
│   ├── health_check.py         # Health Check Script (ทุก PC)
│   └── alert.py                # Alert on Failure
├── backup/
│   ├── backup_db.sh            # Database Backup Script
│   └── backup_images.sh        # Image Backup Script
└── docs/
    ├── user_manual.md          # คู่มือผู้ใช้งาน
    ├── admin_manual.md         # คู่มือ Admin / Deploy
    ├── api_docs.md             # API Documentation ทุก Endpoint
    └── network_setup.md        # ⭐ Network + Nginx Setup Guide
```

---

## 🔗 แผนผังการเชื่อมต่อ P2P ทั้งระบบ (Complete)

```mermaid
graph LR
    subgraph User["🌐 User"]
        Browser["🧑‍💻 Browser"]
    end
    
    subgraph PC1["🖥️ PC1 (192.168.1.10)<br/>คนที่ 1 + คนที่ 4"]
        direction TB
        Nginx["🔀 Nginx :80"]
        HTML["📄 HTML/CSS/JS"]
    end
    
    subgraph PC2["🖥️ PC2 (192.168.1.20)<br/>คนที่ 2"]
        direction TB
        Flask["⚙️ Flask :5000"]
        SQLite["🗄️ SQLite DB"]
    end
    
    subgraph PC3["🖥️ PC3 (192.168.1.30)<br/>คนที่ 3"]
        direction TB
        AIServer["🤖 FastAPI :7860"]
        Models["📦 SD Models + LoRA"]
        GPUCard["🎮 GPU"]
    end
    
    Browser -->|"① HTTP :80<br/>เข้าเว็บ"| Nginx
    Nginx -->|"② Serve Static"| HTML
    Nginx -->|"③ Proxy /api/*<br/>TCP → :5000"| Flask
    Nginx -->|"④ Proxy /ai/* (optional)<br/>TCP → :7860"| AIServer
    
    Flask -->|"⑤ Local File I/O"| SQLite
    Flask -->|"⑥ POST /ai/generate<br/>TCP → :7860"| AIServer
    AIServer -->|"⑦ POST /api/callback<br/>TCP → :5000"| Flask
    
    AIServer --> Models
    AIServer -->|"⑧ CUDA"| GPUCard
    
    style PC1 fill:#E8F5E9,stroke:#4CAF50
    style PC2 fill:#E3F2FD,stroke:#2196F3
    style PC3 fill:#FFF3E0,stroke:#FF9800
```

---

## 📋 Nginx Configuration (คนที่ 4 เป็นคนตั้งค่า)

```nginx
# nginx.conf — ติดตั้งบน PC1 (192.168.1.10)
# คนที่ 4 เป็นผู้รับผิดชอบ config นี้

upstream backend {
    server 192.168.1.20:5000;    # Flask Backend (PC2)
}

upstream ai_server {
    server 192.168.1.30:7860;    # AI Server (PC3)
}

server {
    listen 80;
    server_name 192.168.1.10;

    # ── Frontend Static Files (คนที่ 1 สร้าง) ──
    location / {
        root /var/www/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # ── Backend API Proxy (คนที่ 2) ──
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # ── AI Server Proxy (คนที่ 3) ──
    location /ai/ {
        proxy_pass http://ai_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 600s;  # AI ใช้เวลานาน
    }

    # ── WebSocket (ถ้าใช้) ──
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ── Gzip Compression ──
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;
}
```

---

## 🔥 P2P Port Summary (Firewall Rules)

| Source | Destination | Port | Protocol | Purpose |
|--------|------------|------|----------|---------|
| User Browser | 192.168.1.10 | **80** | HTTP | เข้าเว็บผ่าน Nginx |
| Nginx (PC1) | 192.168.1.20 | **5000** | HTTP | Proxy → Flask Backend |
| Nginx (PC1) | 192.168.1.30 | **7860** | HTTP | Proxy → AI Server |
| Flask (PC2) | 192.168.1.30 | **7860** | HTTP | Backend ส่งงานให้ AI |
| AI (PC3) | 192.168.1.20 | **5000** | HTTP | AI ส่งผลลัพธ์กลับ Backend |
| DevOps (PC4) | ทุก PC | **22** | SSH | Remote Deploy + Management |
| DevOps (PC4) | 192.168.1.10 | **80** | HTTP | Health Check Frontend |
| DevOps (PC4) | 192.168.1.20 | **5000** | HTTP | Health Check Backend |
| DevOps (PC4) | 192.168.1.30 | **7860** | HTTP | Health Check AI |

---

## 📅 Timeline 4 คน

```mermaid
gantt
    title 📅 Timeline - Distributed Image Project (4 คน)
    dateFormat  YYYY-MM-DD
    
    section 👤 คนที่ 1 (Frontend)
    Design & Wireframe           :f1, 2026-07-14, 3d
    HTML/CSS Pages (6 หน้า)      :f2, after f1, 5d
    JavaScript Logic             :f3, after f2, 4d
    API Integration + Polish     :f4, after f3, 3d
    
    section 👤 คนที่ 2 (Backend)
    Setup Flask + DB Schema      :b1, 2026-07-14, 2d
    Auth API (register/login)    :b2, after b1, 3d
    Image + Task API             :b3, after b2, 4d
    Security + Logging           :b4, after b3, 3d
    
    section 👤 คนที่ 3 (AI)
    Setup CUDA + Model Download  :a1, 2026-07-14, 3d
    AI API Server (FastAPI)      :a2, after a1, 4d
    LoRA + img2img + inpaint     :a3, after a2, 3d
    Queue + Optimization         :a4, after a3, 3d
    
    section 👤 คนที่ 4 (QA/DevOps + Nginx)
    Nginx + Network Setup        :q0, 2026-07-14, 3d
    Write Test Cases             :q1, after q0, 3d
    Integration Test             :q2, after q1, 3d
    Deploy + Docs + Dashboard    :q3, after q2, 4d
```

---

## 📊 สรุปภาระงานแต่ละคน

```mermaid
pie title สัดส่วนภาระงาน (โดยประมาณ)
    "คนที่ 1 - Frontend" : 25
    "คนที่ 2 - Backend" : 27
    "คนที่ 3 - AI Engineer" : 23
    "คนที่ 4 - QA/DevOps + Nginx" : 25
```

> [!TIP]
> คนที่ 4 รับงาน Nginx เพิ่ม แต่ Nginx config ไม่ซับซ้อนมาก (ประมาณ 1-2 วัน) จึงยังสมดุลกับคนอื่นๆ ได้ดี
