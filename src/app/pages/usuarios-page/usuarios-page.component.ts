import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, UsuariosFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { UsuarioEditDialogComponent } from './usuario-edit-dialog.component';
import { UsuarioRegisterDialogComponent } from './usuario-register-dialog.component';

interface UsuarioRow {
  usrId: number | null;
  usrCod: string;
  usrNom: string;
  usrCorr: string;
  usrDocNro: string;
  usrCenCosId: number;
  usrCrg: number;
  usrPass: string;
  usrApr: string;
  usrPrf: string;
  fecha: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-usuarios-page',
  templateUrl: './usuarios-page.component.html',
  styleUrls: ['./usuarios-page.component.scss']
})
export class UsuariosPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  usuarios: UsuarioRow[] = [];
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
      codigoUsuario: [''],
      nombres: [''],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();

    this.apiService.getListarUsuarioActivo(filtros).subscribe({
      next: (response: unknown) => {
        this.usuarios = this.extractRecords(response).map((item) => this.mapUsuario(item));
        this.currentPage = normalizePaginationPage(this.currentPage, this.usuarios.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando usuarios:', error);
        this.usuarios = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de usuarios. Intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      codigo: '',
      codigoUsuario: '',
      nombres: '',
      estado: 'A'
    });
    this.cargarUsuarios();
  }

  trackByUsuario(_index: number, usuario: UsuarioRow): string {
    return usuario.usrId !== null ? String(usuario.usrId) : usuario.usrCod;
  }

  get paginatedUsuarios(): UsuarioRow[] {
    return paginateItems(this.usuarios, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.usuarios.length, this.pageSize);
  }

  editarUsuario(usuario: UsuarioRow): void {
    if (usuario.usrId === null) {
      return;
    }

    const dialogRef = this.dialog.open(UsuarioEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      data: { usuario },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarUsuarios();
      }
    });
  }

  registrarUsuario(): void {
    const dialogRef = this.dialog.open(UsuarioRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarUsuarios();
      }
    });
  }

  sanitizeCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericValue = Number(input.value);

    if (!input.value) {
      this.filtersForm.controls['codigo'].setValue('', { emitEvent: false });
      return;
    }

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      input.value = '';
      this.filtersForm.controls['codigo'].setValue('', { emitEvent: false });
    }
  }

  private getFiltros(): UsuariosFiltro {
    const filters = this.filtersForm.value as {
      codigo: string;
      codigoUsuario: string;
      nombres: string;
      estado: string;
    };
    const usrId = Number(filters.codigo);
    const filtros: UsuariosFiltro = {};

    if (filters.codigo && Number.isInteger(usrId) && usrId > 0) {
      filtros.Usr_Id = usrId;
    }

    if (filters.codigoUsuario?.trim()) {
      filtros.Usr_Cod = filters.codigoUsuario.trim();
    }

    if (filters.nombres?.trim()) {
      filtros.Usr_Nom = filters.nombres.trim();
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

    const possibleArrayKeys = ['usuarios', 'Usuarios', 'users', 'Users', 'elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter(this.isDataRecord);
      }
    }

    return [response];
  }

  private mapUsuario(item: DataRecord): UsuarioRow {
    const usrId = this.getNumberValue(item, ['Usr_Id', 'usr_Id', 'usrId', 'id', 'Id']);
    const usrCod = this.getTextValue(item, ['Usr_Cod', 'usr_Cod', 'usrCod']);
    const usrNom = this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']);
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
    const activo = flgEst.toUpperCase() === 'A';

    return {
      usrId,
      usrCod,
      usrNom,
      usrCorr: this.getTextValue(item, ['Usr_Corr', 'usr_Corr', 'usrCorr']),
      usrDocNro: this.getTextValue(item, ['Usr_Doc_Nro', 'usr_Doc_Nro', 'usrDocNro']),
      usrCenCosId: this.getNumberValue(item, ['Usr_Cen_Cos_Id', 'usr_Cen_Cos_Id', 'usrCenCosId']) ?? 0,
      usrCrg: this.getNumberValue(item, ['Usr_Crg', 'usr_Crg', 'usrCrg']) ?? 0,
      usrPass: this.getTextValue(item, ['Usr_Pass', 'usr_Pass', 'usrPass']),
      usrApr: this.getTextValue(item, ['Usr_Apr', 'usr_Apr', 'usrApr']) || 'N',
      usrPrf: this.getTextValue(item, ['Usr_Prf', 'usr_Prf', 'usrPrf']),
      fecha,
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
