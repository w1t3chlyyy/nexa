import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN not set!');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    const data = await res.json();
    console.log('sendMessage response:', JSON.stringify(data));
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error('Error answering callback:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));

  if (req.method !== 'POST') {
    console.log('Not POST, returning ok');
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  // DEBUG: покажем secret token если есть
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  console.log('Secret from header:', secretToken);
  console.log('Expected secret:', expectedSecret ? '***set***' : '***not set***');

  // Если secret задан И header не совпадает — блокируем
  // НО: если secret задан, а header пустой — тоже блокируем
  if (expectedSecret && secretToken !== expectedSecret) {
    console.error('SECRET TOKEN MISMATCH! Blocking request.');
    return res.status(401).json({ error: 'Unauthorized secret token' });
  }

  const update = req.body;
  if (!update) {
    console.log('Empty body');
    return res.status(200).json({ status: 'empty_update' });
  }

  console.log('Update type:', Object.keys(update).join(', '));

  const supabase = getSupabase();
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;
  console.log('OWNER_ID:', ownerId);

  try {
    // Handle text messages & commands
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const fromUser = msg.from;

      console.log('Message from:', fromUser?.id, 'text:', text, 'chat:', chatId);

      if (!fromUser) {
        console.log('No fromUser');
        return res.status(200).json({ ok: true });
      }

      // Upsert user
      if (supabase) {
        console.log('Upserting user to Supabase...');
        await supabase.from('users').upsert(
          {
            telegram_id: fromUser.id,
            username: fromUser.username || null,
            full_name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'Пользователь',
            role: ownerId && fromUser.id === ownerId ? 'owner' : 'user',
          },
          { onConflict: 'telegram_id' }
        );
      }

      const isOwnerOrAdmin = Boolean(ownerId && fromUser.id === ownerId);
      console.log('isOwnerOrAdmin:', isOwnerOrAdmin);

      // /start
      if (text.startsWith('/start')) {
        console.log('Processing /start command');
        const welcomeText =
          `👋 <b>Добро пожаловать!</b>\n\n` +
          `💰 Продавайте чеки <b>CryptoBot & Send</b> по максимальному курсу с моментальной выплатой на карту или СБП (0% комиссия).\n\n` +
          `Нажмите кнопку ниже, чтобы открыть обменник:`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть обменник USDT',
                web_app: { url: miniappUrl },
              },
            ],
            ...(isOwnerOrAdmin
              ? [[{ text: '⚙️ Панель управления (/admin)', callback_data: 'admin_menu' }]]
              : []),
          ],
        };

        await sendTelegramMessage(chatId, welcomeText, keyboard);
        console.log('/start response sent');
        return res.status(200).json({ ok: true });
      }

      // /admin
      if (text.startsWith('/admin') || text === 'панель') {
        console.log('Processing /admin command');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ У вас нет прав администратора.');
          return res.status(200).json({ ok: true });
        }

        let pendingCount = 0;
        if (supabase) {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'new');
          pendingCount = count || 0;
        }

        const adminText =
          `👑 <b>Панель управления:</b>\n\n` +
          `• Активных ордеров: <b>${pendingCount}</b>\n\n` +
          `Выберите раздел:`;

        const adminKeyboard = {
          inline_keyboard: [
            [{ text: `📋 Очередь ордеров (${pendingCount})`, callback_data: 'admin_orders_list' }],
            [{ text: '📱 Открыть Mini App', web_app: { url: miniappUrl } }],
          ],
        };

        await sendTelegramMessage(chatId, adminText, adminKeyboard);
        return res.status(200).json({ ok: true });
      }

      // /orders
      if (text.startsWith('/orders') || text === 'ордеры') {
        console.log('Processing /orders command');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Доступно только администраторам.');
          return res.status(200).json({ ok: true });
        }

        if (supabase) {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'new')
            .order('created_at', { ascending: false })
            .limit(5);

          if (!orders || orders.length === 0) {
            await sendTelegramMessage(chatId, '✅ Нет новых ордеров.');
            return res.status(200).json({ ok: true });
          }

          for (const ord of orders) {
            const reqData = ord.requisite || {};
            const ordMsg =
              `⚡️ <b>${ord.order_number}</b>\n` +
              `💰 ${ord.crypto_amount} ${ord.crypto_symbol} → ${ord.fiat_amount} ₽\n` +
              `🏦 ${reqData.bank_name || 'СБП'} | <code>${reqData.account_number}</code>\n` +
              `👤 @${ord.user_username || 'unknown'}\n` +
              `🧾 <code>${ord.cheque_code}</code>`;

            const ordButtons = {
              inline_keyboard: [
                [{ text: '💳 Подтвердить выплату', callback_data: `pay_order_${ord.id}` }],
                [{ text: '❌ Отклонить', callback_data: `reject_order_${ord.id}` }],
              ],
            };
            await sendTelegramMessage(chatId, ordMsg, ordButtons);
          }
        }
        return res.status(200).json({ ok: true });
      }

      // Unknown command
      console.log('Unknown command, ignoring');
      return res.status(200).json({ ok: true });
    }

    // Callback queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat.id;

      console.log('Callback query:', cbData, 'chat:', chatId);

      await answerCallbackQuery(cb.id);

      if (cbData === 'admin_menu') {
        console.log('Admin menu callback');
        if (!chatId) return res.status(200).json({ ok: true });

        const isOwnerOrAdmin = Boolean(ownerId && cb.from?.id === ownerId);
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        let pendingCount = 0;
        if (supabase) {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'new');
          pendingCount = count || 0;
        }

        const adminText = `👑 <b>Панель управления</b>\n\nАктивных ордеров: <b>${pendingCount}</b>`;
        const adminKeyboard = {
          inline_keyboard: [
            [{ text: `📋 Ордеры (${pendingCount})`, callback_data: 'admin_orders_list' }],
            [{ text: '📱 Mini App', web_app: { url: miniappUrl } }],
          ],
        };
        await sendTelegramMessage(chatId, adminText, adminKeyboard);
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'admin_orders_list') {
        console.log('Orders list callback');
        if (!chatId) return res.status(200).json({ ok: true });
        await sendTelegramMessage(chatId, 'Используйте команду /orders для просмотра очереди.');
        return res.status(200).json({ ok: true });
      }

      if (chatId && cbData.startsWith('pay_order_')) {
        console.log('Pay order callback:', cbData);
        const orderId = cbData.replace('pay_order_', '');
        if (supabase) {
          const operationId = `SBP_RUR_${Math.floor(100000000 + Math.random() * 900000000)}`;
          const nowStr = new Date().toISOString();

          const { data: updatedOrder } = await supabase
            .from('orders')
            .update({
              status: 'paid',
              paid_at: nowStr,
              payout_tx_id: operationId,
              pdf_receipt: { operationId, status: 'SUCCESS', paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            })
            .eq('id', orderId)
            .select()
            .single();

          if (updatedOrder) {
            const successText =
              `✅ <b>Выплата ${updatedOrder.order_number} подтверждена!</b>\n\n` +
              `💰 ${updatedOrder.fiat_amount} ₽\n` +
              `🆔 <code>${operationId}</code>`;
            await sendTelegramMessage(chatId, successText);
          }
        }
        return res.status(200).json({ ok: true });
      }

      if (chatId && cbData.startsWith('reject_order_')) {
        console.log('Reject order callback:', cbData);
        const orderId = cbData.replace('reject_order_', '');
        if (supabase) {
          await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
          await sendTelegramMessage(chatId, '❌ Ордер отклонен.');
        }
        return res.status(200).json({ ok: true });
      }
    }

    console.log('Unknown update type, returning ok');
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
