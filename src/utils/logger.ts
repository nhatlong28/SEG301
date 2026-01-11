type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const formattedArgs = args.map(arg => {
        if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack}`;
        }
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return String(arg);
    }).join(' ');

    return `${prefix} ${message}${formattedArgs ? ' ' + formattedArgs : ''}`;
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

const logger = {
    debug: (message: string, ...args: unknown[]) => {
        if (shouldLog('debug')) console.log(formatMessage('debug', message, ...args));
    },
    info: (message: string, ...args: unknown[]) => {
        if (shouldLog('info')) console.log(formatMessage('info', message, ...args));
    },
    warn: (message: string, ...args: unknown[]) => {
        if (shouldLog('warn')) console.warn(formatMessage('warn', message, ...args));
    },
    error: (message: string, ...args: unknown[]) => {
        if (shouldLog('error')) console.error(formatMessage('error', message, ...args));
    },
};

export default logger;
