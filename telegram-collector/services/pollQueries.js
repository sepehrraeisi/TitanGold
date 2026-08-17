/**
 * Canonical telegram_messages query helpers used by channel polling.
 * Query text is frozen for C1 — MAX(message_id) semantics must not change.
 * Accepts an injected query function (pool.query-compatible) so tests need no live DB.
 */

const LAST_MESSAGE_ID_SQL =
    'SELECT MAX(message_id) AS max_id FROM telegram_messages WHERE channel_id = $1';

const SAVE_MESSAGES_INSERT_HEAD = `INSERT INTO telegram_messages
                    (channel_id, message_id, sender_id, sender_username, message_text, message_type, has_media, telegram_created_at)
                VALUES `;

const SAVE_MESSAGES_CONFLICT = `
                ON CONFLICT (message_id, channel_id) DO NOTHING
                RETURNING id`;

async function getLastMessageIdForChannel(query, channelDbId) {
    try {
        const result = await query(LAST_MESSAGE_ID_SQL, [channelDbId]);
        const maxId = result.rows[0]?.max_id;
        return maxId != null ? Number(maxId) : 0;
    } catch (error) {
        console.error('❌ Error getting last message id for channel:', error.message);
        return 0;
    }
}

function buildSaveMessagesQuery(messages) {
    const values = messages.map((msg, index) => {
        const base = index * 8;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    }).join(', ');
    const params = [];
    messages.forEach((msg) => {
        params.push(
            msg.channelDbId,
            msg.message_id.toString(),
            msg.sender_id?.toString() || null,
            msg.sender_username || null,
            msg.message_text,
            msg.message_type,
            msg.has_media,
            msg.telegram_created_at
        );
    });
    return {
        text: `${SAVE_MESSAGES_INSERT_HEAD}${values}${SAVE_MESSAGES_CONFLICT}`,
        params,
    };
}

async function saveMessages(query, channelDbId, messages) {
    if (!messages || messages.length === 0) {
        return 0;
    }
    try {
        const { text, params } = buildSaveMessagesQuery(
            messages.map((msg) => ({ ...msg, channelDbId }))
        );
        const result = await query(text, params);
        return result.rowCount || 0;
    } catch (error) {
        console.error('❌ Error saving messages to database:', error);
        throw error;
    }
}

module.exports = {
    LAST_MESSAGE_ID_SQL,
    SAVE_MESSAGES_INSERT_HEAD,
    SAVE_MESSAGES_CONFLICT,
    getLastMessageIdForChannel,
    buildSaveMessagesQuery,
    saveMessages,
};
