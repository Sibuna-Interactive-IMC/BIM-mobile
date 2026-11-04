import { InternetPackage } from '@/types';
import Constants from 'expo-constants';
export const countryCode = Constants.expoConfig?.extra?.countryCode;
export const phoneNumberLength = Constants.expoConfig?.extra?.phoneNumberLength;
export const environment = Constants.expoConfig?.extra?.env;
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const phoneRegexWithSpaces = /^\d{4} \d{3} \d{3}$/;
// password regex that requires a capital letter, a number, a special character and a minimum length of 8 characters
export const passwordRegex =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^-_+=~`|\\/:;"'<>(){}[\]])[A-Za-z\d@$!%*?&.#^-_+=~`|\\/:;"'<>(){}[\]]{8,}$/;

export const packages: InternetPackage[] = [
	{
		name: 'daily',
		tag: 'profile_DAILY1000Shs',
		price: 1000,
		bandwidth: '1Mbps',
		usersPerDevice: 1,
		duration: 24,
	},
	{
		name: 'weekly',
		tag: 'profile_WEEKLY5000Shs',
		price: 5000,
		bandwidth: '2Mbps',
		usersPerDevice: 2,
		duration: 168,
	},
	{
		name: 'monthly',
		tag: 'profile_MONTHLY20000Shs',
		price: 20000,
		bandwidth: '5Mbps',
		usersPerDevice: 3,
		duration: 720,
	},
	{
		name: 'short',
		tag: 'profile_5HRS500Shs',
		price: 500,
		bandwidth: '256Kbps',
		usersPerDevice: 1,
		duration: 5,
	},
];
