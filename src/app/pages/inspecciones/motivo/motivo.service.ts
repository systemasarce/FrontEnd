import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { MotivoFilter } from './motivo.model';

export interface RegistrarMotivoRequest {
  Nombre: string;
  Usr_Reg: string;
}

export interface ActualizarMotivoRequest {
  Id: number;
  Nombre: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class MotivoService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: MotivoFilter = {}): Observable<any> {
    return this.apiService.getListarMotivo({
      Id: Number(filtros.Id || 0),
      Nombre: String(filtros.Nombre ?? ''),
      Estado: String(filtros.Estado ?? 'A')
    });
  }

  consultarDatos(motivoId: number): Observable<any> {
    return this.apiService.getConsultarDatosMotivo(motivoId);
  }

  registrar(motivo: RegistrarMotivoRequest): Observable<any> {
    return this.apiService.registrarMotivo(motivo as never);
  }

  actualizar(motivo: ActualizarMotivoRequest): Observable<any> {
    return this.apiService.actualizarMotivo(motivo as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarMotivo(id, usrMod);
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

  mapMotivoDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['Motivo_Nombre'] ??
        item['motivo_Nombre'] ??
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
