# Auth Reclaim Manual Checklist

Checklist นี้ใช้ยืนยัน flow ใหม่: auto refresh, reclaim หลัง access token หมดอายุ, และ retry-once ตอน proxy เจอ `401`.

## Preconditions
- Backend และ Frontend รันด้วย `AUTH_SECRET` เดียวกัน
- Frontend ตั้งค่า `BACKEND_URL`/`NEXT_PUBLIC_BACKEND_URL` ชี้ backend ถูกต้อง
- (แนะนำสำหรับทดสอบเร็ว) ตั้ง access-token TTL ฝั่ง backend ให้สั้นชั่วคราว เช่น 60-120 วินาที แล้ว restart backend

## Scenario 1: Baseline login
1. Login ผ่าน `/api/login` ตาม flow ปกติ
2. เปิด Network แล้วเรียก `GET /api/me`
3. คาดหวัง: ได้ `200` และ `authenticated: true`

## Scenario 2: Proactive refresh (ก่อนหมดอายุ)
1. หลัง login ให้เรียก endpoint ที่ต้อง auth ซ้ำ ๆ เช่น `GET /api/requests?page=1&limit=20`
2. เมื่อเวลาใกล้หมดอายุ access token ให้ดูว่า request ยังสำเร็จต่อเนื่อง
3. คาดหวัง:
   - ไม่มี redirect ไปหน้า login
   - คำขอยังได้ `200`
   - มีการอัปเดต `Set-Cookie: session=...` ตามรอบ refresh

## Scenario 3: Expired access token reclaim
1. ปล่อยให้ access token หมดอายุจริง
2. เรียก endpoint ที่ต้อง auth เช่น `GET /api/requests?page=1&limit=20`
3. คาดหวัง:
   - รอบแรก backend อาจตอบ `401`
   - Next proxy ทำ force refresh + replay อัตโนมัติ 1 ครั้ง
   - ผลลัพธ์สุดท้ายยังสำเร็จ (`200`) หาก session ยังไม่หมดอายุรวม

## Scenario 4: Retry-once coverage
ทดสอบ endpoint ต่อไปนี้หลัง access token หมดอายุ:
- `POST /api/admin/change-password`
- `GET|POST|PUT /api/backend/officials`
- `GET|POST /api/form-links/current`
- `GET /api/pdf/:id`
- `GET|PUT|POST /api/requests`
- `PUT /api/requests/:requestId/status`
- `POST /api/requests/:requestId/sign-links`

คาดหวัง: แต่ละ endpoint recover ได้ด้วย retry-once เมื่อ reclaim สำเร็จ

## Scenario 5: Absolute session expiry
1. ตั้ง `SESSION_MAX_AGE_SECONDS` ให้สั้น (เช่น 180 วินาที) แล้ว login ใหม่
2. หลังเกินเวลานี้ ให้เรียก endpoint ที่ต้อง auth
3. คาดหวัง:
   - refresh/reclaim ไม่สำเร็จ
   - ได้ `401` และฝั่ง UI กลับไป login ตาม flow เดิม

## Scenario 6: Logout regression
1. กด logout
2. เรียก `GET /api/me` และ endpoint auth ใด ๆ
3. คาดหวัง:
   - `authenticated: false` หรือ `401`
   - ไม่เกิด loop refresh

## Acceptance Criteria
- ไม่มี infinite retry (ต้อง replay สูงสุด 1 ครั้ง)
- หาก reclaim สำเร็จ ผู้ใช้ไม่หลุด session ระหว่างใช้งาน
- หาก reclaim ไม่สำเร็จ (session หมดอายุ/token ไม่ถูกต้อง) ระบบตอบ `401` ชัดเจน
