import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { JefeRegisterDialogComponent } from './jefe-register-dialog.component';
import { JefeFilter, JefeItem } from './jefe.model';
import { JefeService } from './jefe.service';

type DataRecord = Record<string, unknown>;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-jefe-page',
  templateUrl: './jefe-page.component.html',
  styleUrls: ['./jefe-page.component.scss']
})
export class JefePageComponent implements OnInit {
  readonly filtros: JefeFilter = {
    Id: undefined,
    Reporte_Tipo: '',
    Estado: 'A'
  };

  jefes: JefeItem[] = [];
  cargando = false;
  eliminandoJefe = false;
  errorMessage = '';

  // ── Paginación ──────────────────────────────────────────────────
  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.jefes.length / this.pageSize));
  }

  get jefesPaginados(): JefeItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.jefes.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
  }
  // ────────────────────────────────────────────────────────────────

  constructor(
    private readonly jefeService: JefeService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarJefes();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(JefeRegisterDialogComponent, {
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
        this.cargarJefes();
      }
    });
  }

  editarJefe(jefe: JefeItem): void {
    if (jefe.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(JefeRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        jefe
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarJefes();
      }
    });
  }

  buscar(): void {
    this.cargarJefes();
  }

  eliminarJefe(jefe: JefeItem): void {
    if (jefe.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar Tipo Reporte',
        mensaje: `Se eliminará el tipo de reporte "${jefe.tipoReporte}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionJefe(jefe.id as number);
      }
    });
  }

  private ejecutarEliminacionJefe(id: number): void {
    const usrMod = String(this.authService.getCurrentUser() ?? '').trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoJefe = true;

    this.jefeService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoJefe = false;
        this.cargarJefes();
      },
      error: (error: unknown) => {
        console.error('Error eliminando tipo reporte', error);
        this.eliminandoJefe = false;
        this.errorMessage = 'No se pudo eliminar el tipo de reporte.';
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = undefined;
    this.filtros.Reporte_Tipo = '';
    this.filtros.Estado = 'A';
    this.cargarJefes();
  }

  cargarJefes(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.jefeService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando tipos de reporte', error);
        this.jefes = [];
        this.errorMessage = 'No se pudo cargar la información de Tipo Reporte.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.jefes = registros.map((item) => this.mapJefe(item));
        this.cargando = false;
      },
      error: () => {
        this.jefes = [];
        this.cargando = false;
      }
    });
  }

  trackByJefe(_index: number, jefe: JefeItem): number | null {
    return jefe.id;
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

  private mapJefe(item: DataRecord): JefeItem {
    const rawId = item['Reporte_Id'] ?? item['Id'] ?? item['id'] ?? item['ReporteID'] ?? item['reporte_id'];
    const rawTipoReporte =
      item['Reporte_Tipo'] ?? item['reporte_Tipo'] ?? item['reporte_tipo'] ?? item['Tipo_Reporte'] ?? item['tipoReporte'];
    const rawEstado = item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? item['Flg_Estado'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId),
      tipoReporte: String(rawTipoReporte ?? ''),
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
