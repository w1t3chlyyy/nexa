import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase client ─────────────────────────────────────────────
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('SUPABASE_URL exists:', !!url);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!key);
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
    
    console.log('getFsmState result:', { data, error });
    
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
    console.log('setFsmState:', { userId, state });
    const { data, error } = await supabase
      .from('admin_fsm')
      .upsert(
        { 
          telegram_id: userId, 
          state: state as any, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'telegram_id' }
      );
    console.log('setFsmState result:', { data, error });
  } catch (err) {
    console.error('setFsmState error:', err);
  }
}

async function clearFsmState(supabase: SupabaseClient | null, userId: number) {
  if (!supabase) return;
  try {
    console.log('clearFsmState:', userId);
    const { data, error } = await supabase
      .from('admin_fsm')
      .delete()
      .eq('telegram_id', userId);
    console.log('clearFsmState result:', { data, error });
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
    
    console.log('getBotSettings result:', { data, error });
    
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
    console.log('setBotSettings:', value);
    const { data, error } = await supabase
      .from('bot_settings')
      .upsert(
        { 
          key: 'welcome', 
          value, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'key' }
      );
    console.log('setBotSettings result:', { data, error });
  } catch (err) {
    console.error('setBotSettings error:', err);
  }
}

// ─── Admin check ─────────────────────────────────────────────────
function isAdmin(userId: number, ownerId: number | null): boolean {
  return Boolean(ownerId && userId === ownerId);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN HANDLER - ТОЛЬКО ПРИВЕТСТВИЕ
// ══════════════════════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok', message: 'Telegram Webhook Endpoint' });
  }

  const update = req.body;
  console.log('Update:', JSON.stringify(update, null, 2));
  
  if (!update) {
    console.log('No update body');
    return res.status(200).json({ ok: true });
  }

  const supabase = getSupabase();
  console.log('Supabase initialized:', !!supabase);
  
  const miniappUrl = process.env.MINIAPP_URL || 'https://t.me';
  const ownerId = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : null;
  console.log('OwnerId:', ownerId);

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

      console.log('Callback query:', cbData);
      console.log('From user:', fromUser?.id);
      console.log('Is admin:', isOwnerOrAdmin);

      await answerCallbackQuery(cb.id);
      if (!chatId) return res.status(200).json({ ok: true });

      // ── Admin menu ────────────────────────────────────────────
      if (cbData === 'admin_menu') {
        console.log('Admin menu requested');
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
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit text ──────────────────────────────────────
      if (cbData === 'welcome_edit_text') {
        console.log('Welcome edit text requested');
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
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit photo ─────────────────────────────────────
      if (cbData === 'welcome_edit_photo') {
        console.log('Welcome edit photo requested');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_photo' });
        await sendTelegramMessage(
          chatId,
          `🖼 <b>Добавление фото к приветствию</b>\n\nОтправьте <b>фото</b> в этот чат.`,
          {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome edit entities ──────────────────────────────────
      if (cbData === 'welcome_edit_entities') {
        console.log('Welcome edit entities requested');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        
        await setFsmState(supabase, fromUser.id, { step: 'welcome_edit_entities' });
        await sendTelegramMessage(
          chatId,
          `😎 <b>Премиум-эмодзи в приветствии</b>\n\nОтправьте сообщение с премиум-эмодзи (Telegram Premium).`,
          {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── Welcome preview ────────────────────────────────────────
      if (cbData === 'welcome_preview') {
        console.log('Welcome preview requested');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        
        const settings = await getBotSettings(supabase);
        const text =
          settings?.text ||
          `<b>Добро пожаловать в Nexa</b>\n\nПродавайте криптовалюту по лучшему курсу.`;
        
        const keyboard = {
          inline_keyboard: [
            [{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }],
          ],
        };
        
        await sendTelegramMessage(chatId, `👀 <b>Предпросмотр приветствия:</b>`);
        
        if (settings?.photo) {
          await sendTelegramMessage(chatId, text, keyboard, {
            photo: settings.photo,
            captionEntities: settings?.caption_entities,
          });
        } else {
          await sendTelegramMessage(chatId, text, keyboard);
        }
        
        await sendTelegramMessage(chatId, '⬆️ Так будет выглядеть приветствие.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Cancel ──────────────────────────────────────────────────
      if (cbData === 'welcome_cancel') {
        console.log('Welcome cancel requested');
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '❌ Отменено.', {
          inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
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

      console.log('Message from:', fromUser.id);
      console.log('Text:', text);

      const isOwnerOrAdmin = isAdmin(fromUser.id, ownerId);

      // Check FSM state
      const { state: fsmState } = await getFsmState(supabase, fromUser.id);
      console.log('FSM State:', fsmState);

      // ── FSM: Welcome edit text ────────────────────────────────
      if (fsmState.step === 'welcome_edit_text') {
        console.log('Processing welcome_edit_text');
        console.log('New text:', msg.text);
        
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        
        const settings = (await getBotSettings(supabase)) || {};
        settings.text = msg.text || '';
        
        console.log('Saving settings:', settings);
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);
        
        await sendTelegramMessage(
          chatId, 
          '✅ Текст приветствия обновлён!\n\n' + msg.text,
          {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit entities ────────────────────────────
      if (fsmState.step === 'welcome_edit_entities') {
        console.log('Processing welcome_edit_entities');
        
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        
        const settings = (await getBotSettings(supabase)) || {};
        
        if (msg.entities) {
          const customEmojiEntities = msg.entities.filter((e: any) => e.type === 'custom_emoji');
          console.log('Custom emoji entities:', customEmojiEntities);
          
          if (customEmojiEntities.length > 0) {
            settings.caption_entities = customEmojiEntities;
            await setBotSettings(supabase, settings);
            await clearFsmState(supabase, fromUser.id);
            await sendTelegramMessage(
              chatId, 
              `✅ Сохранено <b>${customEmojiEntities.length}</b> премиум-эмодзи!`,
              {
                inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
              }
            );
          } else {
            await sendTelegramMessage(
              chatId, 
              '⚠️ В сообщении не найдены премиум-эмодзи. Отправьте сообщение с премиум-эмодзи (Telegram Premium):',
              {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
              }
            );
          }
        } else {
          await sendTelegramMessage(
            chatId, 
            '⚠️ В сообщении нет entities. Отправьте сообщение с премиум-эмодзи:',
            {
              inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'welcome_cancel' }]],
            }
          );
        }
        return res.status(200).json({ ok: true });
      }

      // ── Commands ──────────────────────────────────────────────
      if (text.startsWith('/start')) {
        console.log('Start command');
        const settings = await getBotSettings(supabase);
        console.log('Welcome settings:', settings);
        
        const welcomeText = settings?.text || `👋 <b>Добро пожаловать!</b>`;
        const keyboard = {
          inline_keyboard: [
            [{ text: 'Открыть обменник USDT', web_app: { url: miniappUrl } }],
          ],
        };
        
        await sendTelegramMessage(chatId, welcomeText, keyboard, {
          photo: settings?.photo,
          captionEntities: settings?.caption_entities,
        });
        return res.status(200).json({ ok: true });
      }

      if (text.startsWith('/admin') || text === 'панель') {
        console.log('Admin command');
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ У вас нет прав администратора.');
          return res.status(200).json({ ok: true });
        }
        
        const settings = await getBotSettings(supabase);
        const hasPhoto = settings?.photo ? '✅' : '❌';
        const hasEntities = settings?.caption_entities ? '✅' : '❌';
        
        await sendTelegramMessage(
          chatId,
          `👑 <b>Панель управления</b>\n\n📝 Приветствие:\nТекст: ${settings?.text ? '✅' : '❌'}\nФото: ${hasPhoto}\nПремиум-эмодзи: ${hasEntities}`,
          {
            inline_keyboard: [
              [{ text: '📝 Изменить текст', callback_data: 'welcome_edit_text' }],
              [{ text: `🖼 Фото ${hasPhoto}`, callback_data: 'welcome_edit_photo' }],
              [{ text: `😎 Премиум-эмодзи ${hasEntities}`, callback_data: 'welcome_edit_entities' }],
              [{ text: '👀 Предпросмотр', callback_data: 'welcome_preview' }],
            ],
          }
        );
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

      console.log('Photo received from:', fromUser.id);

      const { state: fsmState } = await getFsmState(supabase, fromUser.id);
      console.log('FSM State for photo:', fsmState);

      if (fsmState.step === 'welcome_edit_photo') {
        console.log('Processing welcome_edit_photo');
        
        if (!isAdmin(fromUser.id, ownerId)) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        
        const photos = msg.photo;
        const largestPhoto = photos[photos.length - 1];
        const fileId = largestPhoto.file_id;
        
        console.log('Photo file_id:', fileId);
        
        const settings = (await getBotSettings(supabase)) || {};
        settings.photo = fileId;
        
        await setBotSettings(supabase, settings);
        await clearFsmState(supabase, fromUser.id);
        
        await sendTelegramMessage(
          chatId, 
          `✅ Фото сохранено!`,
          {
            inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'admin_menu' }]],
          }
        );
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
