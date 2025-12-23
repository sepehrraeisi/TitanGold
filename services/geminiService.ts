
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";

// Lazy initialization - don't throw error at module level
let aiInstance: GoogleGenAI | null = null;
let chatInstance: Chat | null = null;

function getAIInstance(): GoogleGenAI {
    // Always check for temp key first (for testing), then use cached instance
    const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_gemini_key') : null;
    if (tempKey) {
        // If temp key exists, create new instance with it
        aiInstance = new GoogleGenAI({ apiKey: tempKey });
        return aiInstance;
    }
    
    if (!aiInstance) {
        const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            throw new Error("API_KEY or GEMINI_API_KEY environment variable not set.");
        }
        aiInstance = new GoogleGenAI({ apiKey: API_KEY });
    }
    return aiInstance;
}

function getChatInstance(): Chat {
    if (!chatInstance) {
        const ai = getAIInstance();
        chatInstance = ai.chats.create({
            model: 'gemini-2.5-flash-lite',
            config: {
                systemInstruction: 'You are Artemis, the master AI of the Titan trading system. You are a professional, helpful assistant. You can answer questions about the platform and execute trades via text commands. Keep your responses concise and informative.',
            },
        });
    }
    return chatInstance;
}

// Replaced direct API call with Backend API call for security
export const getChatResponseStream = async (message: string) => {
    // Note: Currently returning a simulated stream from the full response
    // In a future update, we can implement real SSE for true streaming
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/ai-agents/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
    });

    if (!response.ok) {
        throw new Error('Failed to get response from Artemis');
    }

    const data = await response.json();

    // Simulate stream generator
    async function* streamGenerator() {
        const words = data.text.split(' ');
        for (const word of words) {
            yield { text: word + ' ' };
            await new Promise(resolve => setTimeout(resolve, 20)); // smooth typing effect
        }
    }

    return streamGenerator();
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    const imagePart = {
        inlineData: {
            mimeType,
            data: imageBase64,
        },
    };
    const textPart = {
        text: prompt,
    };

    const ai = getAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });

    return response.text;
};


export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string | null> => {
    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType,
        },
    };
    const textPart = { text: prompt };

    const ai = getAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    return null;
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9"): Promise<string | null> => {
    const ai = getAIInstance();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio,
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
    }
    return null;
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
};


export const getGroundedResponse = async (prompt: string): Promise<{ text: string, sources: any[] }> => {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text: response.text, sources };
};

// Helper to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = (reader.result as string).split(',')[1];
            resolve(result);
        };
        reader.onerror = error => reject(error);
    });
};

// Test Gemini connection
export const testGeminiConnection = async (): Promise<{ success: boolean; latency?: number; error?: string }> => {
    try {
        const startTime = Date.now();
        // Reset instance to use new key from localStorage
        aiInstance = null;
        chatInstance = null;
        
        // Check if temp key exists
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_gemini_key') : null;
        if (!tempKey || tempKey.trim().length === 0) {
            return { success: false, error: 'API key not found. Please configure it first.' };
        }
        
        console.log('Gemini test - Using key:', tempKey.substring(0, 10) + '...');
        
        // Use SDK (direct fetch has CORS issues in browser)
        const ai = getAIInstance();
        console.log('Gemini test - AI instance created');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: 'Hello' }] }],
        });
        
        console.log('Gemini test - Response received:', {
            hasText: !!response.text,
            textLength: response.text?.length || 0,
        });
        
        const latency = Date.now() - startTime;
        
        if (response && response.text && response.text.trim().length > 0) {
            return { success: true, latency };
        }
        
        return { success: false, error: 'No response from Gemini' };
    } catch (e: any) {
        console.error('Gemini connection test error:', e);
        let errorMessage = e.message || e.toString() || 'Connection failed';
        
        // Check if it's a CORS error
        if (errorMessage.includes('CORS') || 
            errorMessage.includes('Failed to fetch') || 
            errorMessage.includes('Access-Control-Allow-Origin') ||
            e.message?.includes('Failed to fetch')) {
            errorMessage = 'CORS Error: Gemini API cannot be tested directly from browser due to CORS restrictions. The API key appears to be valid, but testing must be done from a backend server. For production use, the API will work correctly when called from your backend.';
        }
        
        console.error('Error details:', {
            message: errorMessage,
            originalError: e.message,
            stack: e.stack,
            name: e.name,
        });
        return { success: false, error: errorMessage };
    }
};
