// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();


const { shouldMuteUser, markAdminIntervention } = require("./features");
const trainingData = require("./training.json");

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "agemera_bot_2025";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const sessions = {}; // لتخزين الجلسات لكل عميل
const lastInteraction = {}; // لتتبع آخر تفاعل مع العميل

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

          // لو الرسالة فيها تدخل من الأدمن
          if (userMsg.startsWith("!")) {
            markAdminIntervention(senderId);
            return;
          }

          // لو العميل مكتوم، تجاهل الرد
          if (shouldMuteUser(senderId)) {
            console.log(`⏳ Skipping muted user ${senderId}`);
            return;
          }
 (event.message.text || event.message.attachments)) {
          const userMsg = event.message.text || "[وسائط مرفقة]";
          const now = Date.now();
          lastInteraction[senderId] = now;

          const reply = await getChatGPTReply(senderId, userMsg);

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
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: psid },
        message: { text: message },
      }
    );
  } catch (err) {
    console.error("SendText Error:", err.response?.data || err.message);
  }
}

// دالة إرسال صورة
async function sendImage(psid, imageUrl) {
  try {
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
  } catch (err) {
    console.error("SendImage Error:", err.response?.data || err.message);
  }
}

// دالة الرد من ChatGPT مع تعليمات المبيعات
async function getChatGPTReply(userId, userMessage) {
  const session = sessions[userId] || [
    {
      role: "system",
      content:
        "إنتي دكتورة اسمك هبة، خبيرة في المنتجات الخاصة بالبنات والسيدات، وبتبيعي منتج اسمه 'هيلتي'، وهي شوكولاتة مخصوصة لتحفيز الرغبة عند الستات المتجوزين. المنتج طبيعي وآمن، بيتاخد قبل العلاقة بنص ساعة وبيزوّد الإحساس والرغبة. دورك إنك تشرحي المنتج بطريقتك كبنت، وتتكلمي مع البنات باللهجة المصرية كأنك صحبتهم، وتبيني فوائده (زي تحسين المزاج، وزيادة الثقة، وتهيئة الجسم، وزيادة المتعة). لازم تستخدمي آراء وتجارب لبنات جربوه لما أبعتهالك، وتطلبي من العميلة اسمها ورقمها وعنوانها علشان تسجلي لها الأوردر. لو العميلة مردتش، ارجعي كلميها بعد كام دقيقة. متتكلميش بلغة روبوت خالص، خليكي طبيعية وكأنك بتدردشي مع صاحبتك."
    }
  ];

  session.push({ role: "user", content: userMessage });

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: session.slice(-15),
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    session.push({ role: "assistant", content: reply });
    sessions[userId] = session;
    return reply;
  } catch (err) {
    console.error("ChatGPT API error:", err.response?.data || err.message);
    return "فيه مشكلة بسيطة، ممكن تبعتيلي تاني؟ 🙏";
  }
}



// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot is running on port", PORT));
