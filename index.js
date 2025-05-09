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

const sessions = {};
const lastInteraction = {};
const waitingForReply = {};
const lastImageSent = {};
const selectedOffer = {};
const clientStage = {};
const customerData = {};

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

const stageImages = {
  "عرض المنتج": "https://i.imgur.com/4AiXzf8.jpeg",
  "تجارب العملاء": [
    "https://i.imgur.com/a1.jpg",
    "https://i.imgur.com/b2.jpg",
    "https://i.imgur.com/c3.jpg"
  ],
  "العرض الشامل": "https://i.imgur.com/full-offer.jpg"
};

const approvalTriggers = ["تمام", "ماشي", "موافق", "اه", "اوكي", "توكلنا على الله", "عايزه العرض", "سجليلي"];
const followupTriggers = ["هكلم جوزي", "هفكر", "ارجعلك", "مشغولة"];
const offerTriggers = [/عرض رقم\s*\d+/, /العرض (الأول|الثاني|الثالث|الشامل)/i];

const decisionRules = [
  {
    trigger: /بكام|السعر/i,
    reply: () => {
      return {
        text: "🔥 العروض تبدأ من 199 جنيه، وفيه عروض بتشمل شوكولاتة + عسل هدية، تحبي أشرحهم؟",
        stage: "عرض السعر"
      };
    }
  },
  {
    trigger: /حامل|سكر|ضغط|آمن/i,
    reply: () => {
      return {
        text: "المنتج آمن ١٠٠٪ لأنه من أعشاب طبيعية ومصرّح بيه من وزارة الصحة 💚",
        stage: "طمأنة"
      };
    }
  },
  {
    trigger: /هل فعلاً بيشتغل|تجارب/i,
    reply: () => {
      return {
        text: "هبعتلك شوية تجارب لبنات استخدموه، شوفي بنفسك 💬",
        stage: "إرسال تجارب"
      };
    }
  },
  {
    trigger: /معايا حضرتك|؟؟؟|؟؟|؟/i,
    reply: () => {
      return {
        text: "أنا لسه معاكِ يا قمر، كنت منتظرة ردك بس ❤️",
        stage: "متابعة بعد صمت"
      };
    }
  },
  {
    trigger: /العرض الشامل/i,
    reply: () => {
      return {
        text: "📦 العرض الشامل: شوكولاتة حريمي + رجالي + جل + 3 عسل هدية بـ 349 جنيه بس 🔥",
        stage: "عرض السعر"
      };
    }
  },
  ...extraRules.map(rule => ({
    trigger: rule.trigger,
    reply: () => ({ text: rule.reply })
  }))
];

function suggestNextStep(senderId) {
  const stage = clientStage[senderId];
  if (stage === "عرض المنتج") {
    return "تحبي أقولك على أقوى العروض اللي ممكن تفيدك؟ ✨";
  }
  return null;
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
    return `📦 تم تسجيل الطلب بنجاح!\nاسم: ${data.name}\nموبايل: ${data.phone}\nعنوان: ${data.address}\nهنتواصل معاكي لتأكيد الشحن خلال ساعات 💌`;
  }
  return null;
}

async function sendTyping(senderId, duration = 1500) {
  await axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      sender_action: "typing_on"
    }
  );
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function sendMultiText(senderId, fullText) {
  const parts = fullText.split(/\n{2,}|\.\s*/).filter(Boolean);
  for (const part of parts) {
    await sendTyping(senderId);
    await sendText(senderId, part.trim());
  }
}
