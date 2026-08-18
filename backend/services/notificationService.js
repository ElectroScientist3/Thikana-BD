const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const { sendBilingualMessage } = require('./telegramBot');

async function writeLog({ userId, type, title, message, language, status, telegramMessageId, errorMessage, relatedEntityId }) {
  try {
    await NotificationLog.create({
      userId,
      type,
      title,
      message,
      language,
      status,
      telegramMessageId,
      errorMessage,
      relatedEntityId,
    });
  } catch (err) {
    console.error('[Notification] failed to write NotificationLog:', err.message);
  }
}

async function sendNotification({ userId, type, title, enMessage, bnMessage, relatedEntityId }) {
  try {
    const user = await User.findById(userId).select('telegramChatId telegramLinked notificationsEnabled notificationLanguage');
    if (!user) return { success: false, error: 'User not found' };

    const language = user.notificationLanguage || 'en';
    const message = language === 'bn' ? bnMessage : enMessage;
    if (!user.telegramLinked || !user.notificationsEnabled || !user.telegramChatId) {
      await writeLog({ userId, type, title, message, language, status: 'pending', errorMessage: 'Telegram is not linked or notifications are disabled', relatedEntityId });
      return { success: false, skipped: true };
    }

    const telegramMessage = await sendBilingualMessage(user.telegramChatId, enMessage, bnMessage, language);
    if (!telegramMessage) {
      await writeLog({ userId, type, title, message, language, status: 'failed', errorMessage: 'Telegram send failed', relatedEntityId });
      return { success: false, error: 'Telegram send failed' };
    }

    await writeLog({
      userId,
      type,
      title,
      message,
      language,
      status: 'sent',
      telegramMessageId: String(telegramMessage.message_id),
      relatedEntityId,
    });
    return { success: true, telegramMessageId: telegramMessage.message_id };
  } catch (err) {
    console.error(`[Notification] ${type} failed:`, err.message);
    await writeLog({ userId, type, title, message: enMessage, language: 'en', status: 'failed', errorMessage: err.message, relatedEntityId });
    return { success: false, error: err.message };
  }
}

const sendViewingRequestNotification = (ownerId, tenantName, propertyTitle, dateTime, relatedEntityId) => sendNotification({
  userId: ownerId,
  type: 'viewing_request',
  title: 'New viewing request',
  enMessage: `${tenantName} requested a viewing for ${propertyTitle} on ${dateTime}.`,
  bnMessage: `${tenantName} ${propertyTitle}-er jonno ${dateTime}-e viewing request korechen.`,
  relatedEntityId,
});

const sendViewingResponseNotification = (tenantId, status, propertyTitle, relatedEntityId) => sendNotification({
  userId: tenantId,
  type: 'viewing_response',
  title: 'Viewing update',
  enMessage: `Your viewing for ${propertyTitle} was ${status}.`,
  bnMessage: `${propertyTitle}-er viewing request ${status} hoyeche.`,
  relatedEntityId,
});

const sendApplicationStatusNotification = (tenantId, status, propertyTitle, relatedEntityId) => sendNotification({
  userId: tenantId,
  type: 'application_status',
  title: 'Application update',
  enMessage: `Your application for ${propertyTitle} is now ${status}.`,
  bnMessage: `${propertyTitle}-er jonno apnar application ekhon ${status}.`,
  relatedEntityId,
});

const sendPaymentConfirmationNotification = (userId, amount, transactionId, propertyTitle, relatedEntityId) => sendNotification({
  userId,
  type: 'payment_confirmation',
  title: 'Payment confirmed',
  enMessage: `Payment of BDT ${amount} for ${propertyTitle} was confirmed. Transaction: ${transactionId}.`,
  bnMessage: `${propertyTitle}-er jonno BDT ${amount} payment nishchit hoyeche. Transaction: ${transactionId}.`,
  relatedEntityId,
});

const sendRentReminderNotification = (tenantId, amount, dueDate, propertyTitle, relatedEntityId) => sendNotification({
  userId: tenantId,
  type: 'rent_reminder',
  title: 'Rent reminder',
  enMessage: `Rent of BDT ${amount} for ${propertyTitle} is due on ${dueDate}.`,
  bnMessage: `${propertyTitle}-er BDT ${amount} rent ${dueDate}-e dite hobe.`,
  relatedEntityId,
});

const sendNewMessageNotification = (receiverId, senderName, propertyTitle, relatedEntityId) => sendNotification({
  userId: receiverId,
  type: 'new_message',
  title: 'New message',
  enMessage: `${senderName} sent you a message about ${propertyTitle}.`,
  bnMessage: `${senderName} ${propertyTitle} niye apnake message pathiyechen.`,
  relatedEntityId,
});

const sendVerificationStatusNotification = (ownerId, propertyTitle, status, relatedEntityId) => sendNotification({
  userId: ownerId,
  type: 'verification_status',
  title: 'Verification update',
  enMessage: `Verification for ${propertyTitle} is ${status}.`,
  bnMessage: `${propertyTitle}-er verification ${status}.`,
  relatedEntityId,
});

const sendReviewNotification = (ownerId, reviewerName, propertyTitle, rating, relatedEntityId) => sendNotification({
  userId: ownerId,
  type: 'review_received',
  title: 'New review received',
  enMessage: `${reviewerName} rated ${propertyTitle} ${rating}/5.`,
  bnMessage: `${reviewerName} ${propertyTitle}-ke ${rating}/5 rating diyechen.`,
  relatedEntityId,
});

const sendReviewResponseNotification = (reviewerId, propertyTitle, ownerName, relatedEntityId) => sendNotification({
  userId: reviewerId,
  type: 'review_received',
  title: 'Owner response received',
  enMessage: `${ownerName} responded to your review of ${propertyTitle}.`,
  bnMessage: `${ownerName} ${propertyTitle} niye apnar review-er jobab diyechen.`,
  relatedEntityId,
});

const sendFraudResolutionNotification = (reporterId, propertyTitle, status, actionTaken, relatedEntityId) => sendNotification({
  userId: reporterId,
  type: 'fraud_report',
  title: 'Fraud report update',
  enMessage: `Your report about ${propertyTitle} is ${status}. Action: ${actionTaken}.`,
  bnMessage: `${propertyTitle} niye apnar report ${status}. Action: ${actionTaken}.`,
  relatedEntityId,
});

const sendFraudWarningNotification = (ownerId, propertyTitle, relatedEntityId) => sendNotification({
  userId: ownerId,
  type: 'fraud_report',
  title: 'Listing warning',
  enMessage: `Your listing ${propertyTitle} received a fraud warning from the admin team.`,
  bnMessage: `Admin team apnar ${propertyTitle} listing-ke fraud warning diyeche.`,
  relatedEntityId,
});

async function sendFraudReportNotification(adminIds, reportType, propertyTitle, relatedEntityId) {
  const ids = Array.isArray(adminIds) ? adminIds : [adminIds];
  return Promise.all(ids.filter(Boolean).map((adminId) => sendNotification({
    userId: adminId,
    type: 'fraud_report',
    title: 'Fraud report received',
    enMessage: `A ${reportType} fraud report concerns ${propertyTitle}.`,
    bnMessage: `${reportType} fraud report ${propertyTitle}-er sathe somporkito.`,
    relatedEntityId,
  })));
}

module.exports = {
  sendViewingRequestNotification,
  sendViewingResponseNotification,
  sendApplicationStatusNotification,
  sendPaymentConfirmationNotification,
  sendRentReminderNotification,
  sendNewMessageNotification,
  sendVerificationStatusNotification,
  sendReviewNotification,
  sendReviewResponseNotification,
  sendFraudResolutionNotification,
  sendFraudWarningNotification,
  sendFraudReportNotification,
};
