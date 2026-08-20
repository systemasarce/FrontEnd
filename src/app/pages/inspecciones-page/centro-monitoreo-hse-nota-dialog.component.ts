import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';
import { PreguntasHseService } from '../inspecciones/preguntas-hse/preguntas-hse.service';
import { ConfirmacionAccionDialogComponent } from './confirmacion-accion-dialog.component';

type DataRecord = Record<string, unknown>;
type RespuestaValor = 'P' | 'N' | '';

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
export class CentroMonitoreoHseNotaDialogComponent implements OnInit, OnChanges {
  @Input() centroMonitoreo: CentroMonitoreoNotaData | null = null;
  @Output() volver = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<CentroMonitoreoHseNotaResult>();

  cargandoPreguntas = false;
  guardando = false;
  saveError = '';
  errorMessage = '';
  preguntas: CentroMonitoreoNotaItem[] = [];
  comentario = '';

  private preguntasCargadas = false;

  constructor(
    private readonly preguntasHseService: PreguntasHseService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog
  ) {}

  get inspectorNombre(): string {
    const nombre = this.authService.getCurrentUserName?.().trim() ?? '';
    return nombre || '-';
  }

  ngOnInit(): void {
    this.cargarPreguntas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centroMonitoreo'] && !changes['centroMonitoreo'].firstChange) {
      this.preguntas.forEach((item) => { item.audio = ''; item.documento = ''; });
      this.comentario = '';
      this.saveError = '';
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

  establecerRespuesta(item: CentroMonitoreoNotaItem, campo: 'audio' | 'documento', valor: RespuestaValor): void {
    item[campo] = valor;
  }

  totalRespondidas(campo: 'audio' | 'documento'): number {
    return this.preguntas.filter((item) => item[campo] === 'P' || item[campo] === 'N').length;
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
