import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'sync_amazon_offers': { paramsTuple?: []; params?: {} }
    'api_docs.openapi': { paramsTuple?: []; params?: {} }
    'api_docs.html': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'api_docs.openapi': { paramsTuple?: []; params?: {} }
    'api_docs.html': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'api_docs.openapi': { paramsTuple?: []; params?: {} }
    'api_docs.html': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'sync_amazon_offers': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}