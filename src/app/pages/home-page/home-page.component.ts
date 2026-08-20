import { Component } from '@angular/core';
import { AuthService } from 'src/app/features/auth/services/auth.service';

interface HomeProcessCard {
  title: string;
  description: string;
  route: string;
  iconPaths: ReadonlyArray<string>;
}

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent {
  readonly processCards: HomeProcessCard[] = [
    {
      title: 'Pedidos',
      description: 'Registra solicitudes, gestiona su aprobaci\u00f3n y consulta el avance de cada pedido.',
      route: '/pedidos',
      iconPaths: ['M8 4.5h8l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V6a1.5 1.5 0 0 1 1.5-1.5H8z', 'M8 4.5V8h8', 'M8.5 11.5h7', 'M8.5 15h7']
    },
    {
      title: 'Orden de Compra',
      description: 'Genera y administra \u00f3rdenes de compra a partir de los pedidos aprobados.',
      route: '/orden-compra',
      iconPaths: ['M6 7h12l-1.1 6.2a2 2 0 0 1-2 1.7H9.1a2 2 0 0 1-2-1.7L6 7z', 'M9 7V5.8A2.8 2.8 0 0 1 11.8 3h.4A2.8 2.8 0 0 1 15 5.8V7', 'M9 18.5h.01', 'M15 18.5h.01']
    },
    {
      title: 'Orden de Servicio',
      description: 'Gestiona las \u00f3rdenes asociadas a servicios, proveedores y centros de costo.',
      route: '/orden-servicio',
      iconPaths: ['M14.7 5.3a2.3 2.3 0 1 1 3.3 3.3l-2.2 2.2-3.3-3.3 2.2-2.2z', 'M4 20l4.6-1.2L18 9.4l-3.4-3.4-9.4 9.4z', 'M4 20h4.6']
    },
    {
      title: 'Almac\u00e9n',
      description: 'Controla ingresos, salidas, consumos, despachos y anulaciones de materiales.',
      route: '/almacen',
      iconPaths: ['M4 8.5 12 4l8 4.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 8.5 12 13l8-4.5', 'M12 13V20']
    },
    {
      title: 'Stock',
      description: 'Consulta las existencias disponibles y el movimiento de los materiales.',
      route: '/stock',
      iconPaths: ['M5 18.5V11', 'M10 18.5V5.5', 'M15 18.5v-8', 'M20 18.5v-4', 'M3.5 20.5h17']
    },
    {
      title: 'Inspecciones',
      description: 'Registra y consulta inspecciones y controles operativos de seguridad.',
      route: '/inspecciones',
      iconPaths: ['M12 3l7 3v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6z', 'm9 6.8-7.2 7.2L9 16.9']
    },
    {
      title: 'Asignaci\u00f3n',
      description: 'Asigna materiales a usuarios por centro de costo y controla sus cantidades.',
      route: '/asignacion',
      iconPaths: ['M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 14a5 5 0 0 1 10 0', 'M15 8h6', 'M18 5v6', 'm15 17 2 2 4-5']
    },
    {
      title: 'Obra',
      description: 'Administra obras, clientes, centros de costo, responsables y datos contractuales.',
      route: '/obra',
      iconPaths: ['M4 20V8l8-5 8 5v12', 'M8 20v-6h8v6', 'M7 9h2', 'M11 9h2', 'M15 9h2']
    },
    {
      title: 'Transferencia de almacén',
      description: 'Traslada materiales entre centros de costo con control de stock y aprobación.',
      route: '/transferencia-almacen',
      iconPaths: ['M4 7h13', 'm14 4 3-4-3-4', 'M20 17H7', 'm10 13-3 4 3 4']
    },
    {
      title: 'Reportes',
      description: 'Consulta y exporta kardex, movimientos de almac\u00e9n, \u00f3rdenes y asignaciones.',
      route: '/reportes',
      iconPaths: ['M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z', 'M14 3.5V8h4', 'M9 16.5V12', 'M12 16.5v-3', 'M15 16.5V10']
    }
  ];

  constructor(private readonly authService: AuthService) {}

  get visibleProcessCards(): HomeProcessCard[] {
    return this.processCards.filter((process) => this.authService.hasAccessToRoute(process.route));
  }
}
