export interface TipoRiesgoItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface TipoRiesgoFilter {
  Id?: number;
  Nombre?: string;
  Estado?: string;
}
