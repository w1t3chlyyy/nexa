import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Check,
  Building2,
  Plus,
  Bot,
  Hourglass,
} from 'lucide-react';
import {
  PaymentRequisite,
  UserStats,
  TierInfo,
  Transaction,
  PdfReceiptData,
  ValidatedCheque,
} from '../types';
import { SUPPORTED_CRYPTOS, getVolumeTier } from '../data/mockData';
import { sound } from '../utils/sound';
import { supabase } from '../lib/supabase';

interface SellChequeViewProps {
  user: UserStats;
  tier: TierInfo;
  requisites: PaymentRequisite[];
  onOpenAddRequisite: () => void;
  onTransactionSuccess: (tx: Transaction) => void;
  onOpenReceipt: (tx: Transaction) => void;
  onOpenTelegramBot?: () => void;
  onOpenPdfReceipt?: (receipt: PdfReceiptData) => void;
}

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

export const SellChequeView: React.FC<SellChequeViewProps> = ({
  user,
  tier,
  requisites,
  onOpenAddRequisite,
  onTransactionSuccess,
  onOpenReceipt,
  onOpenTelegramBot,
}) => {
  const [chequeInput, setChequeInput] = useState<string>('');
  const [selectedRequisiteId, setSelectedRequisiteId] = useState<string>(
    requisites.find((r) => r.isDefault)?.id || requisites[0]?.id || ''
  );

  // Реальная проверка чека через /api/validate-cheque (CryptoBot API).
  // Сумма и валюта берутся ТОЛЬКО из ответа сервера — никаких догадок по тексту кода.
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [validatedCheque, setValidatedCheque] = useState<ValidatedCheque | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [activePendingOrder, setActivePendingOrder] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!selectedRequisiteId && requisites.length > 0) {
      const def = requisites.find((r) => r.isDefault) || requisites[0];
      setSelectedRequisiteId(def.id);
    }
  }, [requisites, selectedRequisiteId]);

  // Сброс проверки при изменении ввода
  useEffect(() => {
    setValidation('idle');
    setValidatedCheque(null);
    setValidationError('');
  }, [chequeInput]);

  // Опрос статуса заказа в Supabase, пока он в очереди.
  // Как только оператор проставит orders.status = 'paid', заказ закроется автоматически.
  useEffect(() => {
    if (!activePendingOrder || !supabase) return;
    const orderNumber = `ORD-${activePendingOrder.id.substring(0, 8)}`;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('status, payout_tx_id')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (data?.status === 'paid') {
        clearInterval(interval);
        sound.playCashout();
        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 }, colors: ['#a3e635', '#ffffff'] });
        } catch {
          // ignore
        }
        const completedTx: Transaction = {
          ...activePendingOrder,
          status: 'completed',
          payoutTxId: data.payout_tx_id || activePendingOrder.payoutTxId,
        };
        setActivePendingOrder(null);
        setIsProcessing(false);
        onOpenReceipt(completedTx);
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePendingOrder]);

  const selectedRequisite = requisites.find((r) => r.id === selectedRequisiteId) || requisites[0];

  const currentCrypto =
    SUPPORTED_CRYPTOS.find((c) => c.symbol === validatedCheque?.cryptoSymbol) || SUPPORTED_CRYPTOS[0];

  const amount = validatedCheque?.cryptoAmount || 0;
  const amountUsd = amount * currentCrypto.priceUsd;
  const activeVolumeTier = getVolumeTier(amountUsd);
  const totalBonusPercent = activeVolumeTier.rateBonusPercent + tier.rateBonus;
  const effectiveRate = Number(
    (currentCrypto.priceRub * (1 + totalBonusPercent / 100)).toFixed(2)
  );
  const estimatedPayoutRub = Math.round(amount * effectiveRate);

  const handleValidate = async () => {
    if (!chequeInput.trim()) return;
    sound.playTap();
    setValidation('checking');
    setValidationError('');

    try {
      const resp = await fetch('/api/validate-cheque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: chequeInput.trim() }),
      });
      const result = await resp.json();

      if (!result.ok) {
        setValidation('invalid');
        setValidationError(result.error || 'Чек не прошёл проверку CryptoBot');
        return;
      }

      setValidatedCheque({
        code: chequeInput.trim(),
        checkId: result.checkId,
        cryptoSymbol: result.asset,
        cryptoAmount: parseFloat(result.amount),
      });
      setValidation('valid');
    } catch {
      setValidation('invalid');
      setValidationError('Не удалось связаться с сервером проверки чеков');
    }
  };

  const handleExecuteCashout = () => {
    if (validation !== 'valid' || !validatedCheque || !selectedRequisite) return;

    sound.playTap();
    setIsProcessing(true);
    setProcessingStage(1);

    setTimeout(() => {
      setProcessingStage(2);
      sound.playTap();

      const createdPendingTx: Transaction = {
        id: `tx_${Math.floor(100000 + Math.random() * 900000)}`,
        date: 'Только что',
        cryptoSymbol: validatedCheque.cryptoSymbol,
        cryptoAmount: validatedCheque.cryptoAmount,
        fiatCurrency: 'RUB',
        fiatAmount: estimatedPayoutRub,
        rateUsed: effectiveRate,
        volumeBonusPercent: activeVolumeTier.rateBonusPercent,
        tierBonusPercent: tier.rateBonus,
        chequeCode: validatedCheque.code,
        status: 'pending',
        requisite: selectedRequisite,
        cashbackEarned: Number(
          (amount * currentCrypto.priceUsd * (tier.cashbackPercent / 100)).toFixed(2)
        ),
        xpEarned: Math.round(amount * 0.8 + 40),
      };

      setActivePendingOrder(createdPendingTx);
      onTransactionSuccess(createdPendingTx);
      setChequeInput('');
      setValidation('idle');
      setValidatedCheque(null);
    }, 1400);
  };

  return (
    <div id="sell-cheque-view" className="space-y-3 pb-24 select-none">
      {/* Pending order status — реальный опрос, без фейковой мгновенной выплаты */}
      {activePendingOrder && (
        <div className="p-4 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Hourglass className="w-3.5 h-3.5 animate-spin" />
              <span>Заявка ожидает оператора</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {activePendingOrder.fiatAmount.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className="text-xs text-zinc-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Банк</span>
              <span className="text-zinc-300">{activePendingOrder.requisite.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span>Счёт</span>
              <span className="text-zinc-300 font-mono">{activePendingOrder.requisite.accountNumber}</span>
            </div>
          </div>

          {onOpenTelegramBot && (
            <button
              onClick={() => {
                sound.playTap();
                onOpenTelegramBot();
              }}
              className="w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Открыть бота для оператора</span>
            </button>
          )}
        </div>
      )}

      {/* Ввод и проверка чека */}
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Продать чек</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Ссылка на чек CryptoBot или Send</p>
        </div>

        <div className="space-y-2">
          <input
            id="cheque-link-input"
            type="text"
            value={chequeInput}
            onChange={(e) => setChequeInput(e.target.value)}
            placeholder="t.me/CryptoBot?start=CQ..."
            className="w-full px-3.5 py-3 rounded-xl bg-black/30 border border-zinc-800 focus:border-zinc-600 outline-none text-sm text-white placeholder-zinc-600 transition-colors font-mono"
          />

          <button
            id="validate-cheque-btn"
            type="button"
            disabled={!chequeInput.trim() || validation === 'checking'}
            onClick={handleValidate}
            className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {validation === 'checking' ? 'Проверяем в CryptoBot…' : 'Проверить чек'}
          </button>
        </div>

        {validation === 'invalid' && validationError && (
          <div className="text-xs text-rose-400">{validationError}</div>
        )}

        {validation === 'valid' && validatedCheque && (
          <div className="p-3.5 rounded-xl bg-black/30 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Чек подтверждён</span>
              <span className="text-white font-medium">
                {validatedCheque.cryptoAmount} {validatedCheque.cryptoSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800">
              <span className="text-sm text-zinc-500">К выплате</span>
              <span className="text-lg font-semibold text-[#A3FF12]">
                {estimatedPayoutRub.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              Курс {effectiveRate} ₽ · бонус +{totalBonusPercent.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Реквизиты */}
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-white">Реквизиты для выплаты</h3>
          </div>
          <button
            id="add-requisite-btn-sell-view"
            type="button"
            onClick={() => {
              sound.playTap();
              onOpenAddRequisite();
            }}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </div>

        {requisites.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center space-y-2">
            <p className="text-xs text-zinc-500">Нет сохранённых реквизитов СБП</p>
            <button
              type="button"
              onClick={onOpenAddRequisite}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-black text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {requisites.map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => {
                  sound.playTap();
                  setSelectedRequisiteId(req.id);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  selectedRequisiteId === req.id
                    ? 'border-zinc-500 bg-black/20'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="text-sm text-white">{req.bankName}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">{req.accountNumber}</div>
                </div>
                {selectedRequisiteId === req.id && <Check className="w-4 h-4 text-[#A3FF12] flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        0% комиссия · выплата по СБП · {tier.payoutSpeedText}
      </p>

      <button
        id="execute-cashout-btn"
        type="button"
        disabled={validation !== 'valid' || requisites.length === 0 || isProcessing}
        onClick={handleExecuteCashout}
        className="w-full py-3.5 rounded-xl bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        <span>
          {requisites.length === 0
            ? 'Добавьте реквизиты'
            : validation === 'valid'
            ? `Вывести ${estimatedPayoutRub.toLocaleString('ru-RU')} ₽`
            : 'Сначала проверьте чек'}
        </span>
        {validation === 'valid' && <ArrowRight className="w-4 h-4" />}
      </button>

      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm bg-[#141415] border border-zinc-800 rounded-2xl p-6 space-y-4 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-zinc-800 border-t-white animate-spin" />
            <div>
              <h3 className="text-sm font-medium text-white">Создание заявки</h3>
              <p className="text-xs text-zinc-500 mt-1">
                {estimatedPayoutRub.toLocaleString('ru-RU')} ₽ будет отправлено на реквизиты
              </p>
            </div>
            <div className="space-y-2 text-left text-xs">
              <div className={`flex items-center gap-2 ${processingStage >= 1 ? 'text-white' : 'text-zinc-600'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${processingStage >= 1 ? 'bg-[#A3FF12]' : 'bg-zinc-700'}`} />
                <span>Резервирование курса</span>
              </div>
              <div className={`flex items-center gap-2 ${processingStage >= 2 ? 'text-white' : 'text-zinc-600'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${processingStage >= 2 ? 'bg-[#A3FF12]' : 'bg-zinc-700'}`} />
                <span>Передано оператору СБП</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
