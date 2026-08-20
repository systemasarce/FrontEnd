import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { CotizacionTjh2bFilter } from './cotizaciones-tjh2b.model';

@Injectable({
  providedIn: 'root'
})
export class CotizacionesTjh2bService {
  constructor(private readonly apiService: ApiService) {}

  listar(filtros: CotizacionTjh2bFilter = {}): Observable<any> {
    return this.apiService.getListarCotizacionTjh2b(filtros);
  }

  consultarDatos(cotizacionId: number): Observable<any> {
    return this.apiService.getConsultarDatosCotizacionTjh2b(cotizacionId);
  }

  registrar(formData: FormData): Observable<any> {
    return this.apiService.postRegistrarCotizacionTjh2b(formData);
  }

  actualizar(formData: FormData): Observable<any> {
    return this.apiService.patchActualizarCotizacionTjh2b(formData);
  }

  eliminar(id: number, usrMod: string): Observable<any> {
    return this.apiService.deleteEliminarCotizacionTjh2b(id, usrMod);
  }

  obtenerArchivo(ruta: string): Observable<ArrayBuffer> {
    return this.apiService.getArchivoCotizacionTjh2b(ruta);
  }
}
