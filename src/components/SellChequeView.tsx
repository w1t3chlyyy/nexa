import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Zap,
  ArrowRight,
  Clipboard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  Sparkles,
  Layers,
  Check,
  Plus,
  ArrowUpRight,
  Bot,
  FileText,
  ChevronRight,
  Hourglass,
} from 'lucide-react';
import {
  PaymentRequisite,
  UserStats,
  TierInfo,
  Transaction,
  CryptoSymbol,
  ChequeParseResult,
  PdfReceiptData,
} from '../types';
import { SUPPORTED_CRYPTOS, DEMO_CHEQUES, VOLUME_TIERS, getVolumeTier } from '../data/mockData';
import { sound } from '../utils/sound';

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

export const SellChequeView: React.FC<SellChequeViewProps> = ({
  user,
  tier,
  requisites,
  onOpenAddRequisite,
  onTransactionSuccess,
  onOpenReceipt,
  onOpenTelegramBot,
  onOpenPdfReceipt,
}) => {
  const [chequeInput, setChequeInput] = useState<string>('');
  const [selectedRequisiteId, setSelectedRequisiteId] = useState<string>(
    requisites.find((r) => r.isDefault)?.id || requisites[0]?.id || ''
  );
  const [parsedCheque, setParsedCheque] = useState<ChequeParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [activeRecentDeal, setActiveRecentDeal] = useState<number>(0);

  // Проверка чека через backend (CryptoBot API) перед созданием ордера
  const [isValidatingCheque, setIsValidatingCheque] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');

  // Active Pending Order State (for the realistic waiting flow)
  const [activePendingOrder, setActivePendingOrder] = useState<Transaction | null>(null);

  // Keep selected requisite in sync
  useEffect(() => {
    if (!selectedRequisiteId && requisites.length > 0) {
      const def = requisites.find((r) => r.isDefault) || requisites[0];
      setSelectedRequisiteId(def.id);
    }
  }, [requisites, selectedRequisiteId]);

  // Live service payout ticker (USDT payouts)
  const recentDeals = [
    { amount: '150 USDT', rub: '13 927 ₽', bank: 'Сбер СБП', time: '15 сек назад' },
    { amount: '300 USDT', rub: '27 855 ₽', bank: 'Т-Банк СБП', time: '40 сек назад' },
    { amount: '50 USDT', rub: '4 642 ₽', bank: 'Альфа СБП', time: '1 мин назад' },
    { amount: '1 200 USDT', rub: '112 560 ₽', bank: 'ВТБ СБП', time: '2 мин назад' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRecentDeal((prev) => (prev + 1) % recentDeals.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [recentDeals.length]);

  // Parse Cheque URL/Code automatically
  useEffect(() => {
    if (!chequeInput.trim()) {
      setParsedCheque(null);
      return;
    }

    const input = chequeInput.trim();
    let code = input;
    if (input.includes('start=')) {
      const match = input.match(/start=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        code = match[1];
      }
    }

    const demo = DEMO_CHEQUES.find((d) => d.code === input || d.code.includes(code));
    if (demo) {
      setParsedCheque({
        rawUrl: input,
        chequeCode: code,
        isValid: true,
        cryptoSymbol: demo.symbol,
        cryptoAmount: demo.amount,
        creator: '@cryptobot_pool',
        expiresIn: '72 часа',
        passwordProtected: false,
      });
      return;
    }

    if (code.length >= 8) {
      let amount = 50;
      if (code.toLowerCase().includes('whale') || code.toLowerCase().includes('2500')) {
        amount = 2500;
      } else if (code.toLowerCase().includes('1000') || code.toLowerCase().includes('vip')) {
        amount = 1000;
      } else if (code.toLowerCase().includes('300')) {
        amount = 300;
      } else if (code.toLowerCase().includes('150')) {
        amount = 150;
      }

      setParsedCheque({
        rawUrl: input,
        chequeCode: code,
        isValid: true,
        cryptoSymbol: 'USDT',
        cryptoAmount: amount,
        creator: '@telegram_seller',
        expiresIn: '48 часов',
        passwordProtected: false,
      });
    } else {
      setParsedCheque({
        rawUrl: input,
        chequeCode: code,
        isValid: false,
        errorMessage: 'Некорректный код чека. Вставьте полную ссылку или код.',
      });
    }
  }, [chequeInput]);

  // Сбрасываем ошибку проверки чека при изменении ввода
  useEffect(() => {
    setValidationError('');
  }, [chequeInput]);

  const handlePasteClipboard = async () => {
    try {
      sound.playTap();
      const text = await navigator.clipboard.readText();
      if (text) {
        setChequeInput(text);
      }
    } catch {
      // Fallback
      setChequeInput('t.me/CryptoBot?start=CQ81aFk99201a');
    }
  };

  const handleApplyDemo = (demoCode: string) => {
    sound.playTap();
    setChequeInput(demoCode);
  };

  const selectedRequisite =
    requisites.find((r) => r.id === selectedRequisiteId) || requisites[0];

  const currentCrypto =
    SUPPORTED_CRYPTOS.find((c) => c.symbol === (parsedCheque?.cryptoSymbol || 'USDT')) ||
    SUPPORTED_CRYPTOS[0];

  const estimatedCryptoAmount = parsedCheque?.cryptoAmount || currentCrypto.minAmount || 50;
  const estimatedAmountUsd = estimatedCryptoAmount * currentCrypto.priceUsd;
  const activeVolumeTier = getVolumeTier(estimatedAmountUsd);

  const baseRate = currentCrypto.priceRub;
  const volumeBonusMultiplier = 1 + activeVolumeTier.rateBonusPercent / 100;
  const tierBonusMultiplier = 1 + tier.rateBonus / 100;
  const totalBonusPercent = activeVolumeTier.rateBonusPercent + tier.rateBonus;
  const effectiveRate = Number((baseRate * volumeBonusMultiplier * tierBonusMultiplier).toFixed(2));
  const estimatedPayoutRub = Math.round(estimatedCryptoAmount * effectiveRate);
  const basePayoutRub = Math.round(estimatedCryptoAmount * baseRate);
  const rateBonusGainRub = estimatedPayoutRub - basePayoutRub;

  // Realistic Execution & Waiting Process.
  // Шаг 0: проверяем чек через backend (CryptoBot API), и только затем создаём ордер.
  const handleExecuteCashout = async () => {
    if (!parsedCheque || !parsedCheque.isValid || !selectedRequisite) return;

    sound.playTap();
    setValidationError('');
    setIsValidatingCheque(true);

    try {
      const resp = await fetch('/api/validate-cheque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: parsedCheque.rawUrl }),
      });
      const result = await resp.json();
      setIsValidatingCheque(false);

      if (!result.ok) {
        setValidationError(result.error || 'Чек не прошел проверку CryptoBot');
        return;
      }
    } catch {
      setIsValidatingCheque(false);
      setValidationError('Не удалось связаться с сервером проверки чеков');
      return;
    }

    setIsProcessing(true);
    setProcessingStage(1);

    // Step 1: Verify and lock cheque with CryptoBot service (1.2s)
    setTimeout(() => {
      setProcessingStage(2);
      sound.playTap();
    }, 1200);

    // Step 2: Push to SBP Queue and create Order in state (2.2s)
    setTimeout(() => {
      setProcessingStage(3);
      sound.playTap();

      const createdPendingTx: Transaction = {
        id: `tx_${Math.floor(100000 + Math.random() * 900000)}`,
        date: 'Только что',
        cryptoSymbol: parsedCheque.cryptoSymbol || 'USDT',
        cryptoAmount: estimatedCryptoAmount,
        fiatCurrency: 'RUB',
        fiatAmount: estimatedPayoutRub,
        rateUsed: effectiveRate,
        volumeBonusPercent: activeVolumeTier.rateBonusPercent,
        tierBonusPercent: tier.rateBonus,
        chequeCode: parsedCheque.chequeCode,
        status: 'pending',
        requisite: selectedRequisite,
        payoutTxId: `SBP_RUR_${Math.floor(100000000 + Math.random() * 900000000)}`,
        timeTakenSeconds: 30,
        cashbackEarned: Number(
          (
            estimatedCryptoAmount *
            currentCrypto.priceUsd *
            (tier.cashbackPercent / 100)
          ).toFixed(2)
        ),
        xpEarned: Math.round(
          estimatedCryptoAmount * (currentCrypto.symbol === 'NOT' ? 0.001 : 0.8) + 40
        ),
      };

      setActivePendingOrder(createdPendingTx);
      onTransactionSuccess(createdPendingTx);
      setChequeInput('');
      setParsedCheque(null);
    }, 2200);
  };

  // Instant simulation helper for immediate operator payout
  const handleSimulateInstantFulfillment = () => {
    if (!activePendingOrder) return;
    sound.playCashout();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a3e635', '#bef264', '#ffffff', '#10b981'],
      });
    } catch {
      // Ignore
    }

    const completedTx: Transaction = {
      ...activePendingOrder,
      status: 'completed',
    };

    setActivePendingOrder(null);
    setIsProcessing(false);
    onOpenReceipt(completedTx);
  };

  return (
    <div id="sell-cheque-view" className="space-y-3 pb-20 select-none">
      {/* Active Pending Order Notice Card (if an order is in waiting queue) */}
      {activePendingOrder && (
        <div className="p-3.5 rounded-2xl bg-[#181818] border border-amber-400/50 shadow-xl space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <Hourglass className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-bold text-white">
                  Заявка #{activePendingOrder.id} в обработке
                </span>
                <p className="text-[10px] text-amber-400 font-mono">
                  Ожидает выплаты оператором СБП
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-extrabold text-[#A3FF12] font-mono">
                {activePendingOrder.fiatAmount.toLocaleString('ru-RU')} ₽
              </span>
              <div className="text-[9px] text-zinc-400">~ 1-3 мин</div>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[10.5px] space-y-1 text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Банк СБП:</span>
              <span className="text-white font-medium">{activePendingOrder.requisite.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Счет / Номер:</span>
              <span className="text-[#A3FF12] font-mono font-bold">{activePendingOrder.requisite.accountNumber}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-0.5">
            {onOpenTelegramBot && (
              <button
                onClick={() => {
                  sound.playTap();
                  onOpenTelegramBot();
                }}
                className="flex-1 py-1.5 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-400/30 text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Открыть бота (для оператора)</span>
              </button>
            )}

            <button
              onClick={handleSimulateInstantFulfillment}
              className="py-1.5 px-3 rounded-xl bg-[#A3FF12] hover:bg-[#bef264] text-black text-[10.5px] font-extrabold flex items-center justify-center gap-1 cursor-pointer shadow-sm"
              title="Симуляция: мгновенно подтвердить перевод"
            >
              <Zap className="w-3 h-3 fill-black" />
              <span>Выплатить</span>
            </button>
          </div>
        </div>
      )}

      {/* Live deals ticker */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-2 h-2 rounded-full bg-[#A3FF12] animate-pulse flex-shrink-0"></span>
          <span className="text-zinc-400 text-[11px] truncate flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-[#A3FF12] flex-shrink-0" />
            <span>Выплата:</span>
            <span className="text-[#A3FF12] font-mono font-bold">
              {recentDeals[activeRecentDeal].amount}
            </span>
            <span>({recentDeals[activeRecentDeal].rub})</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300">{recentDeals[activeRecentDeal].bank}</span>
          </span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap ml-2">
          {recentDeals[activeRecentDeal].time}
        </span>
      </div>

      {/* Cheque Input & Sell Card (White High-Contrast Block) */}
      <div className="p-4 rounded-2xl bg-white text-zinc-950 border border-zinc-200 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black text-[#A3FF12] flex items-center justify-center shadow-xs">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-950 tracking-tight">Продажа чека</h2>
              <p className="text-[11px] text-zinc-500 font-medium">Мгновенный выкуп CryptoBot & Send</p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-300 text-xs font-mono text-zinc-900">
            <span className="text-zinc-500 text-[10px]">Бонус:</span>
            <span className="font-bold text-emerald-600">+{totalBonusPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Input box */}
        <div className="space-y-1.5">
          <div className="relative">
            <input
              id="cheque-link-input"
              type="text"
              value={chequeInput}
              onChange={(e) => setChequeInput(e.target.value)}
              placeholder="t.me/CryptoBot?start=CQ..."
              className="w-full pl-3 pr-20 py-2.5 rounded-xl bg-zinc-100 border border-zinc-300 focus:border-zinc-950 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 outline-none font-mono text-xs text-zinc-950 placeholder-zinc-400 transition-all font-semibold"
            />

            <div className="absolute inset-y-1 right-1 flex items-center">
              {chequeInput ? (
                <button
                  id="clear-cheque-input-btn"
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    setChequeInput('');
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 rounded-lg bg-zinc-200 hover:bg-zinc-300 transition-colors cursor-pointer"
                >
                  Очистить
                </button>
              ) : (
                <button
                  id="paste-cheque-btn"
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-2.5 py-1 text-[11px] font-bold text-black bg-[#A3FF12] hover:bg-[#bef264] rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Вставить</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Demo Cheques */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
            <span className="text-[10px] text-zinc-500 font-semibold flex-shrink-0">Тест:</span>
            {DEMO_CHEQUES.map((demo, idx) => (
              <button
                key={idx}
                id={`demo-cheque-${idx}`}
                type="button"
                onClick={() => handleApplyDemo(demo.code)}
                className="px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[10px] font-semibold text-zinc-800 border border-zinc-300 hover:border-zinc-400 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
              >
                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                <span>{demo.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calculation / Rate Preview */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-600 font-medium">Отдаете по чеку:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-950 font-mono font-black text-sm">
                {estimatedCryptoAmount} {currentCrypto.symbol}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                (≈ ${estimatedAmountUsd.toFixed(2)})
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
            <div>
              <span className="text-xs text-zinc-600 font-medium">Получаете на карту:</span>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Курс: <span className="text-zinc-900 font-mono font-bold">{effectiveRate} ₽</span>{' '}
                {rateBonusGainRub > 0 && (
                  <span className="text-emerald-700 ml-1 font-mono font-semibold">
                    (+{rateBonusGainRub.toLocaleString('ru-RU')} ₽)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black font-mono text-zinc-950 tracking-tight">
                {estimatedPayoutRub.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">СБП 0% комиссия</span>
            </div>
          </div>
        </div>

        {/* Cheque Info Validated State */}
        {parsedCheque && parsedCheque.isValid && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold text-[11px] block">Чек проверен и готов к выплате</span>
                <span className="text-[10px] text-emerald-700 font-mono">
                  Код: {parsedCheque.chequeCode}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-emerald-900 font-mono">
                {parsedCheque.cryptoAmount} {parsedCheque.cryptoSymbol}
              </span>
            </div>
          </div>
        )}

        {/* Cheque Validation Error (from CryptoBot API check) */}
        {validationError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Requisites Selection Card */}
      <div className="p-4 rounded-2xl bg-[#181818] border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/30 flex items-center justify-center text-[#A3FF12]">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Реквизиты для выплаты</h3>
              <p className="text-[10px] text-zinc-400">СБП переводы в любые банки РФ</p>
            </div>
          </div>

          <button
            id="add-requisite-btn-sell-view"
            type="button"
            onClick={() => {
              sound.playTap();
              onOpenAddRequisite();
            }}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#A3FF12] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-zinc-700"
          >
            <Plus className="w-3 h-3" />
            <span>Добавить</span>
          </button>
        </div>

        {requisites.length === 0 ? (
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700 text-center space-y-2">
            <p className="text-xs text-zinc-400">У вас пока нет сохраненных реквизитов СБП</p>
            <button
              type="button"
              onClick={onOpenAddRequisite}
              className="px-3 py-1.5 rounded-lg bg-[#A3FF12] text-black text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить карту / СБП</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {requisites.map((req) => (
              <div
                key={req.id}
                onClick={() => {
                  sound.playTap();
                  setSelectedRequisiteId(req.id);
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedRequisiteId === req.id
                    ? 'bg-zinc-900 border-[#A3FF12] shadow-sm'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: `${req.color}20`,
                      color: req.color,
                      border: `1px solid ${req.color}40`,
                    }}
                  >
                    {req.type === 'sbp' ? 'СБП' : 'МИР'}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{req.bankName}</span>
                      {req.isDefault && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-[#A3FF12] font-semibold">
                          Основной
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-300">{req.accountNumber}</div>
                    <div className="text-[10px] text-zinc-500">{req.recipientName}</div>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                    selectedRequisiteId === req.id
                      ? 'border-[#A3FF12] bg-[#A3FF12] text-black'
                      : 'border-zinc-700 bg-transparent'
                  }`}
                >
                  {selectedRequisiteId === req.id && <Check className="w-2.5 h-2.5" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Perks & Guarantees */}
      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
        <div className="p-2 bg-[#181818] rounded-xl border border-zinc-800">
          <Clock className="w-3.5 h-3.5 text-[#A3FF12] mx-auto mb-1" />
          <p className="font-bold text-white text-[11px]">{tier.payoutSpeedText}</p>
          <p className="text-[9px] text-zinc-400">СБП авто</p>
        </div>

        <div className="p-2 bg-[#181818] rounded-xl border border-zinc-800">
          <ShieldCheck className="w-3.5 h-3.5 text-[#A3FF12] mx-auto mb-1" />
          <p className="font-bold text-white text-[11px]">0% Комиссия</p>
          <p className="text-[9px] text-zinc-400">Без скрытых плат</p>
        </div>

        <div className="p-2 bg-[#181818] rounded-xl border border-zinc-800">
          <Sparkles className="w-3.5 h-3.5 text-[#A3FF12] mx-auto mb-1" />
          <p className="font-bold text-white text-[11px]">+{tier.cashbackPercent}% Кэшбэк</p>
          <p className="text-[9px] text-zinc-400">USDT бонус</p>
        </div>
      </div>

      {/* Main Action Button */}
      <div>
        <button
          id="execute-cashout-btn"
          type="button"
          disabled={
            !parsedCheque ||
            !parsedCheque.isValid ||
            requisites.length === 0 ||
            isProcessing ||
            isValidatingCheque
          }
          onClick={handleExecuteCashout}
          className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
            !parsedCheque || !parsedCheque.isValid || requisites.length === 0
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              : 'bg-[#A3FF12] hover:bg-[#bef264] active:scale-[0.99] text-black cursor-pointer shadow-[#A3FF12]/20'
          }`}
        >
          {isValidatingCheque ? (
            <span>Проверка чека в CryptoBot...</span>
          ) : requisites.length === 0 ? (
            'Добавьте реквизиты'
          ) : !parsedCheque ? (
            'Вставьте ссылку на чек'
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>Вывести {estimatedPayoutRub.toLocaleString('ru-RU')} ₽</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Transaction Processing Modal with Live Realistic Queue */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#181818] border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-3.5 text-center">
            <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[#A3FF12] border-t-transparent animate-spin"></div>
              <Zap className="w-5 h-5 text-[#A3FF12] fill-[#A3FF12] animate-pulse" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Создание заявки на вывод</h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {parsedCheque?.cryptoAmount} {parsedCheque?.cryptoSymbol} →{' '}
                {estimatedPayoutRub.toLocaleString('ru-RU')} ₽
              </p>
            </div>

            <div className="space-y-2 text-left text-xs bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2">
                {processingStage >= 1 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 flex-shrink-0" />
                )}
                <span
                  className={processingStage >= 1 ? 'text-white font-medium' : 'text-zinc-500'}
                >
                  1. Проверка и фиксация чека в CryptoBot
                </span>
              </div>

              <div className="flex items-center gap-2">
                {processingStage >= 2 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 flex-shrink-0" />
                )}
                <span
                  className={processingStage >= 2 ? 'text-white font-medium' : 'text-zinc-500'}
                >
                  2. Резервирование курса ({effectiveRate} ₽)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {processingStage >= 3 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 flex-shrink-0" />
                )}
                <span
                  className={processingStage >= 3 ? 'text-amber-300 font-bold' : 'text-zinc-500'}
                >
                  3. Передано операторам в очередь СБП...
                </span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500">
              Заявка фиксируется в системе. Выплаты производятся операторами по СБП с формированием PDF-чека.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
