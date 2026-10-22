/** Problems caused by the template or the data (-> HTTP 400), as opposed to infrastructure failures (-> 502). */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}
