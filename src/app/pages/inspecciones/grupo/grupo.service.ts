import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { GrupoFiltro, GrupoItem } from './grupo.model';

export interface RegistrarGrupoRequest {
  Grupo_Cod: number;
  Grupo_Nombre: string;
  Usr_Reg: string;
  Grupo_Descripcion: string;
}

export interface ActualizarGrupoRequest {
  Grupo_Id: number;
  Grupo_Cod: number;
  Grupo_Nombre: string;
  Estado: string;
  Usr_Mod: string;
  Grupo_Descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class GrupoService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: GrupoFiltro = {}): Observable<any> {
    return this.apiService.getListarGrupo({
      ...filtros,
      Grupo_Descripcion: String(filtros.Grupo_Descripcion ?? '').trim()
    });
  }


  registrar(grupo: RegistrarGrupoRequest): Observable<any> {
    return this.apiService.registrarGrupo(grupo as never);
  }

  actualizar(grupo: ActualizarGrupoRequest): Observable<any> {
    return this.apiService.actualizarGrupo(grupo as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarGrupo(id, usrMod);
  }

  mapGrupoItems(response: unknown): GrupoItem[] {
    return this.extractRecords(response)
      .map((item) => ({
        grupoId: this.asNumber(
          item['Grupo_Id'] ?? item['grupo_Id'] ?? item['grupo_id'] ?? item['Id'] ?? item['id']
        ),
        grupoCod: this.asNumber(
          item['Grupo_Cod'] ?? item['grupo_Cod'] ?? item['grupo_cod'] ?? item['Codigo'] ?? item['codigo']
        ),
        grupoNombre: String(
          item['Grupo_Nombre'] ?? item['grupo_Nombre'] ?? item['grupo_nombre'] ?? item['Nombre'] ?? item['nombre'] ?? ''
        ).trim(),
        grupoDescripcion: String(
          item['Grupo_Descripcion'] ?? item['grupo_Descripcion'] ?? item['grupo_descripcion'] ?? item['Descripcion'] ?? item['descripcion'] ?? ''
        ).trim(),
        estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? item['Flg_Estado'] ?? '').trim()
      }))
      .filter((item) => item.grupoId !== null || item.grupoCod !== null || !!item.grupoNombre || !!item.estado);
  }

  mapGrupoItem(response: unknown): GrupoItem | null {
    const items = this.mapGrupoItems(response);
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
