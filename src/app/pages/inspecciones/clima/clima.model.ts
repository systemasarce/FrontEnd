export interface ClimaItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface ClimaFilter {
  Id?: string;
  Nombre?: string;
  Estado?: string;
}
