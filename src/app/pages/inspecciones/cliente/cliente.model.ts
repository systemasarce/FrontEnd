export interface ClienteItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface ClienteFilter {
  Id?: number;
  Nombre?: string;
  Estado?: string;
}
