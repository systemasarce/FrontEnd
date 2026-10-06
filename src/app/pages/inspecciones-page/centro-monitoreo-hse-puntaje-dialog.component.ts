import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../Services/api.services';
import { AuthService } from '../../features/auth/services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';
import { ConfirmacionAccionDialogComponent } from './confirmacion-accion-dialog.component';

type DataRecord = Record<string, unknown>;
type RespuestaValor = 'P' | 'N' | '';
type EstadoRevision = 'CERRADO' | 'ABIERTO';

interface CentroMonitoreoPuntajeItem {
  preguntaId: number;
  preguntaNombre: string;
  audioPuntajeId: number | null;
  audio: RespuestaValor;
  documentoPuntajeId: number | null;
  documento: RespuestaValor;
}

export interface CentroMonitoreoPuntajeData {
  Centro_HSE_Id?: number;
  Centro_HSE_Cod?: string;
}

export interface CentroMonitoreoHsePuntajeResult {
  centroMonitoreoId: number | null;
  detalles: Array<{ Puntaje_Id: number; Puntaje_Rpta: 'S' | 'N' }>;
  Centro_Revision: EstadoRevision;
  Centro_Motivo: string;
  Motivo: string;
  Centro_Comentario: string;
}

interface ArchivoVinculado {
  ruta: string;
  nombre: string;
}

@Component({
  selector: 'app-centro-monitoreo-hse-puntaje-dialog',
  templateUrl: './centro-monitoreo-hse-puntaje-dialog.component.html',
  styleUrls: ['./centro-monitoreo-hse-nota-dialog.component.scss']
})
export class CentroMonitoreoHsePuntajeDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() centroMonitoreo: CentroMonitoreoPuntajeData | null = null;
  @Output() volver = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<CentroMonitoreoHsePuntajeResult>();

  readonly form: FormGroup;

  cargando = false;
  guardando = false;
  saveError = '';
  errorMessage = '';
  preguntas: CentroMonitoreoPuntajeItem[] = [];

  private preguntasCargadas = false;

  documentosVinculados: ArchivoVinculado[] = [];
  audiosVinculados: ArchivoVinculado[] = [];
  audioUrlsVinculados: Record<string, SafeUrl> = {};
  audioCargando: Record<string, boolean> = {};
  audioError: Record<string, string> = {};
  private objectUrls = new Map<string, string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly sanitizer: DomSanitizer
  ) {
    this.form = this.fb.group({
      estadoRevision: ['CERRADO', Validators.required],
      motivo: ['', [noWhitespaceValidator()]],
      comentario: ['']
    });
  }

  get inspectorNombre(): string {
    const nombre = this.authService.getCurrentUserName?.().trim() ?? '';
    return nombre || '-';
  }

  get estadoRevisionSeleccionado(): EstadoRevision {
    return this.normalizarEstadoRevision(this.form.controls['estadoRevision'].value);
  }

  get requiereMotivo(): boolean {
    return this.estadoRevisionSeleccionado === 'ABIERTO';
  }

  ngOnInit(): void {
    this.cargarPuntaje();
  }

  ngOnDestroy(): void {
    this.limpiarUrlsAudio();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centroMonitoreo'] && !changes['centroMonitoreo'].firstChange) {
      this.saveError = '';
      this.preguntasCargadas = false;
      this.limpiarUrlsAudio();
      this.documentosVinculados = [];
      this.audiosVinculados = [];
      this.audioCargando = {};
      this.audioError = {};
      this.form.reset({
        estadoRevision: 'CERRADO',
        motivo: '',
        comentario: ''
      });
      this.cargarPuntaje();
    }
  }

  cerrar(): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: {
        titulo: 'Cancelar edición de Puntaje',
        mensaje: 'Se cerrará la edición del Puntaje de Centro de Monitoreo HSE y se perderán los cambios no guardados.',
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

    const estadoRevision = this.estadoRevisionSeleccionado;
    const motivo = String(this.form.controls['motivo'].value ?? '').trim();

    if (!motivo) {
      this.saveError = 'Escribe el motivo para editar el puntaje.';
      this.form.controls['motivo'].markAsTouched();
      return;
    }

    const detalles: Array<{ Puntaje_Id: number; Puntaje_Rpta: 'S' | 'N' }> = [];
    for (const item of this.preguntas) {
      if (item.audioPuntajeId) {
        detalles.push({ Puntaje_Id: item.audioPuntajeId, Puntaje_Rpta: item.audio === 'P' ? 'S' : 'N' });
      }
      if (item.documentoPuntajeId) {
        detalles.push({ Puntaje_Id: item.documentoPuntajeId, Puntaje_Rpta: item.documento === 'P' ? 'S' : 'N' });
      }
    }

    const comentario = String(this.form.controls['comentario'].value ?? '').trim();

    this.guardado.emit({
      centroMonitoreoId: this.centroMonitoreo?.Centro_HSE_Id ?? null,
      detalles,
      Centro_Revision: estadoRevision,
      Centro_Motivo: motivo,
      Motivo: motivo,
      Centro_Comentario: comentario
    });
  }

  establecerRespuesta(item: CentroMonitoreoPuntajeItem, campo: 'audio' | 'documento', valor: RespuestaValor): void {
    item[campo] = valor;
  }

  totalRespondidas(campo: 'audio' | 'documento'): number {
    return this.preguntas.filter((item) => item[campo] === 'P' || item[campo] === 'N').length;
  }

  private normalizarEstadoRevision(valor: unknown): EstadoRevision {
    return String(valor ?? '').trim().toUpperCase() === 'ABIERTO' ? 'ABIERTO' : 'CERRADO';
  }

  private cargarPuntaje(): void {
    const centroHseId = this.centroMonitoreo?.Centro_HSE_Id;
    if (!centroHseId) {
      this.preguntas = [];
      this.errorMessage = 'No se pudo identificar el Centro de Monitoreo HSE.';
      return;
    }

    this.cargando = true;
    this.errorMessage = '';

    this.apiService.getMostrarActualizarPuntajeCentroHse(centroHseId).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando el Puntaje de Centro de Monitoreo HSE', error);
        this.preguntas = [];
        this.errorMessage = 'No se pudo cargar el Puntaje registrado.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.preguntas = this.agruparPorPregunta(registros);
        this.form.patchValue({ comentario: this.extractComentario(response) }, { emitEvent: false });
        this.cargarArchivosVinculados();
        this.cargando = false;
        this.preguntasCargadas = true;
      },
      error: (error: unknown) => {
        console.error('Error inesperado cargando el Puntaje de Centro de Monitoreo HSE', error);
        this.preguntas = [];
        this.errorMessage = 'No se pudo cargar el Puntaje registrado.';
        this.cargando = false;
      }
    });
  }

  abrirDocumentoVinculado(archivo: ArchivoVinculado): void {
    this.apiService.getArchivoCentroMonitoreoHse(archivo.ruta).subscribe({
      next: (contenido: ArrayBuffer) => {
        const extension = archivo.nombre.split('.').pop()?.toLowerCase() || '';
        const mimeType = this.obtenerMimeType(extension);
        const blob = new Blob([contenido], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
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
      const documento = this.obtenerTextoRespuesta(data, [
        'Centro_HSE_Documento',
        'Centro_Hse_Documento',
        'centro_HSE_Documento',
        'centro_Hse_Documento'
      ]);
      const audio = this.obtenerTextoRespuesta(data, [
        'Centro_HSE_Audio',
        'centro_HSE_Audio'
      ]);

      this.documentosVinculados = this.convertirRutas(documento, 'Documento');
      this.audiosVinculados = this.convertirRutas(audio, 'Audio');
    });
  }

  private obtenerTextoRespuesta(response: unknown, claves: string[]): string {
    if (!this.isRecord(response)) {
      return '';
    }

    for (const clave of claves) {
      const valor = response[clave];
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
      .map(ruta => ruta.trim())
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

  private extractComentario(response: unknown): string {
    if (!this.isRecord(response)) {
      return '';
    }

    const valor = response['Centro_Comentario'] ?? response['centro_Comentario'];
    return valor === null || valor === undefined ? '' : String(valor).trim();
  }

  private agruparPorPregunta(registros: DataRecord[]): CentroMonitoreoPuntajeItem[] {
    const mapa = new Map<number, CentroMonitoreoPuntajeItem>();

    for (const registro of registros) {
      const preguntaId = this.leerNumero(registro, ['Pregunta_Id', 'pregunta_Id']);
      const puntajeId = this.leerNumero(registro, ['Puntaje_Id', 'puntaje_Id']);
      const tipo = String(registro['Puntaje_Tipo'] ?? registro['puntaje_Tipo'] ?? '').trim().toUpperCase();
      const rpta = String(registro['Puntaje_Rpta'] ?? registro['puntaje_Rpta'] ?? '').trim().toUpperCase();
      const nombre = String(registro['Pregunta_Nombre'] ?? registro['pregunta_Nombre'] ?? '').trim();

      if (!preguntaId) { continue; }

      let item = mapa.get(preguntaId);
      if (!item) {
        item = {
          preguntaId,
          preguntaNombre: nombre,
          audioPuntajeId: null,
          audio: '',
          documentoPuntajeId: null,
          documento: ''
        };
        mapa.set(preguntaId, item);
      }

      const valor: RespuestaValor = rpta === 'S' ? 'P' : rpta === 'N' ? 'N' : '';

      if (tipo === 'A') {
        item.audioPuntajeId = puntajeId;
        item.audio = valor;
      } else if (tipo === 'D') {
        item.documentoPuntajeId = puntajeId;
        item.documento = valor;
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.preguntaId - b.preguntaId);
  }

  private leerNumero(registro: DataRecord, claves: string[]): number | null {
    for (const clave of claves) {
      const valor = registro[clave];
      if (valor === null || valor === undefined || valor === '') { continue; }
      const num = Number(valor);
      if (!Number.isNaN(num)) { return num; }
    }
    return null;
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    for (const key of ['Detalles', 'detalles', 'Elements', 'elements', 'Data', 'data', 'Result', 'result', 'Items', 'items', 'Lista', 'lista']) {
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
