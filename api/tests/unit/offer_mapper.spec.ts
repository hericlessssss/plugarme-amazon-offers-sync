import { test } from '@japa/runner'
import { buildAmazonOfferPatchPayload, mapProductToAmazonOffer } from '#services/offer_mapper'
import type { PlugarmeProduct } from '#types/plugarme'

const FILIAL_ID = 6
const MARKETPLACE_ID = 'A2Q3Y263D00KWC'

function makeProduct(overrides: Partial<PlugarmeProduct> = {}): PlugarmeProduct {
  return {
    id: '761487',
    cliente_id: '1',
    erp_id: 'PS5-CONTROLE',
    titulo: 'Controle Sony DualSense PS5',
    ativo: true,
    preco: [
      {
        filial_id: '6',
        preco: 599,
      },
    ],
    estoque: [
      {
        filial_id: '6',
        quantidade: 100,
        custo: 399,
      },
    ],
    ...overrides,
  }
}

test.group('Offer mapper', () => {
  test('maps an active Plugar.me product to an Amazon offer candidate', ({ assert }) => {
    const result = mapProductToAmazonOffer(makeProduct(), FILIAL_ID, MARKETPLACE_ID)

    assert.deepEqual(result, {
      status: 'publishable',
      sku: 'PS5-CONTROLE',
      title: 'Controle Sony DualSense PS5',
      price: 599,
      quantity: 100,
      marketplaceId: MARKETPLACE_ID,
    })
  })

  test('skips inactive products', ({ assert }) => {
    const result = mapProductToAmazonOffer(makeProduct({ ativo: false }), FILIAL_ID, MARKETPLACE_ID)

    assert.deepInclude(result, {
      status: 'skipped',
      sku: 'PS5-CONTROLE',
      reason: 'inactive_product',
    })
  })

  test('skips products without a valid price for the configured branch', ({ assert }) => {
    const result = mapProductToAmazonOffer(
      makeProduct({
        preco: [
          {
            filial_id: '9',
            preco: 599,
          },
        ],
      }),
      FILIAL_ID,
      MARKETPLACE_ID
    )

    assert.deepInclude(result, {
      status: 'skipped',
      sku: 'PS5-CONTROLE',
      reason: 'missing_valid_price',
    })
  })

  test('skips products with a non-positive price', ({ assert }) => {
    const result = mapProductToAmazonOffer(
      makeProduct({
        preco: [
          {
            filial_id: '6',
            preco: 0,
          },
        ],
      }),
      FILIAL_ID,
      MARKETPLACE_ID
    )

    assert.deepInclude(result, {
      status: 'skipped',
      sku: 'PS5-CONTROLE',
      reason: 'missing_valid_price',
    })
  })

  test('skips products without stock for the configured branch', ({ assert }) => {
    const result = mapProductToAmazonOffer(
      makeProduct({
        estoque: [
          {
            filial_id: '9',
            quantidade: 100,
          },
        ],
      }),
      FILIAL_ID,
      MARKETPLACE_ID
    )

    assert.deepInclude(result, {
      status: 'skipped',
      sku: 'PS5-CONTROLE',
      reason: 'missing_stock',
    })
  })

  test('accepts zero stock quantity as publishable', ({ assert }) => {
    const result = mapProductToAmazonOffer(
      makeProduct({
        estoque: [
          {
            filial_id: '6',
            quantidade: 0,
          },
        ],
      }),
      FILIAL_ID,
      MARKETPLACE_ID
    )

    assert.deepInclude(result, {
      status: 'publishable',
      sku: 'PS5-CONTROLE',
      quantity: 0,
    })
  })

  test('builds the Amazon listings patch payload without product cost', ({ assert }) => {
    const payload = buildAmazonOfferPatchPayload({
      marketplaceId: MARKETPLACE_ID,
      price: 599,
      quantity: 100,
    })

    assert.deepEqual(payload, {
      productType: 'PRODUCT',
      patches: [
        {
          op: 'replace',
          path: '/attributes/purchasable_offer',
          value: [
            {
              marketplace_id: MARKETPLACE_ID,
              currency: 'BRL',
              our_price: [{ schedule: [{ value_with_tax: 599 }] }],
            },
          ],
        },
        {
          op: 'merge',
          path: '/attributes/fulfillment_availability',
          value: [
            {
              fulfillment_channel_code: 'DEFAULT',
              quantity: 100,
            },
          ],
        },
      ],
    })
    const stockPayload = payload.patches[1].value[0] as Record<string, unknown>
    assert.isUndefined(stockPayload.custo)
    assert.isUndefined(stockPayload.cost)
  })
})
