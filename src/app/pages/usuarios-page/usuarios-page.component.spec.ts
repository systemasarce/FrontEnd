import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { UsuariosPageComponent } from './usuarios-page.component';

describe('UsuariosPageComponent', () => {
  let component: UsuariosPageComponent;
  let fixture: ComponentFixture<UsuariosPageComponent>;
  let apiServiceMock: { getListarUsuarioActivo: jasmine.Spy };
  let matDialogMock: { open: jasmine.Spy };

  beforeEach(async () => {
    const usuariosResponse = of([
      {
        Usr_Id: 1,
        Usr_Cod: 'ADM',
        Usr_Nom: 'Usuario Admin',
        Fec_Reg: '2024-05-01T13:45:20',
        Flg_Est: 'A'
      }
    ]);

    apiServiceMock = {
      getListarUsuarioActivo: jasmine.createSpy('getListarUsuarioActivo').and.returnValue(usuariosResponse)
    };
    matDialogMock = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(false)
      })
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [UsuariosPageComponent],
      providers: [
        {
          provide: ApiService,
          useValue: apiServiceMock
        },
        {
          provide: MatDialog,
          useValue: matDialogMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should normalize user data from the API response', () => {
    expect(component.usuarios.length).toBe(1);
    expect(component.usuarios[0].usrCod).toBe('ADM');
    expect(component.usuarios[0].usrNom).toBe('Usuario Admin');
    expect(component.usuarios[0].fecha).toBe('05-01-2024');
    expect(component.usuarios[0].estado).toBe('Activo');
  });

  it('should initialize active users filter by default', () => {
    expect(component.filtersForm.controls['estado'].value).toBe('A');
  });

  it('should clear filters and keep active users as default', () => {
    component.filtersForm.patchValue({ codigo: '1', codigoUsuario: 'ADM', nombres: 'admin', estado: 'I' });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      codigoUsuario: '',
      nombres: '',
      estado: 'A'
    });
  });

  it('should open the edit dialog and reload users when it closes after update', () => {
    matDialogMock.open.and.returnValue({
      afterClosed: () => of(true)
    });

    component.editarUsuario(component.usuarios[0]);

    expect(matDialogMock.open).toHaveBeenCalled();
    expect(apiServiceMock.getListarUsuarioActivo).toHaveBeenCalledTimes(2);
  });

  it('should clear codigo when the input receives zero or negative values', () => {
    const zeroInput = document.createElement('input');
    zeroInput.value = '0';

    component.sanitizeCodigoInput({ target: zeroInput } as unknown as Event);
    expect(component.filtersForm.controls['codigo'].value).toBe('');

    const negativeInput = document.createElement('input');
    negativeInput.value = '-1';

    component.sanitizeCodigoInput({ target: negativeInput } as unknown as Event);
    expect(component.filtersForm.controls['codigo'].value).toBe('');
  });

  it('should search users by exact filters', () => {
    apiServiceMock.getListarUsuarioActivo.calls.reset();
    component.filtersForm.patchValue({ codigo: '12', estado: 'I' });

    component.cargarUsuarios();

    expect(apiServiceMock.getListarUsuarioActivo).toHaveBeenCalledWith({
      Usr_Id: 12,
      Flg_Est: 'I'
    });
  });
});
