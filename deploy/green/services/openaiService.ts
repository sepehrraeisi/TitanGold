// OpenAI/ChatGPT AI Service
// OpenAI API integration for Titan trading system

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIResponse {
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
    // Always check for temp key first (for testing)
    const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_openai_key') : null;
    if (tempKey) {
        return tempKey;
    }
    
    if (!apiKey) {
        apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY or CHATGPT_API_KEY environment variable not set.");
        }
    }
    return apiKey;
}

// Generate content using OpenAI API
export const generateContent = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'gpt-4o-mini'
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: OpenAIMessage[] = [];
        
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
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `OpenAI API error: ${response.status}`;
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    // Handle specific error types
                    if (errorJson.error.code === 'insufficient_quota' || response.status === 429) {
                        errorMessage = 'Quota exceeded. Please check your OpenAI billing and plan.';
                    } else if (errorJson.error.message) {
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
        
        const data: OpenAIResponse = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        
        throw new Error('No response from OpenAI API');
    } catch (e) {
        console.error('OpenAI API error:', e);
        throw e;
    }
};

// Generate streaming response (for chat)
export const generateContentStream = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'gpt-4o-mini',
    onChunk?: (chunk: string) => void
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: OpenAIMessage[] = [];
        
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
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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
        console.error('OpenAI streaming error:', e);
        throw e;
    }
};

// Test OpenAI connection
export const testOpenAIConnection = async (): Promise<{ success: boolean; latency?: number; error?: string }> => {
    try {
        const startTime = Date.now();
        // Reset apiKey to use new key from localStorage
        apiKey = null;
        
        // Check if temp key exists
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_openai_key') : null;
        if (!tempKey || tempKey.trim().length === 0) {
            return { success: false, error: 'API key not found. Please configure it first.' };
        }
        
        console.log('OpenAI test - Using key:', tempKey.substring(0, 10) + '...');
        console.log('OpenAI test - Calling generateContent...');
        
        const response = await generateContent('Hello', 'You are a helpful assistant.', 'gpt-4o-mini');
        
        console.log('OpenAI test - Response received:', {
            hasResponse: !!response,
            responseLength: response?.length || 0,
        });
        
        if (!response || response.trim().length === 0) {
            return { success: false, error: 'Empty response from OpenAI' };
        }
        
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        console.error('OpenAI connection test error:', e);
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

