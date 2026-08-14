import React, { useState } from 'react';
import { X, Check, CreditCard, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';
import { PaymentRequisite, BankInfo } from '../types';
import { POPULAR_BANKS } from '../data/mockData';
import { sound } from '../utils/sound';

interface AddRequisiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (requisite: Omit<PaymentRequisite, 'id' | 'createdAt'>) => void;
  initialData?: PaymentRequisite | null;
}

export const AddRequisiteModal: React.FC<AddRequisiteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [selectedBankId, setSelectedBankId] = useState<string>(
    initialData?.bankId || POPULAR_BANKS[0].id
  );
  const [paymentType, setPaymentType] = useState<'sbp' | 'card' | 'yoomoney' | 'kaspi'>(
    initialData?.type || 'sbp'
  );
  const [accountNumber, setAccountNumber] = useState<string>(
    initialData?.accountNumber || ''
  );
  const [recipientName, setRecipientName] = useState<string>(
    initialData?.recipientName || ''
  );
  const [title, setTitle] = useState<string>(
    initialData?.title || ''
  );
  const [isDefault, setIsDefault] = useState<boolean>(
    initialData?.isDefault ?? true
  );
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const currentBank = POPULAR_BANKS.find((b) => b.id === selectedBankId) || POPULAR_BANKS[0];

  const handleBankSelect = (bank: BankInfo) => {
    sound.playTap();
    setSelectedBankId(bank.id);
    setPaymentType(bank.type);
    if (!title || title.startsWith('Мой') || title.startsWith('Карта')) {
      setTitle(`${bank.shortName} (${bank.type === 'sbp' ? 'СБП' : 'Карта'})`);
    }
  };

  const handlePhoneFormat = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setAccountNumber('');
      return;
    }
    let formatted = '+7 ';
    let d = digits;
    if (d.startsWith('7') || d.startsWith('8')) {
      d = d.substring(1);
    }
    if (d.length > 0) formatted += `(${d.substring(0, 3)}`;
    if (d.length >= 3) formatted += `) ${d.substring(3, 6)}`;
    if (d.length >= 6) formatted += `-${d.substring(6, 8)}`;
    if (d.length >= 8) formatted += `-${d.substring(8, 10)}`;
    setAccountNumber(formatted);
  };

  const handleCardFormat = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.substring(i, i + 4));
    }
    setAccountNumber(parts.join(' '));
  };

  const handleSave = () => {
    if (!accountNumber.trim()) {
      setError('Пожалуйста, укажите номер телефона СБП или номер карты');
      return;
    }
    if (!recipientName.trim()) {
      setError('Укажите имя и первую букву фамилии получателя (например, Алексей В.)');
      return;
    }

    sound.playSuccess();
    onSave({
      title: title.trim() || `${currentBank.shortName}`,
      bankId: currentBank.id,
      bankName: currentBank.name,
      type: paymentType,
      accountNumber: accountNumber.trim(),
      recipientName: recipientName.trim(),
      isDefault,
      color: currentBank.color,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        id="add-requisite-modal"
        className="w-full max-w-md bg-[#181818] border border-zinc-800 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">
                {initialData ? 'Редактировать реквизиты' : 'Добавить реквизиты'}
              </h2>
              <p className="text-[10px] text-zinc-400">Для выплат СБП при продаже</p>
            </div>
          </div>

          <button
            id="close-req-modal-btn"
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 space-y-3 overflow-y-auto max-h-[calc(85vh-120px)]">
          {error && (
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              {error}
            </div>
          )}

          {/* Select Bank */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Выберите банк</span>
              <span className="text-[10px] text-[#A3FF12] font-mono">СБП 0%</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {POPULAR_BANKS.map((bank) => {
                const isSelected = selectedBankId === bank.id;
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleBankSelect(bank)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1E2514] border-[#A3FF12]/80 text-[#A3FF12]'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: bank.color }}
                      ></span>
                      {isSelected && <Check className="w-3 h-3 text-[#A3FF12]" />}
                    </div>
                    <span className="text-xs font-bold text-white leading-tight">
                      {bank.shortName}
                    </span>
                    <span className="text-[9px] text-zinc-400 mt-0.5">
                      {bank.type === 'sbp' ? 'СБП' : 'Карта'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account / Phone Number */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1 flex items-center justify-between">
              <span>
                {paymentType === 'sbp'
                  ? 'Номер телефона (СБП)'
                  : paymentType === 'card'
                  ? 'Номер карты'
                  : 'Номер счета'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {paymentType === 'sbp' ? '+7 (XXX) XXX-XX-XX' : '16 цифр'}
              </span>
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                {paymentType === 'sbp' ? (
                  <Smartphone className="w-3.5 h-3.5 text-[#A3FF12]" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5 text-[#A3FF12]" />
                )}
              </div>
              <input
                id="req-account-number-input"
                type="text"
                value={accountNumber}
                onChange={(e) => {
                  setError('');
                  if (paymentType === 'sbp') {
                    handlePhoneFormat(e.target.value);
                  } else if (paymentType === 'card') {
                    handleCardFormat(e.target.value);
                  } else {
                    setAccountNumber(e.target.value);
                  }
                }}
                placeholder={
                  paymentType === 'sbp'
                    ? '+7 (999) 000-00-00'
                    : '2200 0000 0000 0000'
                }
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#A3FF12] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all font-mono font-bold"
              />
            </div>
          </div>

          {/* Recipient Full Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Имя получателя
            </label>
            <input
              id="req-recipient-name-input"
              type="text"
              value={recipientName}
              onChange={(e) => {
                setError('');
                setRecipientName(e.target.value);
              }}
              placeholder="Например: Алексей В."
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#A3FF12] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
            />
          </div>

          {/* Friendly Title */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Название
            </label>
            <input
              id="req-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Основной Т-Банк"
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#A3FF12] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
            />
          </div>

          {/* Is Default Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#A3FF12]" />
              <div>
                <div className="text-xs font-bold text-white">Основной реквизит</div>
                <div className="text-[10px] text-zinc-400">
                  По умолчанию при продаже
                </div>
              </div>
            </div>
            <button
              id="req-is-default-toggle"
              type="button"
              onClick={() => {
                sound.playTap();
                setIsDefault(!isDefault);
              }}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                isDefault ? 'bg-[#A3FF12]' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`bg-black w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                  isDefault ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex gap-2">
          <button
            id="cancel-req-btn"
            type="button"
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            id="save-req-btn"
            type="button"
            onClick={handleSave}
            className="flex-1 py-1.5 px-3 rounded-lg bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Сохранить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
