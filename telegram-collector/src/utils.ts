export const normalizeChannelIdentifier = (input: string): string => {
    let value = input.trim();
    if (value.startsWith('https://t.me/')) {
        value = value.replace('https://t.me/', '');
    }
    if (value.startsWith('t.me/')) {
        value = value.replace('t.me/', '');
    }
    value = value.replace(/^s\//, '');
    value = value.replace(/^@/, '');
    if (value.includes('?')) {
        value = value.split('?')[0];
    }
    return value;
};

export const buildMessageLink = (username: string | undefined, id: number) => {
    if (!username) return undefined;
    return `https://t.me/${username}/${id}`;
};

