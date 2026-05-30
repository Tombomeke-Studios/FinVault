export interface User {
  id: string;
  email: string;
  passwordHash: string;
  accountType: 'personal' | 'business';
  status: 'active' | 'frozen';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  country: string;
}

export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  balance: number;
  reservedBalance: number;
  status: 'active' | 'frozen';
  createdAt: string;
}

export interface BalanceHistory {
  id: string;
  walletId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  timestamp: string;
}

export interface Transaction {
  id: string;
  reference: string;
  senderWalletId: string | null;
  receiverWalletId: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'refunded';
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

// API Payloads
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    accountType: string;
    profile?: UserProfile;
  };
}
