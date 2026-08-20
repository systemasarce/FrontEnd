export interface CentroMonitoreoHseExcelRow {
  codigo?: string;
  inspector?: string;
  supervisor?: string;
  fecha?: string;
  hora?: string;
  estado?: string;
  puntaje?: string;
  comentario?: string;
  ubicacion?: string;

  // Compatibilidad con respuestas antiguas o pruebas locales.
  Codigo?: string;
  Inspector?: string;
  Supervisor?: string;
  Fecha?: string;
  Hora?: string;
  Estado?: string;
  Puntaje?: string;
  Comentario?: string;
  Ubicacion?: string;
  'Ubicación'?: string;
}
