import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { GrupoDetalleItem, GrupoDetalleFiltro } from './grupo-detalle.model';
import { GrupoDetalleRegisterDialogComponent } from './grupo-detalle-register-dialog.component';
import { GrupoDetalleService } from './grupo-detalle.service';

@Component({
  selector: 'app-grupo-detalle-page',
  templateUrl: './grupo-detalle-page.component.html',
  styleUrls: ['./grupo-detalle-page.component.scss']
})
export class GrupoDetallePageComponent implements OnInit {
  readonly filtros: GrupoDetalleFiltro = {
    Detalle_Id: undefined,
    Detalle_Cod: '',
    Detalle_Nombre: '',
    Detalle_Valor: undefined,
    Grupo_Nombre: '',
    Grupo_Descripcion: '',
    Estado: 'A'
  };

  gruposDetalle: GrupoDetalleItem[] = [];
  cargando = false;
  eliminando = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.gruposDetalle.length / this.pageSize));
  }

  get gruposDetallePaginados(): GrupoDetalleItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.gruposDetalle.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly grupoDetalleService: GrupoDetalleService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarGrupoDetalles();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(GrupoDetalleRegisterDialogComponent, {
      width: '620px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: { usrReg: this.authService.getCurrentUser() || '' }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarGrupoDetalles();
      }
    });
  }

  editarGrupoDetalle(item: GrupoDetalleItem): void {
    if (item.detalleId === null || item.detalleId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(GrupoDetalleRegisterDialogComponent, {
      width: '620px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        grupoDetalle: item
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarGrupoDetalles();
      }
    });
  }

  buscar(): void {
    this.cargarGrupoDetalles();
  }

  limpiar(): void {
    this.filtros.Detalle_Id = undefined;
    this.filtros.Detalle_Cod = '';
    this.filtros.Detalle_Nombre = '';
    this.filtros.Detalle_Valor = undefined;
    this.filtros.Grupo_Nombre = '';
    this.filtros.Grupo_Descripcion = '';
    this.filtros.Estado = 'A';
    this.cargarGrupoDetalles();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }
    this.paginaActual = pagina;
  }

  trackByGrupoDetalle(_index: number, item: GrupoDetalleItem): number | null {
    return item.detalleId;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim().toUpperCase();
    if (text === 'A' || text === 'ACTIVO' || text === '1' || text === 'TRUE') {
      return 'Activo';
    }
    if (text === 'I' || text === 'INACTIVO' || text === '0' || text === 'FALSE') {
      return 'Inactivo';
    }
    return String(value ?? '').trim() || '-';
  }

  eliminarGrupoDetalle(item: GrupoDetalleItem): void {
    if (item.detalleId === null || item.detalleId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar Grupo Detalle',
        mensaje: `Se eliminará el grupo detalle "${item.detalleNombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionGrupoDetalle(item.detalleId as number);
      }
    });
  }

  private ejecutarEliminacionGrupoDetalle(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminando = true;
    this.grupoDetalleService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminando = false;
        this.cargarGrupoDetalles();
      },
      error: (error: unknown) => {
        console.error('Error eliminando Grupo Detalle', error);
        this.eliminando = false;
        this.errorMessage = 'No se pudo eliminar el grupo detalle.';
      }
    });
  }

  cargarGrupoDetalles(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.grupoDetalleService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando Grupo Detalle', error);
        this.gruposDetalle = [];
        this.errorMessage = 'No se pudo cargar la información de Grupo Detalle.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        this.gruposDetalle = this.grupoDetalleService.mapGrupoDetalleItems(response);
        this.cargando = false;
      },
      error: () => {
        this.gruposDetalle = [];
        this.cargando = false;
      }
    });
  }
}
