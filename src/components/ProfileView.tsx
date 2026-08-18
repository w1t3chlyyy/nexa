import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Copy,
  ChevronRight,
  FileText,
  Download,
  Bot,
  Lock,
  Star,
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

// Имя бота для реферальной ссылки. Задаётся через VITE_BOT_USERNAME в .env —
// это публичная информация (никакой секрет), поэтому её можно спокойно
// зашивать в клиентскую сборку.
const BOT_USERNAME = (import.meta as any).env?.VITE_BOT_USERNAME || 'your_bot';

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

  // Реферальная ссылка теперь всегда ref_<telegramId> — бот сам находит
  // пригласившего по этому id (см. api/webhook.ts). Раньше здесь было
  // задвоение "ref_ref_..." и ссылка вообще ни на что не влияла.
  const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user.telegramId}`;

  const handleCopyReferral = () => {
    sound.playTap();
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const getPdf = (tx: Transaction) =>
    tx.pdfReceipt ||
    createPdfReceiptData(
      `ORD-${tx.id.substring(0, 8)}`,
      tx.fiatAmount,
      tx.cryptoAmount,
      tx.cryptoSymbol,
      tx.rateUsed,
      tx.requisite.bankName,
      tx.requisite.accountNumber,
      tx.requisite.recipientName
    );

  const handleDownloadTxPdf = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    sound.playSuccess();
    downloadSbpReceiptPdf(getPdf(tx));
  };

  const handleViewTxPdf = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    sound.playTap();
    const pdfData = getPdf(tx);
    if (onOpenPdfReceipt) onOpenPdfReceipt(pdfData);
    else downloadSbpReceiptPdf(pdfData);
  };

  return (
    <div id="profile-view" className="space-y-3 pb-28 select-none">
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h2 className="text-sm font-semibold text-white">{user.fullName}</h2>
              <div className="text-xs text-zinc-500">@{user.username} · с {user.joinedDate}</div>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-white font-medium">{tier.title.split(' ')[0]}</div>
            <div className="text-zinc-500">{user.completedDeals} выплат</div>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playTap();
            onNavigateToTasks();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-black/30 hover:bg-black/40 border border-zinc-800 cursor-pointer transition-colors"
        >
          <div className="text-left">
            <div className="text-xs text-white">{tier.title} · +{tier.rateBonus}%</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{user.xp} / {user.xpToNextTier} XP</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      <div className="flex bg-[#141415] p-1 rounded-xl border border-zinc-800/70">
        {(['requisites', 'stats', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              sound.playTap();
              setActiveTab(t);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === t ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {t === 'requisites' ? `Карты (${requisites.length})` : t === 'stats' ? 'Инфо' : `Сделки (${transactions.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'requisites' && (
        <div className="space-y-2.5">
          <button
            id="add-new-req-main-btn"
            onClick={() => {
              sound.playTap();
              onOpenAddRequisite();
            }}
            className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-black text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить реквизит</span>
          </button>

          <div className="space-y-1.5">
            {requisites.map((req) => (
              <div
                key={req.id}
                id={`saved-req-item-${req.id}`}
                className="p-3.5 rounded-xl bg-[#141415] border border-zinc-800/70 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white truncate">{req.title}</span>
                    {req.isDefault && <span className="text-[10px] text-zinc-500">· основной</span>}
                  </div>
                  <div className="text-xs font-mono text-zinc-400 mt-0.5">{req.accountNumber}</div>
                  <div className="text-xs text-zinc-600">{req.bankName}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!req.isDefault && (
                    <button
                      onClick={() => {
                        sound.playTap();
                        onSetDefaultRequisite(req.id);
                      }}
                      title="Сделать основным"
                      className="w-7 h-7 rounded-lg text-zinc-600 hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      sound.playTap();
                      onDeleteRequisite(req.id);
                    }}
                    title="Удалить"
                    className="w-7 h-7 rounded-lg text-zinc-600 hover:text-rose-400 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Оборот', value: `$${user.totalVolumeUsd.toLocaleString('en-US')}` },
              { label: 'Сделок', value: String(user.completedDeals) },
              { label: 'Скорость', value: `${user.avgSpeedSeconds} сек` },
              { label: 'Рефералы', value: `${user.referralsCount} чел.` },
            ].map((s) => (
              <div key={s.label} className="p-3.5 rounded-xl bg-[#141415] border border-zinc-800/70">
                <div className="text-xs text-zinc-500">{s.label}</div>
                <div className="text-base font-semibold text-white mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-2">
            <div className="text-sm text-white">Реферальная ссылка</div>
            <p className="text-xs text-zinc-500">15% с комиссии сделок ваших друзей · заработано ${user.referralEarningsUsdt.toFixed(2)}</p>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 bg-black/30 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs font-mono text-zinc-400 truncate">
                {referralLink}
              </div>
              <button
                onClick={handleCopyReferral}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer transition-colors"
              >
                {copiedRef ? <Check className="w-3.5 h-3.5 text-[#A3FF12]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-1.5">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              onClick={() => {
                sound.playTap();
                onOpenReceipt(tx);
              }}
              className="p-3.5 rounded-xl bg-[#141415] border border-zinc-800/70 hover:border-zinc-700 cursor-pointer transition-colors flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm text-white">+{tx.fiatAmount.toLocaleString('ru-RU')} ₽</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {tx.cryptoAmount} {tx.cryptoSymbol} · {tx.requisite.bankName}
                </div>
                <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{tx.date}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => handleViewTxPdf(e, tx)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white cursor-pointer transition-colors"
                  title="Открыть PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDownloadTxPdf(e, tx)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white cursor-pointer transition-colors"
                  title="Скачать PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        id="btn-profile-open-tg-bot"
        onClick={() => {
          sound.playTap();
          if (onOpenTelegramBot) onOpenTelegramBot();
        }}
        className="w-full p-3.5 rounded-xl bg-[#141415] hover:bg-zinc-900 border border-zinc-800/70 flex items-center justify-between transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Bot className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-white">Чат с ботом</span>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600" />
      </button>

      {onOpenAdminPanel && (
        <button
          id="btn-profile-open-admin"
          onClick={() => {
            sound.playTap();
            onOpenAdminPanel();
          }}
          className="w-full p-3.5 rounded-xl bg-[#141415] hover:bg-zinc-900 border border-zinc-800/70 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-white">Админ: курсы обмена</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
      )}
    </div>
  );
};
