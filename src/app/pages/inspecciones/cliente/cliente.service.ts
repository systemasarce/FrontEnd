import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { ClienteFilter } from './cliente.model';

export interface RegistrarClienteRequest {
  Nombre: string;
  Usr_Reg: string;
}

export interface ActualizarClienteRequest {
  Id: number;
  Nombre: string;
  Estado: string;
  Usr_Mod: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: ClienteFilter = {}): Observable<any> {
    return this.apiService.getListarCliente(filtros);
  }

  registrar(cliente: RegistrarClienteRequest): Observable<any> {
    return this.apiService.registrarCliente(cliente as never);
  }

  consultarDatos(clienteId: number): Observable<any> {
    return this.apiService.getConsultarDatosCliente(clienteId);
  }

  actualizar(cliente: ActualizarClienteRequest): Observable<any> {
    return this.apiService.actualizarCliente(cliente as never);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.eliminarCliente(id, usrMod);
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

  mapClienteDetalle(response: unknown): { nombre: string; estado: string } | null {
    const registros = this.extractRecords(response);
    if (!registros.length) {
      return null;
    }

    const item = registros[0];
    return {
      nombre: String(
        item['Cliente_Nombre'] ??
        item['cliente_Nombre'] ??
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
