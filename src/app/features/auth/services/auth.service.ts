import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';

const AUTH_STORAGE_KEY = 'app_auth_session';
const AUTH_USER_KEY = 'app_auth_user';
const AUTH_USER_NAME_KEY = 'app_auth_user_name';
const AUTH_USER_PROFILE_KEY = 'app_auth_user_profile';
const AUTH_ACCESS_ROUTES_KEY = 'app_auth_access_routes';
const AUTH_REMEMBER_CREDENTIALS_KEY = 'app_auth_remember_credentials';

interface LoginResult {
  success: boolean;
  message: string;
  userName: string;
  userProfile: string;
  accessRoutes: string[];
}

export interface RememberedCredentials {
  userCode: string;
  password: string;
  remember: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private readonly apiService: ApiService) {}

  isAuthenticated(): boolean {
    return this.getStorageValue(AUTH_STORAGE_KEY) === 'true';
  }

  login(userCode: string, password: string, rememberCredentials = false): Observable<LoginResult> {
    const normalizedUserCode = userCode.trim();

    return this.apiService.getObtenerAccesoUsuario({
      Usr_Cod: normalizedUserCode,
      Usr_Pass: password
    }).pipe(
      map((response: unknown) => {
        console.log('[Auth] Respuesta getObtenerAccesoUsuario:', response);
        return this.mapAccessResponse(response);
      }),
      switchMap((result: LoginResult) => this.resolveUserProfile(result, normalizedUserCode)),
      switchMap((result: LoginResult) => {
        if (!result.success || !result.userProfile) {
          if (result.success) {
            console.warn('[Auth] Login correcto, pero no se encontro Usr_Prf para cargar accesos.', {
              usuario: normalizedUserCode,
              resultado: result
            });
          }

          return of(result);
        }

        return this.apiService.getListarAcceso({ Prf_Acc_Cod: result.userProfile }).pipe(
          map((response: unknown) => {
            const accessRoutes = this.extractAccessRoutes(response);
            console.groupCollapsed('[Auth] Accesos cargados por perfil');
            console.log('Usuario:', normalizedUserCode);
            console.log('Perfil Usr_Prf:', result.userProfile);
            console.log('Respuesta getListarAcceso:', response);
            console.log('Rutas permitidas:', accessRoutes);
            console.log('Acceso total (*):', accessRoutes.includes('*'));
            console.groupEnd();

            return {
              ...result,
              accessRoutes
            };
          }),
          catchError((error) => {
            console.error('[Auth] No se pudieron cargar los accesos del perfil', {
              usuario: normalizedUserCode,
              perfil: result.userProfile,
              error
            });

            return of({
              ...result,
              accessRoutes: []
            });
          })
        );
      }),
      catchError((error) => {
        console.error('[Auth] Error validando usuario en getObtenerAccesoUsuario:', error);

        return of({
          success: false,
          message: this.extractErrorMessage(error),
          userName: '',
          userProfile: '',
          accessRoutes: []
        });
      }),
      tap((result: LoginResult) => {
        if (result.success) {
          this.setStorageValue(AUTH_STORAGE_KEY, 'true');
          this.setStorageValue(AUTH_USER_KEY, normalizedUserCode);
          this.setStorageValue(AUTH_USER_NAME_KEY, result.userName || normalizedUserCode);
          this.setStorageValue(AUTH_USER_PROFILE_KEY, result.userProfile);
          this.setStorageValue(AUTH_ACCESS_ROUTES_KEY, JSON.stringify(result.accessRoutes));
          this.saveRememberedCredentials(normalizedUserCode, password, rememberCredentials);
          console.log('[Auth] Accesos guardados en sesion:', {
            perfil: result.userProfile,
            rutas: result.accessRoutes
          });
          return;
        }

        this.logout();
      })
    );
  }

  private resolveUserProfile(result: LoginResult, userCode: string): Observable<LoginResult> {
    if (!result.success || result.userProfile) {
      return of(result);
    }

    return this.apiService.getListarUsuarioActivo({ Usr_Cod: userCode, Flg_Est: 'A' }).pipe(
      map((response: unknown) => {
        const record = this.extractFirstRecord(response);
        const userProfile = this.getUserProfileFromRecord(record);

        console.groupCollapsed('[Auth] Perfil obtenido por fallback de usuario activo');
        console.log('Usuario:', userCode);
        console.log('Respuesta getListarUsuarioActivo:', response);
        console.log('Perfil encontrado:', userProfile);
        console.groupEnd();

        return {
          ...result,
          userProfile
        };
      }),
      catchError((error) => {
        console.error('[Auth] No se pudo obtener el perfil del usuario activo', {
          usuario: userCode,
          error
        });

        return of(result);
      })
    );
  }

  logout(): void {
    this.removeStorageValue(AUTH_STORAGE_KEY);
    this.removeStorageValue(AUTH_USER_KEY);
    this.removeStorageValue(AUTH_USER_NAME_KEY);
    this.removeStorageValue(AUTH_USER_PROFILE_KEY);
    this.removeStorageValue(AUTH_ACCESS_ROUTES_KEY);
  }

  getCurrentUser(): string {
    return this.getStorageValue(AUTH_USER_KEY) ?? '';
  }

  getCurrentUserName(): string {
    return this.getStorageValue(AUTH_USER_NAME_KEY) ?? this.getCurrentUser();
  }

  getCurrentUserProfile(): string {
    return this.getStorageValue(AUTH_USER_PROFILE_KEY) ?? '';
  }

  getAccessRoutes(): string[] {
    const rawValue = this.getStorageValue(AUTH_ACCESS_ROUTES_KEY);

    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      return Array.isArray(parsedValue)
        ? parsedValue.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  hasAccessToRoute(route: string): boolean {
    const normalizedRoute = this.normalizeRoute(route);

    if (normalizedRoute === '/' || normalizedRoute === '/login') {
      return true;
    }

    const accessRoutes = this.getAccessRoutes();

    if (accessRoutes.includes('*')) {
      return true;
    }

    const aliases: Record<string, string[]> = {
      '/cliente': ['/jefe', '/tipo-reporte'],
      '/cliente-tjh2b': ['/cliente'],
      '/cotizaciones-tjh2b': ['/pedidos'],
      '/jefe': ['/cliente', '/tipo-reporte'],
      '/tipo-reporte': ['/cliente', '/jefe'],
      '/riesgo': ['/cliente'],
      '/reporte': ['/cliente'],
      '/motivo': ['/jefe'],
      '/clima': ['/jefe'],
      '/tarea': ['/jefe'],
      '/sub-contrata': ['/jefe'],
      '/asignacion': ['/reportes'],
      '/transferencia-almacen': ['/almacen'],
      '/reportes/kardex-general': ['/reportes'],
      '/reportes/ingresos-salidas-almacen': ['/reportes'],
      '/reportes/ordenes-compra-servicio': ['/reportes']
    };

    const candidateRoutes = [normalizedRoute, ...(aliases[normalizedRoute] ?? [])];

    return candidateRoutes.some((route) =>
      accessRoutes.some((accessRoute) => this.normalizeRoute(accessRoute) === route)
    );
  }

  getRememberedCredentials(): RememberedCredentials {
    const rawValue = localStorage.getItem(AUTH_REMEMBER_CREDENTIALS_KEY);

    if (!rawValue) {
      return {
        userCode: '',
        password: '',
        remember: false
      };
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<RememberedCredentials>;
      return {
        userCode: String(parsedValue.userCode || ''),
        password: String(parsedValue.password || ''),
        remember: Boolean(parsedValue.remember)
      };
    } catch {
      return {
        userCode: '',
        password: '',
        remember: false
      };
    }
  }

  private saveRememberedCredentials(userCode: string, password: string, rememberCredentials: boolean): void {
    if (!rememberCredentials) {
      localStorage.removeItem(AUTH_REMEMBER_CREDENTIALS_KEY);
      return;
    }

    localStorage.setItem(AUTH_REMEMBER_CREDENTIALS_KEY, JSON.stringify({
      userCode,
      password,
      remember: true
    }));
  }

  private getStorageValue(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private setStorageValue(key: string, value: string): void {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  }

  private removeStorageValue(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  private mapAccessResponse(response: unknown): LoginResult {
    const responseRecord = this.asRecord(response);
    const record = this.extractFirstRecord(response);
    const existe = String(this.getRecordValue(record, ['Existe']) ?? '1').trim();
    const message = String(
      this.getRecordValue(record, ['Respuesta', 'Message', 'message'])
      ?? this.getRecordValue(responseRecord, ['Message', 'message'])
      ?? ''
    ).trim();
    const userName = String(this.getRecordValue(record, ['Usr_Nom', 'usr_Nom', 'usrNom']) ?? '').trim();
    const userProfile = this.getUserProfileFromRecord(record);

    return {
      success: existe === '0',
      message: message || (existe === '0' ? 'ACCESO CORRECTO' : 'No se pudo validar el acceso.'),
      userName,
      userProfile,
      accessRoutes: []
    };
  }

  private extractAccessRoutes(response: unknown): string[] {
    return this.extractRecords(response)
      .map((item) => String(this.getRecordValue(item, ['Prf_Acc_Des', 'prf_Acc_Des', 'prfAccDes']) ?? '').trim())
      .filter(Boolean);
  }

  private extractErrorMessage(error: unknown): string {
    const errorRecord = this.asRecord(error);
    const nestedError = this.asRecord(errorRecord?.['error']);
    const message = String(
      this.getRecordValue(nestedError, ['Message', 'message', 'Detail', 'detail'])
      ?? this.getRecordValue(errorRecord, ['Message', 'message', 'statusText'])
      ?? ''
    ).trim();

    return message || 'No se pudo validar el acceso. Intenta nuevamente.';
  }

  private extractRecords(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response.map((item) => this.asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
    }

    const responseRecord = this.asRecord(response);

    if (!responseRecord) {
      return [];
    }

    const possibleArrayKeys = ['Elements', 'elements', 'Data', 'data', 'Result', 'result', 'accesos', 'Accesos'];

    for (const key of possibleArrayKeys) {
      const value = responseRecord[key];

      if (Array.isArray(value)) {
        return value.map((item) => this.asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
      }
    }

    return [responseRecord];
  }

  private normalizeRoute(route: string): string {
    const cleanRoute = String(route || '').split('?')[0].split('#')[0].trim();

    if (!cleanRoute || cleanRoute === '/') {
      return '/';
    }

    return `/${cleanRoute.replace(/^\/+|\/+$/g, '')}`;
  }

  private extractFirstRecord(response: unknown): Record<string, unknown> | null {
    if (Array.isArray(response)) {
      return this.asRecord(response[0]);
    }

    const responseRecord = this.asRecord(response);
    if (!responseRecord) {
      return null;
    }

    const elements = this.getRecordValue(responseRecord, ['Elements']);
    if (Array.isArray(elements)) {
      return this.asRecord(elements[0]);
    }

    const data = this.getRecordValue(responseRecord, ['Data']);
    if (Array.isArray(data)) {
      return this.asRecord(data[0]);
    }

    const dataRecord = this.asRecord(data);
    if (dataRecord) {
      return dataRecord;
    }

    return responseRecord;
  }

  private getRecordValue(record: Record<string, unknown> | null, keys: string[]): unknown {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        return record[key];
      }
    }

    const normalizedRecordKeys = Object.keys(record);
    for (const key of keys) {
      const normalizedKey = normalizedRecordKeys.find((recordKey) => recordKey.toLowerCase() === key.toLowerCase());

      if (normalizedKey) {
        return record[normalizedKey];
      }
    }

    return null;
  }

  private getUserProfileFromRecord(record: Record<string, unknown> | null): string {
    return String(this.getRecordValue(record, [
      'Usr_Prf',
      'usrPrf',
      'USR_PRF',
      'usr_prf',
      'Usr_Perfil',
      'usrPerfil',
      'Perfil',
      'perfil'
    ]) ?? '').trim();
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }
}
