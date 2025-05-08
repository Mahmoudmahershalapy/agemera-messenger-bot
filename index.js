// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "agemera_bot_2025";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const sessions = {}; // لتخزين الجلسات لكل عميل

// تحقق webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// استلام رسائل
app.post("/webhook", async (req, res) => {
  if (req.body.object === "page") {
    for (const entry of req.body.entry) {
      for (const event of entry.messaging) {
        const senderId = event.sender.id;
        if (event.message && event.message.text) {
          const userMsg = event.message.text;
          const reply = await getChatGPTReply(senderId, userMsg);

          // لو فيها كلمة "منتج" أو "شكل" نرسل صورة
          if (/منتج|شكل|علبة|package/i.test(userMsg)) {
            await sendImage(senderId, "https://i.imgur.com/4AiXzf8.jpeg");
          }

          await sendText(senderId, reply);
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// دالة إرسال نص
async function sendText(psid, message) {
  await axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: psid },
      message: { text: message },
    }
  );
}

// دالة إرسال صورة
async function sendImage(psid, imageUrl) {
  await axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "image",
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    }
  );
}

// دالة الرد من ChatGPT
async function getChatGPTReply(userId, userMessage) {
  const session = sessions[userId] || [];
  session.push({ role: "user", content: userMessage });

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: session.slice(-10),
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    session.push({ role: "assistant", content: reply });
    sessions[userId] = session;
    return reply;
  } catch (err) {
    console.error("ChatGPT API error:", err.message);
    return "حصلت مشكلة بسيطة، جرب تاني بعد شوية 🙏";
  }
}

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot is running on port", PORT));
