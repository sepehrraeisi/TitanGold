
import React, { useState, useRef, useEffect } from 'react';
import { getChatResponseStream } from '../services/geminiService.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import type { ChatMessage } from '../types.ts';

// Web Speech API interfaces for TypeScript
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}


const Chatbot: React.FC = () => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'bot', text: 'Hello! I am Artemis, your AI assistant for the Titan platform. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'fa' ? 'fa-IR' : 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript); // auto-send after transcription
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, [language]);


  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const currentInput = textToSend || input;
    if (currentInput.trim() === '') return;

    const userMessage: ChatMessage = { id: Date.now(), sender: 'user', text: currentInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    
    const botMessageId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: botMessageId, sender: 'bot', text: '', isTyping: true }]);

    try {
        const stream = await getChatResponseStream(currentInput);
        let botReply = '';
        for await (const chunk of stream) {
            botReply += chunk.text;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === botMessageId ? { ...msg, text: botReply, isTyping: true } : msg
                )
            );
        }
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, text: botReply, isTyping: false } : msg
            )
        );

    } catch (error) {
        console.error("Chat Error:", error);
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, text: "Sorry, I encountered an error.", isTyping: false } : msg
            )
        );
    }
  };
  
  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.sender === 'user';
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl ${isUser ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-white'}`}>
          <p className="text-sm break-words">{message.text}</p>
          {message.isTyping && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        </div>
      </div>
    );
  };
  
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 z-50"
        aria-label="Toggle Chatbot"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[32rem] bg-white dark:bg-[#161B22] border border-slate-200 dark:border-gray-800 rounded-xl shadow-2xl flex flex-col z-40">
          <div className="p-4 border-b border-slate-200 dark:border-gray-800">
            <h3 className="font-bold text-center">{t('chatbot_title')}</h3>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-slate-200 dark:border-gray-800 flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? t('chatbot_listening') : t('chatbot_placeholder')}
              className="flex-1 bg-slate-100 dark:bg-gray-800 px-3 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isListening}
            />
             <button onClick={toggleListen} className={`p-2 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-gray-400'} hover:text-slate-800 dark:hover:text-white`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 8a1 1 0 11-2 0v1a5 5 0 01-5 5H3a1 1 0 110-2h2a3 3 0 003-3V8a1 1 0 112 0v4z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={() => handleSend()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <style>{`
        .typing-indicator { display: inline-block; margin-left: 5px; }
        .typing-indicator span { height: 6px; width: 6px; background-color: #9E9EA1; border-radius: 50%; display: inline-block; margin: 0 1px; animation: bounce 1s infinite; }
        .typing-indicator span:nth-of-type(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-of-type(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </>
  );
};

export default Chatbot;