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
    //  CALLBACK QUERIES - ЕДИНЫЙ ОБРАБОТЧИК
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

      // ── Task create required (yes/no) ──────────────────────
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
        
        // ✅ Проверка прав
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        
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

      // ✅ Исправленный обработчик подтверждения редактирования
      if (cbData.startsWith('task_edit_confirm_')) {
        const parts = cbData.replace('task_edit_confirm_', '').split('_');
        const taskId = parts[0];
        const field = parts[1];
        const value = parts[2] === 'true';
        
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          return res.status(200).json({ ok: true });
        }
        
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        
        const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', taskId);
        
        if (error) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка обновления: ${error.message}`);
          return res.status(200).json({ ok: true });
        }
        
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Поле обновлено!', {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── Task delete flow ──────────────────────────────────────
      if (cbData === 'task_delete_start') {
        // ... (оставляем как есть)
      }

      // ── Tasks list ────────────────────────────────────────────
      if (cbData === 'admin_tasks_list') {
        // ... (оставляем как есть)
      }

      // ── Tiers list ────────────────────────────────────────────
      if (cbData === 'admin_tiers_list') {
        // ... (оставляем как есть)
      }

      // ── CryptoBot balance ─────────────────────────────────────
      if (cbData === 'admin_cryptobot_balance') {
        // ... (оставляем как есть)
      }

      // ── Welcome menu ────────────────────────────────────────
      if (cbData === 'admin_welcome_menu') {
        // ... (оставляем как есть)
      }

      // ── Welcome edit handlers ──────────────────────────────
      if (cbData === 'welcome_edit_text') {
        // ... (оставляем как есть)
      }

      if (cbData === 'welcome_edit_photo') {
        // ... (оставляем как есть)
      }

      if (cbData === 'welcome_edit_entities') {
        // ... (оставляем как есть)
      }

      if (cbData === 'welcome_preview') {
        // ... (оставляем как есть)
      }

      // ── Pay / Reject order ─────────────────────────────────
      if (chatId && cbData.startsWith('pay_order_')) {
        // ... (оставляем как есть)
      }

      if (chatId && cbData.startsWith('reject_order_')) {
        // ... (оставляем как есть)
      }
      
      // ⚠️ ВАЖНО: Если ни один callback не обработан, отправляем ответ
      return res.status(200).json({ ok: true });
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
        // ... (оставляем как есть)
      }

      if (fsmState.step === 'task_create_desc') {
        // ... (оставляем как есть)
      }

      if (fsmState.step === 'task_create_reward_xp') {
        // ... (оставляем как есть)
      }

      if (fsmState.step === 'task_create_reward_usdt') {
        // ... (оставляем как есть)
      }

      // ── FSM: Task edit field ──────────────────────────────────
      if (fsmState.step === 'task_edit_field') {
        // ✅ Добавляем проверку прав
        if (!isOwnerOrAdmin) {
          await sendTelegramMessage(chatId, '⛔️ Нет прав.');
          await clearFsmState(supabase, fromUser.id);
          return res.status(200).json({ ok: true });
        }
        
        if (!supabase) {
          await sendTelegramMessage(chatId, '⚠️ БД недоступна.');
          return res.status(200).json({ ok: true });
        }
        
        let value: any = msg.text;
        
        // Для числовых полей
        if (fsmState.field === 'reward_xp' || fsmState.field === 'reward_usdt') {
          value = parseFloat(msg.text || '0');
          if (isNaN(value) || value < 0) {
            await sendTelegramMessage(chatId, '⚠️ Введите корректное число:');
            return res.status(200).json({ ok: true });
          }
        }
        
        // Для текстовых полей
        if (fsmState.field === 'title' || fsmState.field === 'description') {
          value = msg.text || '';
          if (!value.trim()) {
            await sendTelegramMessage(chatId, '⚠️ Поле не может быть пустым:');
            return res.status(200).json({ ok: true });
          }
        }
        
        // ⚠️ is_required_sub обрабатывается ТОЛЬКО через callback, не через текст
        if (fsmState.field === 'is_required_sub') {
          await sendTelegramMessage(chatId, '⚠️ Используйте кнопки для изменения этого поля.');
          return res.status(200).json({ ok: true });
        }
        
        const { error } = await supabase.from('tasks').update({ [fsmState.field]: value }).eq('id', fsmState.taskId);
        
        if (error) {
          await sendTelegramMessage(chatId, `⚠️ Ошибка обновления: ${error.message}`);
          return res.status(200).json({ ok: true });
        }
        
        await clearFsmState(supabase, fromUser.id);
        await sendTelegramMessage(chatId, '✅ Поле обновлено!', {
          inline_keyboard: [[{ text: '⬅️ К заданиям', callback_data: 'admin_tasks_menu' }]],
        });
        return res.status(200).json({ ok: true });
      }

      // ── FSM: Welcome edit text ────────────────────────────────
      if (fsmState.step === 'welcome_edit_text') {
        // ... (оставляем как есть)
      }

      // ── FSM: Welcome edit entities ────────────────────────────
      if (fsmState.step === 'welcome_edit_entities') {
        // ... (оставляем как есть)
      }

      // ── Commands ──────────────────────────────────────────────
      if (text.startsWith('/start')) {
        // ... (оставляем как есть)
      }

      if (text.startsWith('/admin') || text === 'панель') {
        // ... (оставляем как есть)
      }

      if (text.startsWith('/orders') || text === 'ордеры') {
        // ... (оставляем как есть)
      }

      if (text.startsWith('/balance') || text === 'баланс') {
        // ... (оставляем как есть)
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  PHOTO MESSAGES (for welcome photo)
    // ═══════════════════════════════════════════════════════════
    if (update.message?.photo && update.message.photo.length > 0) {
      // ... (оставляем как есть)
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err);
    return res.status(200).json({ error: err.message });
  }
}
