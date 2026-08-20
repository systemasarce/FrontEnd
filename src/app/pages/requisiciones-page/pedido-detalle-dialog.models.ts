export interface PedidoDetalleItemOption {
  id: number;
  code: string;
  description: string;
  groupDescription: string;
  unitId?: number;
  unitCode?: string;
  unitDescription?: string;
}

export interface PedidoDetalleUnidadOption {
  id: number;
  code: string;
  description: string;
  abbreviation: string;
}

export interface PedidoDetalleDialogValue {
  itemCode: string;
  itemDescription: string;
  unitCode: string;
  unitDescription: string;
  centroCostoId: number;
  centroCostoDescripcion: string;
  centroCostoCantidadRequerida: number;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}
