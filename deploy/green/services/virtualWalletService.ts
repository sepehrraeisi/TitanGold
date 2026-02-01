// Virtual Wallet Service for Demo Mode
// Provides a virtual wallet that works exactly like a real wallet
// The system should not know it's using a virtual wallet

interface VirtualBalance {
    asset: string;
    free: number;
    locked: number;
    total: number;
}

interface VirtualWallet {
    balances: VirtualBalance[];
    totalUSDT: number;
    transactions: VirtualTransaction[];
    createdAt: number;
    lastUpdated: number;
}

interface VirtualTransaction {
    id: string;
    type: 'deposit' | 'withdrawal' | 'trade' | 'fee';
    asset: string;
    amount: number;
    price?: number;
    value?: number;
    timestamp: number;
    description?: string;
}

class VirtualWalletService {
    private wallet: VirtualWallet | null = null;
    private readonly STORAGE_KEY = 'titan_virtual_wallet';
    private readonly DEFAULT_BALANCE = 10000; // $10,000 default

    constructor() {
        this.loadWallet();
    }

    private loadWallet(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.wallet = JSON.parse(stored);
                // Validate wallet structure
                if (!this.wallet?.balances || !Array.isArray(this.wallet.balances)) {
                    this.initializeWallet();
                }
            } else {
                this.initializeWallet();
            }
        } catch (error) {
            console.error('Failed to load virtual wallet:', error);
            this.initializeWallet();
        }
    }

    private initializeWallet(): void {
        this.wallet = {
            balances: [
                { asset: 'USDT', free: this.DEFAULT_BALANCE, locked: 0, total: this.DEFAULT_BALANCE },
                { asset: 'BTC', free: 0, locked: 0, total: 0 },
                { asset: 'ETH', free: 0, locked: 0, total: 0 },
            ],
            totalUSDT: this.DEFAULT_BALANCE,
            transactions: [],
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };
        this.saveWallet();
    }

    private saveWallet(): void {
        if (this.wallet) {
            this.wallet.lastUpdated = Date.now();
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.wallet));
            } catch (error) {
                console.error('Failed to save virtual wallet:', error);
            }
        }
    }

    // Get wallet balance (same interface as real wallet)
    getBalance(): VirtualWallet {
        if (!this.wallet) {
            this.initializeWallet();
        }
        return this.wallet!;
    }

    // Get balance for a specific asset
    getAssetBalance(asset: string): VirtualBalance | null {
        if (!this.wallet) {
            this.loadWallet();
        }
        return this.wallet!.balances.find(b => b.asset === asset) || null;
    }

    // Get free balance for an asset
    getFreeBalance(asset: string): number {
        const balance = this.getAssetBalance(asset);
        return balance ? balance.free : 0;
    }

    // Lock balance (for pending orders)
    lockBalance(asset: string, amount: number): boolean {
        if (!this.wallet) {
            this.loadWallet();
        }

        const balance = this.wallet!.balances.find(b => b.asset === asset);
        if (!balance || balance.free < amount) {
            return false;
        }

        balance.free -= amount;
        balance.locked += amount;
        balance.total = balance.free + balance.locked;
        this.saveWallet();
        return true;
    }

    // Unlock balance (when order is cancelled or filled)
    unlockBalance(asset: string, amount: number): boolean {
        if (!this.wallet) {
            this.loadWallet();
        }

        const balance = this.wallet!.balances.find(b => b.asset === asset);
        if (!balance || balance.locked < amount) {
            return false;
        }

        balance.free += amount;
        balance.locked -= amount;
        balance.total = balance.free + balance.locked;
        this.saveWallet();
        return true;
    }

    // Deduct balance (for executed trades)
    deductBalance(asset: string, amount: number): boolean {
        if (!this.wallet) {
            this.loadWallet();
        }

        const balance = this.wallet!.balances.find(b => b.asset === asset);
        if (!balance || balance.free < amount) {
            return false;
        }

        balance.free -= amount;
        balance.total = balance.free + balance.locked;

        // Add transaction
        this.addTransaction({
            type: 'trade',
            asset,
            amount: -amount,
            timestamp: Date.now(),
            description: `Trade: Sold ${amount} ${asset}`,
        });

        this.saveWallet();
        return true;
    }

    // Add balance (for executed trades or deposits)
    addBalance(asset: string, amount: number, type: 'deposit' | 'trade' = 'trade'): void {
        if (!this.wallet) {
            this.loadWallet();
        }

        let balance = this.wallet!.balances.find(b => b.asset === asset);
        if (!balance) {
            // Create new asset balance
            balance = { asset, free: 0, locked: 0, total: 0 };
            this.wallet!.balances.push(balance);
        }

        balance.free += amount;
        balance.total = balance.free + balance.locked;

        // Update total USDT if needed
        if (asset === 'USDT') {
            this.wallet!.totalUSDT = balance.total;
        }

        // Add transaction
        this.addTransaction({
            type,
            asset,
            amount,
            timestamp: Date.now(),
            description: type === 'deposit' ? `Deposit: ${amount} ${asset}` : `Trade: Bought ${amount} ${asset}`,
        });

        this.saveWallet();
    }

    // Execute a trade (buy or sell)
    executeTrade(side: 'BUY' | 'SELL', baseAsset: string, quoteAsset: string, quantity: number, price: number): boolean {
        if (!this.wallet) {
            this.loadWallet();
        }

        const totalCost = quantity * price;

        if (side === 'BUY') {
            // Need quoteAsset (usually USDT) to buy baseAsset
            const quoteBalance = this.getFreeBalance(quoteAsset);
            if (quoteBalance < totalCost) {
                return false; // Insufficient balance
            }

            // Deduct quote asset
            this.deductBalance(quoteAsset, totalCost);

            // Add base asset
            this.addBalance(baseAsset, quantity, 'trade');

            return true;
        } else {
            // SELL: Need baseAsset to sell for quoteAsset
            const baseBalance = this.getFreeBalance(baseAsset);
            if (baseBalance < quantity) {
                return false; // Insufficient balance
            }

            // Deduct base asset
            this.deductBalance(baseAsset, quantity);

            // Add quote asset
            this.addBalance(quoteAsset, totalCost, 'trade');

            return true;
        }
    }

    // Add transaction to history
    private addTransaction(transaction: Omit<VirtualTransaction, 'id'>): void {
        if (!this.wallet) {
            return;
        }

        const newTransaction: VirtualTransaction = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...transaction,
        };

        this.wallet.transactions.unshift(newTransaction);
        // Keep only last 1000 transactions
        if (this.wallet.transactions.length > 1000) {
            this.wallet.transactions = this.wallet.transactions.slice(0, 1000);
        }
    }

    // Get transaction history
    getTransactions(limit: number = 100): VirtualTransaction[] {
        if (!this.wallet) {
            this.loadWallet();
        }
        return this.wallet!.transactions.slice(0, limit);
    }

    // Reset wallet to default
    resetWallet(): void {
        this.initializeWallet();
    }

    // Get total portfolio value in USDT
    getTotalValue(prices: { [asset: string]: number }): number {
        if (!this.wallet) {
            this.loadWallet();
        }

        let total = 0;
        for (const balance of this.wallet!.balances) {
            if (balance.asset === 'USDT') {
                total += balance.total;
            } else {
                const price = prices[balance.asset] || 0;
                total += balance.total * price;
            }
        }
        return total;
    }

    // Format balance for display (same format as real wallet)
    formatBalance(): {
        balances: Array<{ asset: string; free: string; locked: string; total: string }>;
        totalUSDT: string;
    } {
        if (!this.wallet) {
            this.loadWallet();
        }

        return {
            balances: this.wallet!.balances.map(b => ({
                asset: b.asset,
                free: b.free.toFixed(8),
                locked: b.locked.toFixed(8),
                total: b.total.toFixed(8),
            })),
            totalUSDT: this.wallet!.totalUSDT.toFixed(2),
        };
    }
}

export const virtualWalletService = new VirtualWalletService();

// Export types
export type { VirtualBalance, VirtualWallet, VirtualTransaction };

