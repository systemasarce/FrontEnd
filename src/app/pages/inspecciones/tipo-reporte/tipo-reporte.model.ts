export interface TipoReporteItem {
  reporteId: number | null;
  reporteTipo: string;
  estado: string;
}

export interface TipoReporteFiltro {
  Reporte_Id?: number;
  Reporte_Tipo?: string;
  Estado?: string;
}
