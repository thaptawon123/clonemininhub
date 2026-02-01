const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

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

        const keyData = await keysCollection.findOne({ key: key });

        if (!keyData) {
            return res.json({ success: false, message: "ไม่พบคีย์นี้ในระบบ" });
        }

        const now = new Date();

        if (keyData.activatedAt) {
            // เช็ค HWID (ใช้ได้ทั้งคีย์ปกติและคีย์ถาวร)
            if (keyData.hwid !== hwid) {
                return res.json({ success: false, message: "คีย์นี้ถูกใช้กับเครื่องอื่นไปแล้ว" });
            }

            // --- ส่วนที่แก้ไข: เช็คเวลาเฉพาะคีย์ที่ไม่ใช่ถาวร ---
            if (!keyData.isPermanent) {
                const activatedDate = new Date(keyData.activatedAt);
                const expiryDate = new Date(activatedDate.getTime() + (24 * 60 * 60 * 1000));

                if (now > expiryDate) {
                    return res.json({ success: false, message: "คีย์นี้หมดอายุแล้ว (Expired)" });
                }
            }
            // -------------------------------------------
            
        } else {
            // ลงทะเบียนครั้งแรก
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

        const response = await axios.get(GITHUB_SCRIPT_URL);
        res.json({
            success: true,
            message: keyData.isPermanent ? "ยินดีด้วย! คุณใช้คีย์ถาวร" : "ยืนยันคีย์สำเร็จ (24 ชม.)",
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
