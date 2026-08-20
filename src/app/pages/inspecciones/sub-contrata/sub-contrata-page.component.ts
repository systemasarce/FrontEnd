import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { SubContrataFilter, SubContrataItem } from './sub-contrata.model';
import { SubContrataRegisterDialogComponent } from './sub-contrata-register-dialog.component';
import { SubContrataService } from './sub-contrata.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-sub-contrata-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sub-contrata-page.component.html',
  styleUrls: ['./sub-contrata-page.component.scss']
})
export class SubContrataPageComponent implements OnInit {
  filtros: SubContrataFilter = {
    Id: '',
    Nombre: '',
    Estado: 'A'
  };

  subContratas: SubContrataItem[] = [];
  cargando = false;
  eliminandoSubContrata = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.subContratas.length / this.pageSize));
  }

  get subContratasPaginadas(): SubContrataItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.subContratas.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly subContrataService: SubContrataService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarSubContratas();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(SubContrataRegisterDialogComponent, {
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
        this.cargarSubContratas();
      }
    });
  }

  editarSubContrata(subContrata: SubContrataItem): void {
    if (subContrata.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(SubContrataRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        subContrata
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarSubContratas();
      }
    });
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarSubContratas();
  }

  eliminarSubContrata(subContrata: SubContrataItem): void {
    if (subContrata.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar sub contrata',
        mensaje: `Se eliminará la sub contrata "${subContrata.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionSubContrata(subContrata.id as number);
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = '';
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarSubContratas();
  }

  cargarSubContratas(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.subContrataService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando sub contratas', error);
        this.subContratas = [];
        this.errorMessage = 'No se pudo cargar la información de Sub Contrata.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.subContratas = registros.map((item) => this.mapSubContrata(item));
        this.cargando = false;
      },
      error: () => {
        this.subContratas = [];
        this.cargando = false;
      }
    });
  }

  trackBySubContrata(_index: number, item: SubContrataItem): number | null {
    return item.id;
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

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }

  private ejecutarEliminacionSubContrata(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoSubContrata = true;

    this.subContrataService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoSubContrata = false;
        this.cargarSubContratas();
      },
      error: (error: unknown) => {
        console.error('Error eliminando sub contrata', error);
        this.eliminandoSubContrata = false;
        this.errorMessage = 'No se pudo eliminar la sub contrata.';
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

  private mapSubContrata(item: DataRecord): SubContrataItem {
    return {
      id: this.toNullableNumber(item['SubContrata_Id'] ?? item['subContrata_Id'] ?? item['Id'] ?? item['id']),
      nombre: String(
        item['SubContrata_Nombre'] ??
        item['subContrata_Nombre'] ??
        item['Nombre'] ??
        item['nombre'] ??
        ''
      ),
      estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? 'A')
    };
  }

  private toNullableNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
