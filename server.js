const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// โหลดข้อมูล Keys และ History ของผู้เล่น
let keys = JSON.parse(fs.readFileSync('./keys.json'));
let playerHistory = {}; // ใช้เก็บว่า UserId นี้เคยใช้คีย์ไหนไปล่าสุดเมื่อไหร่

const USE_PERIOD = 2 * 24 * 60 * 60 * 1000;    // 2 วัน (เวลาใช้งาน)
const BAN_PERIOD = 4 * 24 * 60 * 60 * 1000;    // 4 วัน (พักคนเดิม)

app.post('/verify-key', (req, res) => {
    const { key, hwid, userId } = req.body; // รับ userId มาด้วยเพื่อเช็คประวัติคน
    const currentTime = Date.now();

    // 1. เช็คคีย์ถาวร
    let keyData = keys.find(k => k.key === key);
    if (keyData && keyData.isPermanent) {
        return res.json({ success: true, message: "VIP Owner" });
    }

    // 2. เช็คประวัติคนเดิม (พัก 4 วัน)
    if (playerHistory[userId]) {
        const timeSinceLastUsed = currentTime - playerHistory[userId].lastUsedTime;
        if (timeSinceLastUsed < BAN_PERIOD) {
            const daysLeft = Math.ceil((BAN_PERIOD - timeSinceLastUsed) / (1000 * 60 * 60 * 24));
            return res.json({ 
                success: false, 
                message: `คุณต้องพักการใช้คีย์อีก ${daysLeft} วัน ถึงจะ Get คีย์ใหม่ได้` 
            });
        }
    }

    if (!keyData) return res.json({ success: false, message: "Invalid Key" });

    // 3. เช็คสถานะคีย์
    if (!keyData.startTime || !keyData.hwid) {
        // คีย์ว่าง -> ให้คนนี้ครอง
        keyData.startTime = currentTime;
        keyData.hwid = hwid;
        keyData.currentUserId = userId;
        saveData();
        return res.json({ success: true, message: "Activated" });
    }

    const elapsedTime = currentTime - keyData.startTime;

    if (elapsedTime < USE_PERIOD) {
        // ยังไม่ครบ 2 วัน
        if (keyData.hwid === hwid) {
            return res.json({ success: true, message: "Auto-login" });
        } else {
            return res.json({ success: false, message: "คีย์นี้มีคนใช้อยู่" });
        }
    } else {
        // [ครบ 2 วันแล้ว] 
        // บันทึกประวัติคนเก่าว่าต้องพัก 4 วัน
        playerHistory[keyData.currentUserId] = { lastUsedTime: currentTime };
        
        // เช็คว่าคนเดิมพยายามจะใช้ต่อไหม
        if (keyData.currentUserId === userId) {
            // ล้างค่าคีย์เพื่อให้คนอื่นใช้ แต่ตัวเองติดพัก 4 วันไปแล้วข้างบน
            resetKey(keyData);
            return res.json({ success: false, message: "ครบ 2 วันแล้ว คุณต้องพัก 4 วัน" });
        }

        // ถ้าเป็นคนใหม่มา Get -> ให้เริ่มนับ 1 ใหม่ทันที
        keyData.startTime = currentTime;
        keyData.hwid = hwid;
        keyData.currentUserId = userId;
        saveData();
        return res.json({ success: true, message: "Key Transferred to new user" });
    }
});

function resetKey(k) {
    k.startTime = null;
    k.hwid = null;
    k.currentUserId = null;
    saveData();
}

function saveData() {
    fs.writeFileSync('./keys.json', JSON.stringify(keys, null, 2));
}

app.listen(3000, () => console.log('Server running on port 3000'));
