import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { PreguntasHseFilter, PreguntasHseItem } from './preguntas-hse.model';
import { PreguntasHseRegisterDialogComponent } from './preguntas-hse-register-dialog.component';
import { PreguntasHseService } from './preguntas-hse.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-preguntas-hse-page',
  templateUrl: './preguntas-hse-page.component.html',
  styleUrls: ['./preguntas-hse-page.component.scss']
})
export class PreguntasHsePageComponent implements OnInit {
  readonly filtros: PreguntasHseFilter = {
    Pregunta_Id: 0,
    Pregunta_Nombre: '',
    Estado: 'A'
  };

  preguntasHse: PreguntasHseItem[] = [];
  cargando = false;
  eliminando = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.preguntasHse.length / this.pageSize));
  }

  get preguntasHsePaginadas(): PreguntasHseItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.preguntasHse.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly preguntasHseService: PreguntasHseService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarPreguntasHse();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(PreguntasHseRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || ''
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarPreguntasHse();
      }
    });
  }

  editarPreguntasHse(pregunta: PreguntasHseItem): void {
    if (pregunta.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(PreguntasHseRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        preguntasHse: pregunta
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarPreguntasHse();
      }
    });
  }

  actualizarFiltroId(valor: unknown): void {
    if (valor === null || valor === undefined || valor === '') {
      this.filtros.Pregunta_Id = 0;
      return;
    }

    const numero = Number(valor);
    this.filtros.Pregunta_Id = Number.isFinite(numero) ? numero : 0;
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarPreguntasHse();
  }

  limpiar(): void {
    this.filtros.Pregunta_Id = 0;
    this.filtros.Pregunta_Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarPreguntasHse();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1) {
      pagina = 1;
    }

    if (pagina > this.totalPaginas) {
      pagina = this.totalPaginas;
    }

    this.paginaActual = pagina;
  }

  eliminarPreguntasHse(pregunta: PreguntasHseItem): void {
    if (pregunta.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar Pregunta HSE',
        mensaje: `Se eliminará la Pregunta HSE "${pregunta.pregunta}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacion(pregunta.id as number);
      }
    });
  }

  private ejecutarEliminacion(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminando = true;

    this.preguntasHseService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminando = false;
        this.cargarPreguntasHse();
      },
      error: (error: unknown) => {
        console.error('Error eliminando Preguntas HSE', error);
        this.eliminando = false;
        this.errorMessage = 'No se pudo eliminar la Pregunta HSE.';
      }
    });
  }

  cargarPreguntasHse(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.preguntasHseService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando Preguntas HSE', error);
        this.preguntasHse = [];
        this.errorMessage = 'No se pudo cargar la información de Preguntas HSE.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.preguntasHse = registros.map((item) => this.mapPreguntasHse(item));
        this.cargando = false;
      },
      error: () => {
        this.preguntasHse = [];
        this.cargando = false;
      }
    });
  }

  trackByPreguntasHse(_index: number, pregunta: PreguntasHseItem): number | null {
    return pregunta.id;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const normalized = text.toUpperCase();
    if (normalized === 'A' || normalized === 'ACTIVO') {
      return 'Activo';
    }

    if (normalized === 'I' || normalized === 'INACTIVO') {
      return 'Inactivo';
    }

    return text;
  }

  private mapPreguntasHse(item: DataRecord): PreguntasHseItem {
    const rawId = item['id'] ?? item['Id'] ?? item['Pregunta_Id'] ?? item['pregunta_Id'];
    const rawPregunta = item['pregunta'] ?? item['Pregunta'] ?? item['Pregunta_Nombre'] ?? item['Nombre'] ?? item['nombre'];
    const rawEstado = item['estado'] ?? item['Estado'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId),
      pregunta: String(rawPregunta ?? ''),
      estado: String(rawEstado ?? '')
    };
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    const elements = response['Elements'] ?? response['elements'];
    if (Array.isArray(elements)) {
      return elements.filter((item): item is DataRecord => this.isRecord(item));
    }

    const data = response['Data'] ?? response['data'];
    if (Array.isArray(data)) {
      return data.filter((item): item is DataRecord => this.isRecord(item));
    }

    return [response];
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
