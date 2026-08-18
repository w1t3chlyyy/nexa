import React, { useState, useEffect } from 'react';
import { TelegramHeader } from './components/TelegramHeader';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeView } from './components/HomeView';
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

// Определяем пользователя Telegram один раз при загрузке приложения.
const tgUser = getTelegramUser();
const userKey = tgUser ? `cryptobot_user_stats_${tgUser.id}` : 'cryptobot_user_stats';
const reqKey = tgUser ? `cryptobot_requisites_${tgUser.id}` : 'cryptobot_requisites';
const taskKey = tgUser ? `cryptobot_tasks_${tgUser.id}` : 'cryptobot_tasks';
const txKey = tgUser ? `cryptobot_transactions_${tgUser.id}` : 'cryptobot_transactions';

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

function buildInitialUser(): UserStats {
  const saved = localStorage.getItem(userKey);

  if (saved) {
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

  if (tgUser) {
    return {
      ...EMPTY_USER_STATS,
      telegramId: tgUser.id,
      username: tgUser.username,
      fullName: tgUser.fullName,
      avatarUrl: tgUser.avatarUrl,
      isPremium: tgUser.isPremium,
      referralCode: tgUser.id,
    };
  }

  return INITIAL_USER_STATS;
}

// Оценка суммы сделки в долларах — используется и для баланса пользователя,
// и для прогресса заданий, чтобы обе цифры совпадали.
function amountToUsd(tx: Transaction): number {
  return tx.cryptoAmount * (tx.cryptoSymbol === 'USDT' ? 1 : 5.6);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
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

  const [isAddRequisiteOpen, setIsAddRequisiteOpen] = useState<boolean>(false);
  const [activeReceiptTx, setActiveReceiptTx] = useState<Transaction | null>(null);
  const [selectedPdfReceipt, setSelectedPdfReceipt] = useState<PdfReceiptData | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminRatesOpen, setIsAdminRatesOpen] = useState<boolean>(false);

  // Состояние для курсов валют
  const [rates, setRates] = useState<Record<string, number>>({});

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

  // Реальное число рефералов — считаем пользователей, у кого referred_by
  // указывает на наш telegram_id (проставляется ботом при переходе по
  // реферальной ссылке, см. api/webhook.ts).
  useEffect(() => {
    if (!supabase || !tgUser) return;
    (async () => {
      const { count } = await supabase
        .from('users')
        .select('telegram_id', { count: 'exact', head: true })
        .eq('referred_by', Number(tgUser.id));
      if (typeof count === 'number') {
        setUser((prev) => ({ ...prev, referralsCount: count }));
      }
    })();
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
  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase.from('exchange_rates').select('crypto_symbol, rate_rub');
      if (data) {
        const newRates: Record<string, number> = {};
        data.forEach((row: any) => {
          newRates[row.crypto_symbol] = Number(row.rate_rub);
        });
        setRates(newRates);
      }
    })();
  }, []);

  // Ранги теперь живут в Supabase (tiers_config) и редактируются из бота —
  // при наличии подключения полностью заменяют локальный набор по умолчанию.
  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase.from('tiers_config').select('*').order('min_xp', { ascending: true });
      if (data && data.length > 0) {
        const record: Record<string, TierInfo> = {};
        data.forEach((row: any) => {
          record[row.tier_key] = {
            tier: row.tier_key,
            title: row.title,
            minXp: row.min_xp,
            color: row.color,
            rateBonus: Number(row.rate_bonus),
            cashbackPercent: Number(row.cashback_percent),
            payoutSpeedText: row.payout_speed_text,
            features: Array.isArray(row.features) ? row.features : [],
          };
        });
        setTiers(record);
      }
    })();
  }, []);

  // Задания тоже живут в Supabase (tasks) и редактируются из бота.
  // Прогресс/claimed остаются локальными (по id) — при совпадении id
  // сохраняем то, что пользователь уже накопил/забрал.
  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase.from('tasks').select('*').eq('is_active', true);
      if (!data) return;

      setTasks((prevTasks) => {
        const prevById = new Map(prevTasks.map((t) => [t.id, t]));
        return data.map((row: any) => {
          const existing = prevById.get(row.id);
          return {
            id: row.id,
            title: row.title,
            description: row.description,
            category: row.category,
            rewardXp: row.reward_xp,
            rewardUsdt: row.reward_usdt ? Number(row.reward_usdt) : undefined,
            progress: existing?.progress ?? 0,
            maxProgress: Number(row.max_progress),
            unit: row.unit,
            completed: existing?.completed ?? false,
            claimed: existing?.claimed ?? false,
            iconName: row.icon_name,
            actionText: row.action_text,
            badge: existing?.badge,
            progressTrigger: row.progress_trigger,
            channelUsername: row.channel_username || undefined,
            channelTitle: row.channel_title || undefined,
            channelLink: row.channel_link || undefined,
            isChannelSub: row.is_channel_sub,
            isRequiredSub: row.is_required_sub,
          } as QuestTask;
        });
      });
    })();
  }, []);

  // Универсальный расчёт следующего ранга по XP — работает с любым набором
  // рангов (в т.ч. добавленными вручную через бота), а не только с 5 фиксированными.
  const determineTier = (xp: number): RatingTier => {
    const sorted = Object.values(tiers).sort((a, b) => b.minXp - a.minXp);
    const found = sorted.find((t) => xp >= t.minXp);
    return found ? found.tier : sorted[sorted.length - 1]?.tier || 'Bronze';
  };

  const currentTierInfo = tiers[user.tier] || Object.values(tiers)[0] || TIERS.Gold;

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

  // Обновляет прогресс заданий по факту реальной сделки — универсально,
  // на основе progressTrigger, а не привязки к конкретным id.
  const updateTasksAfterTrade = (tx: Transaction) => {
    const amountUsd = amountToUsd(tx);

    setTasks((prev) =>
      prev.map((t) => {
        if (t.claimed) return t;

        switch (t.progressTrigger) {
          case 'per_trade': {
            const progress = Math.min(t.maxProgress, t.progress + 1);
            return { ...t, progress, completed: progress >= t.maxProgress };
          }
          case 'daily_volume': {
            const progress = Math.min(t.maxProgress, t.progress + amountUsd);
            return { ...t, progress, completed: progress >= t.maxProgress };
          }
          case 'single_deal_min': {
            if (amountUsd >= t.maxProgress) {
              return { ...t, progress: t.maxProgress, completed: true };
            }
            return t;
          }
          default:
            return t;
        }
      })
    );
  };

  // Синхронизация "накопительных" заданий (milestone) с реальной статистикой.
  useEffect(() => {
    setTasks((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.claimed) return t;

        let progress = t.progress;
        if (t.progressTrigger === 'milestone_deals') progress = Math.min(t.maxProgress, user.completedDeals);
        else if (t.progressTrigger === 'milestone_referrals') progress = Math.min(t.maxProgress, user.referralsCount);
        else if (t.progressTrigger === 'milestone_volume') progress = Math.min(t.maxProgress, user.totalVolumeUsd);
        else return t;

        const completed = progress >= t.maxProgress;
        if (progress === t.progress && completed === t.completed) return t;
        changed = true;
        return { ...t, progress, completed };
      });
      return changed ? next : prev;
    });
  }, [user.completedDeals, user.referralsCount, user.totalVolumeUsd]);

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
    updateTasksAfterTrade(tx);

    // Заявка уходит в Supabase → оператор увидит её в самом боте через /admin → «Ордеры»
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
        totalVolumeUsd: prev.totalVolumeUsd + amountToUsd(tx),
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
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-start justify-center antialiased">
      <div className="w-full max-w-md min-h-screen bg-[#0A0A0B] flex flex-col relative">
        <TelegramHeader
          user={user}
          tier={currentTierInfo}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onOpenProfile={() => setActiveTab('profile')}
        />

        <main className="flex-1 px-4 pt-4 pb-28 overflow-y-auto">
          {activeTab === 'home' && (
            <HomeView 
              tier={currentTierInfo} 
              rates={rates}  // ← передаем rates
              onNavigateToSell={() => setActiveTab('sell')} 
            />
          )}

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
              tiers={tiers}
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
