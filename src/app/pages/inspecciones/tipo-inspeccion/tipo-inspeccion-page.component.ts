import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { TipoInspeccionFilter, TipoInspeccionItem } from './tipo-inspeccion.model';
import { TipoInspeccionRegisterDialogComponent } from './tipo-inspeccion-register-dialog.component';
import { TipoInspeccionService } from './tipo-inspeccion.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-tipo-inspeccion-page',
  templateUrl: './tipo-inspeccion-page.component.html',
  styleUrls: ['./tipo-inspeccion-page.component.scss']
})
export class TipoInspeccionPageComponent implements OnInit {
  readonly filtros: TipoInspeccionFilter = {
    Id: 0,
    Nombre: '',
    Estado: 'A'
  };

  tiposInspeccion: TipoInspeccionItem[] = [];
  cargando = false;
  eliminandoTipoInspeccion = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.tiposInspeccion.length / this.pageSize));
  }

  get tiposInspeccionPaginados(): TipoInspeccionItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.tiposInspeccion.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly tipoInspeccionService: TipoInspeccionService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTiposInspeccion();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(TipoInspeccionRegisterDialogComponent, {
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
        this.cargarTiposInspeccion();
      }
    });
  }

  editarTipoInspeccion(tipoInspeccion: TipoInspeccionItem): void {
    if (tipoInspeccion.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(TipoInspeccionRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        tipoInspeccion
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarTiposInspeccion();
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
    this.cargarTiposInspeccion();
  }

  limpiar(): void {
    this.filtros.Id = 0;
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarTiposInspeccion();
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

  eliminarTipoInspeccion(tipoInspeccion: TipoInspeccionItem): void {
    if (tipoInspeccion.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar tipo de inspección',
        mensaje: `Se eliminará el tipo de inspección "${tipoInspeccion.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionTipoInspeccion(tipoInspeccion.id as number);
      }
    });
  }

  private ejecutarEliminacionTipoInspeccion(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoTipoInspeccion = true;

    this.tipoInspeccionService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoTipoInspeccion = false;
        this.cargarTiposInspeccion();
      },
      error: (error: unknown) => {
        console.error('Error eliminando tipo de inspección', error);
        this.eliminandoTipoInspeccion = false;
        this.errorMessage = 'No se pudo eliminar el tipo de inspección.';
      }
    });
  }

  cargarTiposInspeccion(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.tipoInspeccionService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando tipos de inspección', error);
        this.tiposInspeccion = [];
        this.errorMessage = 'No se pudo cargar la información de Tipo de Inspección.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.tiposInspeccion = registros.map((item) => this.mapTipoInspeccion(item));
        this.cargando = false;
      },
      error: () => {
        this.tiposInspeccion = [];
        this.cargando = false;
      }
    });
  }

  trackByTipoInspeccion(_index: number, tipoInspeccion: TipoInspeccionItem): number | null {
    return tipoInspeccion.id;
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

  private mapTipoInspeccion(item: DataRecord): TipoInspeccionItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Tipo_Id'] ??
      item['tipo_Id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Tipo_Nombre'] ??
      item['tipo_Nombre'];

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
