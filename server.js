const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// --- 1. ตั้งค่าเชื่อมต่อ MongoDB ---
// นำ Connection String จาก MongoDB Atlas มาวางตรงนี้
const MONGO_URI = "mongodb+srv://admin:PASSWORD@cluster.xxxxx.mongodb.net/roblox-api?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("Error connecting to MongoDB:", err));

// --- 2. สร้างโครงสร้างข้อมูล (Schema) ---
const keySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    isPermanent: { type: Boolean, default: false },
    startTime: { type: Number, default: null },
    hwid: { type: String, default: null },
    currentUser: { type: String, default: null },
    lastUser: { type: String, default: null },
    expiryTime: { type: Number, default: null }
});

const Key = mongoose.model('Key', keySchema);

const TWO_DAYS_MS = 172800000;   // 2 วัน
const FOUR_DAYS_MS = 345600000;  // 4 วัน

// --- 3. ตรรกะการตรวจสอบ (Verify Logic) ---
app.post('/verify-key', async (req, res) => {
    const { key, hwid, userId } = req.body;
    const currentTime = Date.now();

    if (!userId || !hwid) {
        return res.json({ success: false, message: "Missing User Data" });
    }

    try {
        let keyData = await Key.findOne({ key: key });

        // ตรวจสอบว่ามีคีย์ไหม
        if (!keyData) {
            return res.json({ success: false, message: "Invalid Key! Please get a new one." });
        }

        // ตรรกะเดิม: ถ้าเป็น VIP (Permanent) ให้ผ่านตลอด
        if (keyData.isPermanent) {
            return res.json({ success: true, message: "Welcome VIP Owner" });
        }

        // ตรรกะเดิม: เช็คประวัติคนล่าสุด (พัก 4 วันสำหรับคนเดิม)
        if (keyData.lastUser === userId) {
            const timeSinceExpired = currentTime - (keyData.expiryTime || 0);
            if (timeSinceExpired < FOUR_DAYS_MS) {
                return res.json({ success: false, message: "Invalid Key! (Wait 4 days for this key)" });
            }
        }

        // ตรรกะเดิม: ถ้าคีย์ว่าง (เริ่มใช้งานครั้งแรก)
        if (!keyData.startTime) {
            keyData.startTime = currentTime;
            keyData.hwid = hwid;
            keyData.currentUser = userId;
            await keyData.save();
            return res.json({ success: true, message: "Key Activated!" });
        }

        // ตรรกะเดิม: เช็คช่วงเวลา 2 วัน
        const elapsedTime = currentTime - keyData.startTime;

        if (elapsedTime < TWO_DAYS_MS) {
            // เช็คว่าคนเดิมไหม
            if (keyData.hwid === hwid) {
                return res.json({ success: true, message: "Auto-login success" });
            } else {
                return res.json({ success: false, message: "This key is already in use by another device." });
            }
        } else {
            // ตรรกะเดิม: หมดอายุ 2 วัน -> รีเซ็ตและเริ่มพัก 4 วัน
            keyData.lastUser = keyData.currentUser;
            keyData.expiryTime = currentTime;
            keyData.startTime = null;
            keyData.hwid = null;
            keyData.currentUser = null;
            await keyData.save();
            return res.json({ success: false, message: "Key Expired! Get a new one." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
