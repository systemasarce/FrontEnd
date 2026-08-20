export interface MotivoItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface MotivoFilter {
  Id?: string;
  Nombre?: string;
  Estado?: string;
}
