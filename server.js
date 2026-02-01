const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const app = express();

// เชื่อมต่อ MongoDB (ค่านี้จะไปตั้งในหน้า Dashboard ของ Render)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("DB Connected"))
    .catch(err => console.log("DB Error:", err));

// โครงสร้าง Database สำหรับเก็บ Key
const Key = mongoose.model('Key', new mongoose.Schema({
    key: String,
    hwid: String,
    expiresAt: Date
}));

app.get('/verify', async (req, res) => {
    const { key, hwid } = req.query;

    try {
        const foundKey = await Key.findOne({ key: key });

        if (!foundKey) return res.json({ success: false, message: "ไม่พบ Key นี้ในระบบ" });
        if (new Date() > foundKey.expiresAt) return res.json({ success: false, message: "Key หมดอายุแล้ว" });

        // ระบบ Lock HWID
        if (!foundKey.hwid) {
            foundKey.hwid = hwid;
            await foundKey.save();
        } else if (foundKey.hwid !== hwid) {
            return res.json({ success: false, message: "Key นี้ถูกใช้กับเครื่องอื่นไปแล้ว" });
        }

        // ดึงสคริปต์จริงจาก GitHub ของคุณมาส่งต่อ
        const githubRes = await axios.get(process.env.GITHUB_SCRIPT_URL);
        
        res.json({
            success: true,
            content: githubRes.data // โค้ด clonemining.lua ของคุณ
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));