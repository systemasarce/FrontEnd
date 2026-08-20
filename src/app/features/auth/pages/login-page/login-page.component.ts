import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss']
})
export class LoginPageComponent {
  loginError = '';
  isSubmitting = false;

  readonly loginForm = this.formBuilder.nonNullable.group({
    userCode: ['', [Validators.required, noWhitespaceValidator()]],
    password: ['', [Validators.required, noWhitespaceValidator()]],
    rememberCredentials: [false]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    const rememberedCredentials = this.authService.getRememberedCredentials();

    if (rememberedCredentials.remember) {
      this.loginForm.patchValue({
        userCode: rememberedCredentials.userCode,
        password: rememberedCredentials.password,
        rememberCredentials: true
      });
    }
  }

  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { userCode, password, rememberCredentials } = this.loginForm.getRawValue();

    this.isSubmitting = true;
    this.loginError = '';

    this.authService.login(userCode, password, rememberCredentials).subscribe({
      next: (result) => {
        this.isSubmitting = false;

        if (!result.success) {
          this.loginError = result.message;
          return;
        }

        void this.router.navigate(['/']);
      },
      error: () => {
        this.isSubmitting = false;
        this.loginError = 'No se pudo validar el acceso. Intenta nuevamente.';
      }
    });
  }
}
