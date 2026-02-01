// OpenRouter AI Service
// OpenRouter API integration for Titan trading system

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenRouterResponse {
    id: string;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// Lazy initialization
let apiKey: string | null = null;

function getApiKey(): string {
    // Always check for temp key first (for testing)
    const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_openrouter_key') : null;
    if (tempKey) {
        return tempKey;
    }
    
    if (!apiKey) {
        apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error("OPENROUTER_API_KEY environment variable not set.");
        }
    }
    return apiKey;
}

// Generate content using OpenRouter API
export const generateContent = async (
    prompt: string,
    systemInstruction?: string,
    model?: string
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: OpenRouterMessage[] = [];
        
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
        
        const modelToUse = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
        };
        
        // Optional headers from env
        if (process.env.OPENROUTER_HTTP_REFERER) {
            headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
        }
        if (process.env.OPENROUTER_X_TITLE) {
            headers['X-Title'] = process.env.OPENROUTER_X_TITLE;
        }
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: modelToUse,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `OpenRouter API error: ${response.status}`;
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    if (errorJson.error.message) {
                        errorMessage = errorJson.error.message;
                    } else {
                        errorMessage = errorJson.error.code || errorMessage;
                    }
                } else {
                    errorMessage = errorText || errorMessage;
                }
            } catch {
                errorMessage = errorText || errorMessage;
            }
            
            throw new Error(errorMessage);
        }
        
        const data: OpenRouterResponse = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        
        throw new Error('No response from OpenRouter API');
    } catch (e) {
        console.error('OpenRouter API error:', e);
        throw e;
    }
};

// Test OpenRouter connection
export const testOpenRouterConnection = async (model?: string): Promise<{ success: boolean; latency?: number; error?: string }> => {
    try {
        const startTime = Date.now();
        // Reset apiKey to use new key from localStorage
        apiKey = null;
        
        // Check if temp key exists
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_openrouter_key') : null;
        if (!tempKey || tempKey.trim().length === 0) {
            return { success: false, error: 'API key not found. Please configure it first.' };
        }
        
        console.log('OpenRouter test - Using key:', tempKey.substring(0, 10) + '...');
        console.log('OpenRouter test - Calling generateContent...');
        
        const modelToUse = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
        const response = await generateContent('Hello', 'You are a helpful assistant.', modelToUse);
        
        console.log('OpenRouter test - Response received:', {
            hasResponse: !!response,
            responseLength: response?.length || 0,
        });
        
        if (!response || response.trim().length === 0) {
            return { success: false, error: 'Empty response from OpenRouter' };
        }
        
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        console.error('OpenRouter connection test error:', e);
        let errorMessage = e.message || 'Connection failed';
        
        // Try to extract more detailed error information
        if (e.response) {
            try {
                const errorData = await e.response.json();
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch {
                try {
                    const errorText = await e.response.text();
                    errorMessage = errorText || errorMessage;
                } catch {
                    // Ignore
                }
            }
        }
        
        console.error('Error details:', {
            message: errorMessage,
            stack: e.stack,
            name: e.name,
        });
        
        return { success: false, error: errorMessage };
    }
};

