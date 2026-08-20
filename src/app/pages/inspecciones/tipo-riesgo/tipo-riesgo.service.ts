import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import type { ActualizarTipoRiesgoRequest, RegistrarTipoRiesgoRequest, TipoRiesgoFiltro } from 'src/app/Services/api.services';
export type { ActualizarTipoRiesgoRequest, RegistrarTipoRiesgoRequest, TipoRiesgoFiltro } from 'src/app/Services/api.services';

@Injectable({
  providedIn: 'root'
})
export class TipoRiesgoService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: TipoRiesgoFiltro = {}): Observable<any> {
    return this.apiService.getListarTipoRiesgo(filtros);
  }

  registrar(tipoRiesgo: RegistrarTipoRiesgoRequest): Observable<any> {
    return this.apiService.registrarTipoRiesgo(tipoRiesgo);
  }

  consultarDatos(tipoRiesgoId: number): Observable<any> {
    return this.apiService.getConsultarDatosTipoRiesgo(tipoRiesgoId);
  }

  actualizar(tipoRiesgo: ActualizarTipoRiesgoRequest): Observable<any> {
    return this.apiService.actualizarTipoRiesgo(tipoRiesgo);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarTipoRiesgo(id, usrMod);
  }

  mapTipoRiesgoDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['Tipo_Riesgo'] ??
        item['tipo_riesgo'] ??
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
