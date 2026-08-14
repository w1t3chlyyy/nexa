import React from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  Building,
  ShieldCheck,
  X,
  ExternalLink,
  Copy,
  Clock,
  ArrowDownToLine,
  Share2,
} from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        id="pdf-receipt-modal"
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight">
                Электронный чек СБП
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                {receipt.orderNumber}
              </p>
            </div>
          </div>

          <button
            id="close-pdf-modal"
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 bg-zinc-950">
          {/* Main Status & Amount Card */}
          <div className="p-3.5 rounded-xl bg-white text-zinc-950 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>ОПЕРАЦИЯ ИСПОЛНЕНА</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                СБП 0%
              </span>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-medium">
                Выплачено на счет
              </span>
              <div className="text-2xl font-black text-zinc-950 font-mono tracking-tight">
                {receipt.fiatAmount.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                })}{' '}
                ₽
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-700">
              <span>
                Продано: <strong>{receipt.cryptoAmount} {receipt.cryptoSymbol}</strong>
              </span>
              <span className="font-mono text-zinc-500">
                Курс: {receipt.rateUsed.toFixed(2)} ₽
              </span>
            </div>
          </div>

          {/* Details list */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 text-[11px]">ID операции СБП:</span>
              <div className="flex items-center gap-1">
                <span className="text-white font-mono text-[11px]">
                  {receipt.operationId}
                </span>
                <button
                  onClick={() => handleCopy(receipt.operationId, 'opId')}
                  className="text-zinc-400 hover:text-[#A3FF12] cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 text-[11px]">Банк получателя:</span>
              <span className="text-white font-semibold text-[11px]">
                {receipt.recipientBank}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 text-[11px]">Номер / Счет:</span>
              <span className="text-[#A3FF12] font-mono font-bold text-[11px]">
                {receipt.recipientAccount}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 text-[11px]">Получатель:</span>
              <span className="text-white font-medium text-[11px]">
                {receipt.recipientName}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 text-[11px]">Банк отправителя:</span>
              <span className="text-zinc-300 text-[10px] text-right">
                {receipt.senderBank}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">Дата и время:</span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {receipt.executedAt}
              </span>
            </div>
          </div>

          {/* Official Bank Stamp Visualization */}
          <div className="p-3 rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-950/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-400/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-[10px] leading-tight text-blue-200">
              <div className="font-bold uppercase tracking-wider text-blue-300">
                Штамп банка: Исполнено СБП
              </div>
              <div className="text-zinc-400 mt-0.5 font-mono">
                НСПК Референс: {receipt.sbpTransactionRef}
              </div>
              <div className="text-zinc-500 mt-0.5">
                Оператор: {receipt.operatorName}
              </div>
            </div>
          </div>

          {copiedField && (
            <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-700/50 text-emerald-300 text-center text-[10px]">
              Скопировано в буфер обмена!
            </div>
          )}
        </div>

          {/* Action Footer */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2">
          <button
            id="btn-download-pdf"
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b8ff33] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#A3FF12]/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Скачать PDF чек</span>
          </button>

          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
