import React from 'react';
import { FileText, Download, X, Copy } from 'lucide-react';
import { PdfReceiptData } from '../types';
import { downloadSbpReceiptPdf } from '../utils/pdfGenerator';
import { sound } from '../utils/sound';

interface PdfReceiptViewerModalProps {
  receipt: PdfReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfReceiptViewerModal: React.FC<PdfReceiptViewerModalProps> = ({
  receipt,
  isOpen,
  onClose,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!isOpen || !receipt) return null;

  const handleCopy = (text: string, field: string) => {
    sound.playTap();
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleDownload = () => {
    sound.playSuccess();
    downloadSbpReceiptPdf(receipt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-sm bg-[#0A0A0B] border border-zinc-800 rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            <div>
              <div className="text-sm font-medium text-white">Электронный чек СБП</div>
              <div className="text-xs text-zinc-500 font-mono">{receipt.orderNumber}</div>
            </div>
          </div>
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

        <div className="p-4 overflow-y-auto space-y-3">
          <div className="p-4 rounded-xl bg-white text-black space-y-2">
            <div className="text-xs text-zinc-500 uppercase">Выплачено на счёт</div>
            <div className="text-2xl font-semibold">
              {receipt.fiatAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </div>
            <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
              <span>{receipt.cryptoAmount} {receipt.cryptoSymbol}</span>
              <span>Курс: {receipt.rateUsed.toFixed(2)} ₽</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">ID операции</span>
              <button
                onClick={() => handleCopy(receipt.operationId, 'opId')}
                className="flex items-center gap-1 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                {receipt.operationId} <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">Банк получателя</span>
              <span className="text-xs text-white">{receipt.recipientBank}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">Счёт / номер</span>
              <span className="text-xs font-mono text-white">{receipt.recipientAccount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">Получатель</span>
              <span className="text-xs text-white">{receipt.recipientName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs">Дата и время</span>
              <span className="text-xs font-mono text-white">{receipt.executedAt}</span>
            </div>
          </div>

          {copiedField && (
            <div className="text-center text-xs text-zinc-500">Скопировано</div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Скачать PDF</span>
          </button>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm cursor-pointer transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
