const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const app = express();

require("dotenv").config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "agemera_bot_2025";

app.use(bodyParser.json());

// Endpoint للفيسبوك يتحقق من الـ webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// الـ webhook اللي يستقبل الرسائل
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handleMessage(senderPsid, { text: "ضغطت على زر" });
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// دالة الرد على الرسائل
function handleMessage(senderPsid, receivedMessage) {
  let messageData;

  const text = receivedMessage.text?.toLowerCase();

  if (text === "صورة") {
    messageData = {
      attachment: {
        type: "image",
        payload: {
          url: "https://i.imgur.com/4AiXzf8.jpeg",
          is_reusable: true,
        },
      },
    };
  } else if (text === "رابط") {
    messageData = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "اضغط هنا لزيارة الرابط:",
          buttons: [
            {
              type: "web_url",
              url: "https://google.com",
              title: "فتح الرابط",
            },
          ],
        },
      },
    };
  } else if (text === "فيديو") {
    messageData = { text: `أهلاً! استلمت رسالتك: "${text}"` };
  } else {
    messageData = { text: `شكرًا لرسالتك: "${receivedMessage.text}"` };
  }

  callSendAPI(senderPsid, messageData);
}

// إرسال الرسالة فعليًا لفيسبوك
function callSendAPI(senderPsid, response) {
  const requestBody = {
    recipient: { id: senderPsid },
    message: response,
  };

  request(
    {
      uri: "https://graph.facebook.com/v18.0/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: requestBody,
    },
    (err, res, body) => {
      if (!err) {
        console.log("تم إرسال الرسالة ✅");
      } else {
        console.error("خطأ في إرسال الرسالة ❌:", err);
      }
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server is listening on port ${PORT}`));
