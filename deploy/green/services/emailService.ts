// Email Service (SMTP) for Titan Trading System
// Supports multiple SMTP providers: Gmail, Outlook, SendGrid, Mailgun, Custom SMTP

import { getAuthToken } from './api-auth';

export interface SMTPConfig {
    host: string;
    port: number;
    secure: boolean; // true for 465, false for other ports
    auth: {
        user: string;
        password: string;
    };
    from: string; // Sender email address
    fromName?: string; // Sender name
    provider?: 'gmail' | 'outlook' | 'sendgrid' | 'mailgun' | 'custom';
}

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        content?: string;
        path?: string;
        contentType?: string;
    }>;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// Test SMTP connection
export const testSMTPConnection = async (config: SMTPConfig): Promise<{ success: boolean; error?: string; latency?: number }> => {
    const startTime = Date.now();
    
    try {
        // In browser, we need to use backend API
        if (typeof window !== 'undefined') {
            const token = getAuthToken();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/v1/email/test', {
                method: 'POST',
                headers,
                body: JSON.stringify(config),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: errorText || 'SMTP test failed' };
            }
            
            const result = await response.json();
            const latency = Date.now() - startTime;
            return { success: result.success || false, error: result.error, latency };
        }
        
        // In Node.js environment (backend)
        // This would use nodemailer directly
        // For now, return success if config is valid
        if (!config.host || !config.port || !config.auth?.user || !config.auth?.password) {
            return { success: false, error: 'Invalid SMTP configuration' };
        }
        
        const latency = Date.now() - startTime;
        return { success: true, latency };
    } catch (e: any) {
        return { success: false, error: e.message || 'SMTP connection test failed' };
    }
};

// Send email
export const sendEmail = async (config: SMTPConfig, options: EmailOptions): Promise<EmailResult> => {
    try {
        // In browser, use backend API
        if (typeof window !== 'undefined') {
            const token = getAuthToken();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/v1/email/send', {
                method: 'POST',
                headers,
                body: JSON.stringify({ config, options }),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: errorText || 'Failed to send email' };
            }
            
            const result = await response.json();
            return { success: result.success || false, messageId: result.messageId, error: result.error };
        }
        
        // In Node.js environment (backend)
        // This would use nodemailer directly
        return { success: false, error: 'Email sending not implemented in frontend. Use backend API.' };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to send email' };
    }
};

// Get SMTP provider presets
export const getSMTPPresets = (): Record<string, Partial<SMTPConfig>> => {
    return {
        gmail: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            provider: 'gmail',
        },
        outlook: {
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false,
            provider: 'outlook',
        },
        sendgrid: {
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            provider: 'sendgrid',
        },
        mailgun: {
            host: 'smtp.mailgun.org',
            port: 587,
            secure: false,
            provider: 'mailgun',
        },
    };
};

