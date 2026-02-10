/**
 * Deduplication Service
 * Manages duplicate detection and cleanup for collected data
 */

import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

/**
 * Check if message is duplicate by content hash
 */
export async function isDuplicate(contentHash) {
    try {
        const result = await query(
            'SELECT id, collected_at FROM collected_data WHERE content_hash = $1 LIMIT 1',
            [contentHash]
        );
        
        if (result.rows.length > 0) {
            return {
                isDuplicate: true,
                existingId: result.rows[0].id,
                existingDate: result.rows[0].collected_at
            };
        }
        
        return { isDuplicate: false };
    } catch (error) {
        logger.error('Error checking duplicate:', error);
        throw error;
    }
}

/**
 * Find duplicates in collected_data table
 */
export async function findDuplicates(options = {}) {
    const {
        sourceId = null,
        limit = 100,
        includeContent = false
    } = options;

    try {
        const whereClause = sourceId ? 'WHERE source_id = $1' : '';
        const params = sourceId ? [sourceId] : [];

        const result = await query(
            `SELECT 
                content_hash,
                COUNT(*) as count,
                MIN(id) as first_id,
                MAX(id) as last_id,
                MIN(collected_at) as first_collected,
                MAX(collected_at) as last_collected,
                ${includeContent ? 'raw_data,' : ''}
                source_id
            FROM collected_data
            ${whereClause}
            GROUP BY content_hash, source_id ${includeContent ? ', raw_data' : ''}
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT ${limit}`,
            params
        );

        return result.rows.map(row => ({
            contentHash: row.content_hash,
            duplicateCount: parseInt(row.count),
            firstId: row.first_id,
            lastId: row.last_id,
            firstCollected: row.first_collected,
            lastCollected: row.last_collected,
            sourceId: row.source_id,
            ...(includeContent && { rawData: row.raw_data })
        }));
    } catch (error) {
        logger.error('Error finding duplicates:', error);
        throw error;
    }
}

/**
 * Get duplicate statistics
 */
export async function getDuplicateStats(sourceId = null) {
    try {
        const whereClause = sourceId ? 'WHERE source_id = $1' : '';
        const params = sourceId ? [sourceId] : [];

        const result = await query(
            `SELECT 
                COUNT(DISTINCT content_hash) as unique_messages,
                COUNT(*) as total_messages,
                COUNT(*) - COUNT(DISTINCT content_hash) as duplicate_count,
                (COUNT(*) - COUNT(DISTINCT content_hash))::numeric / 
                NULLIF(COUNT(*), 0)::numeric * 100 as duplicate_percentage
            FROM collected_data
            ${whereClause}`,
            params
        );

        const stats = result.rows[0];
        
        return {
            uniqueMessages: parseInt(stats.unique_messages),
            totalMessages: parseInt(stats.total_messages),
            duplicateCount: parseInt(stats.duplicate_count),
            duplicatePercentage: Math.round(parseFloat(stats.duplicate_percentage || 0) * 100) / 100
        };
    } catch (error) {
        logger.error('Error getting duplicate stats:', error);
        throw error;
    }
}

/**
 * Remove duplicates keeping the oldest entry
 */
export async function removeDuplicates(options = {}) {
    const {
        sourceId = null,
        dryRun = true,
        keepStrategy = 'oldest' // 'oldest' or 'newest'
    } = options;

    try {
        const whereClause = sourceId ? 'WHERE source_id = $1' : '';
        const params = sourceId ? [sourceId] : [];

        // Find duplicates
        const duplicates = await query(
            `SELECT 
                content_hash,
                ARRAY_AGG(id ORDER BY collected_at ${keepStrategy === 'oldest' ? 'ASC' : 'DESC'}) as ids
            FROM collected_data
            ${whereClause}
            GROUP BY content_hash
            HAVING COUNT(*) > 1`,
            params
        );

        const results = {
            totalDuplicateGroups: duplicates.rows.length,
            totalRecordsToDelete: 0,
            deletedIds: [],
            keptIds: [],
            dryRun
        };

        for (const group of duplicates.rows) {
            const [keepId, ...deleteIds] = group.ids;
            results.keptIds.push(keepId);
            results.totalRecordsToDelete += deleteIds.length;

            if (!dryRun) {
                // Actually delete the duplicates
                for (const id of deleteIds) {
                    await query('DELETE FROM collected_data WHERE id = $1', [id]);
                    results.deletedIds.push(id);
                }
                logger.info(`Deleted ${deleteIds.length} duplicates, kept ${keepId}`);
            } else {
                results.deletedIds.push(...deleteIds);
            }
        }

        return results;
    } catch (error) {
        logger.error('Error removing duplicates:', error);
        throw error;
    }
}

/**
 * Merge duplicate entries (combine metadata)
 */
export async function mergeDuplicates(contentHash) {
    try {
        // Get all entries with this content hash
        const result = await query(
            `SELECT * FROM collected_data 
            WHERE content_hash = $1 
            ORDER BY collected_at ASC`,
            [contentHash]
        );

        if (result.rows.length <= 1) {
            return { merged: false, message: 'No duplicates found' };
        }

        const entries = result.rows;
        const keepEntry = entries[0]; // Keep oldest
        const deleteEntries = entries.slice(1);

        // Merge metadata
        const mergedMetadata = {
            ...keepEntry.metadata,
            duplicate_count: entries.length,
            merged_from: deleteEntries.map(e => e.id),
            merged_at: new Date().toISOString(),
            collected_times: entries.map(e => e.collected_at)
        };

        // Update the kept entry with merged metadata
        await query(
            `UPDATE collected_data 
            SET metadata = $1 
            WHERE id = $2`,
            [JSON.stringify(mergedMetadata), keepEntry.id]
        );

        // Delete duplicates
        for (const entry of deleteEntries) {
            await query('DELETE FROM collected_data WHERE id = $1', [entry.id]);
        }

        logger.info(`Merged ${entries.length} duplicates for hash ${contentHash}`);

        return {
            merged: true,
            keptId: keepEntry.id,
            deletedIds: deleteEntries.map(e => e.id),
            totalMerged: entries.length
        };
    } catch (error) {
        logger.error('Error merging duplicates:', error);
        throw error;
    }
}

/**
 * Analyze duplicate patterns
 */
export async function analyzeDuplicatePatterns(sourceId = null) {
    try {
        const whereClause = sourceId ? 'WHERE cd.source_id = $1' : '';
        const params = sourceId ? [sourceId] : [];

        const result = await query(
            `WITH duplicate_groups AS (
                SELECT 
                    content_hash,
                    COUNT(*) as dup_count,
                    source_id,
                    EXTRACT(EPOCH FROM (MAX(collected_at) - MIN(collected_at))) / 60 as time_span_minutes
                FROM collected_data
                ${whereClause}
                GROUP BY content_hash, source_id
                HAVING COUNT(*) > 1
            )
            SELECT 
                COUNT(*) as total_duplicate_groups,
                SUM(dup_count - 1) as total_duplicates,
                AVG(dup_count) as avg_duplicates_per_group,
                MAX(dup_count) as max_duplicates,
                AVG(time_span_minutes) as avg_time_span_minutes,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_span_minutes) as median_time_span_minutes
            FROM duplicate_groups`,
            params
        );

        const analysis = result.rows[0];

        return {
            totalDuplicateGroups: parseInt(analysis.total_duplicate_groups) || 0,
            totalDuplicates: parseInt(analysis.total_duplicates) || 0,
            avgDuplicatesPerGroup: Math.round(parseFloat(analysis.avg_duplicates_per_group || 0) * 100) / 100,
            maxDuplicates: parseInt(analysis.max_duplicates) || 0,
            avgTimeSpanMinutes: Math.round(parseFloat(analysis.avg_time_span_minutes || 0) * 100) / 100,
            medianTimeSpanMinutes: Math.round(parseFloat(analysis.median_time_span_minutes || 0) * 100) / 100
        };
    } catch (error) {
        logger.error('Error analyzing duplicate patterns:', error);
        throw error;
    }
}

export default {
    isDuplicate,
    findDuplicates,
    getDuplicateStats,
    removeDuplicates,
    mergeDuplicates,
    analyzeDuplicatePatterns
};
