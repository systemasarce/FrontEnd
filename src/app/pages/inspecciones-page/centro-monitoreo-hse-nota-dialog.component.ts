import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../Services/api.services';

import { AuthService } from '../../features/auth/services/auth.service';
import { PreguntasHseService } from '../inspecciones/preguntas-hse/preguntas-hse.service';
import { ConfirmacionAccionDialogComponent } from './confirmacion-accion-dialog.component';

type DataRecord = Record<string, unknown>;
type RespuestaValor = 'P' | 'N' | '';

interface ArchivoVinculado {
  ruta: string;
  nombre: string;
}

interface CentroMonitoreoNotaItem {
  preguntaId: number;
  preguntaNombre: string;
  audio: RespuestaValor;
  documento: RespuestaValor;
}

export interface CentroMonitoreoNotaData {
  Centro_HSE_Id?: number;
  Centro_HSE_Cod?: string;
}

export interface CentroMonitoreoHseNotaResult {
  centroMonitoreoId: number | null;
  respuestas: Array<{
    preguntaId: number;
    audio: RespuestaValor;
    documento: RespuestaValor;
  }>;
  comentario: string;
}

@Component({
  selector: 'app-centro-monitoreo-hse-nota-dialog',
  templateUrl: './centro-monitoreo-hse-nota-dialog.component.html',
  styleUrls: ['./centro-monitoreo-hse-nota-dialog.component.scss']
})
export class CentroMonitoreoHseNotaDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() centroMonitoreo: CentroMonitoreoNotaData | null = null;
  @Output() volver = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<CentroMonitoreoHseNotaResult>();

  cargandoPreguntas = false;
  guardando = false;
  saveError = '';
  errorMessage = '';
  preguntas: CentroMonitoreoNotaItem[] = [];
  comentario = '';

  documentosVinculados: ArchivoVinculado[] = [];
  audiosVinculados: ArchivoVinculado[] = [];
  audioUrlsVinculados: Record<string, SafeUrl> = {};
  audioCargando: Record<string, boolean> = {};
  audioError: Record<string, string> = {};
  private readonly objectUrls = new Map<string, string>();

  private preguntasCargadas = false;

  constructor(
    private readonly preguntasHseService: PreguntasHseService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly apiService: ApiService,
    private readonly sanitizer: DomSanitizer
  ) {}

  get inspectorNombre(): string {
    const nombre = this.authService.getCurrentUserName?.().trim() ?? '';
    return nombre || '-';
  }

  ngOnInit(): void {
    this.cargarPreguntas();
    this.cargarArchivosVinculados();
  }

  ngOnDestroy(): void {
    this.limpiarUrlsAudio();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centroMonitoreo'] && !changes['centroMonitoreo'].firstChange) {
      this.preguntas.forEach((item) => { item.audio = ''; item.documento = ''; });
      this.comentario = '';
      this.saveError = '';
      this.limpiarUrlsAudio();
      this.documentosVinculados = [];
      this.audiosVinculados = [];
      this.audioCargando = {};
      this.audioError = {};
      this.cargarArchivosVinculados();
      if (!this.preguntasCargadas) {
        this.cargarPreguntas();
      }
    }
  }

  cerrar(): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: {
        titulo: 'Cancelar Nota de Centro de Monitoreo HSE',
        mensaje: 'Se cerrará el formulario de Centro de Monitoreo HSE y se perderán los cambios no guardados.',
        textoConfirmar: 'Confirmar cancelación',
        textoCancelar: 'Volver',
        tipo: 'normal'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.volver.emit(); }
    });
  }

  guardar(): void {
    this.saveError = '';

    const incompletas = this.preguntas.filter((item) => !item.audio || !item.documento);
    if (incompletas.length > 0) {
      this.saveError = 'Debes marcar Pasó o No pasó en Audio y Documento para todas las preguntas.';
      return;
    }

    this.guardando = true;

    const payload: CentroMonitoreoHseNotaResult = {
      centroMonitoreoId: this.centroMonitoreo?.Centro_HSE_Id ?? null,
      respuestas: this.preguntas.map((item) => ({
        preguntaId: item.preguntaId,
        audio: item.audio,
        documento: item.documento
      })),
      comentario: this.comentario.trim()
    };

    this.guardando = false;
    this.guardado.emit(payload);
  }

  abrirDocumentoVinculado(archivo: ArchivoVinculado): void {
    this.apiService.getArchivoCentroMonitoreoHse(archivo.ruta).subscribe({
      next: (contenido: ArrayBuffer) => {
        const extension = archivo.nombre.split('.').pop()?.toLowerCase() || '';
        const mimeType = this.obtenerMimeType(extension);
        const objectUrl = URL.createObjectURL(new Blob([contenido], { type: mimeType }));
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      },
      error: () => alert('No se pudo abrir el documento vinculado.')
    });
  }

  cargarAudioVinculado(archivo: ArchivoVinculado): void {
    if (this.audioUrlsVinculados[archivo.ruta]) {
      return;
    }

    this.audioCargando[archivo.ruta] = true;
    this.audioError[archivo.ruta] = '';

    this.apiService.getArchivoCentroMonitoreoHse(archivo.ruta).subscribe({
      next: (contenido: ArrayBuffer) => {
        const extension = archivo.nombre.split('.').pop()?.toLowerCase() || '';
        const mimeType = this.obtenerMimeType(extension);
        const objectUrl = URL.createObjectURL(new Blob([contenido], { type: mimeType }));
        this.objectUrls.set(archivo.ruta, objectUrl);
        this.audioUrlsVinculados[archivo.ruta] = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
        this.audioCargando[archivo.ruta] = false;
      },
      error: () => {
        this.audioCargando[archivo.ruta] = false;
        this.audioError[archivo.ruta] = 'No se pudo cargar este audio.';
      }
    });
  }

  establecerRespuesta(item: CentroMonitoreoNotaItem, campo: 'audio' | 'documento', valor: RespuestaValor): void {
    item[campo] = valor;
  }

  totalRespondidas(campo: 'audio' | 'documento'): number {
    return this.preguntas.filter((item) => item[campo] === 'P' || item[campo] === 'N').length;
  }

  private cargarArchivosVinculados(): void {
    const centroHseId = this.centroMonitoreo?.Centro_HSE_Id;
    if (!centroHseId) {
      this.documentosVinculados = [];
      this.audiosVinculados = [];
      return;
    }

    this.apiService.getArchivosCentroMonitoreoHse(centroHseId).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando archivos vinculados del Centro HSE', error);
        this.documentosVinculados = [];
        this.audiosVinculados = [];
        return of(null);
      })
    ).subscribe((response: unknown) => {
      const data = this.isRecord(response) ? response : {};
      const documento = this.leerTexto(data, [
        'Centro_HSE_Documento',
        'Centro_Hse_Documento',
        'centro_HSE_Documento',
        'centro_Hse_Documento'
      ]);
      const audio = this.leerTexto(data, [
        'Centro_HSE_Audio',
        'centro_HSE_Audio'
      ]);

      this.documentosVinculados = this.convertirRutas(documento, 'Documento');
      this.audiosVinculados = this.convertirRutas(audio, 'Audio');
    });
  }

  private leerTexto(record: DataRecord, claves: string[]): string {
    for (const clave of claves) {
      const valor = record[clave];
      if (valor !== null && valor !== undefined && String(valor).trim()) {
        return String(valor).trim();
      }
    }
    return '';
  }

  private convertirRutas(texto: string, prefijo: string): ArchivoVinculado[] {
    if (!texto) {
      return [];
    }

    return texto
      .split(/[\r\n|;,]+/g)
      .map((ruta) => ruta.trim())
      .filter(Boolean)
      .map((ruta, index) => ({
        ruta,
        nombre: ruta.split(/[\\/]/).pop()?.trim() || `${prefijo} ${index + 1}`
      }));
  }

  private obtenerMimeType(extension: string): string {
    const tipos: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      rtf: 'application/rtf',
      zip: 'application/zip',
      rar: 'application/vnd.rar',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      oga: 'audio/ogg',
      webm: 'audio/webm',
      flac: 'audio/flac'
    };

    return tipos[extension] || 'application/octet-stream';
  }

  private limpiarUrlsAudio(): void {
    for (const objectUrl of this.objectUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    this.objectUrls.clear();
    this.audioUrlsVinculados = {};
  }

  private cargarPreguntas(): void {
    this.cargandoPreguntas = true;
    this.errorMessage = '';

    this.cargarPreguntasActivas();
  }

  private cargarPreguntasActivas(): void {
    this.preguntasHseService.listar({ Estado: 'A' }).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando preguntas HSE para Nota de Centro de Monitoreo', error);
        this.preguntas = [];
        this.errorMessage = 'No se pudo cargar la lista de preguntas HSE.';
        this.cargandoPreguntas = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.preguntas = registros.map((item) => this.mapPregunta(item));
        this.cargandoPreguntas = false;
        this.preguntasCargadas = true;
      },
      error: (error: unknown) => {
        console.error('Error inesperado cargando preguntas HSE', error);
        this.preguntas = [];
        this.errorMessage = 'No se pudo cargar la lista de preguntas HSE.';
        this.cargandoPreguntas = false;
      }
    });
  }

  private mapPregunta(item: DataRecord): CentroMonitoreoNotaItem {
    const rawId = item['id'] ?? item['Id'] ?? item['Pregunta_Id'] ?? item['pregunta_Id'];
    const rawPregunta = item['pregunta'] ?? item['Pregunta'] ?? item['Pregunta_Nombre'] ?? item['Nombre'] ?? item['nombre'];

    return {
      preguntaId: rawId === null || rawId === undefined || rawId === '' ? 0 : Number(rawId),
      preguntaNombre: String(rawPregunta ?? '').trim(),
      audio: '',
      documento: ''
    };
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    for (const key of ['Elements', 'elements', 'Data', 'data', 'Result', 'result', 'Items', 'items', 'Lista', 'lista']) {
      const value = response[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isRecord(item));
      }
    }

    return [response];
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
