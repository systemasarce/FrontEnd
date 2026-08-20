import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { TareaFilter, TareaItem } from './tarea.model';
import { TareaRegisterDialogComponent } from './tarea-register-dialog.component';
import { TareaService } from './tarea.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-tarea-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tarea-page.component.html',
  styleUrls: ['./tarea-page.component.scss']
})
export class TareaPageComponent implements OnInit {
  filtros: TareaFilter = {
    Id: '',
    Nombre: '',
    Estado: 'A'
  };

  tareas: TareaItem[] = [];
  cargando = false;
  eliminandoTarea = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.tareas.length / this.pageSize));
  }

  get tareasPaginadas(): TareaItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.tareas.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }

  constructor(
    private readonly tareaService: TareaService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTareas();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(TareaRegisterDialogComponent, {
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
        this.cargarTareas();
      }
    });
  }

  editarTarea(tarea: TareaItem): void {
    if (tarea.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(TareaRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        tarea
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarTareas();
      }
    });
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarTareas();
  }

  eliminarTarea(tarea: TareaItem): void {
    if (tarea.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar tarea',
        mensaje: `Se eliminará la tarea "${tarea.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionTarea(tarea.id as number);
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = '';
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarTareas();
  }

  cargarTareas(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.tareaService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando tareas', error);
        this.tareas = [];
        this.errorMessage = 'No se pudo cargar la información de Tarea.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.tareas = registros.map((item) => this.mapTarea(item));
        this.cargando = false;
      },
      error: () => {
        this.tareas = [];
        this.cargando = false;
      }
    });
  }

  trackByTarea(_index: number, tarea: TareaItem): number | null {
    return tarea.id;
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

  private ejecutarEliminacionTarea(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoTarea = true;

    this.tareaService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoTarea = false;
        this.cargarTareas();
      },
      error: (error: unknown) => {
        console.error('Error eliminando tarea', error);
        this.eliminandoTarea = false;
        this.errorMessage = 'No se pudo eliminar la tarea.';
      }
    });
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

  private mapTarea(item: DataRecord): TareaItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Tarea_Id'] ??
      item['tarea_Id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Tarea_Nombre'] ??
      item['tarea_Nombre'];

    const rawEstado =
      item['estado'] ??
      item['Estado'] ??
      item['Flg_Est'] ??
      item['flg_est'];

    return {
      id: this.toNumberOrNull(rawId),
      nombre: String(rawNombre ?? '').trim(),
      estado: String(rawEstado ?? '').trim()
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numero = Number(value);
    return Number.isFinite(numero) ? numero : null;
  }
}
