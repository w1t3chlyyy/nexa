import React, { useState } from 'react';
import { X, Check, Smartphone, CreditCard } from 'lucide-react';
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
  const [selectedBankId, setSelectedBankId] = useState<string>(initialData?.bankId || POPULAR_BANKS[0].id);
  const [paymentType, setPaymentType] = useState<'sbp' | 'card' | 'yoomoney' | 'kaspi'>(initialData?.type || 'sbp');
  const [accountNumber, setAccountNumber] = useState<string>(initialData?.accountNumber || '');
  const [recipientName, setRecipientName] = useState<string>(initialData?.recipientName || '');
  const [title, setTitle] = useState<string>(initialData?.title || '');
  const [isDefault, setIsDefault] = useState<boolean>(initialData?.isDefault ?? true);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const currentBank = POPULAR_BANKS.find((b) => b.id === selectedBankId) || POPULAR_BANKS[0];

  const handleBankSelect = (bank: BankInfo) => {
    sound.playTap();
    setSelectedBankId(bank.id);
    setPaymentType(bank.type);
    if (!title) setTitle(bank.shortName);
  };

  const handlePhoneFormat = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setAccountNumber('');
      return;
    }
    let formatted = '+7 ';
    let d = digits;
    if (d.startsWith('7') || d.startsWith('8')) d = d.substring(1);
    if (d.length > 0) formatted += `(${d.substring(0, 3)}`;
    if (d.length >= 3) formatted += `) ${d.substring(3, 6)}`;
    if (d.length >= 6) formatted += `-${d.substring(6, 8)}`;
    if (d.length >= 8) formatted += `-${d.substring(8, 10)}`;
    setAccountNumber(formatted);
  };

  const handleCardFormat = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) parts.push(digits.substring(i, i + 4));
    setAccountNumber(parts.join(' '));
  };

  const handleSave = () => {
    if (!accountNumber.trim()) {
      setError('Укажите номер СБП или карты');
      return;
    }
    if (!recipientName.trim()) {
      setError('Укажите имя получателя');
      return;
    }

    sound.playSuccess();
    onSave({
      title: title.trim() || currentBank.shortName,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80">
      <div className="w-full max-w-md bg-[#141415] border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">
            {initialData ? 'Редактировать реквизит' : 'Добавить реквизит'}
          </h2>
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

        <div className="p-4 space-y-4 overflow-y-auto">
          {error && <div className="text-xs text-rose-400">{error}</div>}

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Банк</label>
            <div className="grid grid-cols-3 gap-1.5">
              {POPULAR_BANKS.map((bank) => {
                const isSelected = selectedBankId === bank.id;
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleBankSelect(bank)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      isSelected ? 'border-zinc-500 bg-black/30' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs text-white leading-tight block">{bank.shortName}</span>
                    <span className="text-[10px] text-zinc-500">{bank.type === 'sbp' ? 'СБП' : 'Карта'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">
              {paymentType === 'sbp' ? 'Номер телефона (СБП)' : 'Номер карты'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-600">
                {paymentType === 'sbp' ? <Smartphone className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => {
                  setError('');
                  if (paymentType === 'sbp') handlePhoneFormat(e.target.value);
                  else if (paymentType === 'card') handleCardFormat(e.target.value);
                  else setAccountNumber(e.target.value);
                }}
                placeholder={paymentType === 'sbp' ? '+7 (999) 000-00-00' : '2200 0000 0000 0000'}
                className="w-full bg-black/30 border border-zinc-800 focus:border-zinc-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Имя получателя</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => {
                setError('');
                setRecipientName(e.target.value);
              }}
              placeholder="Алексей В."
              className="w-full bg-black/30 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Основной Т-Банк"
              className="w-full bg-black/30 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setIsDefault(!isDefault);
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-black/30 border border-zinc-800 cursor-pointer"
          >
            <span className="text-xs text-zinc-300">Использовать по умолчанию</span>
            <div className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${isDefault ? 'bg-[#A3FF12]' : 'bg-zinc-800'}`}>
              <div className={`bg-black w-3.5 h-3.5 rounded-full transform transition-transform ${isDefault ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sm text-zinc-300 cursor-pointer transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[#A3FF12] hover:bg-[#b2ff33] text-sm font-medium text-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Сохранить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
