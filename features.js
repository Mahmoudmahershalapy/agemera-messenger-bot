
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
