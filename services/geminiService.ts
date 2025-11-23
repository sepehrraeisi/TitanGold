
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";

// Lazy initialization - don't throw error at module level
let aiInstance: GoogleGenAI | null = null;
let chatInstance: Chat | null = null;

function getAIInstance(): GoogleGenAI {
    if (!aiInstance) {
        // Try localStorage first (for browser), then environment variables
        const tempKey = typeof window !== 'undefined' ? localStorage.getItem('temp_gemini_key') : null;
        const API_KEY = tempKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
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

export const getChatResponseStream = async (message: string) => {
    const chat = getChatInstance();
    return chat.sendMessageStream({ message });
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
        const ai = getAIInstance();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: 'Hello' }] }],
        });
        const latency = Date.now() - startTime;
        if (response.text) {
            return { success: true, latency };
        }
        return { success: false, error: 'No response from Gemini' };
    } catch (e: any) {
        return { success: false, error: e.message || 'Connection failed' };
    }
};
