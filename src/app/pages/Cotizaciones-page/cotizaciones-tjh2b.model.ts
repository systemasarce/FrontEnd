export interface CotizacionTjh2bItem {
  id: number | null;
  numero: string;
  clienteId: number | null;
  clienteNombre: string;
  servicio: string;
  fechaIni: string;
  fechaFin: string;
  documentoPdf: string;
  cotizacionEstado: string;
  estado: string;
}

export interface CotizacionTjh2bFilter {
  Numero?: string;
  ClienteNombre?: string;
  Servicio?: string;
  FechaInicio?: string | null;
  FechaFin?: string | null;
  EstadoCotizacion?: string;
  Estado?: string;
}
