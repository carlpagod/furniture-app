import { Platform, Alert as RNAlert } from 'react-native';

let alertListener = null;

export function registerAlertListener(listener) {
  alertListener = listener;
  return () => {
    alertListener = null;
  };
}

export const Alert = {
  alert: (title, message, buttons) => {
    if (Platform.OS === 'web' && alertListener) {
      alertListener({ title, message, buttons });
    } else {
      RNAlert.alert(title, message, buttons);
    }
  }
};
