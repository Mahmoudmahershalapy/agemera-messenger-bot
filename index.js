const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express().use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'ajimera_bot_2025';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const receivedMessage = webhookEvent.message.text;

        // ردود تلقائية بناءً على محتوى الرسالة
        if (receivedMessage.includes("صورة")) {
          await sendMessage(senderPsid, 'image', 'https://via.placeholder.com/400');
        } else if (receivedMessage.includes("فيديو")) {
          await sendMessage(senderPsid, 'video', 'https://www.w3schools.com/html/mov_bbb.mp4');
        } else if (receivedMessage.includes("رابط")) {
          await sendMessage(senderPsid, 'link', 'https://ajimera.com');
        } else {
          await sendMessage(senderPsid, 'text', `أهلاً! استلمت رسالتك: "${receivedMessage}"`);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function sendMessage(senderPsid, type, payload) {
  let message;
  switch (type) {
    case 'text':
      message = { text: payload };
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      message = {
        attachment: {
          type: type,
          payload: { url: payload, is_reusable: true }
        }
      };
      break;
    case 'link':
      message = {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "اضغط هنا لزيارة الرابط:",
            buttons: [{ type: "web_url", url: payload, title: "فتح الرابط" }]
          }
        }
      };
      break;
  }

  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    recipient: { id: senderPsid },
    message: message
  });
}

app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening'));