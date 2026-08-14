import React, { useState, useEffect } from 'react';
import { TelegramHeader } from './components/TelegramHeader';
import { BottomNav, TabType } from './components/BottomNav';
import { SellChequeView } from './components/SellChequeView';
import { MarketView } from './components/MarketView';
import { TasksAndBonusesView } from './components/TasksAndBonusesView';
import { ProfileView } from './components/ProfileView';
import { AddRequisiteModal } from './components/AddRequisiteModal';
import { TransactionReceiptModal } from './components/TransactionReceiptModal';
import { PdfReceiptViewerModal } from './components/PdfReceiptViewerModal';
import { TelegramBotChat } from './components/TelegramBotChat';
import {
  UserStats,
  PaymentRequisite,
  Transaction,
  QuestTask,
  RatingTier,
  TierInfo,
  AdminUser,
  AdminOrder,
  PdfReceiptData,
} from './types';
import {
  INITIAL_USER_STATS,
  INITIAL_REQUISITES,
  INITIAL_TASKS,
  INITIAL_TRANSACTIONS,
  INITIAL_ADMINS,
  INITIAL_ADMIN_ORDERS,
  TIERS,
} from './data/mockData';
import { createPdfReceiptData } from './utils/pdfGenerator';
import { sound } from './utils/sound';
import { Bot, Smartphone, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('sell');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Dynamic & Persistent local states
  const [user, setUser] = useState<UserStats>(() => {
    const saved = localStorage.getItem('cryptobot_user_stats');
    return saved ? JSON.parse(saved) : INITIAL_USER_STATS;
  });

  const [tiers, setTiers] = useState<Record<string, TierInfo>>(() => {
    const saved = localStorage.getItem('cryptobot_tiers');
    return saved ? JSON.parse(saved) : TIERS;
  });

  const [requisites, setRequisites] = useState<PaymentRequisite[]>(() => {
    const saved = localStorage.getItem('cryptobot_requisites');
    return saved ? JSON.parse(saved) : INITIAL_REQUISITES;
  });

  const [tasks, setTasks] = useState<QuestTask[]>(() => {
    const saved = localStorage.getItem('cryptobot_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('cryptobot_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [admins, setAdmins] = useState<AdminUser[]>(() => {
    const saved = localStorage.getItem('cryptobot_admins');
    return saved ? JSON.parse(saved) : INITIAL_ADMINS;
  });

  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>(() => {
    const saved = localStorage.getItem('cryptobot_admin_orders');
    return saved ? JSON.parse(saved) : INITIAL_ADMIN_ORDERS;
  });

  // Modals & Panels state
  const [isAddRequisiteOpen, setIsAddRequisiteOpen] = useState<boolean>(false);
  const [activeReceiptTx, setActiveReceiptTx] = useState<Transaction | null>(null);
  const [selectedPdfReceipt, setSelectedPdfReceipt] = useState<PdfReceiptData | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isTelegramBotOpen, setIsTelegramBotOpen] = useState<boolean>(false);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('cryptobot_user_stats', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('cryptobot_tiers', JSON.stringify(tiers));
  }, [tiers]);

  useEffect(() => {
    localStorage.setItem('cryptobot_requisites', JSON.stringify(requisites));
  }, [requisites]);

  useEffect(() => {
    localStorage.setItem('cryptobot_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('cryptobot_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('cryptobot_admins', JSON.stringify(admins));
  }, [admins]);

  useEffect(() => {
    localStorage.setItem('cryptobot_admin_orders', JSON.stringify(adminOrders));
  }, [adminOrders]);

  // Determine current tier from user XP
  const determineTier = (xp: number): RatingTier => {
    if (xp >= (tiers.Diamond?.minXp || 5000)) return 'Diamond';
    if (xp >= (tiers.Platinum?.minXp || 2000)) return 'Platinum';
    if (xp >= (tiers.Gold?.minXp || 750)) return 'Gold';
    if (xp >= (tiers.Silver?.minXp || 250)) return 'Silver';
    return 'Bronze';
  };

  const currentTierInfo = tiers[user.tier] || tiers.Gold || TIERS.Gold;

  // Sound toggle
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
  };

  // Requisite actions
  const handleSaveRequisite = (reqData: Omit<PaymentRequisite, 'id' | 'createdAt'>) => {
    const newReq: PaymentRequisite = {
      ...reqData,
      id: `req_${Date.now()}`,
      createdAt: new Date().toLocaleDateString('ru-RU'),
    };

    let updated = [...requisites];
    if (newReq.isDefault) {
      updated = updated.map((r) => ({ ...r, isDefault: false }));
    }
    if (updated.length === 0) {
      newReq.isDefault = true;
    }
    updated.unshift(newReq);
    setRequisites(updated);
  };

  const handleDeleteRequisite = (id: string) => {
    const updated = requisites.filter((r) => r.id !== id);
    if (updated.length > 0 && !updated.some((r) => r.isDefault)) {
      updated[0].isDefault = true;
    }
    setRequisites(updated);
  };

  const handleSetDefaultRequisite = (id: string) => {
    const updated = requisites.map((r) => ({
      ...r,
      isDefault: r.id === id,
    }));
    setRequisites(updated);
  };

  // Daily Streak Claim
  const handleClaimDailyStreak = () => {
    if (user.streakClaimedToday) return;

    setUser((prev) => {
      const newXp = prev.xp + 30;
      const nextTier = determineTier(newXp);
      return {
        ...prev,
        xp: newXp,
        tier: nextTier,
        streakDays: prev.streakDays + 1,
        streakClaimedToday: true,
        referralEarningsUsdt: prev.referralEarningsUsdt + 0.5,
      };
    });
  };

  // Task Claim Action
  const handleClaimTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.completed || task.claimed) return;

    sound.playSuccess();

    setUser((prev) => {
      const newXp = prev.xp + task.rewardXp;
      const nextTier = determineTier(newXp);
      return {
        ...prev,
        xp: newXp,
        tier: nextTier,
        referralEarningsUsdt: prev.referralEarningsUsdt + (task.rewardUsdt || 0),
      };
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, claimed: true } : t))
    );
  };

  // Verify Telegram Task (e.g. channel subscription with bot verification)
  const handleVerifyTelegramTask = async (taskId: string, channelName?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === taskId) {
              return {
                ...t,
                progress: 1,
                completed: true,
                badge: 'Подтверждено ботом',
              };
            }
            return t;
          })
        );
        resolve(true);
      }, 900);
    });
  };

  // Admin Task Management (from /admin in bot)
  const handleAddTask = (newTaskData: Omit<QuestTask, 'id' | 'progress' | 'completed' | 'claimed'>) => {
    const newTask: QuestTask = {
      ...newTaskData,
      id: `task_custom_${Date.now()}`,
      progress: 0,
      completed: false,
      claimed: false,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Admin Tier/Rank Management (from /admin in bot)
  const handleUpdateTier = (tierKey: RatingTier, updatedData: Partial<TierInfo>) => {
    setTiers((prev) => ({
      ...prev,
      [tierKey]: {
        ...prev[tierKey],
        ...updatedData,
      },
    }));
  };

  // Open PDF Viewer
  const handleOpenPdfReceipt = (receipt: PdfReceiptData) => {
    setSelectedPdfReceipt(receipt);
    setIsPdfModalOpen(true);
  };

  // Deep-linking from Telegram Bot "Посмотреть сделку" into MiniApp
  const handleOpenTransactionReceiptFromBot = (orderIdOrTxId: string) => {
    setIsTelegramBotOpen(false);

    // Look for matching transaction in transactions list
    const foundTx = transactions.find(
      (t) =>
        t.id === orderIdOrTxId ||
        `ORD-${t.id.substring(0, 8)}` === orderIdOrTxId ||
        t.chequeCode.includes(orderIdOrTxId)
    );

    if (foundTx) {
      setActiveReceiptTx(foundTx);
      return;
    }

    // Look in adminOrders
    const foundOrder = adminOrders.find(
      (o) => o.id === orderIdOrTxId || o.orderNumber === orderIdOrTxId
    );

    if (foundOrder) {
      const generatedTx: Transaction = {
        id: foundOrder.id.replace('ord_', 'tx_'),
        date: foundOrder.paidAt || 'Только что',
        cryptoSymbol: foundOrder.cryptoSymbol,
        cryptoAmount: foundOrder.cryptoAmount,
        fiatCurrency: 'RUB',
        fiatAmount: foundOrder.fiatAmount,
        rateUsed: foundOrder.rateUsed,
        volumeBonusPercent: 0.3,
        tierBonusPercent: currentTierInfo.rateBonus,
        chequeCode: foundOrder.chequeCode,
        status: 'completed',
        requisite: foundOrder.requisite,
        payoutTxId: foundOrder.pdfReceipt?.operationId || `SBP_TX_${Date.now()}`,
        timeTakenSeconds: 28,
        cashbackEarned: 0.5,
        xpEarned: 50,
        pdfReceipt: foundOrder.pdfReceipt,
      };
      setActiveReceiptTx(generatedTx);
    }
  };

  // Handle transaction creation & payout workflow from MiniApp
  const handleTransactionSuccess = (tx: Transaction) => {
    // Generate default PDF receipt for initial order record
    const pdfData = createPdfReceiptData(
      `ORD-${tx.id.substring(0, 8)}`,
      tx.fiatAmount,
      tx.cryptoAmount,
      tx.cryptoSymbol,
      tx.rateUsed,
      tx.requisite.bankName,
      tx.requisite.accountNumber,
      tx.requisite.recipientName,
      admins[0]?.username || 'admin_sbp'
    );

    const txWithPdf: Transaction = {
      ...tx,
      pdfReceipt: pdfData,
    };

    setTransactions((prev) => [txWithPdf, ...prev]);

    // Create an AdminOrder entry for the admin queue in the Telegram Bot
    const newAdminOrder: AdminOrder = {
      id: `ord_${Date.now()}`,
      orderNumber: `ORD-${tx.id.substring(0, 8)}`,
      createdAt: 'Только что',
      userTelegramId: user.telegramId,
      userUsername: user.username,
      userFullName: user.fullName,
      cryptoSymbol: tx.cryptoSymbol,
      cryptoAmount: tx.cryptoAmount,
      fiatAmount: tx.fiatAmount,
      rateUsed: tx.rateUsed,
      chequeCode: tx.chequeCode,
      requisite: tx.requisite,
      status: 'new',
      pdfReceipt: pdfData,
    };

    setAdminOrders((prev) => [newAdminOrder, ...prev]);

    setUser((prev) => {
      const newXp = prev.xp + (tx.xpEarned || 50);
      const nextTier = determineTier(newXp);
      return {
        ...prev,
        xp: newXp,
        tier: nextTier,
        completedDeals: prev.completedDeals + 1,
        totalVolumeRub: prev.totalVolumeRub + tx.fiatAmount,
        totalVolumeUsd:
          prev.totalVolumeUsd +
          tx.cryptoAmount * (tx.cryptoSymbol === 'USDT' ? 1 : 5.6),
      };
    });
  };

  // Admin actions from Telegram Bot
  const handleApproveAdminOrder = (orderId: string, pdfReceipt: PdfReceiptData) => {
    setAdminOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'paid',
              pdfReceipt,
              paidAt: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              assignedAdmin: `@${admins[0]?.username || 'admin_sbp'}`,
            }
          : o
      )
    );

    // Update matching transaction so seller can view PDF receipt in profile and deals
    setTransactions((prev) =>
      prev.map((t) => {
        if (`ORD-${t.id.substring(0, 8)}` === pdfReceipt.orderNumber || t.id.includes(orderId)) {
          return {
            ...t,
            pdfReceipt,
            status: 'completed',
          };
        }
        return t;
      })
    );
  };

  const handleRejectAdminOrder = (orderId: string) => {
    setAdminOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'rejected' } : o))
    );
  };

  const handleAddAdmin = (telegramId: string, username: string, fullName: string) => {
    const newAdm: AdminUser = {
      id: `adm_${Date.now()}`,
      telegramId,
      username,
      fullName,
      role: 'admin',
      addedAt: new Date().toLocaleDateString('ru-RU'),
      addedBy: user.username,
    };
    setAdmins((prev) => [...prev, newAdm]);
  };

  const handleRemoveAdmin = (adminId: string) => {
    setAdmins((prev) => prev.filter((a) => a.id !== adminId || a.role === 'owner'));
  };

  const unclaimedTasksCount = tasks.filter((t) => t.completed && !t.claimed).length;
  const pendingOrdersCount = adminOrders.filter((o) => o.status === 'new').length;

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-start font-sans antialiased selection:bg-[#A3FF12] selection:text-black">
      {/* Top Environment Bar */}
      <div className="w-full max-w-md px-3 pt-2 pb-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Smartphone className="w-3.5 h-3.5 text-[#A3FF12]" />
          <span className="text-[11px] font-semibold text-zinc-200">Telegram Mini App</span>
        </div>

        <button
          id="btn-open-tg-bot-floating"
          onClick={() => {
            sound.playTap();
            setIsTelegramBotOpen(true);
          }}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-[#A3FF12] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
        >
          <Bot className="w-3.5 h-3.5 text-[#A3FF12]" />
          <span>Чат бота (@CryptoChequePayBot)</span>
          {pendingOrdersCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Есть заявки на выплату"></span>
          )}
        </button>
      </div>

      {/* Mobile Telegram MiniApp Container */}
      <div className="w-full max-w-md min-h-screen bg-[#0F0F0F] flex flex-col relative border-x border-zinc-800 shadow-2xl">
        {/* Telegram Header */}
        <TelegramHeader
          user={user}
          tier={currentTierInfo}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onOpenProfile={() => setActiveTab('profile')}
          onOpenTelegramBot={() => setIsTelegramBotOpen(true)}
        />

        {/* Main View Area */}
        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          {activeTab === 'sell' && (
            <SellChequeView
              user={user}
              tier={currentTierInfo}
              requisites={requisites}
              onOpenAddRequisite={() => setIsAddRequisiteOpen(true)}
              onTransactionSuccess={handleTransactionSuccess}
              onOpenReceipt={(tx) => setActiveReceiptTx(tx)}
              onOpenTelegramBot={() => setIsTelegramBotOpen(true)}
              onOpenPdfReceipt={handleOpenPdfReceipt}
            />
          )}

          {activeTab === 'market' && (
            <MarketView
              tier={currentTierInfo}
              onQuickSell={() => {
                setActiveTab('sell');
              }}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksAndBonusesView
              user={user}
              tier={currentTierInfo}
              tasks={tasks}
              onClaimTask={handleClaimTask}
              onClaimDailyStreak={handleClaimDailyStreak}
              onNavigateToSell={() => setActiveTab('sell')}
              onVerifyTelegramTask={handleVerifyTelegramTask}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              tier={currentTierInfo}
              requisites={requisites}
              transactions={transactions}
              onOpenAddRequisite={() => setIsAddRequisiteOpen(true)}
              onDeleteRequisite={handleDeleteRequisite}
              onSetDefaultRequisite={handleSetDefaultRequisite}
              onOpenReceipt={(tx) => setActiveReceiptTx(tx)}
              onNavigateToTasks={() => setActiveTab('tasks')}
              onOpenPdfReceipt={handleOpenPdfReceipt}
              onOpenTelegramBot={() => setIsTelegramBotOpen(true)}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          unclaimedTasksCount={unclaimedTasksCount}
        />

        {/* Add Requisite Modal */}
        <AddRequisiteModal
          isOpen={isAddRequisiteOpen}
          onClose={() => setIsAddRequisiteOpen(false)}
          onSave={handleSaveRequisite}
        />

        {/* Transaction Receipt Modal */}
        <TransactionReceiptModal
          transaction={activeReceiptTx}
          onClose={() => setActiveReceiptTx(null)}
          onOpenPdfReceipt={handleOpenPdfReceipt}
        />

        {/* PDF Receipt Viewer Modal */}
        <PdfReceiptViewerModal
          receipt={selectedPdfReceipt}
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setSelectedPdfReceipt(null);
          }}
        />

        {/* Telegram Bot Chat (/start and /admin outside MiniApp) */}
        <TelegramBotChat
          isOpen={isTelegramBotOpen}
          onClose={() => setIsTelegramBotOpen(false)}
          onOpenMiniApp={() => {
            setIsTelegramBotOpen(false);
            setActiveTab('sell');
          }}
          adminOrders={adminOrders}
          admins={admins}
          tasks={tasks}
          tiers={tiers}
          onApproveOrder={handleApproveAdminOrder}
          onRejectOrder={handleRejectAdminOrder}
          onAddAdmin={handleAddAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTier={handleUpdateTier}
          onViewPdf={handleOpenPdfReceipt}
          onOpenTransactionReceipt={handleOpenTransactionReceiptFromBot}
        />
      </div>
    </div>
  );
}
