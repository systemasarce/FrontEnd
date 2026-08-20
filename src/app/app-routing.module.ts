import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './features/auth/guards/auth.guard';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { LoginRedirectGuard } from './features/auth/guards/login-redirect.guard';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';
import { BancoPageComponent } from './pages/banco-page/banco-page.component';
import { AlmacenPageComponent } from './pages/almacen-page/almacen-page.component';
import { CentroCostosPageComponent } from './pages/centro-costos-page/centro-costos-page.component';
import { DetraccionPageComponent } from './pages/detraccion-page/detraccion-page.component';
import { DireccionEntregaPageComponent } from './pages/direccion-entrega-page/direccion-entrega-page.component';
import { FormaPagoPageComponent } from './pages/forma-pago-page/forma-pago-page.component';
import { GrupoItemPageComponent } from './pages/grupo-item-page/grupo-item-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { ItemPageComponent } from './pages/item-page/item-page.component';
import { ItemTreePageComponent } from './pages/item-tree-page/item-tree-page.component';
import { ItemDetalleMaterialPageComponent } from './pages/item-detalle-material-page/item-detalle-material-page.component';
import { MonedaPageComponent } from './pages/moneda-page/moneda-page.component';
import { OrdenCompraPageComponent } from './pages/orden-compra-page/orden-compra-page.component';
import { PedidosBPageComponent } from './pages/requisiciones-page/pedidos-b-page.component';
import { CotizacionesTjh2bPageComponent } from './pages/Cotizaciones-page/cotizaciones-tjh2b-page.component';
import { PerfilPageComponent } from './pages/perfil-page/perfil-page.component';
import { ProviderPageComponent } from './pages/provider-page/provider-page.component';
import { StockPageComponent } from './pages/stock-page/stock-page.component';
import { SubGrupoItemPageComponent } from './pages/sub-grupo-item-page/sub-grupo-item-page.component';
import { TipoServicioPageComponent } from './pages/tipo-servicio-page/tipo-servicio-page.component';
import { UnidadMedidaPageComponent } from './pages/unidad-medida-page/unidad-medida-page.component';
import { UsuariosPageComponent } from './pages/usuarios-page/usuarios-page.component';
import { InspeccionesPageComponent } from './pages/inspecciones-page/inspecciones-page.component';
import { TipoReportePageComponent } from './pages/inspecciones/tipo-reporte/tipo-reporte-page.component';
import { ClientePageComponent } from './pages/inspecciones/cliente/cliente-page.component';
import { ClienteTjh2bPageComponent } from './pages/inspecciones/cliente-tjh2b/cliente-tjh2b-page.component';
import { SubestacionPageComponent } from './pages/inspecciones/subestacion/subestacion-page.component';
import { MotivoPageComponent } from './pages/inspecciones/motivo/motivo-page.component';
import { ClimaPageComponent } from './pages/inspecciones/clima/clima-page.component';
import { TareaPageComponent } from './pages/inspecciones/tarea/tarea-page.component';
import { SubContrataPageComponent } from './pages/inspecciones/sub-contrata/sub-contrata-page.component';
import { RiesgoPageComponent } from './pages/inspecciones/riesgo/riesgo-page.component';
import { ReportePageComponent } from './pages/inspecciones/reporte/reporte-page.component';
import { TipoInspeccionPageComponent } from './pages/inspecciones/tipo-inspeccion/tipo-inspeccion-page.component';
import { PreguntasHsePageComponent } from './pages/inspecciones/preguntas-hse/preguntas-hse-page.component';
import { TipoRiesgoPageComponent } from './pages/inspecciones/tipo-riesgo/tipo-riesgo-page.component';
import { ReportesPageComponent } from './pages/reportes-page/reportes-page.component';
import { KardexGeneralReportePageComponent } from './pages/reportes-page/kardex-general-reporte-page.component';
import { IngresoSalidasAlmacenReportePageComponent } from './pages/reportes-page/ingreso-salidas-almacen-reporte-page.component';
import { OrdenesCompraServicioReportePageComponent } from './pages/reportes-page/ordenes-compra-servicio-reporte-page.component';
import { AsignacionesUsuariosReportePageComponent } from './pages/reportes-page/asignaciones-usuarios-reporte-page.component';
import { ReporteOcosPageComponent } from './pages/reportes-page/reporte-ocos-page.component';
import { AsignacionPageComponent } from './pages/asignacion-page/asignacion-page.component';
import { ObraPageComponent } from './pages/obra-page/obra-page.component';
import { TransferenciaAlmacenPageComponent } from './pages/transferencia-almacen-page/transferencia-almacen-page.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [LoginRedirectGuard]
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: '',
        component: HomePageComponent
      },
      {
        path: 'proveedor',
        component: ProviderPageComponent
      },
      {
        path: 'forma-pago',
        component: FormaPagoPageComponent
      },
      {
        path: 'perfil',
        component: PerfilPageComponent
      },
      {
        path: 'detraccion',
        component: DetraccionPageComponent
      },
      {
        path: 'banco',
        component: BancoPageComponent
      },
      {
        path: 'centro-costos',
        component: CentroCostosPageComponent
      },
      {
        path: 'direccion-entrega',
        component: DireccionEntregaPageComponent
      },
      {
        path: 'moneda',
        component: MonedaPageComponent
      },
      {
        path: 'grupo-item',
        component: GrupoItemPageComponent
      },
      {
        path: 'sub-grupo-item',
        component: SubGrupoItemPageComponent
      },
      {
        path: 'item',
        component: ItemPageComponent
      },
      {
        path: 'item-arbol',
        component: ItemTreePageComponent
      },
      {
        path: 'item-detalle-material',
        component: ItemDetalleMaterialPageComponent
      },
      {
        path: 'tipo-servicio',
        component: TipoServicioPageComponent
      },
      {
        path: 'unidad-medida',
        component: UnidadMedidaPageComponent
      },
      {
        path: 'pedidos',
        component: PedidosBPageComponent
      },
      {
        path: 'pedidos-b',
        redirectTo: 'pedidos',
        pathMatch: 'full'
      },
      {
        path: 'cotizaciones-tjh2b',
        component: CotizacionesTjh2bPageComponent
      },
      {
        path: 'orden-compra',
        component: OrdenCompraPageComponent,
        data: { ordComTip: 1 }
      },
      {
        path: 'orden-servicio',
        component: OrdenCompraPageComponent,
        data: { ordComTip: 2 }
      },
      {
        path: 'almacen',
        component: AlmacenPageComponent
      },
      {
        path: 'stock',
        component: StockPageComponent
      },
      {
        path: 'inspecciones',
        component: InspeccionesPageComponent
      },
      {
        path: 'tipo-reporte',
        component: TipoReportePageComponent
      },
      {
        path: 'asignacion',
        component: AsignacionPageComponent
      },
      {
        path: 'obra',
        component: ObraPageComponent
      },
      {
        path: 'transferencia-almacen',
        component: TransferenciaAlmacenPageComponent
      },
      {
        path: 'reportes',
        component: ReportesPageComponent
      },
      {
        path: 'reportes/kardex-general',
        component: KardexGeneralReportePageComponent
      },
      {
        path: 'reportes/ingresos-salidas-almacen',
        component: IngresoSalidasAlmacenReportePageComponent
      },
      {
        path: 'reportes/ordenes-compra-servicio',
        component: OrdenesCompraServicioReportePageComponent
      },
      {
        path: 'reportes/asignaciones-usuarios',
        component: AsignacionesUsuariosReportePageComponent
      },
      {
        path: 'reportes/reporte-ocos',
        component: ReporteOcosPageComponent
      },
      {
        path: 'jefe',
        redirectTo: 'tipo-reporte',
        pathMatch: 'full'
      },
      {
        path: 'cliente',
        component: ClientePageComponent
      },
      {
        path: 'cliente-tjh2b',
        component: ClienteTjh2bPageComponent
      },
      {
        path: 'tipo-inspeccion',
        component: TipoInspeccionPageComponent
      },
      {
        path: 'preguntas-hse',
        component: PreguntasHsePageComponent
      },
      {
        path: 'tipo-riesgo',
        component: TipoRiesgoPageComponent
      },
      {
        path: 'riesgo',
        component: RiesgoPageComponent
      },
      {
        path: 'reporte',
        component: ReportePageComponent
      },
      {
        path: 'motivo',
        component: MotivoPageComponent
      },
      {
        path: 'clima',
        component: ClimaPageComponent
      },
      {
        path: 'tarea',
        component: TareaPageComponent
      },
      {
        path: 'sub-contrata',
        component: SubContrataPageComponent
      },
      {
        path: 'subestacion',
        component: SubestacionPageComponent
      },
      {
        path: 'requisicion',
        redirectTo: 'pedidos',
        pathMatch: 'full'
      },
      {
        path: 'usuario',
        component: UsuariosPageComponent
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
