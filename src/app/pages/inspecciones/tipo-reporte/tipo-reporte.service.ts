import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { TipoReporteFiltro, TipoReporteItem } from './tipo-reporte.model';

export interface RegistrarTipoReporteRequest {
  Reporte_Tipo: string;
  Usr_Reg: string;
}

export interface ActualizarTipoReporteRequest {
  Reporte_Id: number;
  Reporte_Tipo: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class TipoReporteService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: TipoReporteFiltro = {}): Observable<any> {
    return this.apiService.getListarTipoReporte(filtros);
  }

  registrar(tipoReporte: RegistrarTipoReporteRequest): Observable<any> {
    return this.apiService.registrarTipoReporte(tipoReporte as never);
  }

  actualizar(tipoReporte: ActualizarTipoReporteRequest): Observable<any> {
    return this.apiService.actualizarTipoReporte(tipoReporte as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarTipoReporte(id, usrMod);
  }

  mapTipoReporteItems(response: unknown): TipoReporteItem[] {
    return this.extractRecords(response)
      .map((item) => ({
        reporteId: this.asNumber(
          item['Reporte_Id'] ?? item['reporte_Id'] ?? item['reporte_id'] ?? item['Id'] ?? item['id']
        ),
        reporteTipo: String(
          item['Reporte_Tipo'] ?? item['reporte_Tipo'] ?? item['reporte_tipo'] ?? item['Tipo_Reporte'] ??
          item['tipo_reporte'] ?? item['Nombre'] ?? item['nombre'] ?? ''
        ).trim(),
        estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? item['Flg_Estado'] ?? '').trim()
      }))
      .filter((item) => item.reporteId !== null || !!item.reporteTipo || !!item.estado);
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
