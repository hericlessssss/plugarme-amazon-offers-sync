import type { AmazonListingsPatchPayload, AmazonOfferPatchInput } from '#types/amazon'
import type { PlugarmeProduct } from '#types/plugarme'
import type { OfferMappingResult, SkipReason } from '#types/sync'

function sameBranch(rowBranchId: string | number, configuredBranchId: string | number) {
  return String(rowBranchId) === String(configuredBranchId)
}

function toFiniteNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function skip(product: PlugarmeProduct, reason: SkipReason): OfferMappingResult {
  return {
    status: 'skipped',
    sku: product.erp_id || null,
    title: product.titulo,
    reason,
  }
}

export function mapProductToAmazonOffer(
  product: PlugarmeProduct,
  filialId: string | number,
  marketplaceId: string
): OfferMappingResult {
  if (!product.ativo) {
    return skip(product, 'inactive_product')
  }

  if (!product.erp_id) {
    return skip(product, 'missing_sku')
  }

  const priceRow = product.preco?.find((price) => sameBranch(price.filial_id, filialId))
  const price = toFiniteNumber(priceRow?.preco)
  if (price === null || price <= 0) {
    return skip(product, 'missing_valid_price')
  }

  const stockRow = product.estoque?.find((stock) => sameBranch(stock.filial_id, filialId))
  if (!stockRow) {
    return skip(product, 'missing_stock')
  }

  const quantity = toFiniteNumber(stockRow.quantidade)
  if (quantity === null || !Number.isInteger(quantity) || quantity < 0) {
    return skip(product, 'invalid_stock_quantity')
  }

  return {
    status: 'publishable',
    sku: product.erp_id,
    title: product.titulo,
    price,
    quantity,
    marketplaceId,
  }
}

export function buildAmazonOfferPatchPayload(
  input: AmazonOfferPatchInput
): AmazonListingsPatchPayload {
  return {
    productType: 'PRODUCT',
    patches: [
      {
        op: 'replace',
        path: '/attributes/purchasable_offer',
        value: [
          {
            marketplace_id: input.marketplaceId,
            currency: 'BRL',
            our_price: [{ schedule: [{ value_with_tax: input.price }] }],
          },
        ],
      },
      {
        op: 'merge',
        path: '/attributes/fulfillment_availability',
        value: [
          {
            fulfillment_channel_code: 'DEFAULT',
            quantity: input.quantity,
          },
        ],
      },
    ],
  }
}
