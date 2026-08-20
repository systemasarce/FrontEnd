import { Component } from '@angular/core';

interface ReporteAccesoDirecto {
  title: string;
  description: string;
  route: string;
  endpoint: string;
}

@Component({
  selector: 'app-reportes-page',
  templateUrl: './reportes-page.component.html',
  styleUrls: ['./reportes-page.component.scss']
})
export class ReportesPageComponent {
  readonly reportes: ReporteAccesoDirecto[] = [
    {
      title: 'Kardex General',
      description: 'Consulta el kardex general y filtra los movimientos por ítem.',
      route: '/reportes/kardex-general',
      endpoint: 'getGenerarKardexGeneral'
    },
    {
      title: 'Ingresos y Salidas de Almacén',
      description: 'Consulta los movimientos de almacén por solicitante, fechas, centro de costo y proveedor.',
      route: '/reportes/ingresos-salidas-almacen',
      endpoint: 'getReporteIngresoSalidasAlmacen'
    },
    {
      title: 'Órdenes de Compra y Servicio',
      description: 'Consulta las órdenes generadas por solicitante, tipo, pedido, proveedor y forma de pago.',
      route: '/reportes/ordenes-compra-servicio',
      endpoint: 'getGenerarReporteOcos'
    },
    {
      title: 'Asignaciones por Usuario',
      description: 'Consulta las asignaciones de materiales por usuario, fecha, centro de costo e ítem.',
      route: '/reportes/asignaciones-usuarios',
      endpoint: 'getReporteAsignacionUsuario'
    },
    {
      title: 'Reporte OC/OS',
      description: 'Consulta el seguimiento de pedidos, órdenes de compra y servicio, importes y datos de pago.',
      route: '/reportes/reporte-ocos',
      endpoint: 'getReporteOCOS'
    }
  ];
}
