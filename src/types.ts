export type CryptoSymbol = 'USDT' | 'TON' | 'BTC' | 'ETH' | 'NOT' | 'DOGS' | 'SOL' | 'TRX' | 'LTC';

export type FiatCurrency = 'RUB' | 'USD' | 'KZT' | 'UAH' | 'EUR';

export interface CryptoInfo {
  symbol: CryptoSymbol;
  name: string;
  network: string;
  priceUsd: number;
  priceRub: number;
  change24h: number;
  iconBg: string;
  iconColor: string;
  decimals: number;
  minAmount: number;
}

export type PaymentType = 'sbp' | 'card' | 'wallet' | 'yoomoney' | 'kaspi';

export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  bg: string;
  iconName: string;
  type: PaymentType;
}

export interface PaymentRequisite {
  id: string;
  title: string;
  bankId: string;
  bankName: string;
  type: PaymentType;
  accountNumber: string; // Номер телефона для СБП или номер карты
  recipientName: string;
  isDefault: boolean;
  color: string;
  createdAt: string;
}

export type RatingTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface TierInfo {
  tier: RatingTier;
  title: string;
  minXp: number;
  color: string;
  rateBonus: number; // e.g. +0.45%
  cashbackPercent: number; // e.g. 0.4%
  payoutSpeedText: string;
  features: string[];
}

export interface VolumeTier {
  id: string;
  minUsd: number;
  maxUsd: number;
  title: string;
  rateBonusPercent: number; // e.g. +0.7%
  badge: string;
  description: string;
}

export interface UserStats {
  id: string;
  telegramId: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  isPremium: boolean;
  isVerified: boolean;
  rating: number; // e.g. 4.98
  totalReviews: number;
  tier: RatingTier;
  xp: number;
  xpToNextTier: number;
  completedDeals: number;
  successRate: number; // 99.8%
  totalVolumeUsd: number;
  totalVolumeRub: number;
  avgSpeedSeconds: number; // 38 секунд
  joinedDate: string;
  streakDays: number;
  streakClaimedToday: boolean;
  referralCode: string;
  referralsCount: number;
  referralEarningsUsdt: number;
  dailyDealsCount: number;
  lastDailyResetDate?: string;
}

export type TransactionStatus = 'pending' | 'verifying_cheque' | 'sending_payout' | 'completed' | 'failed' | 'cancelled';

export interface PdfReceiptData {
  id: string;
  operationId: string;
  orderNumber: string;
  date: string;
  senderBank: string;
  recipientBank: string;
  recipientAccount: string;
  recipientName: string;
  fiatAmount: number;
  cryptoAmount: number;
  cryptoSymbol: CryptoSymbol;
  rateUsed: number;
  status: 'EXECUTED';
  executedAt: string;
  operatorName: string;
  sbpTransactionRef: string;
}

export interface Transaction {
  id: string;
  date: string;
  cryptoSymbol: CryptoSymbol;
  cryptoAmount: number;
  fiatCurrency: FiatCurrency;
  fiatAmount: number;
  rateUsed: number;
  volumeBonusPercent?: number;
  tierBonusPercent?: number;
  chequeCode: string;
  status: TransactionStatus;
  requisite: PaymentRequisite;
  payoutTxId?: string;
  timeTakenSeconds?: number;
  cashbackEarned?: number;
  xpEarned?: number;
  pdfReceipt?: PdfReceiptData;
  adminNote?: string;
  processedByAdmin?: string;
}

export interface AdminUser {
  id: string;
  telegramId: string;
  username: string;
  fullName: string;
  role: 'owner' | 'admin';
  addedAt: string;
  addedBy: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  userTelegramId: string;
  userUsername: string;
  userFullName: string;
  cryptoSymbol: CryptoSymbol;
  cryptoAmount: number;
  fiatAmount: number;
  rateUsed: number;
  chequeCode: string;
  requisite: PaymentRequisite;
  status: 'new' | 'in_progress' | 'paid' | 'rejected';
  assignedAdmin?: string;
  paidAt?: string;
  pdfReceipt?: PdfReceiptData;
  sbpRef?: string;
}

// Результат РЕАЛЬНОЙ проверки чека через /api/validate-cheque (CryptoBot API).
// Больше не содержит угаданных данных — только то, что вернул сам CryptoBot.
export interface ValidatedCheque {
  code: string;
  checkId: number;
  cryptoSymbol: CryptoSymbol;
  cryptoAmount: number;
}

export type QuestCategory = 'daily' | 'trade' | 'telegram_sub' | 'milestone';

export interface QuestTask {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  rewardXp: number;
  rewardUsdt?: number;
  rewardCashbackBonus?: number;
  minTier?: RatingTier;
  progress: number;
  maxProgress: number;
  unit: string;
  completed: boolean;
  claimed: boolean;
  iconName: string;
  actionText: string;
  badge?: string;
  // Для проверки подписки через Telegram Bot
  channelUsername?: string;
  channelTitle?: string;
  channelLink?: string;
  isChannelSub?: boolean;
  isCustomChannel?: boolean;
  isRequiredSub?: boolean;
}

export interface CustomAdminChannel {
  id: string;
  username: string;
  title: string;
  subscribersCount: number;
  botIsAdmin: boolean;
  botPermissions: string[];
  addedDate: string;
  activeStatus: 'active' | 'pending' | 'revoked';
}
