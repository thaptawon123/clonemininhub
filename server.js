const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// URL ของสคริปต์จริงใน GitHub (Raw)
const GITHUB_SCRIPT_URL = 'https://raw.githubusercontent.com/thaptawon123/clonemininhub/main/script.lua';

app.get('/verify', async (req, res) => {
    const { key, hwid } = req.query;

    if (!key || !hwid) {
        return res.json({ success: false, message: "กรุณาระบุ Key และ HWID" });
    }

    try {
        await client.connect();
        const db = client.db('roblox-api');
        const keysCollection = db.collection('keys');

        // 1. ค้นหาคีย์ในฐานข้อมูล
        const keyData = await keysCollection.findOne({ key: key });

        if (!keyData) {
            return res.json({ success: false, message: "ไม่พบคีย์นี้ในระบบ" });
        }

        const now = new Date();

        // 2. ตรวจสอบการเปิดใช้งาน (Activation)
        if (keyData.activatedAt) {
            // คีย์นี้ถูกใช้ไปแล้ว -> เช็ค HWID
            if (keyData.hwid !== hwid) {
                return res.json({ success: false, message: "คีย์นี้ถูกใช้กับเครื่องอื่นไปแล้ว" });
            }

            // เช็คเวลาหมดอายุ (24 ชั่วโมง)
            const activatedDate = new Date(keyData.activatedAt);
            const expiryDate = new Date(activatedDate.getTime() + (24 * 60 * 60 * 1000));

            if (now > expiryDate) {
                return res.json({ success: false, message: "คีย์นี้หมดอายุแล้ว (Expired)" });
            }
        } else {
            // คีย์ยังว่าง -> เริ่มการผูก HWID และบันทึกเวลาที่เริ่มใช้
            await keysCollection.updateOne(
                { key: key },
                { 
                    $set: { 
                        hwid: hwid, 
                        activatedAt: now.toISOString() 
                    } 
                }
            );
        }

        // 3. ถ้าผ่านทุกเงื่อนไข ดึงสคริปต์จาก GitHub ส่งกลับไป
        const response = await axios.get(GITHUB_SCRIPT_URL);
        res.json({
            success: true,
            message: "ยืนยันคีย์สำเร็จ",
            content: response.data
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error: " + error.message });
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
