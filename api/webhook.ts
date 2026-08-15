import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase client ─────────────────────────────────────────────
const getSupabase = (): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

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
  if (!token) return;
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

// ─── FSM state helpers (stored in Supabase table admin_fsm) ────────
type FsmState =
  | { step: 'idle' }
  | { step: 'task_create_title' }
  | { step: 'task_create_desc'; title: string }
  | { step: 'task_create_reward_xp'; title: string; description: string }
  | { step: 'task_create_reward_usdt'; title: string; description: string; reward_xp: number }
  | { step: 'task_create_required'; title: string; description: string; reward_xp: number; reward_usdt: number }
  | { step: 'task_edit_select' }
  | { step: 'task_edit_field'; taskId: string; field: string }
  | { step: 'welcome_edit_text' }
  | { step: 'welcome_edit_photo' }
  | { step: 'welcome_edit_entities' };

async function getFsmState(supabase: SupabaseClient | null, userId: number): Promise<{ state: FsmState }> {
  if (!supabase) return { state: { step: 'idle' } };
  try {
    const { data, error } = await supabase.from('admin_fsm').select('*').eq('telegram_id', userId).maybeSingle();
    if (error || !data) return { state: { step: 'idle' } };
    return { state: data.state as FsmState };
  } catch {
    return { state: { step: 'idle' } };
  }
}

async function setFsmState(supabase: SupabaseClient | null, userId: number, state: FsmState) {
  if (!supabase) return;
  try {
    await supabase.from('admin_fsm').upsert(
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

// ─── Bot settings helpers (table bot_settings, key='welcome') ──────
async function getBotSettings(supabase: SupabaseClient | null): Promise<any> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('bot_settings').select('value').eq('key', 'welcome').maybeSingle();
    if (error || !data) return null;
    return data.value;
  } catch {
    return null;
  }
}

async function setBotSettings(supabase: SupabaseClient | null, value: any) {
  if (!supabase) return;
  try {
    await supabase.from('bot_settings').upsert(
      { key: 'welcome', value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch (err) {
    console.error('setBotSettings error:', err);
  }
}

// ─── Admin check ─────────────────────────────────────────────────
function isAdmin(userId: number, ownerId: number | null): boolean {
  return Boolean(ownerId && userId === ownerId);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════════
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
    // ═══════════════════════════════════════════════════════════
    //  CALLBACK QUERIES
    // ═══════════════════════════════════════════════════════════
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const fromUser = cb.from;
      const isOwnerOrAdmin = isAdmin(fromUser?.id, ownerId);

      await answerCallbackQuery(cb.id);
      if (!chatId) return res.status(200).json({ ok: true });

      // ── Admin menu ────────────────────────────────────────────
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
        await sendTelegramMessage(chatId, `👑 <b>Панель управления</b>`, {
          inline_keyboard: [
            [{ text: `📋 Ордеры (${pendingCount})`, callback_data: 'admin_orders_list' }],
            [{ text: '📢 Задания', callback_data: 'admin_tasks_menu' }],
            [{ text: '💎 Ранги', callback_data: 'admin_tiers_list' }],
            [{ text: '💰 Баланс', callback_data: 'admin_cryptobot_balance' }],
            [{ text: '📝 Приветствие', callback_data: 'admin_welcome_menu' }],
            [{ text: '📱 Mini App', web_app: { url: miniappUrl } }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Orders list ───────────────────────────────────────────
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

      // ── Tasks menu ──────────────────────────────────────────
      if (cbData === 'admin_tasks_menu') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await sendTelegramMessage(chatId, '📢 <b>Управление заданиями</b>', {
          inline_keyboard: [
            [{ text: '➕ Добавить задание', callback_data: 'task_create_start' }],
            [{ text: '📋 Список заданий', callback_data: 'admin_tasks_list' }],
            [{ text: '✏️ Редактировать задание', callback_data: 'task_edit_start' }],
            [{ text: '🗑 Удалить задание', callback_data: 'task_delete_start' }],
            [{ text: '⬅️ Назад', callback_data: 'admin_menu' }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Task create flow ────────────────────────────────────
      if (cbData === 'task_create_start') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, { step: 'task_create_title' });
        await sendTelegramMessage(chatId, '📝 <b>Создание задания</b>\n\nШаг 1/5: Введите <b>название</b> задания:');
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'task_create_cancel') {
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '❌ Создание задания отменено.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Task edit flow ──────────────────────────────────────
      if (cbData === 'task_edit_start') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        if (!tasks || tasks.length === 0) {
          await sendTelegramMessage(chatId, 'Нет заданий для редактирования.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }
        const keyboard = tasks.map((t: any) => [{ text: t.title, callback_data: `task_edit_select_${t.id}` }]);
        keyboard.push([{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]);
        await setFsmState(supabase, fromUser.id, { step: 'task_edit_select' });
        await sendTelegramMessage(chatId, '✏️ <b>Выберите задание для редактирования:</b>', { inline_keyboard: keyboard });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_edit_select_')) {
        const taskId = cbData.replace('task_edit_select_', '');
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
        if (!task) {
          await sendTelegramMessage(chatId, '⚠️ Задание не найдено.');
          return res.status(200).json({ ok: true });
        }
        await sendTelegramMessage(
          chatId,
          `✏️ <b>Редактирование: ${task.title}</b>\n\nТекущие данные:\n📌 Описание: ${task.description || '—'}\n⭐ XP: ${task.reward_xp}\n💰 USDT: ${task.reward_usdt || 0}\n🔒 Обязательное: ${task.is_required_sub ? 'Да' : 'Нет'}`,
          {
            inline_keyboard: [
              [{ text: '📝 Название', callback_data: `task_edit_field_${taskId}_title` }],
              [{ text: '📌 Описание', callback_data: `task_edit_field_${taskId}_description` }],
              [{ text: '⭐ XP', callback_data: `task_edit_field_${taskId}_reward_xp` }],
              [{ text: '💰 USDT', callback_data: `task_edit_field_${taskId}_reward_usdt` }],
              [{ text: '🔒 Обязательное', callback_data: `task_edit_field_${taskId}_is_required_sub` }],
              [{ text: '⬅️ Назад', callback_data: 'task_edit_start' }],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_edit_field_')) {
        const parts = cbData.replace('task_edit_field_', '').split('_');
        const taskId = parts[0];
        const field = parts[1];
        await setFsmState(supabase, fromUser.id, { step: 'task_edit_field', taskId, field });
        let prompt = '';
        switch (field) {
          case 'title': prompt = 'Введите новое <b>название</b>:'; break;
          case 'description': prompt = 'Введите новое <b>описание</b>:'; break;
          case 'reward_xp': prompt = 'Введите новое значение <b>XP</b> (число):'; break;
          case 'reward_usdt': prompt = 'Введите новое значение <b>USDT</b> (число):'; break;
          case 'is_required_sub':
            await sendTelegramMessage(chatId, 'Выберите:', {
              inline_keyboard: [
                [{ text: '✅ Да', callback_data: `task_edit_confirm_${taskId}_${field}_true` }],
                [{ text: '❌ Нет', callback_data: `task_edit_confirm_${taskId}_${field}_false` }],
              ],
            });
            return res.status(200).json({ ok: true });
        }
        await sendTelegramMessage(chatId, `✏️ ${prompt}`);
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_edit_confirm_')) {
        const parts = cbData.replace('task_edit_confirm_', '').split('_');
        const taskId = parts[0];
        const field = parts[1];
        const value = parts[2] === 'true';
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        await supabase.from('tasks').update({ [field]: value }).eq('id', taskId);
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Поле обновлено!', {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Task delete flow ──────────────────────────────────────
      if (cbData === 'task_delete_start') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        if (!tasks || tasks.length === 0) {
          await sendTelegramMessage(chatId, 'Нет заданий для удаления.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }
        const keyboard = tasks.map((t: any) => [{ text: `🗑 ${t.title}`, callback_data: `task_delete_confirm_${t.id}` }]);
        keyboard.push([{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]);
        await sendTelegramMessage(chatId, '🗑 <b>Выберите задание для удаления:</b>', { inline_keyboard: keyboard });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_delete_confirm_')) {
        const taskId = cbData.replace('task_delete_confirm_', '');
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        await supabase.from('tasks').delete().eq('id', taskId);
        await sendTelegramMessage(chatId, '✅ Задание удалено.', {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Tasks list (view only) ────────────────────────────────
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
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Tiers list ────────────────────────────────────────────
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

      // ── CryptoBot balance ─────────────────────────────────────
      if (cbData === 'admin_cryptobot_balance') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        const cbToken = process.env.CRYPTOBOT_API_TOKEN;
        if (!cbToken) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен.', {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
          return res.status(200).json({ ok: true });
        }
        try {
          const [meRes, balRes] = await Promise.all([
            fetch('https://pay.crypt.bot/api/getMe', { headers: { 'Crypto-Pay-API-Token': cbToken } }),
            fetch('https://pay.crypt.bot/api/getBalance', { headers: { 'Crypto-Pay-API-Token': cbToken } }),
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

      // ── Welcome menu ────────────────────────────────────────
      if (cbData === 'admin_welcome_menu') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
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

      if (cbData === 'welcome_edit_text') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_text' });
        const settings = await getBotSettings(supabase);
        await sendTelegramMessage(
          chatId,
          `📝 <b>Редактирование текста приветствия</b>\n\nТекущий текст:\n<code>${settings?.text || '👋 Добро пожаловать!'}</code>\n\nВведите новый текст (поддерживается HTML):`,
          {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_welcome_menu' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_edit_photo') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_photo' });
        await sendTelegramMessage(
          chatId,
          `🖼 <b>Добавление фото к приветствию</b>\n\nОтправьте <b>фото</b> в этот чат.\nБот сохранит file_id для отправки всем новым пользователям.`,
          {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_welcome_menu' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_edit_entities') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_entities' });
        await sendTelegramMessage(
          chatId,
          `😎 <b>Премиум-эмодзи в приветствии</b>\n\nОтправьте сообщение с премиум-эмодзи (Telegram Premium).\nБот извлечёт entities и сохранит их.`,
          {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_welcome_menu' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_preview') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        const settings = await getBotSettings(supabase);
        const text =
          settings?.text ||
          `👋 <b>Добро пожаловать!</b>\n\n` +
          `💰 Продавайте чеки <b>CryptoBot & Send</b> по максимальному курсу с моментальной выплатой на карту или СБП (0% комиссия).\n\n` +
          `Нажмите кнопку ниже, чтобы открыть обменник:`;
        const keyboard = {
          inline_keyboard: [
            [{ text: '🚀 Открыть обменник USDT', web_app: { url: miniappUrl } }],
            ...(isOwnerOrAdmin
              ? 
              : []),
          ],
        };
        await sendTelegramMessage(chatId, `👀 <b>Предпросмотр приветствия:</b>`);
        await sendTelegramMessage(chatId, text, keyboard, {
          photo: settings?.photo,
          captionEntities: settings?.caption_entities,
        });
        await sendTelegramMessage(chatId, '⬆️ Так будет выглядеть приветствие для новых пользователей.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Pay order ───────────────────────────────────────────
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

      // ── Reject order ────────────────────────────────────────
      if (chatId && cbData.startsWith('reject_order_')) {
        const orderId = cbData.replace('reject_order_', '');
        if (supabase) {
          await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
          await sendTelegramMessage(chatId, '❌ Ордер отклонен.');
        }
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

      // Check FSM state for admin dialogs
      const { state: fsmState } = await getFsmState(supabase, fromUser.id);

      // ── FSM: Task create flow ───────────────────────────────
      if (fsmState.step === 'task_create_title') {
        await setFsmState(supabase, fromUser.id, { step: 'task_create_desc', title: msg.text || '' });
        await sendTelegramMessage(chatId, `✅ Название: <b>${msg.text}</b>\n\nШаг 2/5: Введите <b>описание</b> задания:`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'task_create_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (fsmState.step === 'task_create_desc') {
        await setFsmState(supabase, fromUser.id, {
          step: 'task_create_reward_xp',
          title: fsmState.title,
          description: msg.text || '',
        });
        await sendTelegramMessage(chatId, `✅ Описание сохранено\n\nШаг 3/5: Введите <b>награду XP</b> (число):`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'task_create_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (fsmState.step === 'task_create_reward_xp') {
        const xp = parseInt(msg.text || '0', 10);
        if (isNaN(xp) || xp < 0) {
          await sendTelegramMessage(chatId, '⚠️ Введите корректное число XP:', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'task_create_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, {
          step: 'task_create_reward_usdt',
          title: fsmState.title,
          description: fsmState.description,
          reward_xp: xp,
        });
        await sendTelegramMessage(chatId, `✅ XP: <b>${xp}</b>\n\nШаг 4/5: Введите <b>награду USDT</b> (число, 0 если нет):`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'task_create_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (fsmState.step === 'task_create_reward_usdt') {
        const usdt = parseFloat(msg.text || '0');
        if (isNaN(usdt) || usdt < 0) {
          await sendTelegramMessage(chatId, '⚠️ Введите корректное число USDT:', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'task_create_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }
        await setFsmState(supabase, fromUser.id, {
          step: 'task_create_required',
          title: fsmState.title,
          description: fsmState.description,
          reward_xp: fsmState.reward_xp,
          reward_usdt: usdt,
        });
        await sendTelegramMessage(chatId, `✅ USDT: <b>${usdt}</b>\n\nШаг 5/5: Задание <b>обязательное</b> для подписки?`, {
          inline_keyboard: [
            [{ text: '✅ Да', callback_data: 'task_create_required_true' }],
            [{ text: '❌ Нет', callback_data: 'task_create_required_false' }],
            [{ text: '❌ Отмена', callback_data: 'task_create_cancel' }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Task edit field ──────────────────────────────────
      if (fsmState.step === 'task_edit_field') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        let value: any = msg.text;
        if (fsmState.field === 'reward_xp' || fsmState.field === 'reward_usdt') {
          value = parseFloat(msg.text || '0');
          if (isNaN(value) || value < 0) {
            await sendTelegramMessage(chatId, '⚠️ Введите корректное число:');
            return res.status(200).json({ ok: true });
          }
        }
        if (fsmState.field === 'is_required_sub') {
          value = msg.text?.toLowerCase() === 'да' || msg.text === '1' || msg.text === 'true';
        }
        await supabase.from('tasks').update({ [fsmState.field]: value }).eq('id', fsmState.taskId);
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Поле обновлено!', {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit text ────────────────────────────────
      if (fsmState.step === 'welcome_edit_text') {
        const settings = (await getBotSettings(supabase)) || {};
        settings.text = msg.text || '';
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Текст приветствия обновлён!', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit entities (premium emoji) ────────────
      if (fsmState.step === 'welcome_edit_entities') {
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
            await sendTelegramMessage(chatId, '⚠️ В сообщении не найдены премиум-эмодзи. Отправьте сообщение с премиум-эмодзи (Telegram Premium):', {
              inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_welcome_menu' }]],
            });
          }
        } else {
          await sendTelegramMessage(chatId, '⚠️ В сообщении нет entities. Убедитесь, что вы отправили премиум-эмодзи:', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_welcome_menu' }]],
          });
        }
        return res.status(200).json({ ok: true });
      }

      // ── Commands ──────────────────────────────────────────────
      if (text.startsWith('/start')) {
        const settings = await getBotSettings(supabase);
        const welcomeText =
          settings?.text ||
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
            [{ text: '📢 Обязательные подписки и задания', callback_data: 'admin_tasks_menu' }],
            [{ text: '💎 Настройка рангов и надбавок', callback_data: 'admin_tiers_list' }],
            [{ text: '💰 Баланс CryptoBot', callback_data: 'admin_cryptobot_balance' }],
            [{ text: '📝 Приветствие', callback_data: 'admin_welcome_menu' }],
            [{ text: '📱 Открыть Mini App', web_app: { url: miniappUrl } }],
          ],
        };
        await sendTelegramMessage(chatId, adminText, adminKeyboard);
        return res.status(200).json({ ok: true });
      }

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

      if (text.startsWith('/balance') || text === 'баланс') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Доступно только администраторам.');
          return res.status(200).json({ ok: true });
        }
        const cbToken = process.env.CRYPTOBOT_API_TOKEN;
        if (!cbToken) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен.');
          return res.status(200).json({ ok: true });
        }
        try {
          const [meRes, balRes] = await Promise.all([
            fetch('https://pay.crypt.bot/api/getMe', { headers: { 'Crypto-Pay-API-Token': cbToken } }),
            fetch('https://pay.crypt.bot/api/getBalance', { headers: { 'Crypto-Pay-API-Token': cbToken } }),
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

    // ═══════════════════════════════════════════════════════════
    //  PHOTO MESSAGES (for welcome photo)
    // ═══════════════════════════════════════════════════════════
    if (update.message?.photo && update.message.photo.length > 0) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from;
      if (!fromUser) return res.status(200).json({ ok: true });

      const { state: fsmState } = await getFsmState(supabase, fromUser.id);

      if (fsmState.step === 'welcome_edit_photo') {
        const photos = msg.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileId = largestPhoto.file_id;
        const settings = (await getBotSettings(supabase)) || {};
        settings.photo = fileId;
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, `✅ Фото сохранено! (file_id: <code>${fileId}</code>)`, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  CALLBACK: Task create required (yes/no)
    // ═══════════════════════════════════════════════════════════
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const fromUser = cb.from;
      const isOwnerOrAdmin = isAdmin(fromUser?.id, ownerId);

      await answerCallbackQuery(cb.id);

      if (cbData === 'task_create_required_true' || cbData === 'task_create_required_false') {
        if (!isOwnerOrAdmin || !chatId) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        const { state: fsmState } = await getFsmState(supabase, fromUser.id);
        if (fsmState.step !== 'task_create_required') {
          await sendTelegramMessage(chatId, '⚠️ Сессия устарела. Начните заново.');
          return res.status(200).json({ ok: true });
        }
        const isRequired = cbData === 'task_create_required_true';
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        const { data: newTask } = await supabase.from('tasks').insert({
          title: fsmState.title,
          description: fsmState.description,
          reward_xp: fsmState.reward_xp,
          reward_usdt: fsmState.reward_usdt,
          is_required_sub: isRequired,
          is_active: true,
        }).select().single();

        await clearFsmState(supabase, fromUser.id);
        if (newTask) {
          await sendTelegramMessage(
            chatId,
            `✅ <b>Задание создано!</b>\n\n📌 <b>${newTask.title}</b>\n⭐ +${newTask.reward_xp} XP\n💰 +${newTask.reward_usdt || 0} USDT\n🔒 Обязательное: ${newTask.is_required_sub ? 'Да' : 'Нет'}`,
            {
              inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
            }
          );
        } else {
          await sendTelegramMessage(chatId, '⚠️ Ошибка создания задания.', {
            inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
          });
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
