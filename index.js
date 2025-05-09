
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { shouldMuteUser, markAdminIntervention, sendValueFollowUp, shouldSendFollowUp, getFollowUpMessages } = require("./features");
const trainingData = require("./training.json");
require("dotenv").config();

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function findMatchingIntent(message) {
  for (const intent of trainingData.intents) {
    for (const pattern of intent.patterns) {
      const regex = new RegExp(escapeRegExp(pattern), "i");
      if (regex.test(message)) {
        return intent;
      }
    }
  }
  return null;
}

const app = express();
app.use(bodyParser.json());
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "agemera_bot_2025";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const sessions = {};
const lastInteraction = {};

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  if (req.body.object === "page") {
    for (const entry of req.body.entry) {
      for (const event of entry.messaging) {
        const senderId = event.sender.id;
        if (event.message && (event.message.text || event.message.attachments)) {
          const userMsg = event.message.text || "[وسائط]";
          const now = Date.now();
          const previous = lastInteraction[senderId];
          lastInteraction[senderId] = now;

          if (userMsg.startsWith("!")) {
            markAdminIntervention(senderId);
            return;
          }

          if (shouldMuteUser(senderId)) return;

          if (previous && shouldSendFollowUp(senderId, lastInteraction)) {
            const msgs = getFollowUpMessages();
            for (const msg of msgs) {
              if (msg.startsWith("[IMAGE:")) {
                const url = msg.match(/\[IMAGE:(.*?)\]/)?.[1];
                if (url) await sendImage(senderId, url);
              } else {
                await sendText(senderId, msg);
              }
            }
            return;
          }

          
          const matchedIntent = findMatchingIntent(userMsg);
          if (matchedIntent) {
            console.log(`✅ intent matched: ${matchedIntent.tag}`);
            for (const msg of matchedIntent.responses) {
              if (msg.startsWith("[IMAGE:")) {
                const imageUrl = msg.match(/\[IMAGE:(.*?)\]/)[1];
                await sendImage(senderId, imageUrl);
              } else {
                await sendText(senderId, msg);
              }
            }
            return;
          } else {
            console.log("❌ No intent matched, falling back to ChatGPT");
          }

          const reply = await getChatGPTReply(senderId, userMsg);
          await sendText(senderId, reply);
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

async function sendText(psid, message) {
  if (!psid) { console.warn('⛔ لا يوجد معرف للمستخدم (senderId) – لا يمكن الإرسال'); return; }
  try {
    await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: psid },
      message: { text: message },
    });
  } catch (err) {
    console.error("SendText Error:", err.response?.data || err.message);
  }
}

async function sendImage(psid, imageUrl) {
  if (!psid) { console.warn('⛔ لا يوجد معرف للمستخدم (senderId) – لا يمكن الإرسال'); return; }
  try {
    await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "image",
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    });
  } catch (err) {
    console.error("SendImage Error:", err.response?.data || err.message);
  }
}

async function getChatGPTReply(userId, userMessage) {
  const session = sessions[userId] || [
    { role: "system", content: trainingData.system_prompt }
  ];
  session.push({ role: "user", content: userMessage });

  try {
    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-3.5-turbo",
      messages: session.slice(-15),
      temperature: 0.8,
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const reply = res.data.choices[0].message.content;
    session.push({ role: "assistant", content: reply });
    sessions[userId] = session;
    return reply;
  } catch (err) {
    console.error("ChatGPT API error:", err.response?.data || err.message);
    return "فيه مشكلة مؤقتة في الرد، جربي تبعتيلي تاني 💌";
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot is running on port", PORT));
