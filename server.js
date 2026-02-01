const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// เชื่อมต่อ MongoDB ผ่านตัวแปร MONGO_URI ใน Vercel
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("Could not connect to MongoDB", err));

// โครงสร้าง Database ให้ตรงกับภาพที่คุณส่งมา
const KeySchema = new mongoose.Schema({
    key: String,
    isPermanent: Boolean,
    startTime: Date,
    hwid: String,
    expiryTime: Date
});

const KeyModel = mongoose.model('keys', KeySchema);

// API สำหรับตรวจสอบ Key
app.get('/check-key/:userKey', async (req, res) => {
    const userKey = req.params.userKey;
    const userHwid = req.headers['hwid']; // รับค่าจาก Roblox

    try {
        const foundKey = await KeyModel.findOne({ key: userKey });

        if (!foundKey) {
            return res.json({ success: false, message: "ไม่พบ Key นี้ในระบบ" });
        }

        const now = new Date();

        // 1. ตรวจสอบวันหมดอายุ
        if (foundKey.expiryTime && now > new Date(foundKey.expiryTime)) {
            return res.json({ success: false, message: "Key นี้หมดอายุแล้ว" });
        }

        // 2. ตรวจสอบการ Lock HWID
        if (foundKey.hwid && foundKey.hwid !== "" && foundKey.hwid !== userHwid) {
            return res.json({ success: false, message: "Key นี้ถูกใช้โดยคนอื่นไปแล้ว" });
        }

        // 3. ถ้าเป็นคนแรกที่ใช้ ให้บันทึกข้อมูลและตั้งเวลา 2 วัน
        if (!foundKey.hwid || foundKey.hwid === "") {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 2); // บวกเพิ่ม 2 วัน

            foundKey.hwid = userHwid;
            foundKey.startTime = now;
            foundKey.expiryTime = newExpiry;
            await foundKey.save();
            
            return res.json({ success: true, message: "ยินดีด้วย! ใช้ได้อีก 2 วัน" });
        }

        res.json({ success: true, message: "Key ถูกต้อง (เจ้าของเดิม)" });

    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

module.exports = app;
