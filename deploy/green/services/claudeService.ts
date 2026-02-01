// Anthropic Claude AI Service
// Claude API integration for Titan trading system

interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ClaudeResponse {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

// Lazy initialization
let apiKey: string | null = null;

function getApiKey(): string {
    // Always check for temp key first (for testing)
    const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_claude_key') : null;
    if (tempKey) {
        return tempKey;
    }
    
    if (!apiKey) {
        apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable not set.");
        }
    }
    return apiKey;
}

// Generate content using Claude API
export const generateContent = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'claude-3-5-sonnet-20241022'
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: ClaudeMessage[] = [
            {
                role: 'user',
                content: prompt,
            },
        ];
        
        const requestBody: any = {
            model: model,
            max_tokens: 2000,
            messages: messages,
        };
        
        if (systemInstruction) {
            requestBody.system = systemInstruction;
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Claude API error: ${response.status}`;
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    // Handle specific error types
                    if (errorJson.error.type === 'rate_limit_error' || response.status === 429) {
                        errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
                    } else if (errorJson.error.message) {
                        errorMessage = errorJson.error.message;
                    } else {
                        errorMessage = errorJson.error.type || errorMessage;
                    }
                } else {
                    errorMessage = errorText || errorMessage;
                }
            } catch {
                errorMessage = errorText || errorMessage;
            }
            
            throw new Error(errorMessage);
        }
        
        const data: ClaudeResponse = await response.json();
        
        if (data.content && data.content.length > 0) {
            return data.content[0].text;
        }
        
        throw new Error('No response from Claude API');
    } catch (e) {
        console.error('Claude API error:', e);
        throw e;
    }
};

// Generate streaming response (for chat)
export const generateContentStream = async (
    prompt: string,
    systemInstruction?: string,
    model: string = 'claude-3-5-sonnet-20241022',
    onChunk?: (chunk: string) => void
): Promise<string> => {
    try {
        const key = getApiKey();
        const messages: ClaudeMessage[] = [
            {
                role: 'user',
                content: prompt,
            },
        ];
        
        const requestBody: any = {
            model: model,
            max_tokens: 2000,
            messages: messages,
            stream: true,
        };
        
        if (systemInstruction) {
            requestBody.system = systemInstruction;
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${errorText}`);
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
                        if (parsed.type === 'content_block_delta') {
                            const content = parsed.delta?.text || '';
                            if (content) {
                                fullResponse += content;
                                if (onChunk) {
                                    onChunk(content);
                                }
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
        console.error('Claude streaming error:', e);
        throw e;
    }
};

// Test Claude connection
export const testClaudeConnection = async (): Promise<{ success: boolean; latency?: number; error?: string }> => {
    try {
        const startTime = Date.now();
        // Reset apiKey to use new key from localStorage
        apiKey = null;
        
        // Check if temp key exists
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_claude_key') : null;
        if (!tempKey || tempKey.trim().length === 0) {
            return { success: false, error: 'API key not found. Please configure it first.' };
        }
        
        console.log('Claude test - Using key:', tempKey.substring(0, 10) + '...');
        console.log('Claude test - Calling generateContent...');
        
        const response = await generateContent('Hello', 'You are a helpful assistant.', 'claude-3-5-sonnet-20241022');
        
        console.log('Claude test - Response received:', {
            hasResponse: !!response,
            responseLength: response?.length || 0,
        });
        
        if (!response || response.trim().length === 0) {
            return { success: false, error: 'Empty response from Claude' };
        }
        
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        console.error('Claude connection test error:', e);
        let errorMessage = e.message || 'Connection failed';
        
        // Try to extract more detailed error information
        if (e.response) {
            try {
                const errorData = await e.response.json();
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch {
                const errorText = await e.response.text();
                errorMessage = errorText || errorMessage;
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

