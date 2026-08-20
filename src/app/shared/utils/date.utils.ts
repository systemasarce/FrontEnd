export function formatDisplayDate(value: string): string {
  if (!value) {
    return '';
  }

  const datePart = value.trim().split('T')[0].split(' ')[0];
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);

  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}-${isoMatch[2].padStart(2, '0')}-${isoMatch[1]}`;
  }

  const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(datePart);

  if (separatedMatch) {
    return `${separatedMatch[1].padStart(2, '0')}-${separatedMatch[2].padStart(2, '0')}-${separatedMatch[3]}`;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');

  return `${day}-${month}-${parsedDate.getFullYear()}`;
}

export function formatDateInputValue(value: string): string {
  if (!value) {
    return '';
  }

  const datePart = value.trim().split('T')[0].split(' ')[0];
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(datePart);

  if (separatedMatch) {
    return `${separatedMatch[3]}-${separatedMatch[2].padStart(2, '0')}-${separatedMatch[1].padStart(2, '0')}`;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');

  return `${parsedDate.getFullYear()}-${month}-${day}`;
}

export function formatDateRequestValue(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  return formatDateInputValue(value);
}
