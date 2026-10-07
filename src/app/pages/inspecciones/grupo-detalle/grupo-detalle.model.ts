export interface GrupoDetalleItem {
  detalleId: number | null;
  detalleCod: string;
  detalleNombre: string;
  detalleValor: number | null;
  grupoId: number | null;
  grupoNombre: string;
  grupoDescripcion: string;
  estado: string;
}

export interface GrupoDetalleFiltro {
  Detalle_Id?: number;
  Detalle_Cod?: string;
  Detalle_Nombre?: string;
  Detalle_Valor?: number;
  Grupo_Nombre?: string;
  Estado?: string;
  Grupo_Descripcion?: string;
}
