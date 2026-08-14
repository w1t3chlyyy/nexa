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
    return res.status(200).json({ status: 'ok' });
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
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'new');
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

        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(5);

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

          const ordButtons = {
            inline_keyboard: [
              [{ text: '💳 Подтвердить выплату СБП (PDF)', callback_data: `pay_order_${ord.id}` }],
              [{ text: '❌ Отклонить', callback_data: `reject_order_${ord.id}` }],
            ],
          };
          await sendTelegramMessage(chatId, ordMsg, ordButtons);
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
            fetch('https://pay.crypt.bot/api/getMe', {
              headers: { 'Crypto-Pay-API-Token': token },
            }),
            fetch('https://pay.crypt.bot/api/getBalance', {
              headers: { 'Crypto-Pay-API-Token': token },
            }),
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

    // ========== CALLBACK QUERIES (BUTTON CLICKS) ==========
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat.id;
      const isOwnerOrAdmin = Boolean(ownerId && cb.from?.id === ownerId);

      await answerCallbackQuery(cb.id);

      // admin_menu — кнопка из /start
      if (cbData === 'admin_menu') {
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

      // admin_orders_list — кнопка из /admin
      if (cbData === 'admin_orders_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ База данных недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!orders || orders.length === 0) {
          await sendTelegramMessage(chatId, '✅ <b>Очередь ордеров пуста</b>\n\nНет новых заявок на выплату.');
          return res.status(200).json({ ok: true });
        }

        let ordersText = `📋 <b>Очередь ордеров на выплату (${orders.length}):</b>\n\n`;
        for (const ord of orders) {
          const req = ord.requisite || {};
          ordersText +=
            `⚡️ <b>${ord.order_number}</b>\n` +
            `💰 ${ord.crypto_amount} ${ord.crypto_symbol} → ${ord.fiat_amount} ₽\n` +
            `🏦 ${req.bank_name || 'СБП'} | <code>${req.account_number || '-'}</code>\n` +
            `👤 @${ord.user_username || 'unknown'}\n` +
            `🧾 Чек: <code>${ord.cheque_code}</code>\n\n`;
        }

        const backKeyboard = {
          inline_keyboard: [
            [{ text: '🔄 Обновить список', callback_data: 'admin_orders_list' }],
            [{ text: '⬅️ Назад в меню', callback_data: 'admin_menu' }],
          ],
        };
        await sendTelegramMessage(chatId, ordersText, backKeyboard);
        return res.status(200).json({ ok: true });
      }

      // admin_tasks_list — кнопка из /admin
      if (cbData === 'admin_tasks_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ База данных недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        let tasksText = `📢 <b>Активные задания и подписки:</b>\n\n`;
        if (!tasks || tasks.length === 0) {
          tasksText += 'Нет активных заданий.\n';
        } else {
          for (const t of tasks) {
            tasksText +=
              `• <b>${t.title}</b> ${t.is_required_sub ? '(Обязательно)' : '(Бонус)'}\n` +
              `  ${t.description}\n` +
              `  Награда: +${t.reward_xp} XP${t.reward_usdt ? ` +${t.reward_usdt} USDT` : ''}\n\n`;
          }
        }

        const backKeyboard = {
          inline_keyboard: [[{ text: '⬅️ Назад в меню', callback_data: 'admin_menu' }]],
        };
        await sendTelegramMessage(chatId, tasksText, backKeyboard);
        return res.status(200).json({ ok: true });
      }

      // admin_tiers_list — кнопка из /admin
      if (cbData === 'admin_tiers_list') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ База данных недоступна.');
          return res.status(200).json({ ok: true });
        }

        const { data: tiers } = await supabase
          .from('tiers_config')
          .select('*')
          .order('min_xp', { ascending: true });

        let tiersText = `💎 <b>Ранги и процентные надбавки:</b>\n\n`;
        if (!tiers || tiers.length === 0) {
          tiersText += 'Нет данных о рангах.\n';
        } else {
          for (const t of tiers) {
            tiersText +=
              `<b>${t.title}</b> (${t.tier_key})\n` +
              `  Бонус к курсу: +${t.rate_bonus}%\n` +
              `  Кэшбэк: ${t.cashback_percent}%\n` +
              `  Требуемый XP: ${t.min_xp}\n` +
              `  Скорость: ${t.payout_speed_text}\n\n`;
          }
        }

        const backKeyboard = {
          inline_keyboard: [[{ text: '⬅️ Назад в меню', callback_data: 'admin_menu' }]],
        };
        await sendTelegramMessage(chatId, tiersText, backKeyboard);
        return res.status(200).json({ ok: true });
      }

      // admin_cryptobot_balance — кнопка из /admin
      if (cbData === 'admin_cryptobot_balance') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }

        const token = process.env.CRYPTOBOT_API_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен.');
          return res.status(200).json({ ok: true });
        }

        try {
          const [meRes, balRes] = await Promise.all([
            fetch('https://pay.crypt.bot/api/getMe', {
              headers: { 'Crypto-Pay-API-Token': token },
            }),
            fetch('https://pay.crypt.bot/api/getBalance', {
              headers: { 'Crypto-Pay-API-Token': token },
            }),
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

          const backKeyboard = {
            inline_keyboard: [[{ text: '⬅️ Назад в меню', callback_data: 'admin_menu' }]],
          };
          await sendTelegramMessage(chatId, text, backKeyboard);
        } catch (e: any) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка подключения: ${e.message}`);
        }
        return res.status(200).json({ ok: true });
      }

      // pay_order_* — кнопка "Подтвердить выплату"
      if (chatId && cbData.startsWith('pay_order_')) {
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
            const successText =
              `✅ <b>Выплата ${updatedOrder.order_number} подтверждена!</b>\n\n` +
              `💰 ${updatedOrder.fiat_amount} ₽\n` +
              `🆔 <code>${operationId}</code>`;
            await sendTelegramMessage(chatId, successText);
          }
        }
        return res.status(200).json({ ok: true });
      }

      // reject_order_* — кнопка "Отклонить"
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
