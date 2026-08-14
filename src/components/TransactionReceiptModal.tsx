import React, { useState } from 'react';
import { X, Check, Copy, Share2, ShieldCheck, Zap, Sparkles, FileText, Download } from 'lucide-react';
import { Transaction, PdfReceiptData } from '../types';
import { createPdfReceiptData, downloadSbpReceiptPdf } from '../utils/pdfGenerator';
import { sound } from '../utils/sound';

interface TransactionReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onOpenPdfReceipt?: (receipt: PdfReceiptData) => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  transaction,
  onClose,
  onOpenPdfReceipt,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!transaction) return null;

  const getOrMakePdfReceipt = (): PdfReceiptData => {
    if (transaction.pdfReceipt) return transaction.pdfReceipt;
    return createPdfReceiptData(
      `ORD-${transaction.id.substring(0, 8)}`,
      transaction.fiatAmount,
      transaction.cryptoAmount,
      transaction.cryptoSymbol,
      transaction.rateUsed,
      transaction.requisite.bankName,
      transaction.requisite.accountNumber,
      transaction.requisite.recipientName
    );
  };

  const handleDownloadPdf = () => {
    sound.playSuccess();
    const pdfData = getOrMakePdfReceipt();
    downloadSbpReceiptPdf(pdfData);
  };

  const handleViewPdf = () => {
    sound.playTap();
    const pdfData = getOrMakePdfReceipt();
    if (onOpenPdfReceipt) {
      onOpenPdfReceipt(pdfData);
    } else {
      downloadSbpReceiptPdf(pdfData);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    sound.playTap();
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        id="transaction-receipt-modal"
        className="w-full max-w-sm bg-[#181818] border border-zinc-800 rounded-2xl p-4 shadow-2xl overflow-hidden relative"
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white">Чек выплаты СБП</span>
              <p className="text-[10px] text-zinc-400 font-mono">#{transaction.id}</p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="my-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center relative overflow-hidden">
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#1E2514] border border-[#A3FF12]/30 text-[#A3FF12] text-[9px] font-bold">
            <Check className="w-2.5 h-2.5" />
            Выплачено
          </div>

          <div className="text-[10px] text-zinc-400">
            Зачислено через СБП
          </div>
          <div className="text-xl font-black text-white mt-0.5 tracking-tight font-mono">
            +{transaction.fiatAmount.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-[11px] text-zinc-300 mt-0.5 flex items-center justify-center gap-1">
            <span>Продано:</span>
            <span className="font-mono text-white font-bold">
              {transaction.cryptoAmount} {transaction.cryptoSymbol}
            </span>
            <span className="text-[10px] text-[#A3FF12] font-mono">
              ({transaction.rateUsed} ₽)
            </span>
          </div>
        </div>

        {/* Details list */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-400 text-[11px]">Банк / Реквизит</span>
            <div className="text-right">
              <div className="font-bold text-white text-[11px]">{transaction.requisite.bankName}</div>
              <div className="text-[10px] font-mono text-zinc-400">{transaction.requisite.accountNumber}</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px]">
            <span className="text-zinc-400">Получатель</span>
            <span className="font-bold text-white">{transaction.requisite.recipientName}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px]">
            <span className="text-zinc-400">Код чека</span>
            <button
              onClick={() => copyToClipboard(transaction.chequeCode, 'cheque')}
              className="flex items-center gap-1 font-mono text-[#A3FF12] font-bold hover:underline cursor-pointer"
            >
              <span className="truncate max-w-[140px]">{transaction.chequeCode}</span>
              {copiedField === 'cheque' ? <Check className="w-2.5 h-2.5 text-[#A3FF12]" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px]">
            <span className="text-zinc-400">Скорость</span>
            <div className="flex items-center gap-1 text-[#A3FF12] font-bold">
              <Zap className="w-3 h-3 fill-[#A3FF12]" />
              <span>{transaction.timeTakenSeconds || 32} сек (СБП 0%)</span>
            </div>
          </div>

          {/* Rewards received */}
          {(transaction.cashbackEarned || transaction.xpEarned) && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#1E2514] border border-[#A3FF12]/30">
              <span className="text-[#A3FF12] font-bold flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-[#A3FF12]" /> Бонус:
              </span>
              <span className="font-mono font-bold text-white text-[11px]">
                +{transaction.cashbackEarned} USDT / +{transaction.xpEarned} XP
              </span>
            </div>
          )}
        </div>

        {/* PDF Receipt Quick Banner */}
        <div className="mt-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#A3FF12]" />
            <span className="text-[11px] text-zinc-300 font-medium">Банковская квитанция СБП</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleViewPdf}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#A3FF12] text-[10px] font-bold cursor-pointer"
            >
              Открыть PDF
            </button>
            <button
              onClick={handleDownloadPdf}
              className="p-1 rounded-lg bg-[#A3FF12] text-black hover:bg-[#b2ff33] cursor-pointer"
              title="Скачать PDF"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-2.5 pt-2.5 border-t border-zinc-800 flex gap-2">
          <button
            onClick={() => {
              copyToClipboard(
                `Выплата ${transaction.fiatAmount} RUB по чеку ${transaction.chequeCode} успешно завершена!`,
                'share'
              );
            }}
            className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Share2 className="w-3 h-3 text-[#A3FF12]" />
            {copiedField === 'share' ? 'Скопировано' : 'Поделиться'}
          </button>

          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="flex-1 py-1.5 px-3 rounded-lg bg-[#A3FF12] hover:bg-[#b2ff33] text-xs font-bold text-black flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

