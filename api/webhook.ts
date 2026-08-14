import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

console.log('=== FILE LOADED ===');

const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Supabase URL exists:', !!url, 'Key exists:', !!key);
  if (!url || !key) return null;
  return createClient(url, key);
};

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  console.log('>>> sendTelegramMessage called, chatId:', chatId);
  const token = process.env.BOT_TOKEN;
  console.log('BOT_TOKEN exists:', !!token);
  if (!token) {
    console.log('!!! NO BOT_TOKEN !!!');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    console.log('Sending to Telegram...');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup }),
    });
    const data = await res.json();
    console.log('Telegram response:', JSON.stringify(data));
  } catch (err) {
    console.error('sendMessage ERROR:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== HANDLER CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body type:', typeof req.body);
  console.log('Body:', JSON.stringify(req.body));

  if (req.method !== 'POST') {
    console.log('Not POST, returning ok');
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  const update = req.body;
  console.log('Update keys:', Object.keys(update || {}).join(', '));

  if (!update) {
    console.log('Empty body!');
    return res.status(200).json({ ok: true });
  }

  const supabase = getSupabase();
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;
  console.log('OWNER_ID:', ownerId, 'MINIAPP_URL:', miniappUrl);

  try {
    if (update.message) {
      console.log('>>> Processing MESSAGE');
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').toLowerCase();
      const fromUser = msg.from;
      console.log('Chat ID:', chatId, 'Text:', text, 'From:', fromUser?.id);

      if (!fromUser) {
        console.log('No fromUser!');
        return res.status(200).json({ ok: true });
      }

      const isOwnerOrAdmin = Boolean(ownerId && fromUser.id === ownerId);
      console.log('isOwnerOrAdmin:', isOwnerOrAdmin);

      // /start
      if (text.startsWith('/start')) {
        console.log('>>> HANDLING /start');
        const welcomeText = `👋 <b>Добро пожаловать!</b>\n\n💰 Продавайте чеки по максимальному курсу.`;
        const keyboard = {
          inline_keyboard: [
            [{ text: '🚀 Открыть обменник', web_app: { url: miniappUrl } }],
          ],
        };
        await sendTelegramMessage(chatId, welcomeText, keyboard);
        console.log('>>> /start response sent');
        return res.status(200).json({ ok: true });
      }

      // /admin
      if (text.startsWith('/admin')) {
        console.log('>>> HANDLING /admin');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await sendTelegramMessage(chatId, '👑 <b>Админ панель</b>\n\nРаботает!');
        return res.status(200).json({ ok: true });
      }

      console.log('>>> Unknown command, ignoring');
      return res.status(200).json({ ok: true });
    }

    if (update.callback_query) {
      console.log('>>> Processing CALLBACK_QUERY');
      return res.status(200).json({ ok: true });
    }

    console.log('>>> Unknown update type:', Object.keys(update).join(', '));
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('!!! WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
