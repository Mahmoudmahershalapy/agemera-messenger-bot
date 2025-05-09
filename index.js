// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "agemera_bot_2025";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;

const sessions = {};
const lastInteraction = {};
const waitingForReply = {};
const lastImageSent = {};
const selectedOffer = {};
const clientStage = {};
const customerData = {};

function sendOrderToSheet(data) {
  if (!GOOGLE_SHEET_WEBHOOK_URL) return;
  axios.post(GOOGLE_SHEET_WEBHOOK_URL, data).catch(err => {
    console.warn("فشل إرسال البيانات إلى Google Sheet:", err.message);
  });
}

function extractCustomerData(message, senderId) {
  const nameMatch = message.match(/اسمي\s+(\w+)/i);
  const phoneMatch = message.match(/\b01[0-9]{9}\b/);
  const addressMatch = message.match(/شارع[^\n\r]*/i);

  if (!customerData[senderId]) customerData[senderId] = {};

  if (nameMatch) customerData[senderId].name = nameMatch[1];
  if (phoneMatch) customerData[senderId].phone = phoneMatch[0];
  if (addressMatch) customerData[senderId].address = addressMatch[0];

  const data = customerData[senderId];
  if (data.name && data.phone && data.address) {
    clientStage[senderId] = "اكتمل الأوردر";
    sendOrderToSheet({
      name: data.name,
      phone: data.phone,
      address: data.address,
      stage: clientStage[senderId],
      sender_id: senderId
    });
    return `📦 تم تسجيل الطلب بنجاح!\nاسم: ${data.name}\nموبايل: ${data.phone}\nعنوان: ${data.address}\nهنتواصل معاكي لتأكيد الشحن خلال ساعات 💌`;
  }
  return null;
}

function sendTyping(senderId, duration = 1500) {
  return axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      sender_action: "typing_on"
    }
  ).then(() => new Promise(resolve => setTimeout(resolve, duration)));
}

function sendText(senderId, text) {
  return axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      message: { text }
    }
  ).catch(err => console.error("فشل إرسال الرسالة:", err.message));
}

function sendMultiText(senderId, fullText) {
  const parts = fullText.split(/\n{2,}|\.\s*/).filter(Boolean);
  return parts.reduce((promise, part) => {
    return promise.then(() => sendTyping(senderId).then(() => sendText(senderId, part.trim())));
  }, Promise.resolve());
}

function loadTrainingRules(filePaths) {
  let rules = [];
  for (const path of filePaths) {
    try {
      const data = fs.readFileSync(path, "utf-8");
      const pairs = JSON.parse(data);
      const parsed = pairs.map(pair => ({
        trigger: new RegExp(pair.input, "i"),
        reply: pair.output
      }));
      rules.push(...parsed);
    } catch (err) {
      console.warn("⚠️ تعذر تحميل:", path, "-", err.message);
    }
  }
  return rules;
}

const extraRules = loadTrainingRules([
  "./training/female_training.json",
  "./training/male_training.json",
  "./training/general_training.json"
]);
