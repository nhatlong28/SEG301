// Entity Resolution exports
export { ProductCodeExtractor } from './codeExtractor';
export type { ExtractedCode } from './codeExtractor';

export { StringMatcher } from './similarity';

export { MLEntityMatcher } from './mlMatcher';
export type { MatchFeatures, MatchResult, ProductData } from './mlMatcher';

export { Deduplicator } from './deduplicator';
export type { DeduplicationStats } from './deduplicator';

// Gap 1-9 fix components
export { SmartBlockingStrategy, smartBlockingStrategy } from './smartBlocking';
export type { BlockingKey } from './smartBlocking';

export { VariantManager, variantManager } from './variantManager';
export type { VariantInfo, VariantGroupResult } from './variantManager';

export { CanonicalQualityScorer, qualityScorer } from './qualityScorer';
export type { QualityResult } from './qualityScorer';

export { IntraSourceDeduplicator, intraSourceDeduplicator } from './intraSourceDedup';
export type { DeduplicatedProduct } from './intraSourceDedup';

export { ManualReviewQueue, reviewQueue } from './reviewQueue';
export type { ReviewQueueItem, ReviewType, ReviewStatus } from './reviewQueue';

export { CanonicalHistoryTracker, historyTracker } from './historyTracker';
export type { HistoryEntry, EventType, TriggeredBy } from './historyTracker';

export { AdaptiveThresholdManager, thresholdManager } from './adaptiveThresholds';
export type { ThresholdConfig } from './adaptiveThresholds';
