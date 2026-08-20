import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { JefeFilter } from './jefe.model';

export interface RegistrarJefeRequest {
  Reporte_Tipo: string;
  Usr_Reg: string;
}

export interface ActualizarJefeRequest {
  Reporte_Id: number;
  Reporte_Tipo: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class JefeService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: JefeFilter = {}): Observable<any> {
    return this.apiService.getListarJefe(filtros);
  }

  registrar(jefe: RegistrarJefeRequest): Observable<any> {
    return this.apiService.registrarJefe(jefe as never);
  }

  consultarDatos(jefeId: number): Observable<any> {
    return this.apiService.getConsultarDatosJefe(jefeId);
  }

  actualizar(jefe: ActualizarJefeRequest): Observable<any> {
    return this.apiService.actualizarJefe(jefe as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarJefe(id, usrMod);
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

  mapJefeDetalle(response: unknown): { tipoReporte: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      tipoReporte: String(
        item['Reporte_Tipo'] ??
        item['reporte_Tipo'] ??
        item['reporte_tipo'] ??
        item['Tipo_Reporte'] ??
        item['tipoReporte'] ??
        item['tipo_reporte'] ??
        item['Reporte'] ??
        item['reporte'] ??
        ''
      ),
      estado: String(item['Estado'] ?? item['estado'] ?? '')
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
