export interface AmazonOfferPatchInput {
  marketplaceId: string
  price: number
  quantity: number
}

export interface AmazonCredentials {
  cliente_id: number
  filial_id: number
  seller_id: string
  marketplace_id: string
  lwa_client_id: string
  lwa_client_secret: string
  refresh_token: string
  access_token: string
  access_token_expires_at: string
}

export interface AmazonRefreshTokenInput {
  refreshToken: string
  clientId: string
  clientSecret: string
}

export interface AmazonAccessToken {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export interface AmazonListingPatchResult {
  sku: string
  status: string
  submissionId: string
  issues: unknown[]
}

export interface AmazonListingsPatchPayload {
  productType: 'PRODUCT'
  patches: [
    {
      op: 'replace'
      path: '/attributes/purchasable_offer'
      value: [
        {
          marketplace_id: string
          currency: 'BRL'
          our_price: [{ schedule: [{ value_with_tax: number }] }]
        },
      ]
    },
    {
      op: 'merge'
      path: '/attributes/fulfillment_availability'
      value: [
        {
          fulfillment_channel_code: 'DEFAULT'
          quantity: number
        },
      ]
    },
  ]
}
