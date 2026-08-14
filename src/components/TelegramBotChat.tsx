import React, { useState } from 'react';
import {
  Send,
  Zap,
  ShieldCheck,
  Sparkles,
  Bot,
  ChevronLeft,
  X,
  CreditCard,
  Lock,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  UserPlus,
  Trash2,
  ChevronRight,
  Download,
  AlertCircle,
  ExternalLink,
  Users,
  Plus,
  Crown,
  ListTodo,
  Check,
  Edit2,
  Sliders,
  Flame,
  TrendingUp,
} from 'lucide-react';
import {
  AdminOrder,
  AdminUser,
  PdfReceiptData,
  QuestTask,
  TierInfo,
  RatingTier,
  QuestCategory,
} from '../types';
import { createPdfReceiptData, downloadSbpReceiptPdf } from '../utils/pdfGenerator';
import { sound } from '../utils/sound';
import { CryptoNexaLogo } from './CryptoNexaLogo';

interface TelegramBotChatProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMiniApp: () => void;
  adminOrders: AdminOrder[];
  admins: AdminUser[];
  tasks: QuestTask[];
  tiers: Record<string, TierInfo>;
  onApproveOrder: (orderId: string, pdfReceipt: PdfReceiptData) => void;
  onRejectOrder: (orderId: string) => void;
  onAddAdmin: (telegramId: string, username: string, fullName: string) => void;
  onRemoveAdmin: (adminId: string) => void;
  onAddTask: (newTask: Omit<QuestTask, 'id' | 'progress' | 'completed' | 'claimed'>) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTier: (tierKey: RatingTier, updatedData: Partial<TierInfo>) => void;
  onViewPdf: (receipt: PdfReceiptData) => void;
  onOpenTransactionReceipt: (orderId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  type: 'text' | 'welcome' | 'admin_panel' | 'order_notification' | 'payout_success';
  time: string;
  orderData?: AdminOrder;
  pdfData?: PdfReceiptData;
}

export const TelegramBotChat: React.FC<TelegramBotChatProps> = ({
  isOpen,
  onClose,
  onOpenMiniApp,
  adminOrders,
  admins,
  tasks,
  tiers,
  onApproveOrder,
  onRejectOrder,
  onAddAdmin,
  onRemoveAdmin,
  onAddTask,
  onDeleteTask,
  onUpdateTier,
  onViewPdf,
  onOpenTransactionReceipt,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<'orders' | 'tasks' | 'tiers' | 'admins'>('orders');

  // Modal for Admin to attach / configure PDF receipt before payout
  const [selectedOrderForPayout, setSelectedOrderForPayout] = useState<AdminOrder | null>(null);
  const [payoutBank, setPayoutBank] = useState<string>('Т-Банк (Тинькофф) СБП');
  const [payoutSenderName, setPayoutSenderName] = useState<string>('ООО «КРИПТО ЧЕК СЕРВИС»');
  const [payoutOperationId, setPayoutOperationId] = useState<string>(
    `SBP_TX_${Math.floor(100000000 + Math.random() * 900000000)}`
  );
  const [customFileAttachedName, setCustomFileAttachedName] = useState<string | null>(null);

  // Add admin modal/inline state
  const [isAddingAdmin, setIsAddingAdmin] = useState<boolean>(false);
  const [newAdminUsername, setNewAdminUsername] = useState<string>('');
  const [newAdminFullName, setNewAdminFullName] = useState<string>('');
  const [newAdminTgId, setNewAdminTgId] = useState<string>('');

  // Add task modal/inline state
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskCategory, setTaskCategory] = useState<QuestCategory>('telegram_sub');
  const [taskChannelUsername, setTaskChannelUsername] = useState<string>('@cryptoex_news');
  const [taskChannelTitle, setTaskChannelTitle] = useState<string>('Официальный канал сервиса');
  const [taskChannelLink, setTaskChannelLink] = useState<string>('https://t.me/cryptoex_news');
  const [taskIsRequiredSub, setTaskIsRequiredSub] = useState<boolean>(true);
  const [taskRewardXp, setTaskRewardXp] = useState<number>(100);
  const [taskRewardUsdt, setTaskRewardUsdt] = useState<number>(0.5);

  // Edit tier modal/inline state
  const [editingTierKey, setEditingTierKey] = useState<RatingTier | null>(null);
  const [editTierRateBonus, setEditTierRateBonus] = useState<number>(0.5);
  const [editTierCashback, setEditTierCashback] = useState<number>(0.45);
  const [editTierMinXp, setEditTierMinXp] = useState<number>(750);
  const [editTierSpeedText, setEditTierSpeedText] = useState<string>('~ 30 сек');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'user',
      text: '/start',
      type: 'text',
      time: '18:40',
    },
    {
      id: 'm2',
      sender: 'bot',
      type: 'welcome',
      time: '18:40',
    },
    {
      id: 'm3',
      sender: 'user',
      text: '/admin',
      type: 'text',
      time: '18:42',
    },
    {
      id: 'm4',
      sender: 'bot',
      type: 'admin_panel',
      time: '18:42',
    },
  ]);

  if (!isOpen) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    sound.playTap();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userCmd = chatInput.trim();
    setChatInput('');

    const newMsgId = `usr_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: newMsgId, sender: 'user', text: userCmd, type: 'text', time: timeStr },
    ]);

    setTimeout(() => {
      sound.playSuccess();
      const lower = userCmd.toLowerCase();

      if (lower === '/admin' || lower === 'админ' || lower === 'admin') {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            type: 'admin_panel',
            time: timeStr,
          },
        ]);
      } else if (lower === '/start' || lower === 'старт') {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            type: 'welcome',
            time: timeStr,
          },
        ]);
      } else if (lower === '/orders' || lower === 'ордеры') {
        setActiveAdminTab('orders');
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: `📊 Активных ордеров на выплату: ${adminOrders.filter((o) => o.status === 'new').length}. Введите /admin для управления очередью и прикрепления чеков.`,
            type: 'text',
            time: timeStr,
          },
        ]);
      } else if (lower === '/tasks' || lower === 'задания') {
        setActiveAdminTab('tasks');
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            type: 'admin_panel',
            time: timeStr,
          },
        ]);
      } else if (lower === '/tiers' || lower === 'ранги') {
        setActiveAdminTab('tiers');
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            type: 'admin_panel',
            time: timeStr,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: `Команда ${userCmd} принята. Используйте /start для запуска Mini App или /admin для панели оператора (ордеры, задания на подписку, ранги).`,
            type: 'text',
            time: timeStr,
          },
        ]);
      }
    }, 500);
  };

  const handleOpenPayoutModal = (order: AdminOrder) => {
    sound.playTap();
    setSelectedOrderForPayout(order);
    setPayoutOperationId(`SBP_TX_${Math.floor(100000000 + Math.random() * 900000000)}`);
    setCustomFileAttachedName(`SBP_Receipt_${order.orderNumber}.pdf`);
  };

  const handleConfirmPayoutWithPdf = () => {
    if (!selectedOrderForPayout) return;
    sound.playCashout();

    const pdfReceipt: PdfReceiptData = createPdfReceiptData(
      selectedOrderForPayout.orderNumber,
      selectedOrderForPayout.fiatAmount,
      selectedOrderForPayout.cryptoAmount,
      selectedOrderForPayout.cryptoSymbol,
      selectedOrderForPayout.rateUsed,
      selectedOrderForPayout.requisite.bankName,
      selectedOrderForPayout.requisite.accountNumber,
      selectedOrderForPayout.requisite.recipientName,
      admins[0]?.username || 'admin_sbp'
    );

    // Update receipt with custom admin fields
    pdfReceipt.operationId = payoutOperationId;
    pdfReceipt.senderBank = payoutBank;

    onApproveOrder(selectedOrderForPayout.id, pdfReceipt);

    // Send a message to bot stream showing payment confirmation, attached PDF & "Посмотреть сделку" button
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `bot_paid_${Date.now()}`,
        sender: 'bot',
        type: 'payout_success',
        time: timeStr,
        orderData: selectedOrderForPayout,
        pdfData: pdfReceipt,
      },
    ]);

    setSelectedOrderForPayout(null);
  };

  const handleCreateAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim()) return;

    sound.playSuccess();
    const cleanUser = newAdminUsername.replace('@', '').trim();
    const tgId = newAdminTgId.trim() || `${Math.floor(100000000 + Math.random() * 900000000)}`;
    const full = newAdminFullName.trim() || `@${cleanUser}`;

    onAddAdmin(tgId, cleanUser, full);
    setNewAdminUsername('');
    setNewAdminFullName('');
    setNewAdminTgId('');
    setIsAddingAdmin(false);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    sound.playSuccess();
    onAddTask({
      title: taskTitle.trim(),
      description: taskDescription.trim() || 'Выполните задание для получения бонуса.',
      category: taskCategory,
      rewardXp: Number(taskRewardXp) || 50,
      rewardUsdt: Number(taskRewardUsdt) || 0,
      maxProgress: 1,
      unit: taskCategory === 'telegram_sub' ? 'канал' : 'сделка',
      iconName: taskCategory === 'telegram_sub' ? 'Send' : 'Zap',
      actionText: taskCategory === 'telegram_sub' ? 'Проверить подписку' : 'Выполнить',
      badge: taskIsRequiredSub ? 'Обязательно' : 'Бонус',
      channelUsername: taskChannelUsername.trim(),
      channelTitle: taskChannelTitle.trim(),
      channelLink: taskChannelLink.trim() || `https://t.me/${taskChannelUsername.replace('@', '')}`,
      isChannelSub: taskCategory === 'telegram_sub',
      isRequiredSub: taskIsRequiredSub,
    });

    setTaskTitle('');
    setTaskDescription('');
    setIsAddingTask(false);
  };

  const handleStartEditTier = (tierKey: RatingTier) => {
    sound.playTap();
    const t = tiers[tierKey];
    setEditingTierKey(tierKey);
    setEditTierRateBonus(t.rateBonus);
    setEditTierCashback(t.cashbackPercent);
    setEditTierMinXp(t.minXp);
    setEditTierSpeedText(t.payoutSpeedText);
  };

  const handleSaveTierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTierKey) return;

    sound.playSuccess();
    onUpdateTier(editingTierKey, {
      rateBonus: Number(editTierRateBonus),
      cashbackPercent: Number(editTierCashback),
      minXp: Number(editTierMinXp),
      payoutSpeedText: editTierSpeedText,
    });

    setEditingTierKey(null);
  };

  const pendingOrders = adminOrders.filter((o) => o.status === 'new');
  const paidOrders = adminOrders.filter((o) => o.status === 'paid');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div
        id="telegram-bot-chat"
        className="w-full max-w-md bg-[#0C0D0E] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh] max-h-[760px]"
      >
        {/* Telegram Chat Header */}
        <div className="px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                sound.playTap();
                onClose();
              }}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <CryptoNexaLogo className="w-8 h-8" rounded="rounded-xl" />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white font-mono">CryptoNexa Pay</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-[#A3FF12]/20 text-[#A3FF12] font-bold">
                  BOT
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">@CryptoNexaBot • online</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                sound.playTap();
                onOpenMiniApp();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#A3FF12] hover:bg-[#b5ff2e] text-black text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Mini App</span>
            </button>
            <button
              onClick={() => {
                sound.playTap();
                onClose();
              }}
              className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#0B0B0C] text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'user' ? (
                <div className="max-w-[80%] px-3 py-1.5 rounded-2xl rounded-tr-xs bg-[#243314] border border-[#A3FF12]/30 text-white shadow-sm space-y-0.5">
                  <p className="font-mono text-xs text-[#A3FF12] font-semibold">{msg.text}</p>
                  <div className="text-[9px] text-zinc-400 text-right">{msg.time}</div>
                </div>
              ) : msg.type === 'welcome' ? (
                /* Welcome Message for Customers */
                <div className="max-w-[95%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-xs overflow-hidden shadow-xl">
                  <div className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-3.5 border-b border-zinc-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#A3FF12] text-black uppercase">
                        CryptoBot & Send
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">СБП 0%</span>
                    </div>
                    <h4 className="text-sm font-black text-white leading-snug">
                      Мгновенный выкуп чеков на рубли СБП
                    </h4>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      Активируйте чеки CryptoBot и получайте рубли на карту любого банка РФ с официальным PDF-чеком.
                    </p>
                  </div>

                  <div className="p-3 space-y-2 text-[11px] text-zinc-300">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-200">
                        <Zap className="w-3.5 h-3.5 text-[#A3FF12]" />
                        <span>Выплаты операторами по СБП с официальным PDF-чеком</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#A3FF12]" />
                        <span>Банковский PDF чек прикрепляется к каждой сделке</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-950 border-t border-zinc-800 space-y-1.5">
                    <button
                      onClick={() => {
                        sound.playSuccess();
                        onOpenMiniApp();
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b5ff2e] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>🚀 Открыть Mini App</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTap();
                        setChatInput('/admin');
                      }}
                      className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/20 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      <span>/admin — Панель оператора выплат & настроек</span>
                    </button>
                  </div>
                </div>
              ) : msg.type === 'admin_panel' ? (
                /* Telegram Bot Full Admin Panel (/admin) */
                <div className="w-full max-w-[98%] bg-zinc-900 border border-amber-500/30 rounded-2xl rounded-tl-xs overflow-hidden shadow-2xl space-y-0">
                  {/* Admin Header */}
                  <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-300">
                          Панель управления (в боте)
                        </span>
                        <p className="text-[10px] text-zinc-400">
                          Ордеры, обязательные подписки, задания и ранги
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tab Selector (4 tabs: Orders, Tasks/Subs, Tiers/Ranks, Admins) */}
                  <div className="p-1 bg-zinc-950 border-b border-zinc-800 grid grid-cols-4 gap-1 text-[9.5px] font-bold">
                    <button
                      onClick={() => {
                        sound.playTap();
                        setActiveAdminTab('orders');
                      }}
                      className={`py-1.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        activeAdminTab === 'orders'
                          ? 'bg-amber-400 text-black font-extrabold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>Ордеры</span>
                        {pendingOrders.length > 0 && (
                          <span
                            className={`px-1 rounded-full text-[8.5px] ${
                              activeAdminTab === 'orders'
                                ? 'bg-black text-amber-300'
                                : 'bg-amber-400 text-black font-black'
                            }`}
                          >
                            {pendingOrders.length}
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTap();
                        setActiveAdminTab('tasks');
                      }}
                      className={`py-1.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        activeAdminTab === 'tasks'
                          ? 'bg-amber-400 text-black font-extrabold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>Задания</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTap();
                        setActiveAdminTab('tiers');
                      }}
                      className={`py-1.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        activeAdminTab === 'tiers'
                          ? 'bg-amber-400 text-black font-extrabold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>Ранги</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTap();
                        setActiveAdminTab('admins');
                      }}
                      className={`py-1.5 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        activeAdminTab === 'admins'
                          ? 'bg-amber-400 text-black font-extrabold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>Операторы</span>
                    </button>
                  </div>

                  {/* Tab 1: Orders List */}
                  {activeAdminTab === 'orders' && (
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">
                          Очередь выплат:
                        </span>
                        <span className="text-zinc-400 font-mono">
                          {pendingOrders.length} новых
                        </span>
                      </div>

                      {pendingOrders.length === 0 ? (
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                          <div className="text-xs font-bold text-white">
                            Все ордеры оплачены
                          </div>
                          <p className="text-[10px] text-zinc-400">
                            Новые заявки от продавцов чеков будут приходить сюда в реальном времени.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {pendingOrders.map((order) => (
                            <div
                              key={order.id}
                              className="p-3 rounded-xl bg-zinc-950 border border-amber-400/40 space-y-2.5 shadow-md"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-mono font-bold text-amber-400 text-xs">
                                    {order.orderNumber}
                                  </span>
                                  <div className="text-[10px] text-zinc-400">
                                    От: @{order.userUsername} ({order.createdAt})
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-xs font-extrabold text-[#A3FF12] font-mono">
                                    {order.fiatAmount.toLocaleString('ru-RU')} ₽
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    За: {order.cryptoAmount} {order.cryptoSymbol}
                                  </div>
                                </div>
                              </div>

                              {/* SBP Requisite Box */}
                              <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">Банк СБП:</span>
                                  <span className="text-white font-semibold">
                                    {order.requisite.bankName}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">Номер / Счет:</span>
                                  <span className="text-[#A3FF12] font-mono font-bold">
                                    {order.requisite.accountNumber}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">Получатель:</span>
                                  <span className="text-zinc-200">
                                    {order.requisite.recipientName}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">Код чека:</span>
                                  <span className="text-zinc-400 font-mono">
                                    {order.chequeCode}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons for Admin */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleOpenPayoutModal(order)}
                                  className="flex-1 py-2 rounded-xl bg-[#A3FF12] hover:bg-[#b5ff2e] text-black font-black text-[11px] flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>💳 Оплатить и прикрепить PDF</span>
                                </button>

                                <button
                                  onClick={() => {
                                    sound.playTap();
                                    onRejectOrder(order.id);
                                  }}
                                  className="px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-500/20 text-[10px] font-bold cursor-pointer"
                                >
                                  Отклонить
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Tasks & Mandatory Channel Subscriptions Management */}
                  {activeAdminTab === 'tasks' && (
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-white">Задания и каналы</span>
                          <span className="text-zinc-400 text-[10px] ml-1">({tasks.length})</span>
                        </div>
                        <button
                          onClick={() => {
                            sound.playTap();
                            setIsAddingTask(!isAddingTask);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-400 text-black text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-300"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Добавить задание</span>
                        </button>
                      </div>

                      {/* Add Task Form */}
                      {isAddingTask && (
                        <form
                          onSubmit={handleCreateTaskSubmit}
                          className="p-3 rounded-xl bg-zinc-950 border border-amber-400/40 space-y-2"
                        >
                          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <ListTodo className="w-3.5 h-3.5" />
                            <span>Создать новое задание</span>
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Тип задания:</label>
                            <select
                              value={taskCategory}
                              onChange={(e) => setTaskCategory(e.target.value as QuestCategory)}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-xs text-white"
                            >
                              <option value="telegram_sub">Подписка на Telegram канал / чат (с авто-проверкой)</option>
                              <option value="trade">Задание на объем / сделку (Trade)</option>
                              <option value="daily">Ежедневное задание (Daily)</option>
                              <option value="milestone">Накопительная веха (Milestone)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Заголовок задания:</label>
                            <input
                              type="text"
                              placeholder="Например: Обязательная подписка на канал акций"
                              value={taskTitle}
                              onChange={(e) => setTaskTitle(e.target.value)}
                              required
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Описание:</label>
                            <input
                              type="text"
                              placeholder="Подпишитесь на официальный канал для бонуса"
                              value={taskDescription}
                              onChange={(e) => setTaskDescription(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-500"
                            />
                          </div>

                          {taskCategory === 'telegram_sub' && (
                            <div className="space-y-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Юзернейм канала (@username):</label>
                                <input
                                  type="text"
                                  placeholder="@crypto_official_channel"
                                  value={taskChannelUsername}
                                  onChange={(e) => setTaskChannelUsername(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Ссылка на канал (https://t.me/...):</label>
                                <input
                                  type="text"
                                  placeholder="https://t.me/crypto_official_channel"
                                  value={taskChannelLink}
                                  onChange={(e) => setTaskChannelLink(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                                />
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  id="req-sub-chk"
                                  type="checkbox"
                                  checked={taskIsRequiredSub}
                                  onChange={(e) => setTaskIsRequiredSub(e.target.checked)}
                                  className="rounded text-amber-400"
                                />
                                <label htmlFor="req-sub-chk" className="text-[10px] text-zinc-300 font-semibold cursor-pointer">
                                  Обязательная подписка (выделяется бейджем)
                                </label>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Награда XP:</label>
                              <input
                                type="number"
                                value={taskRewardXp}
                                onChange={(e) => setTaskRewardXp(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Награда USDT ($):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={taskRewardUsdt}
                                onChange={(e) => setTaskRewardUsdt(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-[10px] font-bold cursor-pointer"
                            >
                              Сохранить задание
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingTask(false)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Active Tasks List */}
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px]"
                          >
                            <div className="flex-1 mr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{task.title}</span>
                                {task.isRequiredSub && (
                                  <span className="px-1 py-0.2 rounded bg-red-500/20 text-red-400 text-[8.5px] font-bold">
                                    Обязательное
                                  </span>
                                )}
                                {task.isChannelSub && (
                                  <span className="px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[8.5px] font-bold">
                                    TG Канал
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 line-clamp-1">{task.description}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[9.5px] text-zinc-500">
                                <span className="text-[#A3FF12] font-semibold">+{task.rewardXp} XP</span>
                                {task.rewardUsdt && <span>+{task.rewardUsdt} USDT</span>}
                                {task.channelUsername && <span className="text-zinc-400">{task.channelUsername}</span>}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                sound.playTap();
                                onDeleteTask(task.id);
                              }}
                              className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-900 cursor-pointer flex-shrink-0"
                              title="Удалить задание"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Rating Tiers Management */}
                  {activeAdminTab === 'tiers' && (
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">Ранги и процентные надбавки:</span>
                        <span className="text-zinc-400 text-[10px]">5 уровней</span>
                      </div>

                      {/* Edit Tier Modal Form */}
                      {editingTierKey && (
                        <form
                          onSubmit={handleSaveTierSubmit}
                          className="p-3 rounded-xl bg-zinc-950 border border-amber-400/40 space-y-2"
                        >
                          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5" />
                            <span>Настройка ранга {editingTierKey}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Бонус к курсу (%):</label>
                              <input
                                type="number"
                                step="0.05"
                                value={editTierRateBonus}
                                onChange={(e) => setEditTierRateBonus(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Кэшбэк (%):</label>
                              <input
                                type="number"
                                step="0.05"
                                value={editTierCashback}
                                onChange={(e) => setEditTierCashback(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Требуемый XP:</label>
                              <input
                                type="number"
                                value={editTierMinXp}
                                onChange={(e) => setEditTierMinXp(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Скорость выплаты:</label>
                              <input
                                type="text"
                                value={editTierSpeedText}
                                onChange={(e) => setEditTierSpeedText(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-[10px] font-bold cursor-pointer"
                            >
                              Сохранить изменения
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTierKey(null)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Tiers List */}
                      <div className="space-y-1.5">
                        {(Object.entries(tiers) as [RatingTier, TierInfo][]).map(([key, t]) => (
                          <div
                            key={key}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs"
                                style={{ backgroundColor: `${t.color}20`, color: t.color, border: `1px solid ${t.color}50` }}
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white">{t.title}</span>
                                  <span className="text-[9px] px-1 rounded bg-[#A3FF12]/15 text-[#A3FF12] font-mono font-bold">
                                    +{t.rateBonus}% курс
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                                  <span>от {t.minXp} XP</span>
                                  <span>•</span>
                                  <span>кэшбэк {t.cashbackPercent}%</span>
                                  <span>•</span>
                                  <span>{t.payoutSpeedText}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleStartEditTier(key as RatingTier)}
                              className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Ред.</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Admins Management */}
                  {activeAdminTab === 'admins' && (
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">Список операторов:</span>
                        <button
                          onClick={() => {
                            sound.playTap();
                            setIsAddingAdmin(!isAddingAdmin);
                          }}
                          className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Добавить</span>
                        </button>
                      </div>

                      {isAddingAdmin && (
                        <form
                          onSubmit={handleCreateAdminSubmit}
                          className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2"
                        >
                          <div className="text-[11px] font-bold text-white">
                            Новый администратор бота
                          </div>
                          <input
                            type="text"
                            placeholder="@username в Telegram"
                            value={newAdminUsername}
                            onChange={(e) => setNewAdminUsername(e.target.value)}
                            required
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500"
                          />
                          <input
                            type="text"
                            placeholder="ФИО / Должность оператора"
                            value={newAdminFullName}
                            onChange={(e) => setNewAdminFullName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-[10px] font-bold cursor-pointer"
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingAdmin(false)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-1.5">
                        {admins.map((adm) => (
                          <div
                            key={adm.id}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">@{adm.username}</span>
                                {adm.role === 'owner' ? (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] font-bold">
                                    Owner
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400">{adm.fullName}</p>
                            </div>

                            {adm.role !== 'owner' && (
                              <button
                                onClick={() => {
                                  sound.playTap();
                                  onRemoveAdmin(adm.id);
                                }}
                                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-900 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : msg.type === 'payout_success' && msg.orderData && msg.pdfData ? (
                /* Payout Confirmation Message in Bot with "Посмотреть сделку" Button */
                <div className="max-w-[96%] bg-zinc-900 border border-emerald-500/40 rounded-2xl rounded-tl-xs overflow-hidden shadow-xl space-y-0 animate-fade-in">
                  <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300">
                        Выплата успешно отправлена!
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {msg.orderData.orderNumber}
                    </span>
                  </div>

                  <div className="p-3 space-y-2 text-[11px] text-zinc-300">
                    <p>
                      Сумма{' '}
                      <strong className="text-white font-mono">
                        {msg.orderData.fiatAmount.toLocaleString('ru-RU')} ₽
                      </strong>{' '}
                      переведена по СБП в{' '}
                      <strong>{msg.orderData.requisite.bankName}</strong> ({msg.orderData.requisite.accountNumber}).
                    </p>

                    {/* Attached PDF document block */}
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-white flex items-center gap-1">
                            <span>Квитанция_СБП_{msg.orderData.orderNumber}.pdf</span>
                          </div>
                          <p className="text-[9px] text-zinc-400">
                            Официальный PDF • {msg.pdfData.operationId}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onViewPdf(msg.pdfData!)}
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#A3FF12] text-[10px] font-bold cursor-pointer"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => downloadSbpReceiptPdf(msg.pdfData!)}
                          className="p-1 rounded-lg bg-zinc-800 hover:bg-[#A3FF12] text-zinc-300 hover:text-black cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Action: Open Deal inside Mini App */}
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          sound.playTap();
                          onOpenTransactionReceipt(msg.orderData!.id);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-[#A3FF12] hover:bg-[#b5ff2e] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>🔍 Посмотреть сделку в Mini App</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] p-3 bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-xs text-zinc-200">
                  <p>{msg.text}</p>
                  <div className="text-[9px] text-zinc-500 text-right mt-1">{msg.time}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Telegram Chat Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2 flex-shrink-0"
        >
          <div className="flex-1 relative">
            <input
              id="tg-bot-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Напишите /start, /admin, /orders, /tasks, /tiers..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#A3FF12]"
            />
          </div>

          <button
            type="submit"
            className="w-8 h-8 rounded-xl bg-[#A3FF12] hover:bg-[#b8ff33] text-black flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Modal for Admin to Attach PDF Receipt and Confirm SBP Transfer */}
        {selectedOrderForPayout && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center animate-fade-in">
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-4 space-y-3.5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#A3FF12]/20 text-[#A3FF12] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      Прикрепить PDF чек СБП
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      Ордер {selectedOrderForPayout.orderNumber}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOrderForPayout(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Order payout summary */}
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Сумма к выплате:</span>
                  <span className="text-white font-mono font-bold">
                    {selectedOrderForPayout.fiatAmount.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Банк получателя:</span>
                  <span className="text-zinc-200">
                    {selectedOrderForPayout.requisite.bankName}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Номер счета/телефона:</span>
                  <span className="text-[#A3FF12] font-mono font-bold">
                    {selectedOrderForPayout.requisite.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Получатель:</span>
                  <span className="text-zinc-200">
                    {selectedOrderForPayout.requisite.recipientName}
                  </span>
                </div>
              </div>

              {/* PDF Attachment Form */}
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">
                    Банк отправителя (СБП):
                  </label>
                  <select
                    value={payoutBank}
                    onChange={(e) => setPayoutBank(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:border-[#A3FF12]"
                  >
                    <option value="Т-Банк (Тинькофф) СБП">Т-Банк (Тинькофф) СБП</option>
                    <option value="Сбербанк СБП">Сбербанк СБП</option>
                    <option value="Альфа-Банк СБП">Альфа-Банк СБП</option>
                    <option value="ВТБ СБП">ВТБ СБП</option>
                    <option value="Райффайзенбанк СБП">Райффайзенбанк СБП</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">
                    ID транзакции в банковской системе:
                  </label>
                  <input
                    type="text"
                    value={payoutOperationId}
                    onChange={(e) => setPayoutOperationId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white font-mono focus:border-[#A3FF12]"
                  />
                </div>

                {/* PDF File Attachment Simulator */}
                <div className="p-2.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-[#A3FF12]/10 text-[#A3FF12] flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-white">
                        {customFileAttachedName || 'Чек_СБП.pdf'}
                      </div>
                      <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>PDF сформирован и заверен</span>
                      </p>
                    </div>
                  </div>

                  <label className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold cursor-pointer transition-colors">
                    <Upload className="w-2.5 h-2.5 inline mr-1" />
                    <span>Заменить</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setCustomFileAttachedName(e.target.files[0].name);
                          sound.playTap();
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirmPayoutWithPdf}
                  className="flex-1 py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b5ff2e] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Подтвердить выплату</span>
                </button>

                <button
                  onClick={() => setSelectedOrderForPayout(null)}
                  className="px-3 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
