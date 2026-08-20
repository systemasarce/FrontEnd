import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import type {
  ActualizarPreguntasHseRequest,
  PreguntasHseFiltro,
  RegistrarPreguntasHseRequest
} from 'src/app/Services/api.services';
export type {
  ActualizarPreguntasHseRequest,
  PreguntasHseFiltro,
  RegistrarPreguntasHseRequest
} from 'src/app/Services/api.services';

@Injectable({
  providedIn: 'root'
})
export class PreguntasHseService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: PreguntasHseFiltro = {}): Observable<any> {
    return this.apiService.getListarPreguntasHse(filtros);
  }

  listarSinEstado(): Observable<any> {
    return this.apiService.getListarPreguntasHseSinEstado();
  }

  registrar(pregunta: RegistrarPreguntasHseRequest): Observable<any> {
    return this.apiService.registrarPreguntasHse(pregunta);
  }

  consultarDatos(preguntaId: number): Observable<any> {
    return this.apiService.getConsultarDatosPreguntasHse(preguntaId);
  }

  actualizar(pregunta: ActualizarPreguntasHseRequest): Observable<any> {
    return this.apiService.actualizarPreguntasHse(pregunta);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarPreguntasHse(id, usrMod);
  }

  mapPreguntasHseDetalle(response: unknown): { pregunta: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      pregunta: String(
        item['Pregunta_Nombre'] ??
        item['pregunta_Nombre'] ??
        item['Pregunta'] ??
        item['pregunta'] ??
        item['Nombre'] ??
        item['nombre'] ??
        ''
      ).trim(),
      estado: String(item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? '').trim()
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
