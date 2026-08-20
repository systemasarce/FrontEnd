import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, BancoFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { BancoEditDialogComponent } from './banco-edit-dialog.component';
import { BancoRegisterDialogComponent } from './banco-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface BancoRow {
  banId: number | null;
  banDes: string;
  banAbr: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-banco-page',
  templateUrl: './banco-page.component.html',
  styleUrls: ['./banco-page.component.scss']
})
export class BancoPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  bancos: BancoRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: BancoFiltro = { Flg_Est: 'A' };

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
    this.cargarBancos();
  }

  cargarBancos(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarBanco(filtros).subscribe({
      next: (response: unknown) => {
        this.bancos = this.extractRecords(response)
          .map((item) => this.mapBanco(item))
          .filter((item) => item.banId !== null || !!item.banDes || !!item.banAbr)
          .sort((left, right) => (left.banId ?? 0) - (right.banId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.bancos.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando bancos:', error);
        this.bancos = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de bancos. Intenta nuevamente.';
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
    this.cargarBancos();
  }

  registrarBanco(): void {
    const dialogRef = this.dialog.open(BancoRegisterDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarBancos();
      }
    });
  }

  editarBanco(banco: BancoRow): void {
    if (banco.banId === null) {
      return;
    }

    const dialogRef = this.dialog.open(BancoEditDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { banco }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarBancos();
      }
    });
  }

  trackByBanco(_index: number, banco: BancoRow): string {
    return banco.banId !== null ? String(banco.banId) : `${banco.banDes}-${banco.banAbr}`;
  }

  get paginatedBancos(): BancoRow[] {
    return paginateItems(this.bancos, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.bancos.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Ban_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Ban_Id ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado bancos ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se han encontrado bancos ${estado.toLowerCase()}.`;
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

  private getFiltros(): BancoFiltro {
    const codigoRaw = this.getCodigoBuscado();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: BancoFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Ban_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Ban_Des = descripcion;
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

    const possibleArrayKeys = ['bancos', 'Bancos', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasBancoFields(response) ? [response] : [];
  }

  private mapBanco(item: DataRecord): BancoRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      banId: this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId', 'id', 'Id']),
      banDes: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'descripcion', 'Descripcion']),
      banAbr: this.getTextValue(item, ['Ban_Abr', 'ban_Abr', 'banAbr', 'abreviatura', 'Abreviatura']),
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

  private hasBancoFields(item: DataRecord): boolean {
    const recordKeys = ['Ban_Id', 'ban_Id', 'banId', 'Ban_Des', 'ban_Des', 'banDes', 'Ban_Abr', 'ban_Abr', 'banAbr', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'inactivos' : 'activos';
  }
}
