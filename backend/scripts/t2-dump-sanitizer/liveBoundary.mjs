/**
 * Live boundary wrapper — re-exports orchestrator live boundary with sanitizer naming.
 */

export {
  createLiveBoundary,
  createNodeJournalFs,
} from '../t2-retry-orchestrator/liveBoundary.mjs';

/**
 * @param {ReturnType<import('../t2-retry-orchestrator/liveBoundary.mjs').createLiveBoundary>} boundary
 */
export function attachSanitizedWriteAlias(boundary) {
  return {
    ...boundary,
    writeSanitizedActiveDump: boundary.writeProjectedActiveDump.bind(boundary),
  };
}
