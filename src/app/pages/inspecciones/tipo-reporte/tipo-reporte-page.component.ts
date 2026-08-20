import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { TipoReporteItem, TipoReporteFiltro } from './tipo-reporte.model';
import { TipoReporteRegisterDialogComponent } from './tipo-reporte-register-dialog.component';
import { TipoReporteService } from './tipo-reporte.service';

@Component({
  selector: 'app-tipo-reporte-page',
  templateUrl: './tipo-reporte-page.component.html',
  styleUrls: ['./tipo-reporte-page.component.scss']
})
export class TipoReportePageComponent implements OnInit {
  readonly filtros: TipoReporteFiltro = {
    Reporte_Id: undefined,
    Reporte_Tipo: '',
    Estado: 'A'
  };

  tiposReporte: TipoReporteItem[] = [];
  cargando = false;
  eliminando = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.tiposReporte.length / this.pageSize));
  }

  get tiposReportePaginados(): TipoReporteItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.tiposReporte.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly tipoReporteService: TipoReporteService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTiposReporte();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(TipoReporteRegisterDialogComponent, {
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
        this.cargarTiposReporte();
      }
    });
  }

  editarTipoReporte(tipoReporte: TipoReporteItem): void {
    if (tipoReporte.reporteId === null || tipoReporte.reporteId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(TipoReporteRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        tipoReporte
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarTiposReporte();
      }
    });
  }

  buscar(): void {
    this.cargarTiposReporte();
  }

  limpiar(): void {
    this.filtros.Reporte_Id = undefined;
    this.filtros.Reporte_Tipo = '';
    this.filtros.Estado = 'A';
    this.cargarTiposReporte();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }

  trackByTipoReporte(_index: number, tipoReporte: TipoReporteItem): number | null {
    return tipoReporte.reporteId;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const normalized = text.toUpperCase();
    if (normalized === 'A' || normalized === 'ACTIVO' || normalized === '1' || normalized === 'TRUE') {
      return 'Activo';
    }

    if (normalized === 'I' || normalized === 'INACTIVO' || normalized === '0' || normalized === 'FALSE') {
      return 'Inactivo';
    }

    return text;
  }

  eliminarTipoReporte(tipoReporte: TipoReporteItem): void {
    if (tipoReporte.reporteId === null || tipoReporte.reporteId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar tipo de reporte',
        mensaje: `Se eliminará el tipo de reporte "${tipoReporte.reporteTipo}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionTipoReporte(tipoReporte.reporteId as number);
      }
    });
  }

  private ejecutarEliminacionTipoReporte(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminando = true;

    this.tipoReporteService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminando = false;
        this.cargarTiposReporte();
      },
      error: (error: unknown) => {
        console.error('Error eliminando tipo de reporte', error);
        this.eliminando = false;
        this.errorMessage = 'No se pudo eliminar el tipo de reporte.';
      }
    });
  }

  cargarTiposReporte(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.tipoReporteService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando tipos de reporte', error);
        this.tiposReporte = [];
        this.errorMessage = 'No se pudo cargar la información de Tipo Reporte.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        this.tiposReporte = this.tipoReporteService.mapTipoReporteItems(response);
        this.cargando = false;
      },
      error: () => {
        this.tiposReporte = [];
        this.cargando = false;
      }
    });
  }
}
