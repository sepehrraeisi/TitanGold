type Level = 'info' | 'warn' | 'error' | 'debug';

const log = (level: Level, message: string, meta?: Record<string, unknown>) => {
    const payload = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(meta || {}),
    };
    const serialized = JSON.stringify(payload);
    if (level === 'error') {
        console.error(serialized);
    } else if (level === 'warn') {
        console.warn(serialized);
    } else if (level === 'debug') {
        if (process.env.DEBUG_LOGS === '1') {
            console.debug(serialized);
        }
    } else {
        console.log(serialized);
    }
};

export const logger = {
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
};

