// DeepSeek AI Service
// DeepSeek API integration for Titan trading system

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface DeepSeekResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// Lazy initialization
let apiKey: string | null = null;

function getApiKey(): string {
    if (!apiKey) {
        // Try localStorage first (for browser), then environment variables
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_deepseek_key') : null;
        apiKey = tempKey || process.env.DEEPSEEK_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("DEEPSEEK_API_KEY or API_KEY environment variable not set.");
        }
    }
    return apiKey;
}

// Generate content using DeepSeek API
export const generateContent = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'deepseek-chat'
): Promise<string> => {
    try {
        // Reset apiKey to ensure we get the latest from localStorage
        apiKey = null;
        const key = getApiKey();
        
        if (!key || key.trim() === '') {
            throw new Error('DeepSeek API key is empty or not set');
        }
        
        const messages: DeepSeekMessage[] = [];
        
        if (systemInstruction) {
            messages.push({
                role: 'system',
                content: systemInstruction,
            });
        }
        
        messages.push({
            role: 'user',
            content: prompt,
        });
        
        console.log('DeepSeek API Request:', {
            url: 'https://api.deepseek.com/v1/chat/completions',
            model,
            hasKey: !!key,
            keyLength: key?.length || 0,
        });
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });
        
        console.log('DeepSeek API Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API Error Response:', errorText);
            let errorMessage = `DeepSeek API error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.error?.code || errorJson.message || errorText;
            } catch {
                errorMessage = errorText || `HTTP ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data: DeepSeekResponse = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        
        throw new Error('No response from DeepSeek API');
    } catch (e: any) {
        console.error('DeepSeek API error:', e);
        throw e;
    }
};

// Generate streaming response (for chat)
export const generateContentStream = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'deepseek-chat',
    onChunk?: (chunk: string) => void
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: DeepSeekMessage[] = [];
        
        if (systemInstruction) {
            messages.push({
                role: 'system',
                content: systemInstruction,
            });
        }
        
        messages.push({
            role: 'user',
            content: prompt,
        });
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: true,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
        if (!reader) {
            throw new Error('No response body reader');
        }
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            if (onChunk) {
                                onChunk(content);
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }
        
        return fullResponse;
    } catch (e) {
        console.error('DeepSeek streaming error:', e);
        throw e;
    }
};

// Test DeepSeek connection
export const testDeepSeekConnection = async (): Promise<{ success: boolean; latency?: number; error?: string }> => {
    try {
        const startTime = Date.now();
        // Reset apiKey to use new key from localStorage
        apiKey = null;
        
        // Check if API key is available
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_deepseek_key') : null;
        console.log('DeepSeek test - tempKey from localStorage:', tempKey ? `${tempKey.substring(0, 10)}...` : 'NOT FOUND');
        
        if (!tempKey && !process.env.DEEPSEEK_API_KEY && !process.env.API_KEY) {
            return { success: false, error: 'API key not found. Please configure it first.' };
        }
        
        console.log('Calling DeepSeek generateContent...');
        const response = await generateContent('Hello', 'You are a helpful assistant.', 'deepseek-chat');
        console.log('DeepSeek response received:', response ? 'Success' : 'Empty');
        
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        console.error('DeepSeek connection test error:', e);
        const errorMsg = e.message || 'Connection failed';
        console.error('Error details:', {
            message: e.message,
            stack: e.stack,
            name: e.name,
        });
        return { success: false, error: errorMsg };
    }
};

