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

const extraRules = [
  // Female training
  { trigger: /هو آمن؟/i, reply: "أيوه طبعًا آمن جدًا ومصرّح بيه من وزارة الصحة 💚 ومناسب حتى لو فيه ضغط أو سكر أو حمل 💌" },
  { trigger: /فيه تجارب؟/i, reply: "آه طبعًا، شوفي شوية تجارب حقيقية لبنات استخدموه 💬 هبعتلك كمان صور تجارب تشوفيها بنفسك" },
  { trigger: /الشحن كام؟/i, reply: "الشحن 45 جنيه بس لأي مكان في مصر ✨ وبيوصلك في سرية تامة" },
  { trigger: /فعلاً بيجيب نتيجة؟/i, reply: "المنتج مجرب جدًا وجايب نتايج ممتازة مع البنات خصوصًا في حالات البرود أو ضعف الرغبة 👌" },
  { trigger: /العرض الأول/i, reply: "العرض الأول: 1 شوكولاتة + 1 عسل هدية بـ 199 جنيه، ومعاهم توصيل 45 جنيه 💌" },
  { trigger: /بكام/i, reply: "🔥 العرض الأول: 1 شوكولاتة + 1 عسل هدية بـ 199 جنيه + 45 شحن. تحبي أشرح باقي العروض؟" },
  { trigger: /العرض الشامل/i, reply: "📦 العرض الشامل: شوكولاتة حريمي + رجالي + جل + 3 عسل هدية بـ 349 جنيه بس 🔥" },
  { trigger: /بيوصل متغلف؟/i, reply: "الأوردر بيجي مغلف حراري ومفيش عليه أي بيانات توضح المحتوى، بيجيلك باسمك فقط." },
  { trigger: /مش حاسة بأي مفعول/i, reply: "احتمال حضرتك استخدمتيه بعد الأكل بوقت قليل. جربي استخدامه على معدة فاضية أو مدوّب في مشروب ساخن زي القهوة ✨" },
  { trigger: /تمام انا عايزة العرض/i, reply: "استأذنك في: الاسم - رقم الهاتف - العنوان التفصيلي علشان أسجلك ✅" },

  // General training
  { trigger: /وقت التوصيل/i, reply: "عادة التوصيل بيكون من يومين لـ 3 أيام عمل على حسب المكان، وبنبعت مع شركة شحن موثوقة 🚚" },
  { trigger: /هو بيوصل متغلف؟/i, reply: "أيوه، التغليف حراري ومحكم ومفيش أي حاجة مكتوبة عليه بتوضح المحتوى 🔐" },

  // Male training
  { trigger: /مناسب لمرضى الضغط/i, reply: "آه يا فندم المنتج مكون من أعشاب طبيعية ١٠٠٪ ومفيهوش أي أثر سلبي للضغط أو السكر 💪" },
  { trigger: /بيطول العلاقة/i, reply: "أكيد! الجيل بيأخر القذف لحد 45 دقيقة تقريبًا بدون تخدير 🙌" },
  { trigger: /فيه أعراض جانبية؟/i, reply: "لا إطلاقًا، مفيش أي أعراض جانبية لأنه منتج موضعي طبيعي تمامًا 💯" }
];
