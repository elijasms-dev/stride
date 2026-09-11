export class FitExportError extends Error {
  code: string;
  constructor(code: string) {
    super(
      `The watch file could not be prepared (${code}). Your workout has not changed.`,
    );
    this.name = 'FitExportError';
    this.code = code;
  }
}
