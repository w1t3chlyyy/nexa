import React, { useState } from 'react';
import { X, Check, Copy, FileText, Download } from 'lucide-react';
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

  const getOrMakePdfReceipt = (): PdfReceiptData =>
    transaction.pdfReceipt ||
    createPdfReceiptData(
      `ORD-${transaction.id.substring(0, 8)}`,
      transaction.fiatAmount,
      transaction.cryptoAmount,
      transaction.cryptoSymbol,
      transaction.rateUsed,
      transaction.requisite.bankName,
      transaction.requisite.accountNumber,
      transaction.requisite.recipientName
    );

  const handleDownloadPdf = () => {
    sound.playSuccess();
    downloadSbpReceiptPdf(getOrMakePdfReceipt());
  };

  const handleViewPdf = () => {
    sound.playTap();
    const pdfData = getOrMakePdfReceipt();
    if (onOpenPdfReceipt) onOpenPdfReceipt(pdfData);
    else downloadSbpReceiptPdf(pdfData);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    sound.playTap();
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-sm bg-[#141415] border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Чек выплаты СБП</span>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-7 h-7 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-2">
          <div className="text-xs text-zinc-500">Зачислено через СБП</div>
          <div className="text-2xl font-semibold text-white mt-1">
            +{transaction.fiatAmount.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {transaction.cryptoAmount} {transaction.cryptoSymbol} по курсу {transaction.rateUsed} ₽
          </div>
        </div>

        <div className="space-y-2 text-sm border-t border-zinc-800 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">Банк</span>
            <span className="text-white text-xs">{transaction.requisite.bankName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">Получатель</span>
            <span className="text-white text-xs">{transaction.requisite.recipientName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">Код чека</span>
            <button
              onClick={() => copyToClipboard(transaction.chequeCode, 'cheque')}
              className="flex items-center gap-1 font-mono text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              <span className="truncate max-w-[140px]">{transaction.chequeCode}</span>
              {copiedField === 'cheque' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <FileText className="w-3.5 h-3.5" />
            <span>Квитанция СБП</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleViewPdf}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs cursor-pointer transition-colors"
            >
              Открыть
            </button>
            <button
              onClick={handleDownloadPdf}
              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playTap();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b2ff33] text-sm font-medium text-black cursor-pointer transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};
