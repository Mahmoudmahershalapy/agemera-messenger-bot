
// features.js

const mutedUsers = {}; // لتخزين المستخدمين المكتومين مؤقتاً

function shouldMuteUser(senderId) {
  const currentTime = Date.now();
  const muteUntil = mutedUsers[senderId] || 0;
  return currentTime < muteUntil;
}

function markAdminIntervention(senderId) {
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  mutedUsers[senderId] = Date.now() + FIFTEEN_MINUTES;
  console.log(`[Muted] User ${senderId} muted for 15 mins`);
}

// مستقبلاً نضيف هنا خواص مثل: التذكير، تتبع الحالة، تحليل النبرة، إلخ

module.exports = {
  shouldMuteUser,
  markAdminIntervention,
};


// رد متابعة تلقائي لو العميلة مترددة أو تأخرت في الرد
function sendValueFollowUp() {
  return [
    "الشوكولاتة دي مش عاديه خالص\n" +
    "هي أكتر منتج عليه طلب عندنا، وكل بنت جربتها رجعت تشتري تاني بنفسها، لأنها بتفرق فعلًا في إحساسك وثقتك بنفسك 💕\n" +
    "بصّي كده على شوية آراء من بنات زيك، وهتفهمي ليه بقولك كده 👇",
    "[IMAGE:/assets/ريفيو شيكولاته نسائي 1.jpg]",
    "[IMAGE:/assets/ريفيو شيكولاته نسائي 2.jpg]",
    "[IMAGE:/assets/ريفيو العرض الشامل 7.jpg]"
  ];
}

module.exports.sendValueFollowUp = sendValueFollowUp;
