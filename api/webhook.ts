import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client with service role key for full database access
const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

// Telegram API Helper
async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
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
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (err) {
    console.error('Error answering callback:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  // Verify secret token from Telegram header if set
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && secretToken !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized secret token' });
  }

  const update = req.body;
  if (!update) {
    return res.status(200).json({ status: 'empty_update' });
  }

  const supabase = getSupabase();
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;

  try {
    // 1. Handle regular text messages & commands
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const fromUser = msg.from;

      if (!fromUser) {
        return res.status(200).json({ ok: true });
      }

      // Upsert user in Supabase
      if (supabase) {
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

      // Command: /start
      if (text.startsWith('/start')) {
        const welcomeText =
          `👋 <b>Добро пожаловать в сервис мгновенного выкупа чеков USDT!</b>\n\n` +
          `💰 Продавайте чеки <b>CryptoBot & Send</b> по максимальному курсу с моментальной выплатой на карту или СБП (0% комиссия).\n\n` +
          `⚡️ <b>Преимущества:</b>\n` +
          `• Моментальные переводы СБП в любые банки РФ (Сбер, Т-Банк, ВТБ, Альфа)\n` +
          `• Официальный PDF-чек к каждой сделке\n` +
          `• Бонусы за объем до +1.8% и кэшбэк по рангам\n\n` +
          `Нажмите кнопку ниже, чтобы открыть обменник:`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть обменник USDT',
                web_app: { url: miniappUrl },
              },
            ],
            [
              {
                text: '📢 Канал сервиса',
                url: 'https://t.me/cryptoex_news',
              },
              {
                text: '💬 Чат сообщества',
                url: 'https://t.me/cryptoex_chat',
              },
            ],
            ...(isOwnerOrAdmin
              ? [
                  [
                    {
                      text: '⚙️ Панель управления (/admin)',
                      callback_data: 'admin_menu',
                    },
                  ],
                ]
              : []),
          ],
        };

        await sendTelegramMessage(chatId, welcomeText, keyboard);
        return res.status(200).json({ ok: true });
      }

      // Command: /admin
      if (text.startsWith('/admin') || text === 'панель') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ У вас нет прав администратора для этой команды.');
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
            [
              {
                text: `📋 Очередь ордеров (${pendingCount})`,
                callback_data: 'admin_orders_list',
              },
            ],
            [
              {
                text: '📢 Обязательные подписки и задания',
                callback_data: 'admin_tasks_list',
              },
            ],
            [
              {
                text: '💎 Настройка рангов и надбавок',
                callback_data: 'admin_tiers_list',
              },
            ],
            [
              {
                text: '📱 Открыть Mini App',
                web_app: { url: miniappUrl },
              },
            ],
          ],
        };

        await sendTelegramMessage(chatId, adminText, adminKeyboard);
        return res.status(200).json({ ok: true });
      }

      // Command: /orders
      if (text.startsWith('/orders') || text === 'ордеры') {
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
            await sendTelegramMessage(chatId, '✅ На данный момент нет новых ожидающих ордеров на выплату.');
            return res.status(200).json({ ok: true });
          }

          for (const ord of orders) {
            const reqData = ord.requisite || {};
            const ordMsg =
              `⚡️ <b>Заявка ${ord.order_number}</b>\n` +
              `Сумма: <b>${ord.crypto_amount} ${ord.crypto_symbol}</b> → <b>${ord.fiat_amount} ₽</b>\n` +
              `Банк: <b>${reqData.bank_name || 'СБП'}</b>\n` +
              `Счет / Номер: <code>${reqData.account_number}</code>\n` +
              `Получатель: ${reqData.recipient_name || 'Не указан'}\n` +
              `Чек: <code>${ord.cheque_code}</code>`;

            const ordButtons = {
              inline_keyboard: [
                [
                  {
                    text: '💳 Подтвердить выплату СБП (PDF)',
                    callback_data: `pay_order_${ord.id}`,
                  },
                ],
                [
                  {
                    text: '❌ Отклонить',
                    callback_data: `reject_order_${ord.id}`,
                  },
                ],
              ],
            };
            await sendTelegramMessage(chatId, ordMsg, ordButtons);
          }
        }
        return res.status(200).json({ ok: true });
      }
    }

    // 2. Handle Callback queries (Button clicks)
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat.id;

      await answerCallbackQuery(cb.id);

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
              `✅ <b>Выплата по ордеру ${updatedOrder.order_number} успешно подтверждена!</b>\n\n` +
              `Сумма: <b>${updatedOrder.fiat_amount} ₽</b>\n` +
              `Номер СБП операции: <code>${operationId}</code>\n` +
              `PDF чек сформирован и прикреплен к сделке.`;

            await sendTelegramMessage(chatId, successText, {
              inline_keyboard: [
                [
                  {
                    text: '🔍 Посмотреть сделку в Mini App',
                    web_app: { url: miniappUrl },
                  },
                ],
              ],
            });
          }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error processing Telegram webhook:', err);
    return res.status(200).json({ error: err.message });
  }
}
