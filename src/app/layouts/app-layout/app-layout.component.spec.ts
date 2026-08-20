import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';

import { AppLayoutComponent } from './app-layout.component';
import { AuthService } from '../../features/auth/services/auth.service';

describe('AppLayoutComponent', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppLayoutComponent]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    sessionStorage.setItem('app_auth_session', 'true');
    sessionStorage.setItem('app_auth_user', 'dayala');
    sessionStorage.setItem('app_auth_access_routes', JSON.stringify([
      '/',
      '/pedidos',
      '/orden-compra',
      '/orden-servicio',
      '/almacen',
      '/stock',
      '/inspecciones',
      '/asignacion',
      '/reportes',
      '/perfil',
      '/forma-pago',
      '/banco',
      '/moneda',
      '/tipo-servicio',
      '/unidad-medida',
      '/jefe',
      '/cliente',
      '/usuario',
      '/proveedor'
    ]));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create the layout', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
  });

  it('should render shell navigation links', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.sidebar_link')).map((element) => element.textContent?.trim());
    const groupToggle = compiled.querySelector('.sidebar_group_toggle')?.textContent ?? '';

    expect(links).toContain('Inicio');
    expect(groupToggle).toContain('Procesos');
    expect(groupToggle).toContain('Mantenimiento');
  });

  it('should toggle the procesos group', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;

    expect(component.processOpen).toBeFalse();

    component.toggleProcessMenu();
    expect(component.processOpen).toBeTrue();

    component.toggleProcessMenu();
    expect(component.processOpen).toBeFalse();
  });

  it('should render pedidos and orden de compra inside procesos when it is open', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;
    component.processOpen = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.sidebar_link--nested')).map((element) => element.textContent?.trim());

    expect(links).toContain('Pedidos');
    expect(links).toContain('Orden de Compra');
    expect(links).toContain('Orden de Servicio');
    expect(links).toContain('Asignacion');
    expect(links).toContain('Reportes');

    expect(links.indexOf('Asignacion')).toBeLessThan(links.indexOf('Reportes'));
  });

  it('should toggle the mantenimiento group', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;

    expect(component.maintenanceOpen).toBeFalse();

    component.toggleMaintenanceMenu();
    expect(component.maintenanceOpen).toBeTrue();

    component.toggleMaintenanceMenu();
    expect(component.maintenanceOpen).toBeFalse();
  });

  it('should render usuario and proveedor inside mantenimiento when it is open', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;
    component.maintenanceOpen = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.sidebar_link--nested')).map((element) => element.textContent?.trim());

    expect(links).toContain('Forma de Pagos');
    expect(links).toContain('Banco');
    expect(links).toContain('Moneda');
    expect(links).toContain('Tipo de Servicio');
    expect(links).toContain('Unidad de Medida');
    expect(links).toContain('Tipo Reporte');
    expect(links).toContain('Usuario');
    expect(links).toContain('Proveedor');
  });

  it('should show the current user from the auth session', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('dayala');
  });

  it('should toggle the mobile sidebar state', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;

    expect(component.sidebarOpen).toBeFalse();

    component.toggleSidebar();
    expect(component.sidebarOpen).toBeTrue();

    component.closeSidebar();
    expect(component.sidebarOpen).toBeFalse();
  });

  it('should clear the auth session on logout', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const component = fixture.componentInstance;
    spyOn(router, 'navigate').and.resolveTo(true);

    component.logout();

    expect(authService.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
