import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { TareaFilter } from './tarea.model';

export interface RegistrarTareaRequest {
  Nombre: string;
  Usr_Reg: string;
}

export interface ActualizarTareaRequest {
  Id: number;
  Nombre: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class TareaService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: TareaFilter = {}): Observable<any> {
    return this.apiService.getListarTarea({
      Id: Number(filtros.Id || 0),
      Nombre: String(filtros.Nombre ?? ''),
      Estado: String(filtros.Estado ?? 'A')
    });
  }

  consultarDatos(tareaId: number): Observable<any> {
    return this.apiService.getConsultarDatosTarea(tareaId);
  }

  registrar(tarea: RegistrarTareaRequest): Observable<any> {
    return this.apiService.registrarTarea(tarea as never);
  }

  actualizar(tarea: ActualizarTareaRequest): Observable<any> {
    return this.apiService.actualizarTarea(tarea as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarTarea(id, usrMod);
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

  mapTareaDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['Tarea_Nombre'] ??
        item['tarea_Nombre'] ??
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
