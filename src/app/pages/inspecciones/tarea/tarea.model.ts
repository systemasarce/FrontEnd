export interface TareaItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface TareaFilter {
  Id?: string;
  Nombre?: string;
  Estado?: string;
}
