import Constants from 'expo-constants';
export const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
export const apiBaseUrl = baseUrl ? `${baseUrl}/api/v1` : undefined;
