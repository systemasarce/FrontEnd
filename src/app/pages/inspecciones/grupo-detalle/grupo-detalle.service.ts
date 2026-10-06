import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { GrupoDetalleFiltro, GrupoDetalleItem } from './grupo-detalle.model';

export interface RegistrarGrupoDetalleRequest {
  Detalle_Cod: string;
  Detalle_Nombre: string;
  Detalle_Valor: number;
  Grupo_Id: number;
  Usr_Reg: string;
}

export interface ActualizarGrupoDetalleRequest {
  Detalle_Id: number;
  Detalle_Cod: string;
  Detalle_Nombre: string;
  Detalle_Valor: number;
  Grupo_Id: number;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class GrupoDetalleService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: GrupoDetalleFiltro = {}): Observable<any> {
    return this.apiService.getListarGrupoDetalle(filtros);
  }

  registrar(detalle: RegistrarGrupoDetalleRequest): Observable<any> {
    return this.apiService.registrarGrupoDetalle(detalle);
  }

  actualizar(detalle: ActualizarGrupoDetalleRequest): Observable<any> {
    return this.apiService.actualizarGrupoDetalle(detalle);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarGrupoDetalle(id, usrMod);
  }

  mapGrupoDetalleItems(response: unknown): GrupoDetalleItem[] {
    return this.extractRecords(response)
      .map((item) => ({
        detalleId: this.asNumber(item['Detalle_Id'] ?? item['detalle_Id'] ?? item['detalle_id'] ?? item['Id'] ?? item['id']),
        detalleCod: String(item['Detalle_Cod'] ?? item['detalle_Cod'] ?? item['detalle_cod'] ?? item['Codigo'] ?? item['codigo'] ?? '').trim(),
        detalleNombre: String(item['Detalle_Nombre'] ?? item['detalle_Nombre'] ?? item['detalle_nombre'] ?? item['Nombre'] ?? item['nombre'] ?? '').trim(),
        detalleValor: this.asNumber(item['Detalle_Valor'] ?? item['detalle_Valor'] ?? item['detalle_valor'] ?? item['Valor'] ?? item['valor']),
        grupoId: this.asNumber(item['Grupo_Id'] ?? item['grupo_Id'] ?? item['grupo_id']),
        grupoNombre: String(item['Grupo_Nombre'] ?? item['grupo_Nombre'] ?? item['grupo_nombre'] ?? '').trim(),
        estado: String(item['Estado'] ?? item['estado'] ?? '').trim()
      }))
      .filter((item) => item.detalleId !== null || !!item.detalleCod || !!item.detalleNombre || item.detalleValor !== null || !!item.grupoNombre || !!item.estado);
  }

  mapGrupoDetalleItem(response: unknown): GrupoDetalleItem | null {
    const items = this.mapGrupoDetalleItems(response);
    return items.length ? items[0] : null;
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

  private asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
