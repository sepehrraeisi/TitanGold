// On-chain Analytics Service for Titan Trading System
// Supports multiple providers: Etherscan, Blockchair, Blockchain.com, Moralis

export interface OnChainConfig {
    provider: 'etherscan' | 'blockchair' | 'blockchain' | 'moralis' | 'custom';
    apiKey?: string;
    apiUrl?: string; // For custom provider
    network?: 'mainnet' | 'testnet' | 'polygon' | 'bsc' | 'arbitrum';
}

export interface OnChainMetrics {
    address: string;
    balance: string;
    balanceUSD?: number;
    transactionCount: number;
    firstSeen?: string;
    lastActivity?: string;
    totalReceived?: string;
    totalSent?: string;
    tokens?: Array<{
        symbol: string;
        balance: string;
        valueUSD?: number;
    }>;
}

export interface OnChainTransaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    blockNumber: number;
    gasUsed?: string;
    gasPrice?: string;
    status: 'success' | 'failed';
}

export interface OnChainResult {
    success: boolean;
    data?: OnChainMetrics | OnChainTransaction[];
    error?: string;
}

// Test On-chain API connection
export const testOnChainConnection = async (config: OnChainConfig): Promise<{ success: boolean; error?: string; latency?: number }> => {
    const startTime = Date.now();
    
    try {
        if (!config.apiKey && config.provider !== 'custom') {
            return { success: false, error: 'API key is required' };
        }
        
        // Test with a known address (Ethereum Foundation)
        const testAddress = '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe';
        
        if (config.provider === 'etherscan') {
            const response = await fetch(
                `https://api.etherscan.io/api?module=account&action=balance&address=${testAddress}&tag=latest&apikey=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            const data = await response.json();
            if (data.status === '1' || data.message === 'OK') {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            
            return { success: false, error: data.message || 'Etherscan API error' };
        } else if (config.provider === 'blockchair') {
            const response = await fetch(
                `https://api.blockchair.com/ethereum/dashboards/address/${testAddress}?key=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            const data = await response.json();
            if (data.data && data.data[testAddress]) {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            
            return { success: false, error: 'Blockchair API error' };
        } else if (config.provider === 'custom' && config.apiUrl) {
            // Test custom API
            const response = await fetch(config.apiUrl);
            if (response.ok) {
                const latency = Date.now() - startTime;
                return { success: true, latency };
            }
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        return { success: false, error: 'Unsupported provider or missing configuration' };
    } catch (e: any) {
        return { success: false, error: e.message || 'On-chain API connection test failed' };
    }
};

// Get address balance
export const getAddressBalance = async (config: OnChainConfig, address: string): Promise<OnChainResult> => {
    try {
        if (config.provider === 'etherscan') {
            const response = await fetch(
                `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.status === '1' && data.result) {
                const balance = data.result;
                const txCountResponse = await fetch(
                    `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${config.apiKey}`
                );
                const txCountData = await txCountResponse.json();
                
                return {
                    success: true,
                    data: {
                        address,
                        balance,
                        transactionCount: parseInt(txCountData.result || '0', 16),
                    } as OnChainMetrics,
                };
            }
            
            return { success: false, error: data.message || 'Failed to fetch balance' };
        } else if (config.provider === 'blockchair') {
            const response = await fetch(
                `https://api.blockchair.com/ethereum/dashboards/address/${address}?key=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.data && data.data[address]) {
                const addressData = data.data[address].address;
                return {
                    success: true,
                    data: {
                        address,
                        balance: addressData.balance.toString(),
                        transactionCount: addressData.transaction_count || 0,
                        totalReceived: addressData.received.toString(),
                        totalSent: addressData.spent.toString(),
                    } as OnChainMetrics,
                };
            }
            
            return { success: false, error: 'Address not found' };
        }
        
        return { success: false, error: 'Unsupported provider' };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to fetch address balance' };
    }
};

// Get address transactions
export const getAddressTransactions = async (
    config: OnChainConfig,
    address: string,
    limit: number = 10
): Promise<OnChainResult> => {
    try {
        if (config.provider === 'etherscan') {
            const response = await fetch(
                `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${config.apiKey}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.status === '1' && Array.isArray(data.result)) {
                const transactions: OnChainTransaction[] = data.result.map((tx: any) => ({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    timestamp: parseInt(tx.timeStamp),
                    blockNumber: parseInt(tx.blockNumber),
                    gasUsed: tx.gasUsed,
                    gasPrice: tx.gasPrice,
                    status: parseInt(tx.txreceipt_status) === 1 ? 'success' : 'failed',
                }));
                
                return { success: true, data: transactions };
            }
            
            return { success: false, error: data.message || 'Failed to fetch transactions' };
        } else if (config.provider === 'blockchair') {
            const response = await fetch(
                `https://api.blockchair.com/ethereum/dashboards/address/${address}/transactions?key=${config.apiKey}&limit=${limit}`
            );
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                const transactions: OnChainTransaction[] = data.data.map((tx: any) => ({
                    hash: tx.hash,
                    from: tx.inputs?.[0]?.recipient || '',
                    to: tx.outputs?.[0]?.recipient || '',
                    value: tx.balance_change?.toString() || '0',
                    timestamp: tx.time ? new Date(tx.time).getTime() / 1000 : 0,
                    blockNumber: tx.block_id || 0,
                    status: 'success',
                }));
                
                return { success: true, data: transactions };
            }
            
            return { success: false, error: 'No transactions found' };
        }
        
        return { success: false, error: 'Unsupported provider' };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to fetch transactions' };
    }
};

