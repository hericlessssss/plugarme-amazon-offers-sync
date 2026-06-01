export type SkipReason =
  | 'inactive_product'
  | 'missing_sku'
  | 'missing_valid_price'
  | 'missing_stock'
  | 'invalid_stock_quantity'

export interface PublishableOffer {
  status: 'publishable'
  sku: string
  title: string
  marketplaceId: string
  price: number
  quantity: number
}

export interface SkippedOffer {
  status: 'skipped'
  sku: string | null
  title: string
  reason: SkipReason
}

export type OfferMappingResult = PublishableOffer | SkippedOffer

export interface PublishedSyncItem {
  sku: string
  title: string
  price: number
  quantity: number
  submissionId: string
  status: string
}

export interface SkippedSyncItem {
  sku: string | null
  title: string
  reason: SkipReason
}

export interface FailedSyncItem {
  sku: string
  title: string
  statusCode?: number
  reason: string
}

export interface SyncSummary {
  total: number
  published: number
  skipped: number
  failed: number
}

export interface SyncAmazonOffersResult {
  summary: SyncSummary
  published: PublishedSyncItem[]
  skipped: SkippedSyncItem[]
  failed: FailedSyncItem[]
}
