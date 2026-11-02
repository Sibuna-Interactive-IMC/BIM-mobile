import { Account, OnboardingState, Platform } from './';
import { DashboardSummary } from './dashboard';

export type Gender = 'male' | 'female' | 'other' | undefined;

export interface Bank {
    id: string;
    name: string; // Name of the bank
    accountNumber: string; // Account number of the bank
    accountHolderName: string; // Name of the account holder
    SWIFTCode: string;
    /** Not returned by API 2.0 — optional on records coming from `/banks`. */
    currency?: string;
    branch?: string; // Optional branch name
    createdAt?: Date;
    updatedAt?: Date;
}

export interface VoucherUser {
    voucherCode: string;
    password?: string;
    package: string;
    status: 'active' | 'inactive';
    macAddress: string; // MAC address of the user
    uptime: number; // Uptime of the user in minutes
    bytesIn: number; // Data usage in bytes
    bytesOut: number; // Data usage in bytes
    comment: string;
    createdAt: string;
}

/** User record returned by every identity endpoint in API 2.0 (`UserProfile` schema). */
export interface UserProfile {
    "id": number;
    "name": string;
    "email": string;
    "phone": string;
    "notification_email"?: string;
    "avatar"?: string | null;
    "avatar_id"?: string | null;
    "avatar_url"?: string | null;
    "gender"?: Gender;
    "email_verified_at"?: string | null;
    "created_at"?: string;
    "updated_at"?: string;
    /** Set when an admin approved this login's KYC documents. */
    "documents_verified"?: boolean;
    "documents_verified_at"?: string | null;
}

/**
 * User object from Auth verification /token/verify.
 * Legacy fields are kept optional because API 2.0 no longer returns them.
 */
export interface ServerUser extends UserProfile {
    "totp_secret"?: string;
    "onboarding_state"?: OnboardingState;
    "settings"?: string[];
    "role_id"?: number;
    "phone_verified_at"?: string;
    "last_activity_at"?: string;
}
/** Local app user interface */
export interface User extends ServerUser {
    account?: Account;
    platform?: Platform;
    // Optional typed dashboard data returned by some login/refresh endpoints
    dashboard?: DashboardSummary;
}
