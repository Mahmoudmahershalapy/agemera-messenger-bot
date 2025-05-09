
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { shouldMuteUser, markAdminIntervention, sendValueFollowUp } = require("./features");
const trainingData = require("./training.json");
require("dotenv").config();

const app = express();
app.use("/assets", express.static(__dirname + "/assets"));
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
          const userMsg = event.message.text || "[وسائط مرفقة]";
          const now = Date.now();
          lastInteraction[senderId] = now;
        // التحقق من وقت آخر تفاعل
        const previous = lastInteraction[senderId];
        const now = Date.now();
        const minutesSinceLast = (now - previous) / 60000;

        // لو فات أكتر من 3 دقايق من غير رد
        // لو فات أكتر من 10 دقايق من غير رد
        if (previous && minutesSinceLast >= 10 && minutesSinceLast < 11) {
          const followUpMessages = sendValueFollowUp();
          for (const msg of followUpMessages) {
            if (msg.startsWith("[IMAGE:")) {
              const imageUrl = msg.match(/\[IMAGE:(.*?)\]/)[1];
              await sendImage(senderId, imageUrl);
            } else {
              await sendText(senderId, msg);
            }
          }
          lastInteraction[senderId] = now;
          return;
        }

        if (previous && minutesSinceLast >= 3 && minutesSinceLast < 4) {
          const followUpMessages = sendValueFollowUp();
          for (const msg of followUpMessages) {
            if (msg.startsWith("[IMAGE:")) {
              const imageUrl = msg.match(/\[IMAGE:(.*?)\]/)[1];
              await sendImage(senderId, imageUrl);
            } else {
              await sendText(senderId, msg);
            }
          }
          // حدث آخر تفاعل بعد الإرسال
          lastInteraction[senderId] = now;
          return;
        }


          if (userMsg.startsWith("!")) {
            markAdminIntervention(senderId);
            return;
          }

          if (shouldMuteUser(senderId)) return;

          const reply = await getChatGPTReply(senderId, userMsg);

          if (/منتج|شكل|علبة|package/i.test(userMsg)) {
            await sendImage(senderId, "https://i.imgur.com/4AiXzf8.jpeg");
          }

          
          if (reply.includes("[IMAGE:")) {
            const imageUrl = reply.match(/\[IMAGE:(.*?)\]/)?.[1];
            if (imageUrl) {
              await sendImage(senderId, imageUrl);
              return; // الصورة كفاية، مش محتاج يبعَت كمان رسالة
            }
          }

          
          if (reply.includes("[AUDIO:")) {
            const audioUrl = reply.match(/\[AUDIO:(.*?)\]/)?.[1];
            if (audioUrl) {
              await sendAudio(senderId, audioUrl);
              return;
            }
          }

          
          if (reply.includes("[VIDEO:")) {
            const videoUrl = reply.match(/\[VIDEO:(.*?)\]/)?.[1];
            if (videoUrl) {
              await sendVideo(senderId, videoUrl);
              return;
            }
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

async function getChatGPTReply(userId, userMessage) {
  const session = sessions[userId] || [
    {
      role: "system",
      content: trainingData.system_prompt
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


async function sendAudio(psid, audioUrl) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: psid },
        message: {
          attachment: {
            type: "audio",
            payload: { url: audioUrl, is_reusable: true },
          },
        },
      }
    );
  } catch (err) {
    console.error("SendAudio Error:", err.response?.data || err.message);
  }
}



async function sendVideo(psid, videoUrl) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: psid },
        message: {
          attachment: {
            type: "video",
            payload: { url: videoUrl, is_reusable: true },
          },
        },
      }
    );
  } catch (err) {
    console.error("SendVideo Error:", err.response?.data || err.message);
  }
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot is running on port", PORT));
