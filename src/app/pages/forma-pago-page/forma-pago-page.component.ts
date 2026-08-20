import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, FormaPagoFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { FormaPagoEditDialogComponent } from './forma-pago-edit-dialog.component';
import { FormaPagoRegisterDialogComponent } from './forma-pago-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface FormaPagoRow {
  forPagId: number | null;
  forPagDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-forma-pago-page',
  templateUrl: './forma-pago-page.component.html',
  styleUrls: ['./forma-pago-page.component.scss']
})
export class FormaPagoPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  formasPago: FormaPagoRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: FormaPagoFiltro = { Flg_Est: 'A' };

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
    this.cargarFormasPago();
  }

  cargarFormasPago(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarFormaPagoActivo(filtros).subscribe({
      next: (response: unknown) => {
        this.formasPago = this.extractRecords(response)
          .map((item) => this.mapFormaPago(item))
          .filter((item) => item.forPagId !== null || !!item.forPagDes)
          .sort((left, right) => (left.forPagId ?? 0) - (right.forPagId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.formasPago.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando formas de pago:', error);
        this.formasPago = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de formas de pago. Intenta nuevamente.';
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
    this.cargarFormasPago();
  }

  registrarFormaPago(): void {
    const dialogRef = this.dialog.open(FormaPagoRegisterDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarFormasPago();
      }
    });
  }

  editarFormaPago(formaPago: FormaPagoRow): void {
    if (formaPago.forPagId === null) {
      return;
    }

    const dialogRef = this.dialog.open(FormaPagoEditDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { formaPago }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarFormasPago();
      }
    });
  }

  trackByFormaPago(_index: number, formaPago: FormaPagoRow): string {
    return formaPago.forPagId !== null ? String(formaPago.forPagId) : formaPago.forPagDes;
  }

  get paginatedFormasPago(): FormaPagoRow[] {
    return paginateItems(this.formasPago, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.formasPago.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.For_Pag_Des ?? '').trim();
    const codigo = String(this.appliedFilters.For_Pag_Id ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se han encontrado ${estado.toLowerCase()}.`;
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

  private getFiltros(): FormaPagoFiltro {
    const codigoRaw = this.getCodigoBuscado();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: FormaPagoFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.For_Pag_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.For_Pag_Des = descripcion;
    }

    return filtros;
  }

  private getCodigoBuscado(): string {
    return String(this.filtersForm.controls['codigo'].value ?? '').trim();
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    if (response['Success'] === false || response['success'] === false) {
      return [];
    }

    const possibleArrayKeys = ['formasPago', 'FormasPago', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasFormaPagoFields(response) ? [response] : [];
  }

  private mapFormaPago(item: DataRecord): FormaPagoRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      forPagId: this.getNumberValue(item, ['For_Pag_Id', 'for_Pag_Id', 'forPagId', 'id', 'Id']),
      forPagDes: this.getTextValue(item, ['For_Pag_Des', 'for_Pag_Des', 'forPagDes', 'descripcion', 'Descripcion']),
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

  private hasFormaPagoFields(item: DataRecord): boolean {
    const recordKeys = ['For_Pag_Id', 'for_Pag_Id', 'forPagId', 'For_Pag_Des', 'for_Pag_Des', 'forPagDes', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'Inactivos' : 'Activos';
  }
}
