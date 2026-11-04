import Constants from 'expo-constants';
export const countryCode = Constants.expoConfig?.extra?.countryCode;
export const phoneNumberLength = Constants.expoConfig?.extra?.phoneNumberLength;
export const environment = Constants.expoConfig?.extra?.env;
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const phoneRegexWithSpaces = /^\d{4} \d{3} \d{3}$/;
// password regex that requires a capital letter, a number, a special character and a minimum length of 8 characters
export const passwordRegex =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^-_+=~`|\\/:;"'<>(){}[\]])[A-Za-z\d@$!%*?&.#^-_+=~`|\\/:;"'<>(){}[\]]{8,}$/;
