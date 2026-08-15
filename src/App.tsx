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
import { AdminRatesModal } from './components/AdminRatesModal';
import {
  UserStats,
  PaymentRequisite,
  Transaction,
  QuestTask,
  RatingTier,
  TierInfo,
  PdfReceiptData,
} from './types';
import {
  INITIAL_USER_STATS,
  INITIAL_REQUISITES,
  INITIAL_TASKS,
  INITIAL_TRANSACTIONS,
  TIERS,
  SUPPORTED_CRYPTOS,
} from './data/mockData';
import { createPdfReceiptData } from './utils/pdfGenerator';
import { sound } from './utils/sound';
import { getTelegramUser } from './utils/telegram';
import { supabase } from './lib/supabase';
import { Smartphone } from 'lucide-react';

// Определяем пользователя Telegram один раз при загрузке приложения.
// Внутри Telegram (Mini App) здесь будут реальные id/username/фото.
// Вне Telegram (обычный браузер, для разработки) — null, тогда используются общие demo-ключи.
const tgUser = getTelegramUser();
const userKey = tgUser ? `cryptobot_user_stats_${tgUser.id}` : 'cryptobot_user_stats';
const reqKey = tgUser ? `cryptobot_requisites_${tgUser.id}` : 'cryptobot_requisites';
const taskKey = tgUser ? `cryptobot_tasks_${tgUser.id}` : 'cryptobot_tasks';
const txKey = tgUser ? `cryptobot_transactions_${tgUser.id}` : 'cryptobot_transactions';

// Добавьте ПЕРЕД функцией buildInitialUser():
const EMPTY_USER_STATS: UserStats = {
  telegramId: '0',
  username: 'user',
  fullName: 'Пользователь',
  avatarUrl: '',
  isPremium: false,
  isVerified: false,
  tier: 'Bronze',
  xp: 0,
  xpToNextTier: 250,
  completedDeals: 0,
  totalVolumeRub: 0,
  totalVolumeUsd: 0,
  avgSpeedSeconds: 0,
  referralCode: '',
  referralsCount: 0,
  referralEarningsUsdt: 0,
  joinedDate: new Date().toLocaleDateString('ru-RU'),
  streakDays: 0,
  streakClaimedToday: false,
};

// Замените функцию buildInitialUser() полностью:
function buildInitialUser(): UserStats {
  const saved = localStorage.getItem(userKey);

  if (saved) {
    // Пользователь уже открывал приложение — берём его прогресс
    const base: UserStats = JSON.parse(saved);
    if (tgUser) {
      return {
        ...base,
        telegramId: tgUser.id,
        username: tgUser.username,
        fullName: tgUser.fullName,
        avatarUrl: tgUser.avatarUrl,
        isPremium: tgUser.isPremium,
      };
    }
    return base;
  }

  // Нет сохранённых данных = новый пользователь
  if (tgUser) {
    // В Telegram Mini App — чистый профиль с нуля
    return {
      ...EMPTY_USER_STATS,
      telegramId: tgUser.id,
      username: tgUser.username,
      fullName: tgUser.fullName,
      avatarUrl: tgUser.avatarUrl,
      isPremium: tgUser.isPremium,
      referralCode: `ref_${tgUser.id.slice(-6)}_${Math.floor(Math.random() * 1000)}`,
    };
  }

  // Вне Telegram (обычный браузер) — demo-режим
  return INITIAL_USER_STATS;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('sell');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [user, setUser] = useState<UserStats>(buildInitialUser);

  const [tiers, setTiers] = useState<Record<string, TierInfo>>(() => {
    const saved = localStorage.getItem('cryptobot_tiers');
    return saved ? JSON.parse(saved) : TIERS;
  });

  const [requisites, setRequisites] = useState<PaymentRequisite[]>(() => {
    const saved = localStorage.getItem(reqKey);
    return saved ? JSON.parse(saved) : INITIAL_REQUISITES;
  });

  const [tasks, setTasks] = useState<QuestTask[]>(() => {
    const saved = localStorage.getItem(taskKey);
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(txKey);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Modals state
  const [isAddRequisiteOpen, setIsAddRequisiteOpen] = useState<boolean>(false);
  const [activeReceiptTx, setActiveReceiptTx] = useState<Transaction | null>(null);
  const [selectedPdfReceipt, setSelectedPdfReceipt] = useState<PdfReceiptData | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Admin: доступ к панели курсов обмена
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminRatesOpen, setIsAdminRatesOpen] = useState<boolean>(false);

  // Save to localStorage (персонально по telegramId)
  useEffect(() => {
    localStorage.setItem(userKey, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('cryptobot_tiers', JSON.stringify(tiers));
  }, [tiers]);

  useEffect(() => {
    localStorage.setItem(reqKey, JSON.stringify(requisites));
  }, [requisites]);

  useEffect(() => {
    localStorage.setItem(taskKey, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(txKey, JSON.stringify(transactions));
  }, [transactions]);

  // Синхронизация профиля с Supabase при первом открытии.
  // Если пользователь уже есть в базе — подтягиваем его реальный прогресс (xp, ранг, обороты).
  // Если нет — создаём запись.
  useEffect(() => {
    if (!supabase || !tgUser) return;

    (async () => {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', Number(tgUser.id))
        .maybeSingle();

      if (existing) {
        setUser((prev) => ({
          ...prev,
          xp: existing.xp ?? prev.xp,
          tier: (existing.tier as RatingTier) ?? prev.tier,
          completedDeals: existing.completed_deals ?? prev.completedDeals,
          totalVolumeRub: Number(existing.total_volume_rub ?? prev.totalVolumeRub),
          totalVolumeUsd: Number(existing.total_volume_usd ?? prev.totalVolumeUsd),
          username: tgUser.username,
          fullName: tgUser.fullName,
          avatarUrl: tgUser.avatarUrl,
        }));
      } else {
        await supabase.from('users').upsert(
          {
            telegram_id: Number(tgUser.id),
            username: tgUser.username,
            full_name: tgUser.fullName,
            xp: user.xp,
            tier: user.tier,
          },
          { onConflict: 'telegram_id' }
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Проверяем, является ли текущий пользователь админом (таблица admins в Supabase)
  useEffect(() => {
    if (!supabase || !tgUser) return;

    (async () => {
      const { data } = await supabase
        .from('admins')
        .select('id')
        .eq('telegram_id', Number(tgUser.id))
        .eq('is_active', true)
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  // Подтягиваем актуальные курсы обмена из таблицы exchange_rates при старте.
  // Курс мутируется прямо в SUPPORTED_CRYPTOS, чтобы его сразу видели
  // калькулятор (MarketView) и продажа чека (SellChequeView).
  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase.from('exchange_rates').select('crypto_symbol, rate_rub');
      if (data) {
        data.forEach((row: any) => {
          const crypto = SUPPORTED_CRYPTOS.find((c) => c.symbol === row.crypto_symbol);
          if (crypto) crypto.priceRub = Number(row.rate_rub);
        });
      }
    })();
  }, []);

  const determineTier = (xp: number): RatingTier => {
    if (xp >= (tiers.Diamond?.minXp || 5000)) return 'Diamond';
    if (xp >= (tiers.Platinum?.minXp || 2000)) return 'Platinum';
    if (xp >= (tiers.Gold?.minXp || 750)) return 'Gold';
    if (xp >= (tiers.Silver?.minXp || 250)) return 'Silver';
    return 'Bronze';
  };

  const currentTierInfo = tiers[user.tier] || tiers.Gold || TIERS.Gold;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setEnabled(next);
  };

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

    if (supabase && tgUser) {
      supabase.from('requisites').insert({
        user_telegram_id: Number(tgUser.id),
        bank_name: newReq.bankName,
        account_number: newReq.accountNumber,
        recipient_name: newReq.recipientName,
        type: newReq.type,
        is_default: newReq.isDefault,
        color: newReq.color,
      });
    }
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

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, claimed: true } : t)));
  };

  const handleVerifyTelegramTask = async (taskId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, progress: 1, completed: true, badge: 'Подтверждено ботом' }
              : t
          )
        );
        resolve(true);
      }, 900);
    });
  };

  const handleOpenPdfReceipt = (receipt: PdfReceiptData) => {
    setSelectedPdfReceipt(receipt);
    setIsPdfModalOpen(true);
  };

  const handleTransactionSuccess = (tx: Transaction) => {
    const pdfData = createPdfReceiptData(
      `ORD-${tx.id.substring(0, 8)}`,
      tx.fiatAmount,
      tx.cryptoAmount,
      tx.cryptoSymbol,
      tx.rateUsed,
      tx.requisite.bankName,
      tx.requisite.accountNumber,
      tx.requisite.recipientName
    );

    const txWithPdf: Transaction = { ...tx, pdfReceipt: pdfData };
    setTransactions((prev) => [txWithPdf, ...prev]);

    // Заявка уходит в Supabase → оператор увидит её в самом боте через /orders или /admin
    if (supabase && tgUser) {
      supabase.from('orders').insert({
        order_number: `ORD-${tx.id.substring(0, 8)}`,
        user_telegram_id: Number(tgUser.id),
        user_username: tgUser.username,
        user_full_name: tgUser.fullName,
        crypto_symbol: tx.cryptoSymbol,
        crypto_amount: tx.cryptoAmount,
        fiat_amount: tx.fiatAmount,
        rate_used: tx.rateUsed,
        volume_bonus_percent: tx.volumeBonusPercent || 0,
        tier_bonus_percent: tx.tierBonusPercent || 0,
        cheque_code: tx.chequeCode,
        status: 'new',
        requisite: tx.requisite,
      });
    }

    setUser((prev) => {
      const newXp = prev.xp + (tx.xpEarned || 50);
      const nextTier = determineTier(newXp);
      const updated = {
        ...prev,
        xp: newXp,
        tier: nextTier,
        completedDeals: prev.completedDeals + 1,
        totalVolumeRub: prev.totalVolumeRub + tx.fiatAmount,
        totalVolumeUsd: prev.totalVolumeUsd + tx.cryptoAmount * (tx.cryptoSymbol === 'USDT' ? 1 : 5.6),
      };

      if (supabase && tgUser) {
        supabase
          .from('users')
          .update({
            xp: updated.xp,
            tier: updated.tier,
            completed_deals: updated.completedDeals,
            total_volume_rub: updated.totalVolumeRub,
            total_volume_usd: updated.totalVolumeUsd,
          })
          .eq('telegram_id', Number(tgUser.id));
      }

      return updated;
    });
  };

  const unclaimedTasksCount = tasks.filter((t) => t.completed && !t.claimed).length;

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-start font-sans antialiased selection:bg-[#A3FF12] selection:text-black">
      <div className="w-full max-w-md px-3 pt-2 pb-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Smartphone className="w-3.5 h-3.5 text-[#A3FF12]" />
          <span className="text-[11px] font-semibold text-zinc-200">Telegram Mini App</span>
        </div>
      </div>

      <div className="w-full max-w-md min-h-screen bg-[#0F0F0F] flex flex-col relative border-x border-zinc-800 shadow-2xl">
        <TelegramHeader
          user={user}
          tier={currentTierInfo}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onOpenProfile={() => setActiveTab('profile')}
        />

        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          {activeTab === 'sell' && (
            <SellChequeView
              user={user}
              tier={currentTierInfo}
              requisites={requisites}
              onOpenAddRequisite={() => setIsAddRequisiteOpen(true)}
              onTransactionSuccess={handleTransactionSuccess}
              onOpenReceipt={(tx) => setActiveReceiptTx(tx)}
              onOpenPdfReceipt={handleOpenPdfReceipt}
            />
          )}

          {activeTab === 'market' && (
            <MarketView tier={currentTierInfo} onQuickSell={() => setActiveTab('sell')} />
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
              onOpenAdminPanel={isAdmin ? () => setIsAdminRatesOpen(true) : undefined}
            />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          unclaimedTasksCount={unclaimedTasksCount}
        />

        <AddRequisiteModal
          isOpen={isAddRequisiteOpen}
          onClose={() => setIsAddRequisiteOpen(false)}
          onSave={handleSaveRequisite}
        />

        <TransactionReceiptModal
          transaction={activeReceiptTx}
          onClose={() => setActiveReceiptTx(null)}
          onOpenPdfReceipt={handleOpenPdfReceipt}
        />

        <PdfReceiptViewerModal
          receipt={selectedPdfReceipt}
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setSelectedPdfReceipt(null);
          }}
        />

        <AdminRatesModal
          isOpen={isAdminRatesOpen}
          onClose={() => setIsAdminRatesOpen(false)}
        />
      </div>
    </div>
  );
}
