import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, ProveedoresFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { ProviderEditDialogComponent } from './provider-edit-dialog.component';
import { ProviderBanksDialogComponent } from './provider-banks-dialog.component';
import { ProviderRegisterDialogComponent } from './provider-register-dialog.component';

interface ProviderRow {
  prvId: number | null;
  prvBanId: number | null;
  prvNom: string;
  prvRuc: string;
  prvTel: string;
  prvDir: string;
  prvNomCon: string;
  prvEmail: string;
  prvNroCueBan: string;
  prvNroCueBanCci: string;
  prvBan: number | null;
  fecha: string;
  flgEst: string;
  activo: boolean;
  usrReg: string;
  fecReg: string;
  usrMod: string;
  fecMod: string;
}

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-provider-page',
  templateUrl: './provider-page.component.html',
  styleUrls: ['./provider-page.component.scss']
})
export class ProviderPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  proveedores: ProviderRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog
  ) {
    this.filtersForm = this.formBuilder.group({
      id: [''],
      nombre: [''],
      ruc: [''],
      nombreContacto: [''],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarProveedores();
  }

  cargarProveedores(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getListarProveedorActivo(this.getFiltros()).subscribe({
      next: (response: unknown) => {
        this.proveedores = this.extractRecords(response)
          .map((item) => this.mapProveedor(item))
          .sort((left, right) => this.compareProviderById(left, right));
        this.currentPage = normalizePaginationPage(this.currentPage, this.proveedores.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando proveedores:', error);
        this.proveedores = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de proveedores. Intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      id: '',
      nombre: '',
      ruc: '',
      nombreContacto: '',
      estado: 'A'
    });
    this.cargarProveedores();
  }

  sanitizeIdInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericValue = Number(input.value);

    if (!input.value) {
      this.filtersForm.controls['id'].setValue('', { emitEvent: false });
      return;
    }

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      input.value = '';
      this.filtersForm.controls['id'].setValue('', { emitEvent: false });
    }
  }

  registrarProveedor(): void {
    const dialogRef = this.dialog.open(ProviderRegisterDialogComponent, {
      width: 'min(42rem, 94vw)',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarProveedores();
      }
    });
  }

  editarProveedor(proveedor: ProviderRow): void {
    if (proveedor.prvId === null) {
      return;
    }

    const dialogRef = this.dialog.open(ProviderEditDialogComponent, {
      width: 'min(42rem, 94vw)',
      data: { proveedor },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarProveedores();
      }
    });
  }

  asignarBanco(proveedor: ProviderRow): void {
    if (proveedor.prvId === null) {
      return;
    }

    const dialogRef = this.dialog.open(ProviderBanksDialogComponent, {
      width: 'min(50rem, calc(100vw - 1rem))',
      maxWidth: 'calc(100vw - 1rem)',
      data: {
        providerId: proveedor.prvId,
        providerName: proveedor.prvNom,
        providerRuc: proveedor.prvRuc,
        selectedProviderBankId: proveedor.prvBanId,
        selectedBankId: proveedor.prvBan,
        selectedAccountNumber: proveedor.prvNroCueBan,
        selectedCci: proveedor.prvNroCueBanCci
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.cargarProveedores();
    });
  }

  trackByProveedor(_index: number, proveedor: ProviderRow): string {
    return proveedor.prvId !== null ? String(proveedor.prvId) : proveedor.prvRuc;
  }

  get paginatedProveedores(): ProviderRow[] {
    return paginateItems(this.proveedores, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.proveedores.length, this.pageSize);
  }

  private compareProviderById(left: ProviderRow, right: ProviderRow): number {
    if (left.prvId === null && right.prvId === null) {
      return left.prvRuc.localeCompare(right.prvRuc);
    }

    if (left.prvId === null) {
      return 1;
    }

    if (right.prvId === null) {
      return -1;
    }

    return left.prvId - right.prvId;
  }

  private getFiltros(): ProveedoresFiltro {
    const filters = this.filtersForm.value as {
      id: string;
      nombre: string;
      ruc: string;
      nombreContacto: string;
      estado: string;
    };
    const prvId = Number(filters.id);
    const filtros: ProveedoresFiltro = {};

    if (filters.id && Number.isInteger(prvId) && prvId > 0) {
      filtros.Prv_Id = prvId;
    }

    if (filters.nombre?.trim()) {
      filtros.Prv_Nom = filters.nombre.trim();
    }

    if (filters.ruc?.trim()) {
      filtros.Prv_Ruc = filters.ruc.trim();
    }

    if (filters.nombreContacto?.trim()) {
      filtros.Prv_Nom_Con = filters.nombreContacto.trim();
    }

    filtros.Flg_Est = filters.estado;

    return filtros;
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter(this.isDataRecord);
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['proveedores', 'Proveedores', 'providers', 'Providers', 'bancos', 'Bancos', 'elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter(this.isDataRecord);
      }
    }

    return [response];
  }

  private mapProveedor(item: DataRecord): ProviderRow {
    const prvId = this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId', 'id', 'Id']);
    const prvNom = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']);
    const prvRuc = this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc']);
    const prvTel = this.getTextValue(item, ['Prv_Tel', 'prv_Tel', 'prvTel']);
    const prvDir = this.getTextValue(item, ['Prv_Dir', 'prv_Dir', 'prvDir']);
    const prvNomCon = this.getTextValue(item, ['Prv_Nom_Con', 'prv_Nom_Con', 'prvNomCon']);
    const prvEmail = this.getTextValue(item, ['Prv_Email', 'prv_Email', 'prvEmail']);
    const prvNroCueBan = this.getTextValue(item, ['Prv_Nro_Cue_Ban', 'prv_Nro_Cue_Ban', 'prvNroCueBan']);
    const prvNroCueBanCci = this.getTextValue(item, ['Prv_Nro_Cue_Ban_CCI', 'prv_Nro_Cue_Ban_CCI', 'prvNroCueBanCci']);
    const prvBan = this.getNumberValue(item, ['Prv_Ban', 'prv_Ban', 'prvBan']);
    const fecha = formatDisplayDate(this.getTextValue(item, [
      'Fecha',
      'fecha',
      'Fec_Reg',
      'fec_Reg',
      'Fec_Cre',
      'fec_Cre',
      'CreatedAt',
      'createdAt',
      'Date',
      'date'
    ]));
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']);
    const usrReg = this.getTextValue(item, ['Usr_Reg', 'usr_Reg', 'usrReg']);
    const fecReg = this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg']);
    const usrMod = this.getTextValue(item, ['Usr_Mod', 'usr_Mod', 'usrMod']);
    const fecMod = this.getTextValue(item, ['Fec_Mod', 'fec_Mod', 'fecMod']);

    return {
      prvId,
      prvBanId: this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId', 'Prv_Ban_Id', 'prv_Ban_Id', 'prvBanId', 'Prv_Ban', 'prv_Ban', 'prvBan']),
      prvNom,
      prvRuc,
      prvTel,
      prvDir,
      prvNomCon,
      prvEmail,
      prvNroCueBan,
      prvNroCueBanCci,
      prvBan,
      fecha,
      flgEst,
      activo: flgEst.toUpperCase() === 'A',
      usrReg,
      fecReg,
      usrMod,
      fecMod
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
