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

// Раньше эта функция всегда отправляла И parse_mode:'HTML', И entities
// одновременно — Telegram API не поддерживает такую комбинацию (entities
// заменяют parse_mode, а не дополняют его), из-за чего премиум-эмодзи
// либо не показывались, либо смещения текста уезжали. Теперь используется
// РОВНО один из вариантов.
async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  options?: { photo?: string; entities?: any[] }
) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN is not set');
    return;
  }
  const hasEntities = Array.isArray(options?.entities) && options!.entities!.length > 0;

  try {
    if (options?.photo) {
      await tgApi(token, 'sendPhoto', {
        chat_id: chatId,
        photo: options.photo,
        caption: text,
        reply_markup: replyMarkup,
        ...(hasEntities ? { caption_entities: options!.entities } : { parse_mode: 'HTML' }),
      });
    } else {
      await tgApi(token, 'sendMessage', {
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        ...(hasEntities ? { entities: options!.entities } : { parse_mode: 'HTML' }),
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
    await tgApi(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text });
  } catch (err) {
    console.error('answerCallbackQuery error:', err);
  }
}

// ─── FSM state helpers ──────────────────────────────────────────
type FsmState =
  | { step: 'idle' }
  | { step: 'welcome_edit_text' }
  | { step: 'welcome_edit_photo' }
  | { step: 'welcome_edit_entities' }
  | { step: 'tier_edit'; tierKey: string }
  | { step: 'tier_add' }
  | { step: 'task_edit'; taskId: string }
  | { step: 'task_add' }
  | { step: 'banner_edit'; bannerId: string }
  | { step: 'banner_add'; size: 'small' | 'large' };

async function getFsmState(supabase: SupabaseClient | null, userId: number): Promise<{ state: FsmState }> {
  if (!supabase) return { state: { step: 'idle' } };
  try {
    const { data, error } = await supabase.from('admin_fsm').select('*').eq('telegram_id', userId).maybeSingle();
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
      .upsert({ telegram_id: userId, state: state as any, updated_at: new Date().toISOString() }, { onConflict: 'telegram_id' });
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
    const { data, error } = await supabase.from('bot_settings').select('value').eq('key', 'welcome').maybeSingle();
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
    await supabase.from('bot_settings').upsert({ key: 'welcome', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    console.error('setBotSettings error:', err);
  }
}

// Собирает текст + entities приветствия. Если сохранена "премиум"-пара
// (текст и entities, снятые из ОДНОГО оригинального сообщения админа) —
// используется именно она, потому что entities валидны только для того
// текста, из которого они взяты. Иначе — обычный HTML-текст.
function buildWelcomePayload(settings: any): { text: string; entities?: any[] } {
  if (settings?.premiumText && Array.isArray(settings?.premiumEntities) && settings.premiumEntities.length > 0) {
    return { text: settings.premiumText, entities: settings.premiumEntities };
  }
  return { text: settings?.text || '👋 <b>Добро пожаловать!</b>' };
}

// ─── Admin check ─────────────────────────────────────────────────
function isAdmin(userId: number, ownerId: number | null): boolean {
  return Boolean(ownerId && userId === ownerId);
}

function parsePipeFields(text: string, expectedCount: number): string[] | null {
  const parts = (text || '').split('|').map((p) => p.trim());
  if (parts.length !== expectedCount) return null;
  return parts;
}

// ─── Main admin menu keyboard ────────────────────────────────────
async function buildAdminMenuKeyboard(supabase: SupabaseClient | null, miniappUrl: string) {
  let pendingCount = 0;
  if (supabase) {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new');
    pendingCount = count || 0;
  }

  return {
    inline_keyboard: [
      [{ text: `📋 Ордеры (${pendingCount})`, callback_data: 'admin_orders_list' }],
      [{ text: '📢 Задания', callback_data: 'admin_tasks_menu' }],
      [{ text: '💎 Ранги', callback_data: 'admin_tiers_list' }],
      [{ text: '🖼 Баннеры', callback_data: 'admin_banners_menu' }],
      [{ text: '💱 Курс', callback_data: 'admin_rate_edit' }],
      [{ text: '💰 Баланс', callback_data: 'admin_cryptobot_balance' }],
      [{ text: '📝 Приветствие', callback_data: 'admin_welcome_menu' }],
      [{ text: '📱 Mini App', web_app: { url: miniappUrl } }],
    ],
  };
}

const TASK_FORMAT_HELP =
  'Название | Описание | категория (daily/trade/telegram_sub/milestone) | XP | USDT | maxProgress | unit | текст кнопки | триггер (per_trade/daily_volume/single_deal_min/milestone_deals/milestone_referrals/milestone_volume/manual) | @канал или -';

// ══════════════════════════════════════════════════════════════════
//  STORAGE HELPERS — НОВЫЕ ФУНКЦИИ ДЛЯ ЗАГРУЗКИ ФОТО
// ══════════════════════════════════════════════════════════════════

async function uploadBannerToStorage(supabase: SupabaseClient, fileBuffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('banners')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    const { data: publicUrl } = supabase.storage.from('banners').getPublicUrl(fileName);
    return publicUrl.publicUrl;
  } catch (err) {
    console.error('uploadBannerToStorage error:', err);
    return null;
  }
}

async function deleteBannerFromStorage(supabase: SupabaseClient, storagePath: string) {
  try {
    await supabase.storage.from('banners').remove([storagePath]);
  } catch (err) {
    console.error('deleteBannerFromStorage error:', err);
  }
}

async function downloadTelegramFile(token: string, fileId: string): Promise<Buffer | null> {
  try {
    // 1. Получаем file_path у Telegram
    const fileInfo = await tgApi(token, 'getFile', { file_id: fileId });
    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      console.error('getFile failed:', fileInfo);
      return null;
    }

    // 2. Скачиваем файл по прямой ссылке
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error('Download failed:', response.status);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('downloadTelegramFile error:', err);
    return null;
  }
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
      const cbData: string = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const fromUser = cb.from;
      const isOwnerOrAdmin = isAdmin(fromUser?.id, ownerId);

      await answerCallbackQuery(cb.id);
      if (!chatId) return res.status(200).json({ ok: true });

      const ADMIN_PREFIXES = ['admin', 'mark_paid', 'task_', 'tier_', 'banner_'];
      if (!isOwnerOrAdmin && ADMIN_PREFIXES.some((p) => cbData.startsWith(p))) {
        await sendTelegramMessage(chatId, '⛔️ Нет прав.');
        return res.status(200).json({ ok: true });
      }

      // ── Главное меню админки ───────────────────────────────────
      if (cbData === 'admin_menu') {
        const keyboard = await buildAdminMenuKeyboard(supabase, miniappUrl);
        await sendTelegramMessage(chatId, '👑 <b>Панель управления</b>', keyboard);
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'admin_cancel') {
        await clearFsmState(supabase, fromUser.id);
        const keyboard = await buildAdminMenuKeyboard(supabase, miniappUrl);
        await sendTelegramMessage(chatId, '❌ Отменено.', keyboard);
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

        await sendTelegramMessage(
          chatId,
          updateErr
            ? `⚠️ Не удалось обновить заявку: ${updateErr.message}`
            : `✅ Заявка ${orderNumber} отмечена оплаченной. Пользователь увидит это в приложении автоматически.`
        );
        return res.status(200).json({ ok: true });
      }

      // ── Ранги: список ────────────────────────────────────────
      if (cbData === 'admin_tiers_list') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }
        const { data: tiersRows, error } = await supabase.from('tiers_config').select('*').order('min_xp', { ascending: true });
        if (error) {
          await sendTelegramMessage(chatId, `⚠️ ${error.message}`);
          return res.status(200).json({ ok: true });
        }

        if (tiersRows && tiersRows.length > 0) {
          for (const t of tiersRows) {
            const text = `💎 <b>${t.title}</b> (${t.tier_key})\nОт ${t.min_xp} XP · +${t.rate_bonus}% курс · кэшбэк ${t.cashback_percent}%\n${t.payout_speed_text}`;
            await sendTelegramMessage(chatId, text, {
              inline_keyboard: [[
                { text: '✏️ Изменить', callback_data: `tier_edit_start:${t.tier_key}` },
                { text: '🗑 Удалить', callback_data: `tier_delete:${t.tier_key}` },
              ]],
            });
          }
        } else {
          await sendTelegramMessage(chatId, '💎 Рангов пока нет.');
        }

        await sendTelegramMessage(chatId, 'Добавить новый ранг:', {
          inline_keyboard: [[{ text: '➕ Добавить ранг', callback_data: 'tier_add_start' }], [{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('tier_edit_start:')) {
        const tierKey = cbData.split(':')[1];
        await setFsmState(supabase, fromUser.id, { step: 'tier_edit', tierKey });
        await sendTelegramMessage(
          chatId,
          `✏️ <b>Редактирование ранга ${tierKey}</b>\n\nОтправьте одной строкой через " | ":\nНазвание | бонус к курсу % | кэшбэк % | min XP | текст скорости выплаты\n\nПример:\nЗолотой Партнёр | 0.50 | 0.45 | 750 | ~ 30 сек`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'tier_add_start') {
        await setFsmState(supabase, fromUser.id, { step: 'tier_add' });
        await sendTelegramMessage(
          chatId,
          `➕ <b>Новый ранг</b>\n\nОтправьте одной строкой через " | ":\nключ (латиницей, без пробелов) | Название | бонус к курсу % | кэшбэк % | min XP | текст скорости выплаты\n\nПример:\nvip | VIP Партнёр | 1.50 | 1.00 | 8000 | Мгновенно`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('tier_delete:')) {
        if (!supabase) return res.status(200).json({ ok: true });
        const tierKey = cbData.split(':')[1];
        const { count } = await supabase.from('tiers_config').select('tier_key', { count: 'exact', head: true });
        if ((count || 0) <= 1) {
          await sendTelegramMessage(chatId, '⚠️ Нельзя удалить последний оставшийся ранг.');
          return res.status(200).json({ ok: true });
        }
        const { error } = await supabase.from('tiers_config').delete().eq('tier_key', tierKey);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : `✅ Ранг ${tierKey} удалён.`, {
          inline_keyboard: [[{ text: '⬅️ К рангам', callback_data: 'admin_tiers_list' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Задания: список ─────────────────────────────────────
      if (cbData === 'admin_tasks_menu') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }
        const { data: tasksRows, error } = await supabase.from('tasks').select('*').order('category', { ascending: true });
        if (error) {
          await sendTelegramMessage(chatId, `⚠️ ${error.message}`);
          return res.status(200).json({ ok: true });
        }

        if (tasksRows && tasksRows.length > 0) {
          for (const t of tasksRows) {
            const text = `📢 <b>${t.title}</b>\n${t.category} · +${t.reward_xp} XP${t.reward_usdt ? ` · +$${t.reward_usdt}` : ''}\n${t.is_active ? '✅ включено' : '⛔️ выключено'}`;
            await sendTelegramMessage(chatId, text, {
              inline_keyboard: [[
                { text: '✏️', callback_data: `task_edit_start:${t.id}` },
                { text: t.is_active ? '⛔️ Выкл' : '✅ Вкл', callback_data: `task_toggle:${t.id}` },
                { text: '🗑', callback_data: `task_delete:${t.id}` },
              ]],
            });
          }
        } else {
          await sendTelegramMessage(chatId, '📢 Заданий пока нет.');
        }

        await sendTelegramMessage(chatId, 'Добавить новое задание:', {
          inline_keyboard: [[{ text: '➕ Добавить задание', callback_data: 'task_add_start' }], [{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_toggle:')) {
        if (!supabase) return res.status(200).json({ ok: true });
        const taskId = cbData.split(':')[1];
        const { data: row } = await supabase.from('tasks').select('is_active').eq('id', taskId).maybeSingle();
        if (row) await supabase.from('tasks').update({ is_active: !row.is_active }).eq('id', taskId);
        await sendTelegramMessage(chatId, '✅ Обновлено.', { inline_keyboard: [[{ text: '⬅️ К списку', callback_data: 'admin_tasks_menu' }]] });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_delete:')) {
        if (!supabase) return res.status(200).json({ ok: true });
        const taskId = cbData.split(':')[1];
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : '✅ Задание удалено.', {
          inline_keyboard: [[{ text: '⬅️ К списку', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('task_edit_start:')) {
        const taskId = cbData.split(':')[1];
        await setFsmState(supabase, fromUser.id, { step: 'task_edit', taskId });
        await sendTelegramMessage(chatId, `✏️ <b>Редактирование задания</b>\n\nОтправьте одной строкой через " | ":\n${TASK_FORMAT_HELP}`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'task_add_start') {
        await setFsmState(supabase, fromUser.id, { step: 'task_add' });
        await sendTelegramMessage(
          chatId,
          `➕ <b>Новое задание</b>\n\nОтправьте одной строкой через " | ":\n${TASK_FORMAT_HELP}\n\nПример:\nПодписка на канал | Подпишитесь на канал | telegram_sub | 100 | 0.5 | 1 | канал | Проверить подписку | manual | @cryptoex_news`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Баннеры ──────────────────────────────────────────────
      if (cbData === 'admin_banners_menu') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }
        const { data: bannerRows, error } = await supabase.from('banners').select('*').order('size', { ascending: true }).order('sort_order', { ascending: true });
        if (error) {
          await sendTelegramMessage(chatId, `⚠️ ${error.message}`);
          return res.status(200).json({ ok: true });
        }

        if (bannerRows && bannerRows.length > 0) {
          for (const b of bannerRows) {
            const text = `🖼 <b>${b.title}</b> (${b.size === 'small' ? 'верхний' : 'большой'})\n${b.is_active ? '✅' : '⛔️'} → ${b.link_url}`;
            await sendTelegramMessage(chatId, text, {
              inline_keyboard: [[
                { text: '✏️', callback_data: `banner_edit_start:${b.id}` },
                { text: b.is_active ? '⛔️ Выкл' : '✅ Вкл', callback_data: `banner_toggle:${b.id}` },
                { text: '🗑', callback_data: `banner_delete:${b.id}` },
              ]],
            });
          }
        } else {
          await sendTelegramMessage(chatId, '🖼 Баннеров пока нет.');
        }

        await sendTelegramMessage(chatId, 'Добавить новый баннер:', {
          inline_keyboard: [
            [{ text: '➕ Верхний (маленький)', callback_data: 'banner_add_start:small' }],
            [{ text: '➕ Большой', callback_data: 'banner_add_start:large' }],
            [{ text: '⬅️ Назад', callback_data: 'admin_menu' }],
          ],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('banner_toggle:')) {
        if (!supabase) return res.status(200).json({ ok: true });
        const bannerId = cbData.split(':')[1];
        const { data: row } = await supabase.from('banners').select('is_active').eq('id', bannerId).maybeSingle();
        if (row) await supabase.from('banners').update({ is_active: !row.is_active }).eq('id', bannerId);
        await sendTelegramMessage(chatId, '✅ Обновлено.', { inline_keyboard: [[{ text: '⬅️ К баннерам', callback_data: 'admin_banners_menu' }]] });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('banner_delete:')) {
        if (!supabase) return res.status(200).json({ ok: true });
        const bannerId = cbData.split(':')[1];
        
        // Удаляем фото из Storage перед удалением записи
        const { data: oldBanner } = await supabase.from('banners').select('storage_path').eq('id', bannerId).maybeSingle();
        if (oldBanner?.storage_path) {
          await deleteBannerFromStorage(supabase, oldBanner.storage_path);
        }
        
        const { error } = await supabase.from('banners').delete().eq('id', bannerId);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : '✅ Баннер удалён.', {
          inline_keyboard: [[{ text: '⬅️ К баннерам', callback_data: 'admin_banners_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ═══════════════════════════════════════════════════════════
      //  НОВЫЕ КНОПКИ БАННЕРОВ — ОТПРАВКА ФОТО ВМЕСТО URL
      // ═══════════════════════════════════════════════════════════
      if (cbData.startsWith('banner_edit_start:')) {
        const bannerId = cbData.split(':')[1];
        await setFsmState(supabase, fromUser.id, { step: 'banner_edit', bannerId });
        await sendTelegramMessage(chatId, `✏️ <b>Редактирование баннера</b>\n\nОтправьте <b>фото</b> в этот чат, а в подписи к фото укажите:\nЗаголовок | Ссылка (кнопка «Перейти»)\n\nПример подписи:\nЛетний сезон | https://t.me/mychannel`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData.startsWith('banner_add_start:')) {
        const size = cbData.split(':')[1] as 'small' | 'large';
        await setFsmState(supabase, fromUser.id, { step: 'banner_add', size });
        await sendTelegramMessage(
          chatId,
          `➕ <b>Новый баннер (${size === 'small' ? 'верхний' : 'большой'})</b>\n\nОтправьте <b>фото</b> в этот чат, а в подписи к фото укажите:\nЗаголовок | Ссылка\n\nПример подписи:\nЛетний сезон | https://t.me/mychannel`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Курс ─────────────────────────────────────────────────
      if (cbData === 'admin_rate_edit') {
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          return res.status(200).json({ ok: true });
        }
        const { data: rateRow } = await supabase.from('exchange_rates').select('*').eq('crypto_symbol', 'USDT').maybeSingle();
        await setFsmState(supabase, fromUser.id, { step: 'rate_edit', symbol: 'USDT' });
        await sendTelegramMessage(chatId, `💱 <b>Курс USDT</b>\n\nТекущий: ${rateRow?.rate_rub ?? '—'} ₽\n\nОтправьте новый курс числом (например: 93.10)`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Баланс CryptoBot ─────────────────────────────────────
      if (cbData === 'admin_cryptobot_balance') {
        const token = process.env.CRYPTOBOT_API_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ CRYPTOBOT_API_TOKEN не настроен на сервере.');
          return res.status(200).json({ ok: true });
        }
        try {
          const resp = await fetch('https://pay.crypt.bot/api/getBalance', { headers: { 'Crypto-Pay-API-Token': token } });
          const data = await resp.json();
          if (!data.ok) {
            await sendTelegramMessage(chatId, `⚠️ Ошибка CryptoBot API: ${data.error?.name || 'неизвестна'}`);
            return res.status(200).json({ ok: true });
          }
          const lines = (data.result || []).map((b: any) => `${b.currency_code}: <b>${b.available}</b> (заморожено: ${b.onhold})`).join('\n');
          await sendTelegramMessage(chatId, `💰 <b>Баланс CryptoBot</b>\n\n${lines || 'Пусто'}`, {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          });
        } catch (err: any) {
          await sendTelegramMessage(chatId, `⚠️ Не удалось получить баланс: ${err.message}`);
        }
        return res.status(200).json({ ok: true });
      }

      // ── Приветствие: подменю ────────────────────────────────
      if (cbData === 'admin_welcome_menu') {
        const settings = await getBotSettings(supabase);
        const hasPhoto = settings?.photo ? '✅' : '❌';
        const hasEntities = settings?.premiumEntities?.length ? '✅' : '❌';

        await sendTelegramMessage(
          chatId,
          `📝 <b>Управление приветствием</b>\n\nТекст: ${settings?.text ? '✅' : '❌'}\nФото: ${hasPhoto}\nПремиум-эмодзи: ${hasEntities}`,
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
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_text' });
        const settings = await getBotSettings(supabase);
        await sendTelegramMessage(
          chatId,
          `📝 <b>Редактирование текста приветствия</b>\n\nТекущий текст:\n<code>${settings?.text || '👋 Добро пожаловать!'}</code>\n\nВведите новый текст (поддерживается HTML). Если раньше были сохранены премиум-эмодзи — этот текст их временно заменит, пока вы не пересохраните эмодзи заново.`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_edit_photo') {
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_photo' });
        await sendTelegramMessage(chatId, `🖼 <b>Добавление фото к приветствию</b>\n\nОтправьте <b>фото</b> в этот чат.`, {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_edit_entities') {
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_entities' });
        await sendTelegramMessage(
          chatId,
          `😎 <b>Премиум-эмодзи в приветствии</b>\n\nВажно: премиум-эмодзи может отправить только аккаунт с активной подпиской Telegram Premium.\n\nНапишите ЭТОМУ боту сообщение, в которое вы вставили нужные премиум-эмодзи (через встроенный набор эмодзи Telegram, не текстом). Это сообщение целиком станет новым текстом приветствия — отредактируйте его так, как хотите видеть финальный результат.`,
          { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
        );
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_preview') {
        const settings = await getBotSettings(supabase);
        const payload = buildWelcomePayload(settings);
        const keyboard = { inline_keyboard: [[{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }]] };

        await sendTelegramMessage(chatId, `👀 <b>Предпросмотр приветствия:</b>`);
        await sendTelegramMessage(chatId, payload.text, keyboard, { photo: settings?.photo, entities: payload.entities });
        await sendTelegramMessage(chatId, '⬆️ Так будет выглядеть приветствие.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      if (cbData === 'welcome_cancel') {
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '❌ Отменено.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }
    }

     // ═══════════════════════════════════════════════════════════
    //  PHOTO MESSAGES — ОБРАБОТКА ФОТО ДЛЯ БАННЕРОВ
    // ═══════════════════════════════════════════════════════════
    if (update.message?.photo && update.message.photo.length > 0) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from;
      if (!fromUser) return res.status(200).json({ ok: true });

      const { state: fsmState } = await getFsmState(supabase, fromUser.id);

    // ═══════════════════════════════════════════════════════════
    //  TEXT MESSAGES
    // ═══════════════════════════════════════════════════════════
    if (update.message && !update.message.photo) {
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
        settings.premiumText = null;
        settings.premiumEntities = null;
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Текст приветствия обновлён!\n\n' + msg.text, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit premium emoji (текст+entities одной парой) ──
      if (fsmState.step === 'welcome_edit_entities') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        if (!msg.text) {
          await sendTelegramMessage(chatId, '⚠️ Отправьте текстовое сообщение с эмодзи (не фото/стикер).');
          return res.status(200).json({ ok: true });
        }

        const customEmojiCount = (msg.entities || []).filter((e: any) => e.type === 'custom_emoji').length;
        if (customEmojiCount === 0) {
          await sendTelegramMessage(
            chatId,
            '⚠️ В сообщении не найдено премиум-эмодзи. Убедитесь, что у вас активен Telegram Premium и эмодзи вставлены из панели эмодзи (не обычные юникод-смайлы). Попробуйте снова:',
            { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]] }
          );
          return res.status(200).json({ ok: true });
        }

        const settings = (await getBotSettings(supabase)) || {};
        // Текст и entities сохраняются ВМЕСТЕ, из одного сообщения —
        // это обязательно, иначе смещения эмодзи не совпадут с текстом.
        settings.premiumText = msg.text;
        settings.premiumEntities = msg.entities;
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);

        await sendTelegramMessage(chatId, `✅ Сохранено! Найдено премиум-эмодзи: ${customEmojiCount}.`, {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_welcome_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Ранги (добавление/редактирование) ─────────────────
      if (fsmState.step === 'tier_edit' || fsmState.step === 'tier_add') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        if (!supabase) return res.status(200).json({ ok: true });

        const isAdd = fsmState.step === 'tier_add';
        const parts = parsePipeFields(msg.text || '', isAdd ? 6 : 5);
        if (!parts) {
          await sendTelegramMessage(chatId, `⚠️ Неверный формат. Нужно ${isAdd ? 6 : 5} полей через " | ". Попробуйте снова или нажмите «Отмена».`);
          return res.status(200).json({ ok: true });
        }

        let tierKey: string;
        let title: string, rateBonusStr: string, cashbackStr: string, minXpStr: string, speedText: string;
        if (isAdd) {
          [tierKey, title, rateBonusStr, cashbackStr, minXpStr, speedText] = parts;
        } else {
          tierKey = (fsmState as any).tierKey;
          [title, rateBonusStr, cashbackStr, minXpStr, speedText] = parts;
        }

        const rateBonus = parseFloat(rateBonusStr.replace(',', '.'));
        const cashback = parseFloat(cashbackStr.replace(',', '.'));
        const minXp = parseInt(minXpStr, 10);

        if (!tierKey || isNaN(rateBonus) || isNaN(cashback) || isNaN(minXp)) {
          await sendTelegramMessage(chatId, '⚠️ Проверьте числа (бонус, кэшбэк, min XP) и попробуйте снова.');
          return res.status(200).json({ ok: true });
        }

        const { error } = await supabase.from('tiers_config').upsert(
          {
            tier_key: tierKey,
            title,
            rate_bonus: rateBonus,
            cashback_percent: cashback,
            min_xp: minXp,
            payout_speed_text: speedText,
            color: '#A3FF12',
            icon_name: 'Zap',
          },
          { onConflict: 'tier_key' }
        );

        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : `✅ Ранг «${title}» сохранён.`, {
          inline_keyboard: [[{ text: '⬅️ К рангам', callback_data: 'admin_tiers_list' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Задания (добавление/редактирование) ───────────────
      if (fsmState.step === 'task_edit' || fsmState.step === 'task_add') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        if (!supabase) return res.status(200).json({ ok: true });

        const parts = parsePipeFields(msg.text || '', 10);
        if (!parts) {
          await sendTelegramMessage(chatId, `⚠️ Неверный формат, нужно 10 полей через " | ". Формат:\n${TASK_FORMAT_HELP}`);
          return res.status(200).json({ ok: true });
        }

        const [title, description, category, xpStr, usdtStr, maxProgressStr, unit, actionText, trigger, channelRaw] = parts;
        const validCategories = ['daily', 'trade', 'telegram_sub', 'milestone'];
        const validTriggers = ['per_trade', 'daily_volume', 'single_deal_min', 'milestone_deals', 'milestone_referrals', 'milestone_volume', 'manual'];

        const rewardXp = parseInt(xpStr, 10);
        const rewardUsdt = parseFloat(usdtStr.replace(',', '.'));
        const maxProgress = parseFloat(maxProgressStr.replace(',', '.'));

        if (!validCategories.includes(category) || !validTriggers.includes(trigger) || isNaN(rewardXp) || isNaN(maxProgress)) {
          await sendTelegramMessage(chatId, `⚠️ Проверьте категорию (${validCategories.join('/')}), триггер (${validTriggers.join('/')}) и числа.`);
          return res.status(200).json({ ok: true });
        }

        const channelUsername = channelRaw && channelRaw !== '-' ? channelRaw : null;
        const isChannelSub = category === 'telegram_sub';
        const taskId = fsmState.step === 'task_edit' ? (fsmState as any).taskId : `task_${Date.now()}`;

        const { error } = await supabase.from('tasks').upsert(
          {
            id: taskId,
            title,
            description,
            category,
            reward_xp: rewardXp,
            reward_usdt: isNaN(rewardUsdt) ? 0 : rewardUsdt,
            max_progress: maxProgress,
            unit,
            icon_name: 'Gift',
            action_text: actionText,
            progress_trigger: trigger,
            channel_username: channelUsername,
            channel_link: channelUsername ? `https://t.me/${channelUsername.replace('@', '')}` : null,
            is_channel_sub: isChannelSub,
            is_active: true,
          },
          { onConflict: 'id' }
        );

        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : `✅ Задание «${title}» сохранено.`, {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

    

      // ── FSM: Курс ────────────────────────────────────────────
      if (fsmState.step === 'rate_edit') {
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        if (!supabase) return res.status(200).json({ ok: true });

        const value = parseFloat((msg.text || '').replace(',', '.'));
        if (isNaN(value) || value <= 0) {
          await sendTelegramMessage(chatId, '⚠️ Введите положительное число, например 93.10.');
          return res.status(200).json({ ok: true });
        }

        const symbol = (fsmState as any).symbol || 'USDT';
        const { error } = await supabase
          .from('exchange_rates')
          .upsert({ crypto_symbol: symbol, rate_rub: value, updated_at: new Date().toISOString() }, { onConflict: 'crypto_symbol' });

        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : `✅ Курс ${symbol} обновлён: ${value} ₽.`, {
          inline_keyboard: [[{ text: '⬅️ В меню', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Commands ──────────────────────────────────────────────
      if (text.startsWith('/start')) {
        // Реферальная ссылка вида /start ref_<telegram_id пригласившего>.
        // Раньше этот параметр вообще не читался — переходы по ссылке
        // ни на что не влияли. Теперь при первом заходе нового пользователя
        // сохраняем, кто его пригласил, и шлём пригласившему уведомление.
        const payload = (msg.text || '').trim().split(' ')[1] || '';
        if (payload.startsWith('ref_') && supabase) {
          const referrerId = payload.replace('ref_', '');
          if (referrerId && referrerId !== String(fromUser.id) && /^\d+$/.test(referrerId)) {
            const { data: existingUser } = await supabase
              .from('users')
              .select('telegram_id')
              .eq('telegram_id', Number(fromUser.id))
              .maybeSingle();

            if (!existingUser) {
              await supabase.from('users').upsert(
                {
                  telegram_id: Number(fromUser.id),
                  username: fromUser.username,
                  full_name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' '),
                  referred_by: Number(referrerId),
                },
                { onConflict: 'telegram_id' }
              );

              await sendTelegramMessage(
                Number(referrerId),
                `🎉 По вашей реферальной ссылке зарегистрировался новый пользователь: @${fromUser.username || fromUser.id}!\n\nВы получаете 15% с его сделок.`
              );
            }
          }
        }

        const settings = await getBotSettings(supabase);
        const welcomePayload = buildWelcomePayload(settings);
        const keyboard = { inline_keyboard: [[{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }]] };

        await sendTelegramMessage(chatId, welcomePayload.text, keyboard, {
          photo: settings?.photo,
          entities: welcomePayload.entities,
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
      //  НОВЫЙ БЛОК: БАННЕРЫ — ЗАГРУЗКА ФОТО В SUPABASE STORAGE
      // ═══════════════════════════════════════════════════════════
      if (fsmState.step === 'banner_edit' || fsmState.step === 'banner_add') {
        if (!isAdmin(fromUser.id, ownerId)) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ Supabase не настроен.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        const caption = msg.caption || '';
        const parts = parsePipeFields(caption, 2);
        if (!parts) {
          await sendTelegramMessage(chatId, '⚠️ Неверный формат подписи. Нужно: Заголовок | Ссылка\n\nПопробуйте снова или нажмите «Отмена».', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }
        const [title, linkUrl] = parts;
        if (!/^https?:\/\//.test(linkUrl)) {
          await sendTelegramMessage(chatId, '⚠️ Ссылка должна начинаться с http:// или https://. Попробуйте снова.', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }

        // Скачиваем фото из Telegram
        const token = process.env.BOT_TOKEN;
        if (!token) {
          await sendTelegramMessage(chatId, '⚠️ BOT_TOKEN не настроен.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }

        const photos = msg.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileId = largestPhoto.file_id;

        await sendTelegramMessage(chatId, '⏳ Загружаю фото...');

        const fileBuffer = await downloadTelegramFile(token, fileId);
        if (!fileBuffer) {
          await sendTelegramMessage(chatId, '⚠️ Не удалось скачать фото из Telegram. Попробуйте снова.', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }

        // Генерируем уникальное имя файла
        const fileExt = 'jpg';
        const fileName = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        // Загружаем в Supabase Storage
        const publicUrl = await uploadBannerToStorage(supabase, fileBuffer, fileName);
        if (!publicUrl) {
          await sendTelegramMessage(chatId, '⚠️ Не удалось загрузить фото в хранилище. Попробуйте снова.', {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'admin_cancel' }]],
          });
          return res.status(200).json({ ok: true });
        }

        if (fsmState.step === 'banner_add') {
          const { error } = await supabase.from('banners').insert({
            title,
            image_url: publicUrl,
            link_url: linkUrl,
            storage_path: fileName,
            size: (fsmState as any).size,
            is_active: true,
          });
          await clearFsmState(supabase, fromUser.id);
          await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : `✅ Баннер «${title}» добавлен.`, {
            inline_keyboard: [[{ text: '⬅️ К баннерам', callback_data: 'admin_banners_menu' }]],
          });
        } else {
          const bannerId = (fsmState as any).bannerId;

          // Удаляем старое фото из Storage
          const { data: oldBanner } = await supabase.from('banners').select('storage_path').eq('id', bannerId).maybeSingle();
          if (oldBanner?.storage_path) {
            await deleteBannerFromStorage(supabase, oldBanner.storage_path);
          }

          const { error } = await supabase.from('banners').update({
            title,
            image_url: publicUrl,
            link_url: linkUrl,
            storage_path: fileName,
          }).eq('id', bannerId);
          await clearFsmState(supabase, fromUser.id);
          await sendTelegramMessage(chatId, error ? `⚠️ ${error.message}` : '✅ Баннер обновлён.', {
            inline_keyboard: [[{ text: '⬅️ К баннерам', callback_data: 'admin_banners_menu' }]],
          });
        }
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit photo ───────────────────────────────
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
