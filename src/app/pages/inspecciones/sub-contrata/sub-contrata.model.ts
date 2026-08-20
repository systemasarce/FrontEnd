export interface SubContrataItem {
  id: number | null;
  nombre: string;
  estado: string;
}

export interface SubContrataFilter {
  Id?: string;
  Nombre?: string;
  Estado?: string;
}
