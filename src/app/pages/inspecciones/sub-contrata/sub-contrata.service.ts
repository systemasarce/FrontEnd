import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { SubContrataFilter } from './sub-contrata.model';

export interface RegistrarSubContrataRequest {
  Nombre: string;
  Usr_Reg: string;
}

export interface ActualizarSubContrataRequest {
  Id: number;
  Nombre: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubContrataService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: SubContrataFilter = {}): Observable<any> {
    return this.apiService.getListarSubContrata({
      Id: Number(filtros.Id || 0),
      Nombre: String(filtros.Nombre ?? ''),
      Estado: String(filtros.Estado ?? 'A')
    });
  }

  consultarDatos(subContrataId: number): Observable<any> {
    return this.apiService.getConsultarDatosSubContrata(subContrataId);
  }

  registrar(subContrata: RegistrarSubContrataRequest): Observable<any> {
    return this.apiService.registrarSubContrata(subContrata as never);
  }

  actualizar(subContrata: ActualizarSubContrataRequest): Observable<any> {
    return this.apiService.actualizarSubContrata(subContrata as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarSubContrata(id, usrMod);
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

  mapSubContrataDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['SubContrata_Nombre'] ??
        item['subContrata_Nombre'] ??
        item['Nombre'] ??
        item['nombre'] ??
        ''
      ),
      estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? '')
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
