export interface GrupoItem {
  grupoId: number | null;
  grupoCod: number | null;
  grupoNombre: string;
  estado: string;
}

export interface GrupoFiltro {
  Grupo_Id?: number;
  Grupo_Cod?: number;
  Grupo_Nombre?: string;
  Estado?: string;
}
