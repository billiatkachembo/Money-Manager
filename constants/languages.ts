export type SupportedLanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

export interface SupportedLanguageOption {
  code: SupportedLanguageCode;
  name: string;
  englishName: string;
  locale: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguageOption[] = [
  { code: 'en', name: 'English', englishName: 'English', locale: 'en-US' },
  { code: 'es', name: 'Español', englishName: 'Spanish', locale: 'es-ES' },
  { code: 'fr', name: 'Français', englishName: 'French', locale: 'fr-FR' },
  { code: 'de', name: 'Deutsch', englishName: 'German', locale: 'de-DE' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', locale: 'it-IT' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', locale: 'pt-PT' },
];

const LANGUAGE_LOCALES = SUPPORTED_LANGUAGES.reduce<Record<SupportedLanguageCode, string>>((acc, language) => {
  acc[language.code] = language.locale;
  return acc;
}, {} as Record<SupportedLanguageCode, string>);

export function isSupportedLanguageCode(value: string | undefined | null): value is SupportedLanguageCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

export function resolveLanguageLocale(languageCode?: string | null): string {
  if (languageCode && isSupportedLanguageCode(languageCode)) {
    return LANGUAGE_LOCALES[languageCode];
  }

  return LANGUAGE_LOCALES.en;
}

export function getSupportedLanguageName(languageCode?: string | null): string {
  return SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)?.name ?? SUPPORTED_LANGUAGES[0].name;
}
