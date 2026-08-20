import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import type { ActualizarTipoInspeccionRequest, RegistrarTipoInspeccionRequest, TipoInspeccionFiltro } from 'src/app/Services/api.services';
export type { ActualizarTipoInspeccionRequest, RegistrarTipoInspeccionRequest, TipoInspeccionFiltro } from 'src/app/Services/api.services';

@Injectable({
  providedIn: 'root'
})
export class TipoInspeccionService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: TipoInspeccionFiltro = {}): Observable<any> {
    return this.apiService.getListarTipoInspeccion(filtros);
  }

  registrar(tipoInspeccion: RegistrarTipoInspeccionRequest): Observable<any> {
    return this.apiService.registrarTipoInspeccion(tipoInspeccion);
  }

  consultarDatos(tipoInspeccionId: number): Observable<any> {
    return this.apiService.getConsultarDatosTipoInspeccion(tipoInspeccionId);
  }

  actualizar(tipoInspeccion: ActualizarTipoInspeccionRequest): Observable<any> {
    return this.apiService.actualizarTipoInspeccion(tipoInspeccion);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarTipoInspeccion(id, usrMod);
  }

  mapTipoInspeccionDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['Tipo_Nombre'] ??
        item['tipo_Nombre'] ??
        item['Nombre'] ??
        item['nombre'] ??
        ''
      ),
      estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? '')
    };
  }

  private extractRecords(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is Record<string, unknown> => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    const elements = response['Elements'] ?? response['elements'];
    if (Array.isArray(elements)) {
      return elements.filter((item): item is Record<string, unknown> => this.isRecord(item));
    }

    const data = response['Data'] ?? response['data'];
    if (Array.isArray(data)) {
      return data.filter((item): item is Record<string, unknown> => this.isRecord(item));
    }

    return [response];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
