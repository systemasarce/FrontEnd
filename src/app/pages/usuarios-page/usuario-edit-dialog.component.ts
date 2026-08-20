import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ActualizarUsuarioRequest, ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator, optionalPatternValidator } from 'src/app/shared/validators/form-validators';

interface UsuarioEditData {
  usuario: {
    usrId: number;
    usrCod: string;
    usrNom: string;
    usrCorr: string;
    usrDocNro: string;
    usrCenCosId: number;
    usrCrg: number;
    usrPass: string;
    usrApr: string;
    usrPrf: string;
    flgEst: string;
  };
}

interface CentroCostoOption {
  id: number;
  descripcion: string;
}

interface PerfilOption {
  codigo: string;
  descripcion: string;
}

interface CargoOption {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-usuario-edit-dialog',
  templateUrl: './usuario-edit-dialog.component.html',
  styleUrls: ['./usuario-edit-dialog.component.scss']
})
export class UsuarioEditDialogComponent implements OnInit {
  readonly form: FormGroup;
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly perfilSearchControl = new FormControl('', { nonNullable: true });
  readonly cargoSearchControl = new FormControl('', { nonNullable: true });
  centroCostoOptions: CentroCostoOption[] = [];
  perfilOptions: PerfilOption[] = [];
  cargoOptions: CargoOption[] = [];
  isSaving = false;
  isLoadingCentrosCosto = false;
  isLoadingPerfiles = false;
  isLoadingCargos = false;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: UsuarioEditData,
    private readonly dialogRef: MatDialogRef<UsuarioEditDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      usrCod: [data.usuario.usrCod, [Validators.required, noWhitespaceValidator(), Validators.maxLength(50), optionalPatternValidator(/^[A-Za-z0-9._-]+$/)]],
      usrNom: [data.usuario.usrNom, [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      usrCorr: [data.usuario.usrCorr, [Validators.required, noWhitespaceValidator(), Validators.email, Validators.maxLength(120)]],
      usrDocNro: [data.usuario.usrDocNro, [Validators.required, noWhitespaceValidator(), Validators.maxLength(20), optionalPatternValidator(/^[0-9]+$/)]],
      usrPass: [data.usuario.usrPass, [Validators.required, noWhitespaceValidator(), Validators.maxLength(55)]],
      usrCenCosId: [data.usuario.usrCenCosId || 0, [Validators.required, Validators.min(1)]],
      usrCrg: [data.usuario.usrCrg || 0, [Validators.required, Validators.min(1)]],
      usrApr: [data.usuario.usrApr || 'N', Validators.required],
      usrPrf: [data.usuario.usrPrf || '', [Validators.required, noWhitespaceValidator()]],
      flgEst: [data.usuario.flgEst || 'A', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarCentrosCosto();
    this.cargarPerfiles();
    this.cargarCargos();
  }

  get filteredPerfilOptions(): PerfilOption[] {
    const search = this.perfilSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.perfilOptions;
    }

    return this.perfilOptions.filter((perfil) =>
      perfil.codigo.toLowerCase().includes(search) || perfil.descripcion.toLowerCase().includes(search)
    );
  }

  get filteredCentroCostoOptions(): CentroCostoOption[] {
    const search = this.centroCostoSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.centroCostoOptions;
    }

    return this.centroCostoOptions.filter((centroCosto) =>
      String(centroCosto.id).includes(search) || centroCosto.descripcion.toLowerCase().includes(search)
    );
  }

  get filteredCargoOptions(): CargoOption[] {
    const search = this.cargoSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.cargoOptions;
    }

    return this.cargoOptions.filter((cargo) =>
      String(cargo.id).includes(search) || cargo.nombre.toLowerCase().includes(search)
    );
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const values = this.form.value as {
      usrCod: string;
      usrNom: string;
      usrCorr: string;
      usrDocNro: string;
      usrPass: string;
      usrCenCosId: number;
      usrCrg: number;
      usrApr: string;
      usrPrf: string;
      flgEst: string;
    };
    const payload: ActualizarUsuarioRequest = {
      Usr_Id: String(this.data.usuario.usrId),
      Usr_Cod: values.usrCod.trim(),
      Usr_Nom: values.usrNom.trim(),
      Flg_Est: values.flgEst,
      Usr_Mod: this.getUsuarioModificador(),
      Usr_Doc_Nro: values.usrDocNro.trim(),
      Usr_Cen_Cos_Id: Number(values.usrCenCosId),
      Usr_Pass: values.usrPass.trim(),
      Usr_Apr: values.usrApr,
      Usr_Corr: values.usrCorr.trim(),
      Usr_Prf: values.usrPrf.trim(),
      Usr_Crg: Number(values.usrCrg)
    };

    console.log('Payload actualizar usuario:', payload);

    this.apiService.actualizarUsuario(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando usuario:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isSaving = false;
      }
    });
  }

  cerrar(): void {
    if (!this.isSaving) {
      this.dialogRef.close(false);
    }
  }

  onPerfilSelectOpened(opened: boolean): void {
    if (opened) {
      this.perfilSearchControl.setValue('');
    }
  }

  onCentroCostoSelectOpened(opened: boolean): void {
    if (opened) {
      this.centroCostoSearchControl.setValue('');
    }
  }

  onCargoSelectOpened(opened: boolean): void {
    if (opened) {
      this.cargoSearchControl.setValue('');
    }
  }

  private cargarCentrosCosto(): void {
    this.isLoadingCentrosCosto = true;
    this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.centroCostoOptions = this.extractRecords(response)
          .map((item) => this.mapCentroCostoOption(item))
          .filter((item): item is CentroCostoOption => item !== null);
        this.isLoadingCentrosCosto = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando centros de costo para usuario:', error);
        this.centroCostoOptions = [];
        this.errorMessage = 'No se pudieron cargar los centros de costo.';
        this.isLoadingCentrosCosto = false;
      }
    });
  }

  private cargarPerfiles(): void {
    this.isLoadingPerfiles = true;
    this.apiService.getListarPerfil({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.perfilOptions = this.extractRecords(response)
          .map((item) => this.mapPerfilOption(item))
          .filter((item): item is PerfilOption => item !== null)
          .sort((left, right) => left.codigo.localeCompare(right.codigo));
        this.isLoadingPerfiles = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando perfiles para usuario:', error);
        this.perfilOptions = [];
        this.errorMessage = 'No se pudieron cargar los perfiles.';
        this.isLoadingPerfiles = false;
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo actualizar el usuario. Intenta nuevamente.';
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (this.isErrorBody(error.error)) {
      if (this.isValidationErrors(error.error.errors)) {
        const messages = Object.values(error.error.errors).flat();

        if (messages.length) {
          return messages.join(' ');
        }
      }

      if (typeof error.error.message === 'string' && error.error.message.trim()) {
        return error.error.message;
      }

      if (typeof error.error.title === 'string' && error.error.title.trim()) {
        return error.error.title;
      }

    }

    return `No se pudo actualizar el usuario. Codigo HTTP: ${error.status}.`;
  }

  private getUsuarioModificador(): string {
    const globalUser = GlobalVariable.vusu?.trim();

    if (globalUser) {
      return globalUser;
    }

    const currentUser = this.authService.getCurrentUser().trim();

    if (currentUser) {
      return currentUser;
    }

    return 'sistemas';
  }

  private isErrorBody(value: unknown): value is { message?: unknown; title?: unknown; errors?: unknown } {
    return typeof value === 'object' && value !== null;
  }

  private isValidationErrors(value: unknown): value is Record<string, string[]> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return Object.values(value).every((messages) => Array.isArray(messages));
  }

  private extractRecords(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is Record<string, unknown> => this.isDataRecord(item));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is Record<string, unknown> => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private mapCentroCostoOption(item: Record<string, unknown>): CentroCostoOption | null {
    const id = this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes', 'descripcion', 'Descripcion']);

    if (!id || !descripcion) {
      return null;
    }

    return { id, descripcion };
  }

  private cargarCargos(): void {
    this.isLoadingCargos = true;
    this.apiService.getListarCargo().subscribe({
      next: (response: unknown) => {
        this.cargoOptions = this.extractRecords(response)
          .map((item) => this.mapCargoOption(item))
          .filter((item): item is CargoOption => item !== null)
          .sort((left, right) => left.nombre.localeCompare(right.nombre));
        this.isLoadingCargos = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando cargos para usuario:', error);
        this.cargoOptions = [];
        this.errorMessage = 'No se pudieron cargar los cargos.';
        this.isLoadingCargos = false;
      }
    });
  }

  private mapPerfilOption(item: Record<string, unknown>): PerfilOption | null {
    const codigo = this.getTextValue(item, ['Prf_Cod', 'prf_Cod', 'prfCod', 'codigo', 'Codigo']);
    const descripcion = this.getTextValue(item, ['Prf_Des', 'prf_Des', 'prfDes', 'descripcion', 'Descripcion']);

    if (!codigo || !descripcion) {
      return null;
    }

    return { codigo, descripcion };
  }

  private mapCargoOption(item: Record<string, unknown>): CargoOption | null {
    const id = this.getNumberValue(item, ['Cargo_Id', 'cargo_Id', 'cargoId', 'id', 'Id']);
    const nombre = this.getTextValue(item, ['Cargo_Nombre', 'cargo_Nombre', 'cargoNombre', 'nombre', 'Nombre']);

    if (!id || !nombre) {
      return null;
    }

    return { id, nombre };
  }

  private getTextValue(item: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private isDataRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
