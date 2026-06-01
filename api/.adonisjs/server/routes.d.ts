import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'sync_amazon_offers': { paramsTuple?: []; params?: {} }
  }
  GET: {
  }
  HEAD: {
  }
  POST: {
    'sync_amazon_offers': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}