export interface TipoInspeccionItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface TipoInspeccionFilter {
  Id?: number;
  Nombre?: string;
  Estado?: string;
}
