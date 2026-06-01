export interface PlugarmePrice {
  filial_id: string | number
  preco: number | string | null
}

export interface PlugarmeStock {
  filial_id: string | number
  quantidade: number | string | null
  custo?: number | string | null
  custo_ultima_entrada?: number | string | null
}

export interface PlugarmeProduct {
  id: string
  cliente_id: string | number
  erp_id: string
  titulo: string
  ativo: boolean
  preco?: PlugarmePrice[]
  estoque?: PlugarmeStock[]
}
