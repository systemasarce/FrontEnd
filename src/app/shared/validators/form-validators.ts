import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === null || value === undefined) {
      return null;
    }

    return String(value).trim() ? null : { whitespace: true };
  };
}

export function optionalPatternValidator(pattern: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();

    if (!value) {
      return null;
    }

    return pattern.test(value) ? null : { pattern: true };
  };
}
