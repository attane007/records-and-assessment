# ระบบคำร้องขอเอกสาร ปพ.1/ปพ.7

ระบบจัดการคำร้องขอเอกสารทางการศึกษา สำหรับสถานศึกษา ประกอบด้วยระบบยื่นคำร้องสำหรับนักเรียน/นักศึกษา และระบบจัดการสำหรับเจ้าหน้าที่

## 📋 คุณสมบัติหลัก

### สำหรับนักเรียน/นักศึกษา
- ✅ ยื่นคำร้องขอเอกสาร ปพ.1 (ระเบียนแสดงผลการเรียน)
- ✅ ยื่นคำร้องขอเอกสาร ปพ.7 (หนังสือรับรองการศึกษา)
- ✅ ตรวจสอบสถานะคำร้อง
- ✅ ระบบตรวจสอบเลขประจำตัวประชาชน (Checksum)
- ✅ ดาวน์โหลด PDF เอกสารที่อนุมัติแล้ว

### สำหรับเจ้าหน้าที่/ผู้ดูแลระบบ
- ✅ จัดการคำร้องขอเอกสาร (อนุมัติ/ปฏิเสธ)
- ✅ ดูประวัติคำร้องทั้งหมด
- ✅ สร้าง PDF เอกสารทางการศึกษา
- ✅ จัดการข้อมูลเจ้าหน้าที่
- ✅ เปลี่ยนรหัสผ่าน

## 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (Next.js)     │◄──►│   (Go/Gin)      │◄──►│   (MongoDB)     │
│   Port: 3000    │    │   Port: 8090    │    │   Port: 27017   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend (Next.js)
- **Framework**: Next.js 15.5.2 with App Router
- **UI Library**: Tailwind CSS 4
- **Language**: TypeScript
- **Port**: 3000 (Production: 3002)

### Backend (Go)
- **Framework**: Gin Web Framework
- **Language**: Go 1.24.3
- **Database Driver**: MongoDB Driver
- **PDF Generation**: GoFPDF
- **Validation**: go-playground/validator
- **Port**: 8090

### Database
- **Database**: MongoDB
- **Collections**: 
  - `students` - ข้อมูลคำร้องนักเรียน/นักศึกษา
  - `officials` - ข้อมูลเจ้าหน้าที่
  - `admins` - ข้อมูลผู้ดูแลระบบ

## 🚀 การติดตั้งและเรียกใช้งาน

### ข้อกำหนดระบบ
- Docker และ Docker Compose
- Node.js 20+ (สำหรับการพัฒนา)
- Go 1.24+ (สำหรับการพัฒนา)
- MongoDB 6.0+ (สำหรับการพัฒนา)

### การติดตั้งด้วย Docker (แนะนำ)

1. Clone repository
```bash
git clone <repository-url>
cd records-and-assessment
```

2. สร้างไฟล์ `.env`
```env
# MongoDB Configuration
MONGO_URI=mongodb://mongo:27017
MONGO_DB_NAME=records_db

# JWT Configuration
JWT_SECRET=your-secret-key-here

# Admin Default Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# API Configuration
API_BASE_URL=http://backend:8090
```

3. เรียกใช้งานด้วย Docker Compose
```bash
docker-compose up -d
```

4. เข้าใช้งานระบบ
- **Frontend**: http://localhost:3002
- **Backend API**: http://localhost:8090
- **MongoDB**: localhost:27017

### การติดตั้งสำหรับการพัฒนา

#### Backend
```bash
cd backend
go mod download
go run main.go
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📁 โครงสร้างโปรเจค

```
records-and-assessment/
├── docker-compose.yml          # Docker Compose configuration
├── README.md                   # เอกสารประกอบ
├── backend/                    # Go Backend
│   ├── main.go                # Entry point
│   ├── handlers/              # API routes
│   ├── models/                # Data models
│   ├── services/              # Business logic
│   ├── settings/              # Configuration
│   ├── utils/                 # Utilities
│   ├── fonts/                 # Thai fonts for PDF
│   └── images/               # Static images
└── frontend/                  # Next.js Frontend
    ├── app/                   # App Router pages
    │   ├── page.tsx          # หน้าแรก (ยื่นคำร้อง)
    │   ├── login/            # หน้าเข้าสู่ระบบเจ้าหน้าที่
    │   ├── admin/            # Admin dashboard
    │   └── api/              # API routes
    ├── components/           # React components
    └── lib/                  # Utilities
```

## 🔐 การตั้งค่าความปลอดภัย

### Authentication
- ใช้ JWT (JSON Web Tokens) สำหรับ session management
- Password hashing ด้วย bcrypt
- Session timeout และ refresh mechanism

### Authorization
- Role-based access control (Admin, Official)
- Route protection สำหรับ admin pages
- API endpoint protection

### Data Validation
- ตรวจสอบเลขประจำตัวประชาชนไทย (13 หลัก + checksum)
- Input validation ทั้ง client และ server side
- MongoDB schema validation

## 📄 API Documentation

### Public Endpoints
```
POST /api/submit          # ยื่นคำร้องขอเอกสาร
GET  /api/requests/:id    # ตรวจสอบสถานะคำร้อง
GET  /api/pdf/:id         # ดาวน์โหลด PDF
```

### Admin Endpoints
```
POST /api/login                           # เข้าสู่ระบบ
POST /api/logout                          # ออกจากระบบ
GET  /api/me                             # ข้อมูลผู้ใช้ปัจจุบัน
GET  /api/requests                       # รายการคำร้องทั้งหมด
PUT  /api/requests/:id/status            # อัปเดตสถานะคำร้อง
GET  /api/backend/officials              # รายการเจ้าหน้าที่
POST /api/admin/change-password          # เปลี่ยนรหัสผ่าน
```

## 🎨 การใช้งาน

### สำหรับนักเรียน/นักศึกษา

1. **ยื่นคำร้อง**: เข้าไปที่หน้าแรก กรอกข้อมูลและยื่นคำร้อง
2. **ตรวจสอบสถานะ**: ใช้หมายเลขคำร้องในการตรวจสอบสถานะ
3. **ดาวน์โหลด**: เมื่อเอกสารอนุมัติแล้ว สามารถดาวน์โหลด PDF ได้

### สำหรับเจ้าหน้าที่

1. **เข้าสู่ระบบ**: ไปที่ `/login` และเข้าสู่ระบบ
2. **จัดการคำร้อง**: ดูรายการคำร้อง อนุมัติหรือปฏิเสธ
3. **จัดการข้อมูล**: เพิ่ม/แก้ไข/ลบข้อมูลเจ้าหน้าที่

## 🔧 การกำหนดค่า

### Environment Variables
```env
# Database
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=records_db

# Security
JWT_SECRET=your-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# API
API_BASE_URL=http://localhost:8090
PORT=8090
```

### MongoDB Collections

#### students
```javascript
{
  _id: ObjectId,
  name: String,
  prefix: String,
  id_card: String,
  student_id: String,
  date_of_birth: String,
  purpose: String,
  document_type: String, // "ปพ.1" หรือ "ปพ.7"
  status: String,        // "pending", "completed", "cancelled"
  class: String,
  room: String,
  academic_year: String,
  father_name: String,
  mother_name: String,
  created_at: Date,
  updated_at: Date
}
```

## 🐛 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

1. **MongoDB Connection Error**
   - ตรวจสอบการเชื่อมต่อ MongoDB
   - ตรวจสอบ MONGO_URI ในไฟล์ .env

2. **CORS Error**
   - ตรวจสอบการตั้งค่า CORS ใน backend
   - ตรวจสอบ API_BASE_URL

3. **PDF Generation Error**
   - ตรวจสอบการติดตั้ง fonts ไทย
   - ตรวจสอบสิทธิ์การเขียนไฟล์

### การดู Logs
```bash
# Docker logs
docker-compose logs frontend
docker-compose logs backend
docker-compose logs mongo

# Development logs
# Backend: ดูใน terminal ที่รัน go run main.go
# Frontend: ดูใน browser console และ terminal
```

## 🤝 การมีส่วนร่วม

1. Fork repository
2. สร้าง feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit การเปลี่ยนแปลง (`git commit -m 'Add some AmazingFeature'`)
4. Push ไปยัง branch (`git push origin feature/AmazingFeature`)
5. เปิด Pull Request

## 📞 การติดต่อ

สำหรับคำถามหรือการสนับสนุน กรุณาติดต่อทีมพัฒนา

## 📜 License

This project is licensed under the MIT License.

---

**หมายเหตุ**: โปรเจคนี้พัฒนาขึ้นเพื่อใช้งานในสถานศึกษา กรุณาปรับแต่งการตั้งค่าให้เหมาะสมกับสภาพแวดล้อมของแต่ละองค์กร
