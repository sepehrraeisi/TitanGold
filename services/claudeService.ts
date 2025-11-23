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
    if (!apiKey) {
        // Try localStorage first (for browser), then environment variables
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_claude_key') : null;
        apiKey = tempKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
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
            throw new Error(`Claude API error: ${response.status} - ${errorText}`);
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
        await generateContent('Hello', 'You are a helpful assistant.', 'claude-3-5-sonnet-20241022');
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        return { success: false, error: e.message || 'Connection failed' };
    }
};

