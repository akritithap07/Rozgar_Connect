// types/i18n-js.d.ts
declare module 'i18n-js' {
  interface I18n {
    translations: { [key: string]: any };
    fallbacks: boolean;
    locale: string;
    t: (key: string, options?: any) => string;
  }
  export class I18n {
    constructor(translations?: { [key: string]: any });
    translations: { [key: string]: any };
    fallbacks: boolean;
    locale: string;
    t: (key: string, options?: any) => string;
  }
}