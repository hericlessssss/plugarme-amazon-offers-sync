/*
| Routes file
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const ApiDocsController = () => import('#controllers/api_docs_controller')
const SyncAmazonOffersController = () => import('#controllers/sync_amazon_offers_controller')

router.get('/', () => {
  return {
    name: 'plugarme-amazon-offers-sync-api',
    status: 'ok',
  }
})

router.post('/sync/amazon/offers', [SyncAmazonOffersController, 'handle'])
router.get('/openapi.json', [ApiDocsController, 'openapi'])
router.get('/docs', [ApiDocsController, 'html'])
