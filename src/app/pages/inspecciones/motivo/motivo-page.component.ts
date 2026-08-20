import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { MotivoFilter, MotivoItem } from './motivo.model';
import { MotivoRegisterDialogComponent } from './motivo-register-dialog.component';
import { MotivoService } from './motivo.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-motivo-page',
  templateUrl: './motivo-page.component.html',
  styleUrls: ['./motivo-page.component.scss']
})
export class MotivoPageComponent implements OnInit {
  filtros: MotivoFilter = {
    Id: '',
    Nombre: '',
    Estado: 'A'
  };

  motivos: MotivoItem[] = [];
  cargando = false;
  eliminandoMotivo = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.motivos.length / this.pageSize));
  }

  get motivosPaginados(): MotivoItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.motivos.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly motivoService: MotivoService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarMotivos();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(MotivoRegisterDialogComponent, {
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
        this.cargarMotivos();
      }
    });
  }

  editarMotivo(motivo: MotivoItem): void {
    if (motivo.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(MotivoRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        motivo
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarMotivos();
      }
    });
  }

  buscar(): void {
  this.paginaActual = 1;
  this.cargarMotivos();
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
  eliminarMotivo(motivo: MotivoItem): void {
    if (motivo.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar motivo',
        mensaje: `Se eliminará el motivo "${motivo.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionMotivo(motivo.id as number);
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = '';
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarMotivos();
  }

  cargarMotivos(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.motivoService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando motivos', error);
        this.motivos = [];
        this.errorMessage = 'No se pudo cargar la información de Motivo.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.motivos = registros.map((item) => this.mapMotivo(item));
        this.cargando = false;
      },
      error: () => {
        this.motivos = [];
        this.cargando = false;
      }
    });
  }

  private ejecutarEliminacionMotivo(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoMotivo = true;

    this.motivoService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoMotivo = false;
        this.cargarMotivos();
      },
      error: (error: unknown) => {
        console.error('Error eliminando motivo', error);
        this.eliminandoMotivo = false;
        this.errorMessage = 'No se pudo eliminar el motivo.';
      }
    });
  }

  trackByMotivo(_index: number, motivo: MotivoItem): number | null {
    return motivo.id;
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

  private mapMotivo(item: DataRecord): MotivoItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Motivo_Id'] ??
      item['motivo_Id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Motivo_Nombre'] ??
      item['motivo_Nombre'];

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
