import React, { useState } from 'react';
import {
  ShieldCheck,
  Star,
  Sparkles,
  CreditCard,
  Plus,
  Trash2,
  Check,
  Copy,
  TrendingUp,
  Clock,
  Users,
  Receipt,
  ChevronRight,
  FileText,
  Download,
  Bot,
  Lock,
} from 'lucide-react';
import {
  UserStats,
  TierInfo,
  PaymentRequisite,
  Transaction,
  PdfReceiptData,
} from '../types';
import { sound } from '../utils/sound';
import { createPdfReceiptData, downloadSbpReceiptPdf } from '../utils/pdfGenerator';

interface ProfileViewProps {
  user: UserStats;
  tier: TierInfo;
  requisites: PaymentRequisite[];
  transactions: Transaction[];
  onOpenAddRequisite: () => void;
  onDeleteRequisite: (id: string) => void;
  onSetDefaultRequisite: (id: string) => void;
  onOpenReceipt: (tx: Transaction) => void;
  onNavigateToTasks: () => void;
  onOpenPdfReceipt?: (receipt: PdfReceiptData) => void;
  onOpenTelegramBot?: () => void;
  onOpenAdminPanel?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  tier,
  requisites,
  transactions,
  onOpenAddRequisite,
  onDeleteRequisite,
  onSetDefaultRequisite,
  onOpenReceipt,
  onNavigateToTasks,
  onOpenPdfReceipt,
  onOpenTelegramBot,
  onOpenAdminPanel,
}) => {
  const [activeTab, setActiveTab] = useState<'requisites' | 'stats' | 'history'>('requisites');
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  const handleCopyReferral = () => {
    sound.playTap();
    const link = `https://t.me/CryptoChequePayBot?start=ref_${user.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleDownloadTxPdf = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    sound.playSuccess();
    const pdfData = tx.pdfReceipt || createPdfReceiptData(
      `ORD-${tx.id.substring(0, 8)}`,
      tx.fiatAmount,
      tx.cryptoAmount,
      tx.cryptoSymbol,
      tx.rateUsed,
      tx.requisite.bankName,
      tx.requisite.accountNumber,
      tx.requisite.recipientName
    );
    downloadSbpReceiptPdf(pdfData);
  };

  const handleViewTxPdf = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    sound.playTap();
    const pdfData = tx.pdfReceipt || createPdfReceiptData(
      `ORD-${tx.id.substring(0, 8)}`,
      tx.fiatAmount,
      tx.cryptoAmount,
      tx.cryptoSymbol,
      tx.rateUsed,
      tx.requisite.bankName,
      tx.requisite.accountNumber,
      tx.requisite.recipientName
    );
    if (onOpenPdfReceipt) {
      onOpenPdfReceipt(pdfData);
    } else {
      downloadSbpReceiptPdf(pdfData);
    }
  };

  return (
    <div id="profile-view" className="space-y-3 pb-20 select-none">
      {/* Profile Header Identity Card */}
      <div className="p-4 rounded-2xl bg-[#181818] border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700"
              />
              {user.isPremium && (
                <div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-zinc-900 border border-[#A3FF12] rounded-full flex items-center justify-center"
                  title="Telegram Premium"
                >
                  <Star className="w-2 h-2 text-[#A3FF12] fill-[#A3FF12]" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-bold text-white tracking-tight">{user.fullName}</h2>
                {user.isVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#A3FF12]" />
                )}
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">@{user.username}</div>
              <div className="text-[10px] text-zinc-500">С {user.joinedDate}</div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="text-right">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1E2514] border border-[#A3FF12]/30 text-xs font-bold text-[#A3FF12] font-mono">
              <ShieldCheck className="w-3 h-3 text-[#A3FF12]" />
              <span>{tier.title.split(' ')[0]}</span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              {user.completedDeals} успешных выплат
            </div>
          </div>
        </div>

        {/* Tier & XP Mini Banner */}
        <div
          onClick={() => {
            sound.playTap();
            onNavigateToTasks();
          }}
          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#A3FF12]/40 flex items-center justify-between cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <Sparkles className="w-3 h-3" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{tier.title}</span>
                <span className="text-[9px] text-[#A3FF12] font-mono font-bold px-1.5 py-0.2 rounded bg-[#1E2514] border border-[#A3FF12]/30">
                  +{tier.rateBonus}%
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                {user.xp} / {user.xpToNextTier} XP
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 text-xs font-bold text-[#A3FF12]">
            <span>Бонусы</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Profile Section Tabs */}
      <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
        <button
          id="profile-tab-requisites"
          onClick={() => {
            sound.playTap();
            setActiveTab('requisites');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'requisites'
              ? 'bg-[#A3FF12] text-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Карты ({requisites.length})</span>
        </button>

        <button
          id="profile-tab-stats"
          onClick={() => {
            sound.playTap();
            setActiveTab('stats');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'stats'
              ? 'bg-[#A3FF12] text-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Инфо</span>
        </button>

        <button
          id="profile-tab-history"
          onClick={() => {
            sound.playTap();
            setActiveTab('history');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-[#A3FF12] text-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Сделки ({transactions.length})</span>
        </button>
      </div>

      {/* Tab 1: REQUISITES MANAGER */}
      {activeTab === 'requisites' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">
                Сохраненные реквизиты
              </h3>
              <p className="text-[10px] text-zinc-400">Для выплат СБП</p>
            </div>

            <button
              id="add-new-req-main-btn"
              onClick={() => {
                sound.playTap();
                onOpenAddRequisite();
              }}
              className="py-1 px-2.5 rounded-lg bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Добавить</span>
            </button>
          </div>

          {requisites.length === 0 ? (
            <div
              onClick={onOpenAddRequisite}
              className="p-5 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 text-center cursor-pointer transition-all"
            >
              <CreditCard className="w-6 h-6 text-zinc-500 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-white">Реквизиты не добавлены</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Добавьте номер СБП или карту для выплат
              </p>
              <button
                type="button"
                className="mt-2.5 py-1 px-2.5 rounded-lg bg-[#A3FF12] text-black text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Добавить карту/СБП</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {requisites.map((req) => (
                <div
                  key={req.id}
                  id={`saved-req-item-${req.id}`}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{
                        backgroundColor: `${req.color}15`,
                        border: `1px solid ${req.color}35`,
                        color: req.color,
                      }}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{req.title}</span>
                        {req.isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#A3FF12] text-black">
                            Основной
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                        {req.accountNumber}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {req.bankName} • {req.recipientName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!req.isDefault && (
                      <button
                        id={`set-default-req-${req.id}`}
                        onClick={() => {
                          sound.playTap();
                          onSetDefaultRequisite(req.id);
                        }}
                        title="Сделать основным"
                        className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-[#A3FF12] text-zinc-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      id={`delete-req-${req.id}`}
                      onClick={() => {
                        sound.playTap();
                        onDeleteRequisite(req.id);
                      }}
                      title="Удалить реквизит"
                      className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security Guarantee */}
          <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span>
              Реквизиты используются исключительно для перевода рублей через СБП.
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: DETAILED STATISTICS */}
      {activeTab === 'stats' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400">Оборот продаж</span>
              <div className="text-base font-black text-white font-mono mt-0.5">
                ${user.totalVolumeUsd.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {user.totalVolumeRub.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400">Сделок</span>
              <div className="text-base font-black text-white font-mono mt-0.5">
                {user.completedDeals}
              </div>
              <div className="text-[10px] text-[#A3FF12] font-bold mt-0.5">
                100% без задержек
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400">Скорость</span>
              <div className="text-base font-black text-white font-mono mt-0.5 flex items-center gap-1">
                <span>{user.avgSpeedSeconds} сек</span>
                <Clock className="w-3.5 h-3.5 text-[#A3FF12]" />
              </div>
              <div className="text-[10px] text-zinc-400">
                СБП авто-выплата
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400">Рефералы</span>
              <div className="text-base font-black text-[#A3FF12] font-mono mt-0.5">
                +${user.referralEarningsUsdt.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-400">
                {user.referralsCount} друзей
              </div>
            </div>
          </div>

          {/* Referral Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#A3FF12]" />
                <h3 className="text-xs font-bold text-white">
                  Реферальная ссылка
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#A3FF12] bg-[#1E2514] border border-[#A3FF12]/30 px-1.5 py-0.5 rounded">
                15% бонус
              </span>
            </div>

            <p className="text-[11px] text-zinc-400">
              Получайте 15% с комиссии каждой продажи чека вашими друзьями.
            </p>

            <div className="flex items-center gap-1.5 pt-0.5">
              <div className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 truncate">
                t.me/CryptoSellBot?start=ref_{user.referralCode}
              </div>
              <button
                onClick={handleCopyReferral}
                className="py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-[#A3FF12] hover:text-black text-[#A3FF12] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedRef ? <Check className="w-3 h-3 text-[#A3FF12]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedRef ? 'Скопировано' : 'Копия'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: TRANSACTIONS HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">
              История обменов и чеки СБП
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">{transactions.length} выплат</span>
          </div>

          <div className="space-y-1.5">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => {
                  sound.playTap();
                  onOpenReceipt(tx);
                }}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/30 flex items-center justify-center text-[#A3FF12] font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">
                        +{tx.fiatAmount.toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-[#A3FF12] font-mono">
                        СБП 0%
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {tx.cryptoAmount} {tx.cryptoSymbol} • {tx.requisite.bankName}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-mono">{tx.date}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleViewTxPdf(e, tx)}
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#A3FF12] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Открыть PDF квитанцию"
                  >
                    <FileText className="w-3 h-3" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={(e) => handleDownloadTxPdf(e, tx)}
                    className="p-1 rounded-lg bg-zinc-800 hover:bg-[#A3FF12] text-zinc-300 hover:text-black transition-colors cursor-pointer"
                    title="Скачать PDF чек"
                  >
                    <Download className="w-3 h-3" />
                  </button>

                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick shortcut to Telegram Bot */}
      <div className="pt-2">
        <button
          id="btn-profile-open-tg-bot"
          onClick={() => {
            sound.playTap();
            if (onOpenTelegramBot) onOpenTelegramBot();
          }}
          className="w-full p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#A3FF12]/10 border border-[#A3FF12]/30 flex items-center justify-center text-[#A3FF12]">
              <Bot className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                <span>Чат с ботом @CryptoChequePayBot</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                  /start • /admin
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Уведомления о выплатах и чат</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>
      </div>
    </div>
  );
};


