// Realtime Voice Service for Titan Trading System
// Supports browser-based Speech Recognition and Text-to-Speech

export interface VoiceConfig {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    maxAlternatives?: number;
}

export interface VoiceResult {
    success: boolean;
    transcript?: string;
    confidence?: number;
    error?: string;
}

// Check if browser supports Speech Recognition
export const isSpeechRecognitionSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
};

// Check if browser supports Speech Synthesis
export const isSpeechSynthesisSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!window.speechSynthesis;
};

// Test Voice capabilities
export const testVoiceConnection = async (): Promise<{ success: boolean; error?: string; capabilities?: { recognition: boolean; synthesis: boolean } }> => {
    try {
        const recognitionSupported = isSpeechRecognitionSupported();
        const synthesisSupported = isSpeechSynthesisSupported();
        
        if (!recognitionSupported && !synthesisSupported) {
            return { 
                success: false, 
                error: 'Browser does not support Speech Recognition or Speech Synthesis. Please use Chrome, Edge, or Safari.' 
            };
        }
        
        return { 
            success: true, 
            capabilities: { 
                recognition: recognitionSupported, 
                synthesis: synthesisSupported 
            } 
        };
    } catch (e: any) {
        return { success: false, error: e.message || 'Voice test failed' };
    }
};

// Start listening for voice input
export const startVoiceRecognition = (
    config: VoiceConfig = {},
    onResult: (result: VoiceResult) => void,
    onError?: (error: string) => void
): (() => void) => {
    if (typeof window === 'undefined') {
        onError?.('Voice recognition not available in this environment');
        return () => {};
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        onError?.('Speech Recognition not supported in this browser');
        return () => {};
    }

    const recognition = new SpeechRecognition();
    recognition.lang = config.language || 'en-US';
    recognition.continuous = config.continuous ?? false;
    recognition.interimResults = config.interimResults ?? false;
    recognition.maxAlternatives = config.maxAlternatives || 1;

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence || 0.8;
        
        onResult({
            success: true,
            transcript,
            confidence,
        });
    };

    recognition.onerror = (event: any) => {
        let errorMessage = 'Speech recognition error';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected';
                break;
            case 'audio-capture':
                errorMessage = 'No microphone found';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied';
                break;
            case 'network':
                errorMessage = 'Network error';
                break;
            default:
                errorMessage = event.error || 'Unknown error';
        }
        
        onError?.(errorMessage);
    };

    recognition.onend = () => {
        // Recognition ended
    };

    try {
        recognition.start();
    } catch (e: any) {
        onError?.(e.message || 'Failed to start recognition');
    }

    // Return stop function
    return () => {
        try {
            recognition.stop();
        } catch (e) {
            // Ignore errors when stopping
        }
    };
};

// Speak text using browser TTS
export const speakText = (
    text: string,
    config: {
        lang?: string;
        pitch?: number;
        rate?: number;
        volume?: number;
        voice?: SpeechSynthesisVoice;
    } = {}
): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            reject(new Error('Speech Synthesis not supported'));
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = config.lang || 'en-US';
        utterance.pitch = config.pitch ?? 1;
        utterance.rate = config.rate ?? 1;
        utterance.volume = config.volume ?? 1;
        
        if (config.voice) {
            utterance.voice = config.voice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (e) => reject(new Error(`Speech synthesis error: ${e.error}`));

        window.speechSynthesis.speak(utterance);
    });
};

// Get available voices
export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        return [];
    }
    return window.speechSynthesis.getVoices();
};

// Stop all speech
export const stopSpeech = (): void => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

