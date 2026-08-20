import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, RouterTestingModule],
      declarations: [LoginPageComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the login form fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('input[formControlName="userCode"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeFalsy();
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain('Entrar');
  });
});
