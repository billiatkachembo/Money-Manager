import { Alert, AlertButton, AlertOptions } from 'react-native';
import { AppTooltipTone, showAppTooltip } from '@/store/app-tooltip-store';

let isInstalled = false;
let nativeAlert: typeof Alert.alert | null = null;

const isNeutralSingleButton = (button?: AlertButton) => {
  if (!button) {
    return true;
  }

  const normalizedText = (button.text ?? '').trim().toLowerCase();
  const isNeutralLabel = normalizedText === '' || normalizedText === 'ok' || normalizedText === 'close' || normalizedText === 'dismiss';
  const isNeutralStyle = !button.style || button.style === 'default';

  return isNeutralLabel && isNeutralStyle && !button.onPress;
};

const shouldUseTooltip = (buttons?: AlertButton[] | null, _options?: AlertOptions) => {
  if (!buttons || buttons.length === 0) {
    return true;
  }

  if (buttons.length !== 1) {
    return false;
  }

  return isNeutralSingleButton(buttons[0]);
};

const inferTooltipTone = (title?: string, message?: string): AppTooltipTone => {
  const combined = `${title ?? ''} ${message ?? ''}`.toLowerCase();

  if (
    combined.includes('error') ||
    combined.includes('failed') ||
    combined.includes('unable') ||
    combined.includes('invalid') ||
    combined.includes('could not') ||
    combined.includes('not connected') ||
    combined.includes('not scheduled')
  ) {
    return 'error';
  }

  if (
    combined.includes('warning') ||
    combined.includes('alert') ||
    combined.includes('reminder')
  ) {
    return 'warning';
  }

  if (
    combined.includes('success') ||
    combined.includes('saved') ||
    combined.includes('ready') ||
    combined.includes('updated') ||
    combined.includes('enabled') ||
    combined.includes('created') ||
    combined.includes('scheduled') ||
    combined.includes('restored') ||
    combined.includes('connected')
  ) {
    return 'success';
  }

  return 'info';
};

export const installAlertTooltipBridge = () => {
  if (isInstalled) {
    return () => {};
  }

  const baseAlert = nativeAlert ?? Alert.alert.bind(Alert);
  nativeAlert = baseAlert;

  const patchedAlert = ((title, message, buttons, options) => {
    if (shouldUseTooltip(buttons, options)) {
      const titleText = typeof title === 'string' ? title.trim() : '';
      const messageText = typeof message === 'string' ? message.trim() : '';

      showAppTooltip({
        title: titleText,
        message: messageText || titleText,
        tone: inferTooltipTone(titleText, messageText),
      });
      return;
    }

    return baseAlert(title, message, buttons, options);
  }) as typeof Alert.alert;

  Alert.alert = patchedAlert;
  isInstalled = true;

  return () => {
    if (Alert.alert === patchedAlert) {
      Alert.alert = baseAlert;
    }
    isInstalled = false;
  };
};
