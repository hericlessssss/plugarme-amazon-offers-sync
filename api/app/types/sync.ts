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
