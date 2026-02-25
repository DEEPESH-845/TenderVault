import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut as amplifySignOut, getCurrentUser as amplifyGetCurrentUser } from 'aws-amplify/auth';
import type { UserInfo } from './types';

// Configure Amplify with Cognito settings
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
            userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
        },
    },
});

/**
 * Get the current access token (JWT) string.
 */
export async function getAccessToken(): Promise<string> {
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken?.toString();
        if (!token) throw new Error('No access token found');
        return token;
    } catch (error) {
        console.error('Failed to get access token:', error);
        throw error;
    }
}

/**
 * Get the current authenticated user's info.
 */
export async function getCurrentUser(): Promise<UserInfo> {
    try {
        const session = await fetchAuthSession();
        const user = await amplifyGetCurrentUser();

        const accessToken = session.tokens?.accessToken;
        const payload = accessToken?.payload;
        const groups = (payload?.['cognito:groups'] as string[]) || [];
        const email = (payload?.['email'] as string) || (payload?.['username'] as string) || user.username;
        const userId = user.userId;

        const role = groups.includes('tv-admin')
            ? 'tv-admin'
            : groups.includes('tv-evaluator')
                ? 'tv-evaluator'
                : 'tv-bidder';

        return {
            userId,
            email,
            groups,
            role: role as UserInfo['role'],
        };
    } catch (error) {
        console.error('Failed to get current user:', error);
        throw error;
    }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
    try {
        await amplifySignOut();
    } catch (error) {
        console.error('Failed to sign out:', error);
        throw error;
    }
}
