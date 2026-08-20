import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, UnidadMedidaFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { UnidadMedidaEditDialogComponent } from './unidad-medida-edit-dialog.component';
import { UnidadMedidaRegisterDialogComponent } from './unidad-medida-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface UnidadMedidaRow {
  uniMedId: number | null;
  uniMedDes: string;
  uniMedAbr: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-unidad-medida-page',
  templateUrl: './unidad-medida-page.component.html',
  styleUrls: ['./unidad-medida-page.component.scss']
})
export class UnidadMedidaPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  unidadesMedida: UnidadMedidaRow[] = [];
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
    this.cargarUnidadesMedida();
  }

  cargarUnidadesMedida(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getListarUnidadMedida(this.getFiltros()).subscribe({
      next: (response: unknown) => {
        this.unidadesMedida = this.extractRecords(response)
          .map((item) => this.mapUnidadMedida(item))
          .sort((left, right) => (left.uniMedId ?? 0) - (right.uniMedId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.unidadesMedida.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando unidades de medida:', error);
        this.unidadesMedida = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de unidades de medida. Intenta nuevamente.';
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
    this.cargarUnidadesMedida();
  }

  registrarUnidadMedida(): void {
    const dialogRef = this.dialog.open(UnidadMedidaRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarUnidadesMedida();
      }
    });
  }

  editarUnidadMedida(unidadMedida: UnidadMedidaRow): void {
    if (unidadMedida.uniMedId === null) {
      return;
    }

    const dialogRef = this.dialog.open(UnidadMedidaEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { unidadMedida }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarUnidadesMedida();
      }
    });
  }

  trackByUnidadMedida(_index: number, unidadMedida: UnidadMedidaRow): string {
    return unidadMedida.uniMedId !== null ? String(unidadMedida.uniMedId) : `${unidadMedida.uniMedDes}-${unidadMedida.uniMedAbr}`;
  }

  get paginatedUnidadesMedida(): UnidadMedidaRow[] {
    return paginateItems(this.unidadesMedida, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.unidadesMedida.length, this.pageSize);
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

  private getFiltros(): UnidadMedidaFiltro {
    const codigoRaw = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: UnidadMedidaFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Uni_Med_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Uni_Med_Des = descripcion;
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

    const possibleArrayKeys = ['unidadesMedida', 'UnidadesMedida', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private mapUnidadMedida(item: DataRecord): UnidadMedidaRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      uniMedId: this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId', 'id', 'Id']),
      uniMedDes: this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'descripcion', 'Descripcion']),
      uniMedAbr: this.getTextValue(item, ['Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr', 'abreviatura', 'Abreviatura']),
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
