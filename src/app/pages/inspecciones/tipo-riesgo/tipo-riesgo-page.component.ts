import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { TipoRiesgoFilter, TipoRiesgoItem } from './tipo-riesgo.model';
import { TipoRiesgoRegisterDialogComponent } from './tipo-riesgo-register-dialog.component';
import { TipoRiesgoService } from './tipo-riesgo.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-tipo-riesgo-page',
  templateUrl: './tipo-riesgo-page.component.html',
  styleUrls: ['./tipo-riesgo-page.component.scss']
})
export class TipoRiesgoPageComponent implements OnInit {
  readonly filtros: TipoRiesgoFilter = {
    Id: 0,
    Nombre: '',
    Estado: 'A'
  };

  tiposRiesgo: TipoRiesgoItem[] = [];
  cargando = false;
  eliminandoTipoRiesgo = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.tiposRiesgo.length / this.pageSize));
  }

  get tiposRiesgoPaginados(): TipoRiesgoItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.tiposRiesgo.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly tipoRiesgoService: TipoRiesgoService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTiposRiesgo();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(TipoRiesgoRegisterDialogComponent, {
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
        this.cargarTiposRiesgo();
      }
    });
  }

  editarTipoRiesgo(tipoRiesgo: TipoRiesgoItem): void {
    if (tipoRiesgo.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(TipoRiesgoRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        tipoRiesgo
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarTiposRiesgo();
      }
    });
  }

  actualizarFiltroId(valor: unknown): void {
    if (valor === null || valor === undefined || valor === '') {
      this.filtros.Id = 0;
      return;
    }

    const numero = Number(valor);
    this.filtros.Id = Number.isFinite(numero) ? numero : 0;
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarTiposRiesgo();
  }

  limpiar(): void {
    this.filtros.Id = 0;
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarTiposRiesgo();
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

  eliminarTipoRiesgo(tipoRiesgo: TipoRiesgoItem): void {
    if (tipoRiesgo.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar tipo de riesgo',
        mensaje: `Se eliminará el tipo de riesgo "${tipoRiesgo.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionTipoRiesgo(tipoRiesgo.id as number);
      }
    });
  }

  private ejecutarEliminacionTipoRiesgo(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoTipoRiesgo = true;

    this.tipoRiesgoService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoTipoRiesgo = false;
        this.cargarTiposRiesgo();
      },
      error: (error: unknown) => {
        console.error('Error eliminando tipo de riesgo', error);
        this.eliminandoTipoRiesgo = false;
        this.errorMessage = 'No se pudo eliminar el tipo de riesgo.';
      }
    });
  }

  cargarTiposRiesgo(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.tipoRiesgoService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando tipos de riesgo', error);
        this.tiposRiesgo = [];
        this.errorMessage = 'No se pudo cargar la información de Tipo de Riesgo.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.tiposRiesgo = registros.map((item) => this.mapTipoRiesgo(item));
        this.cargando = false;
      },
      error: () => {
        this.tiposRiesgo = [];
        this.cargando = false;
      }
    });
  }

  trackByTipoRiesgo(_index: number, tipoRiesgo: TipoRiesgoItem): number | null {
    return tipoRiesgo.id;
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

  private mapTipoRiesgo(item: DataRecord): TipoRiesgoItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Tipo_Riesgo_Id'] ??
      item['tipo_riesgo_id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Tipo_Riesgo'] ??
      item['tipo_riesgo'];

    const rawEstado =
      item['estado'] ??
      item['Estado'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId),
      nombre: String(rawNombre ?? ''),
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
