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
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error('sendMessage error:', err);
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
    console.error('answerCallbackQuery error:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  const update = req.body;
  if (!update) return res.status(200).json({ ok: true });

  const supabase = getSupabase();
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;

  try {
    // ========== TEXT MESSAGES ==========
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').toLowerCase();
      const fromUser = msg.from;
      if (!fromUser) return res.status(200).json({ ok: true });

      const isOwnerOrAdmin = Boolean(ownerId && fromUser.id === ownerId);

      // Upsert user
      if (supabase) {
        await supabase.from('users').upsert(
          {
            telegram_id: fromUser.id,
            username: fromUser.username || null,
            full_name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'Пользователь',
            role: isOwnerOrAdmin ? 'owner' : 'user',
          },
          { onConflict: 'telegram_id' }
        );
      }

      // /start
      if (text.startsWith('/start')) {
        const welcomeText =
          `👋 <b>Добро пожаловать!</b>\n\n` +
          `💰 Продавайте чеки <b>CryptoBot & Send</b> по максимальному курсу с моментальной выплатой на карту или СБП (0% комиссия).\n\n` +
          `Нажмите кнопку ниже, чтобы открыть обменник:`;

        const keyboard = {
          inline_keyboard: [
            [{ text: '🚀 Открыть обменник USDT', web_app: { url: miniappUrl } }],
            ...(isOwnerOrAdmin
              ? [[{ text: '⚙️ Панель управления (/admin)', callback_data: 'admin_menu' }]]
              : []),
          ],
        };
        await sendTelegramMessage(chatId, welcomeText, keyboard);
        return res.status(200).json({ ok: true });
      }

      // /admin
      if (text.startsWith('/admin') || text === 'панель') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ У вас нет прав администратора.');
          return res.status(200).json({ ok: true });
        }

        let pendingCount = 0;
        if (supabase) {
          const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'new');
          pendingCount = count || 0;
        }

        const adminText =
          `👑 <b>Панель управления оператора СБП:</b>\n\n` +
          `• Активных ордеров на выплату: <b>${pendingCount}</b>\n` +
          `• Режим: Выплаты по СБП с генерацией PDF-чеков\n\n` +
          `Выберите нужный раздел:`;

        const adminKeyboard = {
          inline_keyboard: [
            [{ text: `📋 Очередь ордеров (${pendingCount})`, callback_data: 'admin_orders_list' }],
            [{ text: '📢 Обязательные подписки и задания', callback_data: 'admin_tasks_list' }],
            [{ text: '💎 Настройка рангов и надбавок', callback_data: 'admin_tiers_list' }],
            [{ text: '💰 Баланс CryptoBot', callback_data: 'admin_cryptobot_balance' }],
            [{ text: '📱 Открыть Mini App', web_app: { url: miniappUrl } }],
          ],
        };
        await sendTelegramMessage(chatId, adminText, adminKeyboard);
        return res.status(200).json({ ok: true });
      }

      // /orders
      if (text.startsWith('/orders') || text === 'ордеры') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Доступно только администраторам.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ База данных недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: orders } = await supabase.from('orders').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(5);

        if (!orders || orders.length === 0) {
          await sendTelegramMessage(chatId, '✅ На данный момент нет новых ожидающих ордеров.');
          return res.status(200).json({ ok: true });
        }

        for (const ord of orders) {
          const reqData = ord.requisite || {};
          const ordMsg =
            `⚡️ <b>Заявка ${ord.order_number}</b>\n` +
            `💰 ${ord.crypto_amount} ${ord.crypto_symbol} → <b>${ord.fiat_amount} ₽</b>\n` +
            `🏦 Банк: <b>${reqData.bank_name || 'СБП'}</b>\n` +
            `📱 Счет: <code>${reqData.account_number}</code>\n` +
            `👤 Получатель: ${reqData.recipient_name || 'Не указан'}\n` +
            `🧾 Чек: <code>${ord.cheque_code}</code>`;

          await sendTelegramMessage(chatId, ordMsg, {
            inline_keyboard: [
              [{ text: '💳 Подтвердить выплату СБП (PDF)', callback_data: `pay_order_${ord.id}` }],
              [{ text: '❌ Отклонить', callback_data: `reject_order_${ord.id}` }],
            ],
          });
        }
        return res.status(200).json({ ok: true });
      }

      // /balance
      if (text.startsWith('/balance') || text === 'баланс') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Доступно только администраторам.');
          return res.status(200).json({ ok: true });
        }

        const token = process.env.CRYPTOBOT_API_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен.');
          return res.status(200).json({ ok: true });
        }

        try {
          const [meRes, balRes] = await Promise.all([
            fetch('https://pay.crypt.bot/api/getMe', { headers: { 'Crypto-Pay-API-Token': token } }),
            fetch('https://pay.crypt.bot/api/getBalance', { headers: { 'Crypto-Pay-API-Token': token } }),
          ]);

          const me = await meRes.json();
          const balance = await balRes.json();

          let text = `💰 <b>Баланс CryptoBot</b>\n\n`;
          if (me.ok) text += `Приложение: <b>${me.result?.name || 'CryptoBot'}</b>\n\n`;

          if (balance.ok && Array.isArray(balance.result)) {
            for (const b of balance.result) {
              text += `<b>${b.asset}:</b> <code>${b.available}</code>\n`;
            }
          } else {
            text += `⚠️ Ошибка: ${balance.description || 'Неизвестная ошибка'}`;
          }

          await sendTelegramMessage(chatId, text);
        } catch (e: any) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка подключения: ${e.message}`);
        }
        return res.status(200).json({ ok: true });
      }
    }

    // ========== CALLBACK QUERIES ==========
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat.id;
      const isOwnerOrAdmin = Boolean(ownerId && cb.from?.id === ownerId);

      await answerCallbackQuery(cb.id);

      // admin_menu
      if (cbData === 'admin_menu') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        let pendingCount = 0;
        if (supabase) {
          const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'new');
          pendingCount = count || 0;
        }

        await sendTelegramMessage(chatId, `👑 <b>Панель управления</b>\n\nОрдеров: <b>${pendingCount}</b>`, {
          inline_keyboard: [
            [{ text: `📋 Ордеры (${pendingCount})`, callback_data: 'admin_orders_list' }],
            [{ text: '📢 Задания', callback_data: 'admin_tasks_list' }],
            [{ text: '💎 Ранги', callback_data: 'admin_tiers_list' }],
            [{ text: '💰 Баланс', callback_data: 'admin_cryptobot_balance' }],
            [{ text: '📱 Mini App', web_app: { url: miniappUrl } }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // admin_orders_list
      if (cbData === 'admin_orders_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: orders } = await supabase.from('orders').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(10);

        if (!orders || orders.length === 0) {
          await sendTelegramMessage(chatId, '✅ <b>Очередь пуста</b>\n\nНет новых заявок.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }

        let text = `📋 <b>Очередь (${orders.length}):</b>\n\n`;
        for (const ord of orders) {
          const req = ord.requisite || {};
          text += `⚡️ <b>${ord.order_number}</b>\n💰 ${ord.crypto_amount} ${ord.crypto_symbol} → ${ord.fiat_amount} ₽\n🏦 ${req.bank_name || 'СБП'} | <code>${req.account_number || '-'}</code>\n👤 @${ord.user_username || 'unknown'}\n🧾 <code>${ord.cheque_code}</code>\n\n`;
        }

        await sendTelegramMessage(chatId, text, {
          inline_keyboard: [
            [{ text: '🔄 Обновить', callback_data: 'admin_orders_list' }],
            [{ text: '⬅️ Назад', callback_data: 'admin_menu' }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // admin_tasks_list
      if (cbData === 'admin_tasks_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: tasks } = await supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: false });

        let text = `📢 <b>Активные задания:</b>\n\n`;
        if (!tasks || tasks.length === 0) {
          text += 'Нет заданий.\n';
        } else {
          for (const t of tasks) {
            text += `• <b>${t.title}</b> ${t.is_required_sub ? '(Обяз.)' : ''}\n  +${t.reward_xp} XP${t.reward_usdt ? ` +${t.reward_usdt} USDT` : ''}\n\n`;
          }
        }

        await sendTelegramMessage(chatId, text, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // admin_tiers_list
      if (cbData === 'admin_tiers_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: tiers } = await supabase.from('tiers_config').select('*').order('min_xp', { ascending: true });

        let text = `💎 <b>Ранги:</b>\n\n`;
        if (!tiers || tiers.length === 0) {
          text += 'Нет данных.\n';
        } else {
          for (const t of tiers) {
            text += `<b>${t.title}</b> — +${t.rate_bonus}% курс, ${t.cashback_percent}% кэшбэк, от ${t.min_xp} XP\n`;
          }
        }

        await sendTelegramMessage(chatId, text, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // admin_cryptobot_balance
      if (cbData === 'admin_cryptobot_balance') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        const token = process.env.CRYPTOBOT_API_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }

        try {
          const [meRes, balRes] = await Promise.all([
            fetch('https://pay.crypt.bot/api/getMe', { headers: { 'Crypto-Pay-API-Token': token } }),
            fetch('https://pay.crypt.bot/api/getBalance', { headers: { 'Crypto-Pay-API-Token': token } }),
          ]);

          const me = await meRes.json();
          const balance = await balRes.json();

          let text = `💰 <b>Баланс CryptoBot</b>\n\n`;
          if (me.ok) text += `Приложение: <b>${me.result?.name || 'CryptoBot'}</b>\n\n`;
          if (balance.ok && Array.isArray(balance.result)) {
            for (const b of balance.result) text += `<b>${b.asset}:</b> <code>${b.available}</code>\n`;
          } else {
            text += `⚠️ Ошибка: ${balance.description || 'Неизвестно'}`;
          }

          await sendTelegramMessage(chatId, text, {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
        } catch (e: any) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка: ${e.message}`, {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
        }
        return res.status(200).json({ ok: true });
      }

      // pay_order_*
      if (chatId && cbData.startsWith('pay_order_')) {
        const orderId = cbData.replace('pay_order_', '');
        if (supabase) {
          const operationId = `SBP_RUR_${Math.floor(100000000 + Math.random() * 900000000)}`;
          const { data: updatedOrder } = await supabase
            .from('orders')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payout_tx_id: operationId,
              pdf_receipt: {
                operationId,
                status: 'SUCCESS',
                paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            })
            .eq('id', orderId)
            .select()
            .single();

          if (updatedOrder) {
            await sendTelegramMessage(chatId, `✅ <b>${updatedOrder.order_number}</b> подтвержден!\n💰 ${updatedOrder.fiat_amount} ₽\n🆔 <code>${operationId}</code>`);
          }
        }
        return res.status(200).json({ ok: true });
      }

      // reject_order_*
      if (chatId && cbData.startsWith('reject_order_')) {
        const orderId = cbData.replace('reject_order_', '');
        if (supabase) {
          await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
          await sendTelegramMessage(chatId, '❌ Ордер отклонен.');
        }
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
