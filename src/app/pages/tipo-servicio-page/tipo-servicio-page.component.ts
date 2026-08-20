import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, TipoServicioFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { TipoServicioEditDialogComponent } from './tipo-servicio-edit-dialog.component';
import { TipoServicioRegisterDialogComponent } from './tipo-servicio-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface TipoServicioRow {
  tipSerId: number | null;
  tipSerDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-tipo-servicio-page',
  templateUrl: './tipo-servicio-page.component.html',
  styleUrls: ['./tipo-servicio-page.component.scss']
})
export class TipoServicioPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  tiposServicio: TipoServicioRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog
  ) {
    this.filtersForm = this.formBuilder.group({
      codigo: [''],
      descripcion: [''],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarTiposServicio();
  }

  cargarTiposServicio(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();

    this.apiService.getListarTipoServicioActivo(filtros).subscribe({
      next: (response: unknown) => {
        this.tiposServicio = this.extractRecords(response)
          .map((item) => this.mapTipoServicio(item))
          .sort((left, right) => (left.tipSerId ?? 0) - (right.tipSerId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.tiposServicio.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando tipos de servicio:', error);
        this.tiposServicio = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de tipos de servicio. Intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    this.cargarTiposServicio();
  }

  registrarTipoServicio(): void {
    const dialogRef = this.dialog.open(TipoServicioRegisterDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarTiposServicio();
      }
    });
  }

  editarTipoServicio(tipoServicio: TipoServicioRow): void {
    if (tipoServicio.tipSerId === null) {
      return;
    }

    const dialogRef = this.dialog.open(TipoServicioEditDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { tipoServicio }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarTiposServicio();
      }
    });
  }

  trackByTipoServicio(_index: number, tipoServicio: TipoServicioRow): string {
    return tipoServicio.tipSerId !== null ? String(tipoServicio.tipSerId) : tipoServicio.tipSerDes;
  }

  get paginatedTiposServicio(): TipoServicioRow[] {
    return paginateItems(this.tiposServicio, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.tiposServicio.length, this.pageSize);
  }

  sanitizeCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = input.value.replace(/[^\d]/g, '');

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
      this.filtersForm.controls['codigo'].setValue(sanitizedValue, { emitEvent: false });
    }
  }

  private getFiltros(): TipoServicioFiltro {
    const codigoRaw = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: TipoServicioFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Tip_Ser_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Tip_Ser_Des = descripcion;
    }

    return filtros;
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['tiposServicio', 'TiposServicio', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private mapTipoServicio(item: DataRecord): TipoServicioRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      tipSerId: this.getNumberValue(item, ['Tip_Ser_Id', 'tip_Ser_Id', 'tipSerId', 'id', 'Id']),
      tipSerDes: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'descripcion', 'Descripcion']),
      flgEst,
      estado: activo ? 'Activo' : 'Inactivo',
      activo
    };
  }

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isInteger(value)) {
        return value;
      }
    }

    return null;
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
