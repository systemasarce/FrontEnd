export interface JefeItem {
  id: number | null;
  tipoReporte: string;
  estado: string;
}

export interface JefeFilter {
  Id?: number;
  Reporte_Tipo?: string;
  Estado?: string;
}
