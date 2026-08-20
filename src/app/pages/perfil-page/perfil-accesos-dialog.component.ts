import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Route, Router } from '@angular/router';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ApiService, EliminarAccesoRequest, RegistrarAccesoRequest } from 'src/app/Services/api.services';
import { PerfilRow } from './perfil-page.component';

type DataRecord = Record<string, unknown>;
type PerfilAccesosView = 'listado' | 'registro';

interface PerfilAccesosDialogData {
  perfil: PerfilRow;
}

interface RouteOption {
  path: string;
  label: string;
}

interface AccesoRow {
  prfAccDes: string;
}

@Component({
  selector: 'app-perfil-accesos-dialog',
  templateUrl: './perfil-accesos-dialog.component.html',
  styleUrls: ['./perfil-accesos-dialog.component.scss']
})
export class PerfilAccesosDialogComponent {
  readonly form: FormGroup;
  readonly rutaSearchControl = new FormControl('', { nonNullable: true });
  readonly routeOptions: RouteOption[];
  accesos: AccesoRow[] = [];
  currentView: PerfilAccesosView = 'listado';
  errorMessage = '';
  isLoading = false;
  isSaving = false;
  deletingAccessPath = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly router: Router,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    @Inject(MAT_DIALOG_DATA) public data: PerfilAccesosDialogData,
    private readonly dialogRef: MatDialogRef<PerfilAccesosDialogComponent>
  ) {
    this.form = this.formBuilder.group({
      ruta: ['']
    });
    this.routeOptions = this.buildRouteOptions();
    this.cargarAccesos();
  }

  get filteredRouteOptions(): RouteOption[] {
    const search = this.rutaSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.routeOptions;
    }

    return this.routeOptions.filter((route) =>
      route.path.toLowerCase().includes(search) || route.label.toLowerCase().includes(search)
    );
  }

  onRutaSelectOpened(opened: boolean): void {
    if (opened) {
      this.rutaSearchControl.setValue('');
    }
  }

  mostrarRegistro(): void {
    this.currentView = 'registro';
    this.form.reset({ ruta: '' });
    this.errorMessage = '';
  }

  volverListado(): void {
    this.currentView = 'listado';
    this.form.reset({ ruta: '' });
    this.errorMessage = '';
  }

  eliminarAcceso(acceso: AccesoRow): void {
    const ruta = String(acceso.prfAccDes || '').trim();

    if (!ruta || this.deletingAccessPath) {
      return;
    }

    const payload: EliminarAccesoRequest = {
      Prf_Acc_Cod: this.data.perfil.prfCod,
      Prf_Acc_Des: ruta
    };

    this.deletingAccessPath = ruta;
    this.errorMessage = '';

    this.apiService.deleteEliminarAcceso(payload).subscribe({
      next: (response: unknown) => {
        if (!this.isSuccessfulResponse(response)) {
          this.deletingAccessPath = '';
          this.errorMessage = this.getResponseMessage(response) || 'No se pudo eliminar el acceso.';
          return;
        }

        this.deletingAccessPath = '';
        this.cargarAccesos();
      },
      error: (error: unknown) => {
        this.deletingAccessPath = '';
        this.errorMessage = this.getResponseMessage(error) || 'No se pudo eliminar el acceso.';
      }
    });
  }

  save(): void {
    const ruta = String(this.form.controls['ruta'].value || '').trim();

    if (!ruta) {
      this.errorMessage = 'Selecciona una ruta para registrar el acceso.';
      return;
    }

    const payload: RegistrarAccesoRequest = {
      Prf_Acc_Cod: this.data.perfil.prfCod,
      Prf_Acc_Des: ruta,
      Usr_Reg: this.authService.getCurrentUser() || 'sistemas'
    };

    this.isSaving = true;
    this.errorMessage = '';

    this.apiService.postRegistrarAcceso(payload).subscribe({
      next: (response: unknown) => {
        if (!this.isSuccessfulResponse(response)) {
          this.isSaving = false;
          this.errorMessage = this.getResponseMessage(response) || 'No se pudo registrar el acceso.';
          return;
        }

        this.isSaving = false;
        this.currentView = 'listado';
        this.form.reset({ ruta: '' });
        this.cargarAccesos();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.errorMessage = this.getResponseMessage(error) || 'No se pudo registrar el acceso.';
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  private cargarAccesos(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getListarAcceso({ Prf_Acc_Cod: this.data.perfil.prfCod }).subscribe({
      next: (response: unknown) => {
        this.accesos = this.extractRecords(response)
          .map((item) => this.mapAcceso(item))
          .filter((item) => !!item.prfAccDes)
          .sort((left, right) => left.prfAccDes.localeCompare(right.prfAccDes));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.accesos = [];
        this.isLoading = false;
        this.errorMessage = this.getResponseMessage(error) || 'No se pudieron cargar los accesos del perfil.';
      }
    });
  }

  private buildRouteOptions(): RouteOption[] {
    const uniqueRoutes = new Map<string, RouteOption>();

    this.extractRoutes(this.router.config)
      .filter((route) => route.path !== '/' && route.path !== '/login')
      .forEach((route) => uniqueRoutes.set(route.path, route));

    return [
      { path: '*', label: 'Todo' },
      ...Array.from(uniqueRoutes.values())
        .sort((left, right) => left.path.localeCompare(right.path))
    ];
  }

  private extractRoutes(routes: Route[], parentPath = ''): RouteOption[] {
    const options: RouteOption[] = [];

    for (const route of routes) {
      const path = String(route.path ?? '').trim();

      if (route.redirectTo || path === '**') {
        continue;
      }

      const fullPath = this.joinRoutePath(parentPath, path);

      if (route.component && fullPath) {
        options.push({
          path: fullPath,
          label: this.formatRouteLabel(fullPath)
        });
      }

      if (route.children?.length) {
        options.push(...this.extractRoutes(route.children, fullPath));
      }
    }

    return options;
  }

  private joinRoutePath(parentPath: string, path: string): string {
    const cleanParent = parentPath.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+|\/+$/g, '');

    if (!cleanParent && !cleanPath) {
      return '/';
    }

    if (!cleanParent) {
      return `/${cleanPath}`;
    }

    if (!cleanPath) {
      return cleanParent;
    }

    return `${cleanParent}/${cleanPath}`;
  }

  private formatRouteLabel(path: string): string {
    if (path === '/') {
      return 'Inicio';
    }

    return path
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => segment
        .split('-')
        .filter(Boolean)
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(' '))
      .join(' / ');
  }

  private isSuccessfulResponse(response: unknown): boolean {
    if (!this.isRecord(response)) {
      return true;
    }

    if (response['success'] === false || response['Success'] === false) {
      return false;
    }

    const code = Number(response['codeResult'] ?? response['CodeResult'] ?? response['codigo'] ?? response['Codigo']);
    return !Number.isFinite(code) || code < 400;
  }

  private getResponseMessage(response: unknown): string {
    if (this.isRecord(response)) {
      const error = response['error'];

      if (this.isRecord(error)) {
        return String(error['message'] ?? error['Message'] ?? error['sMsj'] ?? error['SMsj'] ?? '').trim();
      }

      return String(response['message'] ?? response['Message'] ?? response['sMsj'] ?? response['SMsj'] ?? '').trim();
    }

    return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isRecord(value));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    if (response['Success'] === false || response['success'] === false) {
      return [];
    }

    const possibleArrayKeys = ['accesos', 'Accesos', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isRecord(item));
      }
    }

    return this.hasAccesoFields(response) ? [response] : [];
  }

  private mapAcceso(item: DataRecord): AccesoRow {
    return {
      prfAccDes: this.getTextValue(item, ['Prf_Acc_Des', 'prf_Acc_Des', 'prfAccDes', 'descripcion', 'Descripcion'])
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

  private hasAccesoFields(item: DataRecord): boolean {
    const recordKeys = ['Prf_Acc_Cod', 'prf_Acc_Cod', 'prfAccCod', 'Prf_Acc_Des', 'prf_Acc_Des', 'prfAccDes'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }
}
