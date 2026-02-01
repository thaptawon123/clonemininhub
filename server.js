const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

const KEY_FILE = './keys.json';
const TWO_DAYS_MS = 172800000;   // 2 วัน (เวลาใช้งาน)
const FOUR_DAYS_MS = 345600000;  // 4 วัน (เวลาพักคนเดิมสำหรับคีย์นั้น)

// ฟังก์ชันโหลดและเซฟข้อมูล
let keys = JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'));
const saveKeys = () => fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));

app.post('/verify-key', (req, res) => {
    const { key, hwid, userId } = req.body;
    const currentTime = Date.now();

    if (!userId || !hwid) {
        return res.json({ success: false, message: "Missing User Data" });
    }

    let keyData = keys.find(k => k.key === key);

    // 1. ตรวจสอบว่ามีคีย์นี้ไหม
    if (!keyData) {
        return res.json({ success: false, message: "Invalid Key! Please get a new one." });
    }

    // 2. ถ้าเป็นคีย์ถาวร (VIP) ให้ผ่านตลอด
    if (keyData.isPermanent) {
        return res.json({ success: true, message: "Welcome VIP Owner" });
    }

    // 3. เช็คประวัติคนเดิม (พัก 4 วันสำหรับคีย์รหัสเดิม)
    if (keyData.lastUser === userId) {
        const timeSinceExpired = currentTime - keyData.expiryTime;
        if (timeSinceExpired < FOUR_DAYS_MS) {
            // หลอกว่าคีย์ผิด เพื่อให้เขาไป Get คีย์รหัสอื่นมาใส่
            return res.json({ success: false, message: "Invalid Key! (Please get a NEW key from link)" });
        }
    }

    // 4. ถ้าคีย์ว่าง (ไม่มีคนใช้ หรือโดน Reset ไปแล้ว)
    if (!keyData.startTime) {
        keyData.startTime = currentTime;
        keyData.hwid = hwid;
        keyData.currentUser = userId;
        saveKeys();
        return res.json({ success: true, message: "Key Activated!" });
    }

    // 5. ถ้าคีย์กำลังถูกใช้งานอยู่
    const elapsedTime = currentTime - keyData.startTime;

    if (elapsedTime < TWO_DAYS_MS) {
        // ยังอยู่ในช่วง 2 วันที่ใช้ได้
        if (keyData.hwid === hwid) {
            // เจ้าของเดิม -> รันออโต้
            return res.json({ success: true, message: "Auto-login success" });
        } else {
            // คนอื่นแอบเอาไปใช้
            return res.json({ success: false, message: "This key is already in use by another device." });
        }
    } else {
        // [หมดอายุ 2 วันพอดี]
        // บันทึกประวัติคนล่าสุดลงในช่อง lastUser เพื่อเริ่มนับเวลาพัก 4 วัน
        keyData.lastUser = keyData.currentUser;
        keyData.expiryTime = currentTime;

        // Reset ข้อมูลปัจจุบันให้เป็นค่าว่าง (เพื่อให้คนใหม่มาใช้ได้)
        keyData.startTime = null;
        keyData.hwid = null;
        keyData.currentUser = null;

        saveKeys();
        return res.json({ success: false, message: "Key Expired! Get a new one." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Miner Hub API running on port ${PORT}`);
});
