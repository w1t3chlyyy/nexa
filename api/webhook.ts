import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase client ─────────────────────────────────────────────
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Telegram helpers ────────────────────────────────────────────
async function tgApi(token: string, method: string, body: Record<string, any>): Promise<any> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`tgApi ${method} error:`, err);
    return { ok: false, description: String(err) };
  }
}

async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  options?: { photo?: string; captionEntities?: any[] }
) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN is not set');
    return;
  }
  try {
    if (options?.photo) {
      await tgApi(token, 'sendPhoto', {
        chat_id: chatId,
        photo: options.photo,
        caption: text,
        parse_mode: 'HTML',
        caption_entities: options.captionEntities,
        reply_markup: replyMarkup,
      });
    } else {
      await tgApi(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        entities: options?.captionEntities,
      });
    }
  } catch (err) {
    console.error('sendTelegramMessage error:', err);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  try {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch (err) {
    console.error('answerCallbackQuery error:', err);
  }
}

// ─── FSM state helpers ──────────────────────────────────────────
type FsmState =
  | { step: 'idle' }
  | { step: 'welcome_edit_text' }
  | { step: 'welcome_edit_photo' }
  | { step: 'welcome_edit_entities' };

async function getFsmState(supabase: SupabaseClient | null, userId: number): Promise<{ state: FsmState }> {
  if (!supabase) return { state: { step: 'idle' } };
  try {
    const { data, error } = await supabase
      .from('admin_fsm')
      .select('*')
      .eq('telegram_id', userId)
      .maybeSingle();
    if (error || !data) return { state: { step: 'idle' } };
    return { state: data.state as FsmState };
  } catch (err) {
    console.error('getFsmState error:', err);
    return { state: { step: 'idle' } };
  }
}

async function setFsmState(supabase: SupabaseClient | null, userId: number, state: FsmState) {
  if (!supabase) return;
  try {
    await supabase
      .from('admin_fsm')
      .upsert(
        { telegram_id: userId, state: state as any, updated_at: new Date().toISOString() },
        { onConflict: 'telegram_id' }
      );
  } catch (err) {
    console.error('setFsmState error:', err);
  }
}

async function clearFsmState(supabase: SupabaseClient | null, userId: number) {
  if (!supabase) return;
  try {
    await supabase.from('admin_fsm').delete().eq('telegram_id', userId);
  } catch (err) {
    console.error('clearFsmState error:', err);
  }
}

// ─── Bot settings helpers ──────────────────────────────────────
async function getBotSettings(supabase: SupabaseClient | null): Promise<any> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'welcome')
      .maybeSingle();
    if (error || !data) return null;
    return data.value;
  } catch (err) {
    console.error('getBotSettings error:', err);
    return null;
  }
}

async function setBotSettings(supabase: SupabaseClient | null, value: any) {
  if (!supabase) return;
  try {
    await supabase
      .from('bot_settings')
      .upsert({ key: 'welcome', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    console.error('setBotSettings error:', err);
  }
}

// ─── Admin check ─────────────────────────────────────────────────
function isAdmin(userId: number, ownerId: number | null): boolean {
  return Boolean(ownerId && userId === ownerId);
}

// ─── Main admin menu keyboard ────────────────────────────────────
async function buildAdminMenuKeyboard(supabase: SupabaseClient | null, miniappUrl: string) {
  let pendingCount = 0;
  if (supabase) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new');
    pendingCount = count || 0;
  }

  return {
    inline_keyboard: [
      [{ text: `📋 Ордеры (${pendingCount})`, callback_data: 'admin_orders_list' }],
      [{ text: '📢 Задания', callback_data: 'admin_tasks_menu' }],
      [{ text: '💎 Ранги', callback_data: 'admin_tiers_list' }],
      [{ text: '💰 Баланс', callback_data: 'admin_cryptobot_balance' }],
      [{ text: '📝 Приветствие', callback_data: 'admin_welcome_menu' }],
      [{ text: '📱 Mini App', web_app: { url: miniappUrl } }],
    ],
  };
}

// ══════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true });
  }

  const supabase = getSupabase();
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;

  try {
    // ═══════════════════════════════════════════════════════════
    //  CALLBACK QUERIES
    // ═══════════════════════════════════════════════════════════
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData: string = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const fromUser = cb.from;
      const isOwnerOrAdmin = isAdmin(fromUser?.id, ownerId);

      await answerCallbackQuery(cb.id);
      if (!chatId) return res.status(200).json({ ok: true });

      if (!isOwnerOrAdmin && cbData.startsWith('admin')) {
        await sendTelegramMessage(chatId, '⛔️ Нет прав.');
        return res.status(200).json({ ok: true });
      }

      // ── Главное меню админки ───────────────────────────────────
      if (cbData === 'admin_menu') {
        const keyboard = await buildAdminMenuKeyboard(supabase, miniappUrl);
        await sendTelegramMessage(chatId, '👑 <b>Панель управления</b>', keyboard);
        return res.status(200).json({ ok: true });
      }

      // ── Ордеры: список новых заявок ────────────────────────────
      if (cbData === 'admin_orders_list') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }

        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(10);

        if (ordersErr) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка загрузки заявок: ${ordersErr.message}`);
          return res.status(200).json({ ok: true });
        }

        if (!orders || orders.length === 0) {
          await sendTelegramMessage(chatId, '📋 Новых заявок нет.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }

        for (const order of orders) {
          const reqInfo = order.requisite || {};
          const text =
            `📋 <b>Заявка ${order.order_number}</b>\n\n` +
            `Пользователь: @${order.user_username || order.user_telegram_id}\n` +
            `Сумма: ${order.crypto_amount} ${order.crypto_symbol} → ${Number(order.fiat_amount).toLocaleString('ru-RU')} ₽\n` +
            `Банк: ${reqInfo.bankName || '—'}\n` +
            `Счёт: ${reqInfo.accountNumber || '—'}\n` +
            `Получатель: ${reqInfo.recipientName || '—'}`;

          await sendTelegramMessage(chatId, text, {
            inline_keyboard: [[{ text: '✅ Отметить оплаченной', callback_data: `mark_paid:${order.order_number}` }]],
          });
        }

        await sendTelegramMessage(chatId, '⬆️ Активные заявки выше.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Ордеры: пометить конкретную заявку оплаченной ──────────
      if (cbData.startsWith('mark_paid:')) {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }

        const orderNumber = cbData.split(':')[1];
        const payoutTxId = `SBP_RUR_${Math.floor(100000000 + Math.random() * 900000000)}`;

        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            payout_tx_id: payoutTxId,
            assigned_admin: fromUser.username || String(fromUser.id),
          })
          .eq('order_number', orderNumber);

        if (updateErr) {
          await sendTelegramMessage(chatId, `⚠️ Не удалось обновить заявку: ${updateErr.message}`);
        } else {
          await sendTelegramMessage(
            chatId,
            `✅ Заявка ${orderNumber} отмечена оплаченной. Пользователь увидит это в приложении автоматически.`
          );
        }
        return res.status(200).json({ ok: true });
      }

      // ── Задания: список + переключатель активности ─────────────
      // ВАЖНО: это управляет таблицей public.tasks в Supabase.
      // Мини-апп СЕЙЧАС читает задания из своего локального списка
      // (src/data/mockData.ts), а не из этой таблицы — переключение
      // здесь пока НЕ скрывает и не показывает задания в приложении.
      // Чтобы это заработало по-настоящему, мини-апп нужно перевести
      // на чтение заданий из Supabase.
      if (cbData === 'admin_tasks_menu' || cbData.startsWith('toggle_task:')) {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }

        if (cbData.startsWith('toggle_task:')) {
          const taskId = cbData.split(':')[1];
          const { data: taskRow } = await supabase
            .from('tasks')
            .select('is_active')
            .eq('id', taskId)
            .maybeSingle();
          if (taskRow) {
            await supabase.from('tasks').update({ is_active: !taskRow.is_active }).eq('id', taskId);
          }
        }

        const { data: tasksRows, error: tasksErr } = await supabase
          .from('tasks')
          .select('*')
          .order('category', { ascending: true });

        if (tasksErr) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка загрузки заданий: ${tasksErr.message}`);
          return res.status(200).json({ ok: true });
        }

        if (!tasksRows || tasksRows.length === 0) {
          await sendTelegramMessage(chatId, '📢 Заданий в таблице tasks нет.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }

        const keyboard = tasksRows.map((t: any) => [
          { text: `${t.is_active ? '✅' : '⛔️'} ${t.title}`, callback_data: `toggle_task:${t.id}` },
        ]);
        keyboard.push([{ text: '⬅️ Назад', callback_data: 'admin_menu' }]);

        await sendTelegramMessage(
          chatId,
          '📢 <b>Задания (таблица Supabase)</b>\n\n' +
            'Нажмите на задание, чтобы включить/выключить его.\n' +
            '⚠️ Пока не влияет на мини-апп — она использует свой отдельный список.',
          { inline_keyboard: keyboard }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Ранги: просмотр таблицы tiers_config ────────────────────
      // Так же не связано с мини-аппом напрямую (см. предупреждение выше).
      if (cbData === 'admin_tiers_list') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }

        const { data: tiersRows, error: tiersErr } = await supabase
          .from('tiers_config')
          .select('*')
          .order('min_xp', { ascending: true });

        if (tiersErr) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка загрузки рангов: ${tiersErr.message}`);
          return res.status(200).json({ ok: true });
        }

        const lines = (tiersRows || [])
          .map(
            (t: any) =>
              `<b>${t.title}</b> (от ${t.min_xp} XP)\n+${t.rate_bonus}% курс · кэшбэк ${t.cashback_percent}% · ${t.payout_speed_text}`
          )
          .join('\n\n');

        await sendTelegramMessage(
          chatId,
          `💎 <b>Ранги (таблица Supabase)</b>\n\n${lines || 'Пусто'}\n\n⚠️ Мини-апп пока использует свой встроенный список рангов, не эту таблицу.`,
          { inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Баланс CryptoBot ─────────────────────────────────────────
      if (cbData === 'admin_cryptobot_balance') {
        const token = process.env.CRYPTOBOT_API_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен на сервере.');
          return res.status(200).json({ ok: true });
        }

        try {
          const resp = await fetch('https://pay.crypt.bot/api/getBalance', {
            headers: { 'Crypto-Pay-API-Token': token },
          });
          const data = await resp.json();

          if (!data.ok) {
            await sendTelegramMessage(chatId, `⚠️ Ошибка CryptoBot API: ${data.error?.name || 'неизвестна'}`);
            return res.status(200).json({ ok: true });
          }

          const lines = (data.result || [])
            .map((b: any) => `${b.currency_code}: <b>${b.available}</b> (заморожено: ${b.onhold})`)
            .join('\n');

          await sendTelegramMessage(chatId, `💰 <b>Баланс CryptoBot</b>\n\n${lines || 'Пусто'}`, {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
        } catch (err: any) {
          await sendTelegramMessage(chatId, `⚠️ Не удалось получить баланс: ${err.message}`);
        }
        return res.status(200).json({ ok: true });
      }

      // ── Приветствие: подменю (то, что раньше было главным меню) ─
      if (cbData === 'admin_welcome_menu') {
        const settings = await getBotSettings(supabase);
        const hasPhoto = settings?.photo ? '✅' : '❌';
        const hasEntities = settings?.caption_entities ? '✅' : '❌';

        await sendTelegramMessage(
          chatId,
          `📝 <b>Управление приветствием</b>\n\nТекущий текст: ${settings?.text ? '✅' : '❌'}\nФото: ${hasPhoto}\nПремиум-эмодзи: ${hasEntities}`,
          {
            inline_keyboard: [
              [{ text: '📝 Изменить текст', callback_data: 'welcome_edit_text' }],
              [{ text: `🖼 Фото ${hasPhoto}`, callback_data: 'welcome_edit_photo' }],
              [{ text: `😎 Премиум-эмодзи ${hasEntities}`, callback_data: 'welcome_edit_entities' }],
              [{ text: '👀 Предпросмотр', callback_data: 'welcome_preview' }],
              [{ text: '⬅️ Назад', callback_data: 'admin_menu' }],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit text ──────────────────────────────────────
      if (cbData === 'welcome_edit_text') {
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_text' });
        const settings = await getBotSettings(supabase);
        await sendTelegramMessage(
          chatId,
          `📝 <b>Редактирование текста приветствия</b>\n\nТекущий текст:\n<code>${settings?.text || '👋 Добро пожаловать!'}</code>\n\nВведите новый текст (поддерживается HTML):`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit photo ─────────────────────────────────────
      if (cbData === 'welcome_edit_photo') {
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_photo' });
        await sendTelegramMessage(chatId, `🖼 <b>Добавление фото к приветствию</b>\n\nОтправьте <b>фото</b> в этот чат.`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit entities ──────────────────────────────────
      if (cbData === 'welcome_edit_entities') {
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_entities' });
        await sendTelegramMessage(
          chatId,
          `😎 <b>Премиум-эмодзи в приветствии</b>\n\nОтправьте сообщение с премиум-эмодзи (Telegram Premium).`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome preview ────────────────────────────────────────
      if (cbData === 'welcome_preview') {
        const settings = await getBotSettings(supabase);
        const text = settings?.text || `<b>Добро пожаловать в Nexa</b>\n\nПродавайте криптовалюту по лучшему курсу.`;
        const keyboard = { inline_keyboard: [[{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }]] };

        await sendTelegramMessage(chatId, `👀 <b>Предпросмотр приветствия:</b>`);
        if (settings?.photo) {
          await sendTelegramMessage(chatId, text, keyboard, { photo: settings.photo, captionEntities: settings?.caption_entities });
        } else {
          await sendTelegramMessage(chatId, text, keyboard);
        }
        await sendTelegramMessage(chatId, '⬆️ Так будет выглядеть приветствие.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Cancel ──────────────────────────────────────────────────
      if (cbData === 'welcome_cancel') {
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '❌ Отменено.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  TEXT MESSAGES
    // ═══════════════════════════════════════════════════════════
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').toLowerCase();
      const fromUser = msg.from;
      if (!fromUser) return res.status(200).json({ ok: true });

      const isOwnerOrAdmin = isAdmin(fromUser.id, ownerId);
      const { state: fsmState } = await getFsmState(supabase, fromUser.id);

      // ── FSM: Welcome edit text ────────────────────────────────
      if (fsmState.step === 'welcome_edit_text') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        const settings = (await getBotSettings(supabase)) || {};
        settings.text = msg.text || '';
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);

        await sendTelegramMessage(chatId, '✅ Текст приветствия обновлён!\n\n' + msg.text, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit entities ────────────────────────────
      if (fsmState.step === 'welcome_edit_entities') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        const settings = (await getBotSettings(supabase)) || {};

        if (msg.entities) {
          const customEmojiEntities = msg.entities.filter((e: any) => e.type === 'custom_emoji');
          if (customEmojiEntities.length > 0) {
            settings.caption_entities = customEmojiEntities;
            await setBotSettings(supabase, settings);
            await clearFsmState(supabase, fromUser.id);
            await sendTelegramMessage(chatId, `✅ Сохранено <b>${customEmojiEntities.length}</b> премиум-эмодзи!`, {
              inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
            });
          } else {
            await sendTelegramMessage(
              chatId,
              '⚠️ В сообщении не найдены премиум-эмодзи. Отправьте сообщение с премиум-эмодзи (Telegram Premium):',
              { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
            );
          }
        } else {
          await sendTelegramMessage(chatId, '⚠️ В сообщении нет entities. Отправьте сообщение с премиум-эмодзи:', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
          });
        }
        return res.status(200).json({ ok: true });
      }

      // ── Commands ──────────────────────────────────────────────
      if (text.startsWith('/start')) {
        const settings = await getBotSettings(supabase);
        const welcomeText = settings?.text || `👋 <b>Добро пожаловать!</b>`;
        const keyboard = { inline_keyboard: [[{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }]] };

        await sendTelegramMessage(chatId, welcomeText, keyboard, {
          photo: settings?.photo,
          captionEntities: settings?.caption_entities,
        });
        return res.status(200).json({ ok: true });
      }

      if (text.startsWith('/admin') || text === 'панель') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ У вас нет прав администратора.');
          return res.status(200).json({ ok: true });
        }

        const keyboard = await buildAdminMenuKeyboard(supabase, miniappUrl);
        await sendTelegramMessage(chatId, '👑 <b>Панель управления</b>', keyboard);
        return res.status(200).json({ ok: true });
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  PHOTO MESSAGES
    // ═══════════════════════════════════════════════════════════
    if (update.message?.photo && update.message.photo.length > 0) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from;
      if (!fromUser) return res.status(200).json({ ok: true });

      const { state: fsmState } = await getFsmState(supabase, fromUser.id);

      if (fsmState.step === 'welcome_edit_photo') {
        if (!isAdmin(fromUser.id, ownerId)) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        const photos = msg.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileId = largestPhoto.file_id;

        const settings = (await getBotSettings(supabase)) || {};
        settings.photo = fileId;
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);

        await sendTelegramMessage(chatId, `✅ Фото сохранено!`, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
