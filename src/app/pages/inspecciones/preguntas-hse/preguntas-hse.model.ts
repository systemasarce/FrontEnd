export interface PreguntasHseItem {
  id: number | null;
  pregunta: string;
  estado: string;
}

export interface PreguntasHseFilter {
  Pregunta_Id?: number;
  Pregunta_Nombre?: string;
  Estado?: string;
}
