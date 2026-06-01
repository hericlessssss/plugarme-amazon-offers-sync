export interface AmazonOfferPatchInput {
  marketplaceId: string
  price: number
  quantity: number
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
