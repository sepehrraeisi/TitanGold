import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } else {
            console.warn('Gemini API Key not provided');
        }
    }

    async getAnalysis(prompt, context = '') {
        if (!this.genAI) return 'AI Service not configured';

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 flash as it is standard
            const fullPrompt = `Context: ${context}\n\nQuestion: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('AI getAnalysis error:', error);
            return 'Error generating AI analysis';
        }
    }

    async askArtemis(message, systemInstruction = '') {
        if (!this.genAI) return 'Artemis is offline.';

        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemInstruction || "You are Artemis, the advanced AI controlling the TitanGold trading system. You are analytical, precise, and helpful."
            });
            const result = await model.generateContent(message);
            return result.response.text();
        } catch (error) {
            console.error('Artemis error:', error);
            return 'Artemis is currently unavailable.';
        }
    }
}

export const aiService = new AIService();
