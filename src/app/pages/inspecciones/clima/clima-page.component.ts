import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { ClimaFilter, ClimaItem } from './clima.model';
import { ClimaRegisterDialogComponent } from './clima-register-dialog.component';
import { ClimaService } from './clima.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-clima-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clima-page.component.html',
  styleUrls: ['./clima-page.component.scss']
})
export class ClimaPageComponent implements OnInit {
  filtros: ClimaFilter = {
    Id: '',
    Nombre: '',
    Estado: 'A'
  };

  climas: ClimaItem[] = [];
  cargando = false;
  eliminandoClima = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.climas.length / this.pageSize));
  }

  get climasPaginados(): ClimaItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.climas.slice(inicio, inicio + this.pageSize);
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
    private readonly climaService: ClimaService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarClimas();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(ClimaRegisterDialogComponent, {
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
        this.cargarClimas();
      }
    });
  }

  editarClima(clima: ClimaItem): void {
    if (clima.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ClimaRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        clima
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarClimas();
      }
    });
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarClimas();
  }

  eliminarClima(clima: ClimaItem): void {
    if (clima.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar clima',
        mensaje: `Se eliminará el clima "${clima.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionClima(clima.id as number);
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = '';
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarClimas();
  }

  cargarClimas(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.climaService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando climas', error);
        this.climas = [];
        this.errorMessage = 'No se pudo cargar la información de Clima.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.climas = registros.map((item) => this.mapClima(item));
        this.cargando = false;
      },
      error: () => {
        this.climas = [];
        this.cargando = false;
      }
    });
  }

  trackByClima(_index: number, clima: ClimaItem): number | null {
    return clima.id;
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

  private ejecutarEliminacionClima(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoClima = true;

    this.climaService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoClima = false;
        this.cargarClimas();
      },
      error: (error: unknown) => {
        console.error('Error eliminando clima', error);
        this.eliminandoClima = false;
        this.errorMessage = 'No se pudo eliminar el clima.';
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

  private mapClima(item: DataRecord): ClimaItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Clima_Id'] ??
      item['clima_Id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Clima_Nombre'] ??
      item['clima_Nombre'];

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

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
