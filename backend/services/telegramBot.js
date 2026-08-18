const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');

const token = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.TELEGRAM_BOT_USERNAME;
let bot = null;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function sendMessage(chatId, message, retryCount = 0) {
  if (!token || !bot || !chatId) {
    if (!token) console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not configured; notification skipped');
    return null;
  }

  try {
    console.log(`[Telegram] sendMessage chatId=${chatId}`);
    const result = await bot.sendMessage(chatId, message, { disable_web_page_preview: true });
    console.log(`[Telegram] sendMessage success chatId=${chatId} messageId=${result.message_id}`);
    return result;
  } catch (err) {
    const retryAfter = err.response?.body?.parameters?.retry_after;
    console.error('[Telegram] sendMessage failed:', err.response?.body || err.message);
    if (retryAfter && retryCount < 1) {
      await wait(Number(retryAfter) * 1000);
      return sendMessage(chatId, message, retryCount + 1);
    }
    return null;
  }
}

async function sendBilingualMessage(chatId, enMsg, bnMsg, language = 'en') {
  const message = language === 'bn' ? bnMsg : enMsg;
  return sendMessage(chatId, message);
}

function welcomeMessage() {
  return [
    'Welcome to ThikanaBD! / ThikanaBD-e shagotom!',
    '',
    'Generate a code in your ThikanaBD account, then send /verify CODE here.',
    'ThikanaBD account-e code generate kore ekhane /verify CODE pathan.',
  ].join('\n');
}

function initializeTelegramBot() {
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not configured; bot disabled');
    return null;
  }
  if (bot) return bot;

  try {
    bot = new TelegramBot(token, { polling: true });
    bot.on('polling_error', (err) => console.error('[Telegram] polling error:', err.message));
  } catch (err) {
    console.error('[Telegram] bot initialization failed:', err.message);
    bot = null;
    return null;
  }

  bot.onText(/^\/start(?:@\w+)?$/, async (message) => {
    try {
      await sendMessage(message.chat.id, welcomeMessage());
    } catch (err) {
      console.error('[Telegram] /start handler failed:', err.message);
    }
  });

  bot.onText(/^\/verify(?:@\w+)?\s+(\d{6})$/, async (message, match) => {
    try {
      const code = match[1];
      const user = await User.findOne({
        telegramVerificationCode: code,
        telegramCodeExpiry: { $gt: new Date() },
      });
      if (!user) {
        await sendMessage(message.chat.id, 'Invalid or expired code. / Code-ti vul ba meyad shesh hoye geche.');
        return;
      }

      user.telegramChatId = String(message.chat.id);
      user.telegramLinked = true;
      user.telegramVerificationCode = undefined;
      user.telegramCodeExpiry = undefined;
      await user.save();
      await sendMessage(message.chat.id, 'Telegram linked successfully! / Telegram sofolvabe link hoyeche!');
    } catch (err) {
      console.error('[Telegram] /verify handler failed:', err.message);
      await sendMessage(message.chat.id, 'Unable to verify right now. / Ekhon verify kora jacche na.');
    }
  });

  bot.onText(/^\/unlink(?:@\w+)?$/, async (message) => {
    try {
      const user = await User.findOne({ telegramChatId: String(message.chat.id), telegramLinked: true });
      if (!user) {
        await sendMessage(message.chat.id, 'No linked ThikanaBD account found. / Kon account link kora nei.');
        return;
      }
      user.telegramChatId = undefined;
      user.telegramLinked = false;
      await user.save();
      await sendMessage(message.chat.id, 'Telegram unlinked. / Telegram unlink kora hoyeche.');
    } catch (err) {
      console.error('[Telegram] /unlink handler failed:', err.message);
    }
  });

  bot.onText(/^\/language(?:@\w+)?\s+(en|bn)$/i, async (message, match) => {
    try {
      const language = match[1].toLowerCase();
      const user = await User.findOne({ telegramChatId: String(message.chat.id), telegramLinked: true });
      if (!user) {
        await sendMessage(message.chat.id, 'Link your account first. / Prothome account link korun.');
        return;
      }
      user.notificationLanguage = language;
      await user.save();
      await sendMessage(message.chat.id, language === 'bn'
        ? 'Bengali notifications enabled.'
        : 'English notifications enabled.');
    } catch (err) {
      console.error('[Telegram] /language handler failed:', err.message);
    }
  });

  console.log(`[Telegram] bot polling initialized${botUsername ? ` for @${botUsername}` : ''}`);
  return bot;
}

module.exports = {
  initializeTelegramBot,
  sendMessage,
  sendBilingualMessage,
};
