import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, catchError, filter, forkJoin, of } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';
import { ApiService } from 'src/app/Services/api.services';

interface MenuIcon {
  paths: ReadonlyArray<string>;
}

interface MenuItem {
  label: string;
  route: string;
  icon: MenuIcon;
}

@Component({
  selector: 'app-app-layout',
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss']
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  sidebarCollapsed = false;
  maintenanceOpen: boolean;
  processOpen: boolean;
  notificationsOpen = false;
  notificationBellRinging = false;
  pedidosPendientesAprobacion = 0;
  pedidosPendientesOrdenCompra = 0;
  pedidosPendientesOrdenServicio = 0;
  ordenesCompraPendientesAlmacen = 0;
  isLoadingNotifications = false;
  private routerSubscription?: Subscription;
  private readonly refreshNotificationsHandler = () => this.cargarNotificaciones(true);
  private hasPlayedInitialNotification = false;

  readonly icons = {
    home: { paths: ['M3 10.75 12 3l9 7.75V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z'] },
    procesos: { paths: ['M4 5.5h7v5H4z', 'M13 5.5h7v5h-7z', 'M4 13.5h7V19H4z', 'M13 13.5h7V19h-7z'] },
    mantenimiento: { paths: ['M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z', 'M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-1 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1-1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.4a1 1 0 0 1 1-1h.2a1 1 0 0 0 1-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7 1 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.4a1 1 0 0 1-1 1h-.2a1 1 0 0 0-1 .7 1 1 0 0 0 .2 1.1z'] },
    pedidos: { paths: ['M8 4.5h8l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V6a1.5 1.5 0 0 1 1.5-1.5H8z', 'M8 4.5V8h8', 'M8.5 11.5h7', 'M8.5 15h7'] },
    ordenCompra: { paths: ['M6 7h12l-1.1 6.2a2 2 0 0 1-2 1.7H9.1a2 2 0 0 1-2-1.7L6 7z', 'M9 7V5.8A2.8 2.8 0 0 1 11.8 3h.4A2.8 2.8 0 0 1 15 5.8V7', 'M9 18.5h.01', 'M15 18.5h.01'] },
    ordenServicio: { paths: ['M14.7 5.3a2.3 2.3 0 1 1 3.3 3.3l-2.2 2.2-3.3-3.3 2.2-2.2z', 'M4 20l4.6-1.2L18 9.4l-3.4-3.4-9.4 9.4z', 'M4 20h4.6'] },
    almacen: { paths: ['M4 8.5 12 4l8 4.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 8.5 12 13l8-4.5', 'M12 13V20'] },
    stock: { paths: ['M5 18.5V11', 'M10 18.5V5.5', 'M15 18.5v-8', 'M20 18.5v-4', 'M3.5 20.5h17'] },
    inspecciones: { paths: ['M12 3l7 3v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6z', 'm9 6.8-7.2 7.2L9 16.9'] },
    asignacion: { paths: ['M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 14a5 5 0 0 1 10 0', 'M15 8h6', 'M18 5v6', 'm15 17 2 2 4-5'] },
    obra: { paths: ['M4 20V8l8-5 8 5v12', 'M8 20v-6h8v6', 'M7 9h2', 'M11 9h2', 'M15 9h2'] },
    transferencia: { paths: ['M4 7h13', 'm14 4 3-4-3-4', 'M20 17H7', 'm10 13-3 4 3 4'] },
    reportes: { paths: ['M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z', 'M14 3.5V8h4', 'M9 16.5V12', 'M12 16.5v-3', 'M15 16.5V10'] },
    perfil: { paths: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20a8 8 0 0 1 16 0'] },
    formaPago: { paths: ['M3.5 7.5h17a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 15V9a1.5 1.5 0 0 1 1.5-1.5z', 'M2 10.5h20', 'M6.5 14.5h3'] },
    banco: { paths: ['M3 9h18', 'M5 9V6l7-3 7 3v3', 'M6 9v8', 'M10 9v8', 'M14 9v8', 'M18 9v8', 'M3 19h18'] },
    centroCostos: { paths: ['M4 20V6.5A1.5 1.5 0 0 1 5.5 5H11v15z', 'M11 9h9v11H11', 'M6.5 9.5h1', 'M6.5 13h1', 'M14 12h3', 'M14 15.5h3'] },
    direccionEntrega: { paths: ['M12 20s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'] },
    moneda: { paths: ['M12 3.5v17', 'M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3'] },
    grupoItem: { paths: ['M4 7.5h7v5H4z', 'M13 7.5h7v5h-7z', 'M8.5 12.5v4', 'M15.5 12.5v4', 'M6.5 16.5h4', 'M13.5 16.5h4'] },
    subGrupoItem: { paths: ['M4 7.5h7v5H4z', 'M13 7.5h7v5h-7z', 'M8.5 12.5v4', 'M15.5 12.5v4', 'M15.5 15h3', 'M17 13.5v3'] },
    detalleMaterial: { paths: ['M12 3.8 19 7.8v8.4l-7 4-7-4V7.8z', 'M12 3.8v8.3', 'M19 7.8 12 12.1 5 7.8'] },
    item: { paths: ['M12 3.8 19 7.8v8.4l-7 4-7-4V7.8z', 'M12 12.1 19 7.8', 'M12 12.1 5 7.8', 'M12 12.1v8.1'] },
    tipoServicio: { paths: ['M14.5 6.5 17.5 3.5l3 3-3 3', 'M3.5 20.5l6.5-2 8.5-8.5-4.5-4.5L5.5 14l-2 6.5z'] },
    unidadMedida: { paths: ['M4 16.5 16.5 4a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L7.5 20H4z', 'M12 8.5l3.5 3.5', 'M9.5 11l1.5 1.5', 'M7 13.5l1.5 1.5'] },
    jefe: { paths: ['M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M6 20a6 6 0 0 1 12 0', 'm17 5 .7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z'] },
    cliente: { paths: ['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M3.5 20a5.5 5.5 0 0 1 9 0', 'M13 20a4.5 4.5 0 0 1 7 0'] },
    subestacion: { paths: ['M13 2 6 13h5l-1 9 8-12h-5l1-8z'] },
    detraccion: { paths: ['M7 4.5h10l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5z', 'M14 4.5V8h4', 'M9 16l6-6', 'M9.5 10.5h.01', 'M14.5 15.5h.01'] },
    usuario: { paths: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20a8 8 0 0 1 16 0', 'M18.5 8.5h3', 'M20 7v3'] },
    proveedor: { paths: ['M3.5 7.5H15v8H3.5z', 'M15 10h3l2.5 2.5v3H15z', 'M7 17.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', 'M17 17.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'] },
    logout: { paths: ['M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10', 'M14 8l4 4-4 4', 'M9 12h9'] }
  } as const;

  readonly menuItems: MenuItem[] = [
    { label: 'Inicio', route: '/', icon: this.icons.home }
  ];
  readonly processItems: MenuItem[] = [
    { label: 'Pedidos', route: '/pedidos', icon: this.icons.pedidos },
    { label: 'Cotizaciones - TJH2B', route: '/cotizaciones-tjh2b', icon: this.icons.pedidos },
    { label: 'Orden de Compra', route: '/orden-compra', icon: this.icons.ordenCompra },
    { label: 'Orden de Servicio', route: '/orden-servicio', icon: this.icons.ordenServicio },
    { label: 'Almacen', route: '/almacen', icon: this.icons.almacen },
    { label: 'Stock', route: '/stock', icon: this.icons.stock },
    { label: 'Inspecciones', route: '/inspecciones', icon: this.icons.inspecciones },
    { label: 'Asignacion', route: '/asignacion', icon: this.icons.asignacion },
    { label: 'Obra', route: '/obra', icon: this.icons.obra },
    { label: 'Transferencia Almacen', route: '/transferencia-almacen', icon: this.icons.transferencia },
    { label: 'Reportes', route: '/reportes', icon: this.icons.reportes }
  ];
  readonly maintenanceItems: MenuItem[] = [
    { label: 'Perfil', route: '/perfil', icon: this.icons.perfil },
    { label: 'Forma de Pagos', route: '/forma-pago', icon: this.icons.formaPago },
    { label: 'Banco', route: '/banco', icon: this.icons.banco },
    { label: 'Centro de Costos', route: '/centro-costos', icon: this.icons.centroCostos },
    { label: 'Direccion de Entrega', route: '/direccion-entrega', icon: this.icons.direccionEntrega },
    { label: 'Moneda', route: '/moneda', icon: this.icons.moneda },
    { label: 'Grupo de Item', route: '/grupo-item', icon: this.icons.grupoItem },
    { label: 'Sub Grupo de Item', route: '/sub-grupo-item', icon: this.icons.subGrupoItem },
    { label: 'Detalle de Material', route: '/item-detalle-material', icon: this.icons.detalleMaterial },
    { label: 'Item', route: '/item', icon: this.icons.item },
    { label: 'Tipo de Servicio', route: '/tipo-servicio', icon: this.icons.tipoServicio },
    { label: 'Unidad de Medida', route: '/unidad-medida', icon: this.icons.unidadMedida },
    { label: 'Tipo Reporte', route: '/jefe', icon: this.icons.jefe },
    { label: 'Cliente', route: '/cliente', icon: this.icons.cliente },
    { label: 'Cliente - TJH2B', route: '/cliente-tjh2b', icon: this.icons.cliente },
    { label: 'Tipo de Inspección', route: '/tipo-inspeccion', icon: this.icons.inspecciones },
    { label: 'Preguntas HSE', route: '/preguntas-hse', icon: this.icons.inspecciones },
    { label: 'Tipo de Riesgo', route: '/tipo-riesgo', icon: this.icons.inspecciones },
    { label: 'Riesgo', route: '/riesgo', icon: this.icons.inspecciones },
    { label: 'Reporte', route: '/reporte', icon: this.icons.inspecciones },
    { label: 'Motivo', route: '/motivo', icon: this.icons.inspecciones },
    { label: 'Clima', route: '/clima', icon: this.icons.inspecciones },
    { label: 'Tarea', route: '/tarea', icon: this.icons.inspecciones },
    { label: 'Sub Contrata', route: '/sub-contrata', icon: this.icons.inspecciones },
    { label: 'Subestacion', route: '/subestacion', icon: this.icons.subestacion },
    { label: 'Detracciones', route: '/detraccion', icon: this.icons.detraccion },
    { label: 'Usuario', route: '/usuario', icon: this.icons.usuario },
    { label: 'Proveedor', route: '/proveedor', icon: this.icons.proveedor }
  ];

  get visibleMenuItems(): MenuItem[] {
    return this.menuItems.filter((item) => this.authService.hasAccessToRoute(item.route));
  }

  get visibleProcessItems(): MenuItem[] {
    return this.processItems.filter((item) => this.authService.hasAccessToRoute(item.route));
  }

  get visibleMaintenanceItems(): MenuItem[] {
    return this.maintenanceItems.filter((item) => this.authService.hasAccessToRoute(item.route));
  }

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {
    this.maintenanceOpen = this.isMaintenanceRouteActive();
    this.processOpen = this.isProcessRouteActive();
  }

  ngOnInit(): void {
    this.cargarNotificaciones();
    window.addEventListener('pedido-notifications-refresh', this.refreshNotificationsHandler);
    window.addEventListener('process-notifications-refresh', this.refreshNotificationsHandler);
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.cargarNotificaciones(true));
  }

  ngOnDestroy(): void {
    window.removeEventListener('pedido-notifications-refresh', this.refreshNotificationsHandler);
    window.removeEventListener('process-notifications-refresh', this.refreshNotificationsHandler);
    this.routerSubscription?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.sidebarOpen = false;
  }

  toggleProcessMenu(): void {
    this.processOpen = !this.processOpen;
  }

  toggleMaintenanceMenu(): void {
    this.maintenanceOpen = !this.maintenanceOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
  }

  closeNotifications(): void {
    this.notificationsOpen = false;
  }

  goToPendingApprovals(): void {
    this.closeNotifications();
    void this.router.navigate(['/pedidos']);
  }

  goToPendingPurchaseOrders(): void {
    this.closeNotifications();
    void this.router.navigate(['/orden-compra']);
  }

  goToPendingServiceOrders(): void {
    this.closeNotifications();
    void this.router.navigate(['/orden-servicio']);
  }

  goToPendingWarehouseEntries(): void {
    this.closeNotifications();
    void this.router.navigate(['/almacen']);
  }

  logout(): void {
    this.authService.logout();
    this.closeSidebar();
    void this.router.navigate(['/login']);
  }

  get currentUser(): string {
    return this.authService.getCurrentUser() || 'usuario';
  }

  get currentUserName(): string {
    return this.authService.getCurrentUserName() || this.currentUser;
  }

  getProcessNotificationCount(item: MenuItem): number {
    switch (item.route) {
      case '/pedidos':
        return this.pedidosPendientesAprobacion;
      case '/orden-compra':
        return this.pedidosPendientesOrdenCompra;
      case '/orden-servicio':
        return this.pedidosPendientesOrdenServicio;
      case '/almacen':
        return this.ordenesCompraPendientesAlmacen;
      default:
        return 0;
    }
  }

  get totalNotifications(): number {
    return this.pedidosPendientesAprobacion
      + this.pedidosPendientesOrdenCompra
      + this.pedidosPendientesOrdenServicio
      + this.ordenesCompraPendientesAlmacen;
  }

  isMaintenanceRouteActive(): boolean {
    return this.visibleMaintenanceItems.some((item) => this.router.url.startsWith(item.route));
  }

  isProcessRouteActive(): boolean {
    return this.visibleProcessItems.some((item) => this.router.url.startsWith(item.route));
  }

  private cargarNotificaciones(force = false): void {
    const currentUserCode = this.authService.getCurrentUser().trim();
    const currentUser = currentUserCode.toLowerCase();

    if (!currentUser || (this.isLoadingNotifications && !force)) {
      return;
    }

    this.isLoadingNotifications = true;
    forkJoin({
      pedidosAprobacion: this.apiService.getListarPedido({ Flg_Est: 'P', Usr_Cod: currentUserCode }).pipe(catchError(() => of([]))),
      pedidosOrdenCompra: this.apiService.getListarPedidoAprobadoParaOC({ Flg_Est: 'A', Ped_Tip_Com: 1 }).pipe(catchError(() => of([]))),
      pedidosOrdenServicio: this.apiService.getListarPedidoAprobadoParaOC({ Flg_Est: 'A', Ped_Tip_Com: 2 }).pipe(catchError(() => of([]))),
      ordenesAlmacen: this.apiService.getListarOrdenCompraPendienteAlmacen().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ pedidosAprobacion, pedidosOrdenCompra, pedidosOrdenServicio, ordenesAlmacen }) => {
        this.pedidosPendientesAprobacion = this.countPedidosPendientesAprobacion(pedidosAprobacion, currentUser);
        this.pedidosPendientesOrdenCompra = this.extractRecords(pedidosOrdenCompra).length;
        this.pedidosPendientesOrdenServicio = this.extractRecords(pedidosOrdenServicio).length;
        this.ordenesCompraPendientesAlmacen = this.extractRecords(ordenesAlmacen).length;
        this.triggerInitialNotificationCue();
        this.isLoadingNotifications = false;
      },
      error: () => {
        this.pedidosPendientesAprobacion = 0;
        this.pedidosPendientesOrdenCompra = 0;
        this.pedidosPendientesOrdenServicio = 0;
        this.ordenesCompraPendientesAlmacen = 0;
        this.isLoadingNotifications = false;
      }
    });
  }

  private countPedidosPendientesAprobacion(response: unknown, currentUser: string): number {
    return this.extractRecords(response)
      .filter((item) => this.getTextValue(item, ['Ped_Usr_Apr', 'ped_Usr_Apr', 'pedUsrApr', 'Usr_Apr', 'usrApr']).toLowerCase() === currentUser)
      .length;
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

  private getTextValue(item: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private triggerInitialNotificationCue(): void {
    if (this.hasPlayedInitialNotification || this.pedidosPendientesAprobacion <= 0) {
      return;
    }

    this.hasPlayedInitialNotification = true;
    this.notificationBellRinging = true;
    this.playNotificationSound();

    window.setTimeout(() => {
      this.notificationBellRinging = false;
    }, 1400);
  }

  private playNotificationSound(): void {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.12);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.34);
      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // Some browsers block audio until the user interacts with the page.
    }
  }
}
