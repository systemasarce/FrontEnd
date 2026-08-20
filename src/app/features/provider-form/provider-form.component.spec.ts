import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { PaymentSelectorDialogComponent } from './dialogs/payment-selector-dialog.component';
import { PaymentOption, ProviderRecord } from './provider-form.models';
import { ProviderSelectorDialogComponent } from './dialogs/provider-selector-dialog.component';
import { ProviderFormComponent } from './provider-form.component';

describe('ProviderFormComponent', () => {
  let apiServiceMock: {
    getListarProveedorActivo: jasmine.Spy;
    getListarFormaPagoActivo: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarProveedorActivo: jasmine.createSpy('getListarProveedorActivo').and.returnValue(
        of({
          data: [
            {
              Prv_Id: 1024,
              Prv_Nom: 'Proveedor API',
              Prv_Tel: '01-111-1111',
              Prv_Dir: 'Calle API 123',
              Prv_Nom_Con: 'Ana Torres',
              Prv_Ruc: '20123456789',
              Prv_Email: 'api@proveedor.com',
              Prv_Ban: 2,
              Prv_Nro_Cue_Ban: '22222222222',
              Prv_Nro_Cue_Ban_CCI: '22222222222222222222'
            }
          ]
        })
      ),
      getListarFormaPagoActivo: jasmine.createSpy('getListarFormaPagoActivo').and.returnValue(
        of({
          data: [
            {
              For_Pag_Id: 3,
              For_Pag_Des: 'Credito 30 dias'
            }
          ]
        })
      )
    };

    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        NoopAnimationsModule
      ],
      declarations: [
        ProviderFormComponent,
        ProviderSelectorDialogComponent,
        PaymentSelectorDialogComponent
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();
  });

  it('should create the form component', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
  });

  it('should initialize with blocked supplier fields and code values in 0', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const form = component.form.controls;

    expect(form.supplierCode.value).toBe(0);
    expect(form.paymentCode.value).toBe(0);
    expect(form.supplierName.value).toBe('');
    expect(form.supplierName.disabled).toBeTrue();
    expect(form.phone.disabled).toBeTrue();
    expect(form.paymentDescription.disabled).toBeTrue();
  });

  it('should load providers and payment options from api on init', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    expect(apiServiceMock.getListarProveedorActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(apiServiceMock.getListarFormaPagoActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.providers).toEqual([
      {
        code: 1024,
        name: 'Proveedor API',
        phone: '01-111-1111',
        address: 'Calle API 123',
        contact: 'Ana Torres',
        ruc: '20123456789',
        email: 'api@proveedor.com',
        bankCode: 2,
        bankName: 'BBVA',
        bankAccountNumber: '22222222222',
        bankCci: '22222222222222222222'
      }
    ]);
    expect(component.paymentOptions).toEqual([
      {
        code: 3,
        description: 'Credito 30 dias'
      }
    ]);
  });

  it('should apply supplier data without changing payment selection', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;
    const provider: ProviderRecord = {
      code: 1024,
      name: 'Proveedor Demo',
      phone: '01-111-1111',
      address: 'Calle Prueba 123',
      contact: 'Ana Torres',
      ruc: '20123456789',
      email: 'demo@proveedor.com',
      bankCode: 3,
      bankName: 'Interbank',
      bankAccountNumber: '33333333333',
      bankCci: '33333333333333333333'
    };

    component.applySelectedPayment({ code: 2, description: 'Credito 15 dias' });
    component.applySelectedProvider(provider);

    expect(component.form.controls.supplierCode.value).toBe(1024);
    expect(component.form.controls.supplierName.value).toBe('Proveedor Demo');
    expect(component.form.controls.contact.value).toBe('Ana Torres');
    expect(component.form.controls.email.value).toBe('demo@proveedor.com');
    expect(component.form.controls.bankCode.value).toBe(3);
    expect(component.form.controls.bankName.value).toBe('Interbank');
    expect(component.form.controls.paymentCode.value).toBe(2);
    expect(component.form.controls.paymentDescription.value).toBe('Credito 15 dias');
  });

  it('should resolve provider and payment details from loaded catalogs when hydrating by codes', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    component.hydrateForm({
      supplierCode: 1024,
      supplierName: 'Proveedor parcial',
      phone: '',
      address: '',
      contact: '',
      ruc: '',
      email: '',
      bankCode: 0,
      bankName: '',
      bankAccountNumber: '',
      bankCci: '',
      paymentCode: 3,
      paymentDescription: '',
      isEventual: false
    });

    expect(component.form.controls.supplierCode.value).toBe(1024);
    expect(component.form.controls.supplierName.value).toBe('Proveedor API');
    expect(component.form.controls.phone.value).toBe('01-111-1111');
    expect(component.form.controls.address.value).toBe('Calle API 123');
    expect(component.form.controls.contact.value).toBe('Ana Torres');
    expect(component.form.controls.ruc.value).toBe('20123456789');
    expect(component.form.controls.email.value).toBe('api@proveedor.com');
    expect(component.form.controls.bankCode.value).toBe(2);
    expect(component.form.controls.bankName.value).toBe('BBVA');
    expect(component.form.controls.bankAccountNumber.value).toBe('22222222222');
    expect(component.form.controls.bankCci.value).toBe('22222222222222222222');
    expect(component.form.controls.paymentCode.value).toBe(3);
    expect(component.form.controls.paymentDescription.value).toBe('Credito 30 dias');
  });

  it('should enable manual provider fields and keep payment popup data when Eventual is active', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;
    const payment: PaymentOption = { code: 3, description: 'Credito 30 dias' };

    component.applySelectedPayment(payment);
    component.toggleEventual();

    expect(component.form.controls.isEventual.value).toBeTrue();
    expect(component.form.controls.supplierCode.value).toBe(0);
    expect(component.form.controls.supplierName.enabled).toBeTrue();
    expect(component.form.controls.address.enabled).toBeTrue();
    expect(component.form.controls.paymentCode.value).toBe(3);
    expect(component.form.controls.paymentDescription.value).toBe('Credito 30 dias');
  });

  it('should reset the full block when Eventual is turned off', () => {
    const fixture = TestBed.createComponent(ProviderFormComponent);
    const component = fixture.componentInstance;

    component.toggleEventual();
    component.form.controls.supplierName.setValue('Proveedor Eventual');
    component.form.controls.phone.setValue('01-555-1212');
    component.applySelectedPayment({ code: 1, description: 'Contado' });

    component.toggleEventual();

    expect(component.form.controls.isEventual.value).toBeFalse();
    expect(component.form.controls.supplierCode.value).toBe(0);
    expect(component.form.controls.paymentCode.value).toBe(0);
    expect(component.form.controls.supplierName.value).toBe('');
    expect(component.form.controls.supplierName.disabled).toBeTrue();
    expect(component.form.controls.bankName.value).toBe('');
    expect(component.form.controls.paymentDescription.disabled).toBeTrue();
  });
});
