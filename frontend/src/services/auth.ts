import { Amplify, Auth } from 'aws-amplify';
// Use Auth helpers from aws-amplify to perform authentication flows
import type { UserInfo } from './types';

// Configure Amplify with Cognito settings
Amplify.configure({
    Auth: {
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
        userPoolWebClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
    },
});

/**
 * Get the current access token (JWT) string.
 */
export async function getAccessToken(): Promise<string> {
    try {
        const session = await Auth.currentSession();
        const token = session.getAccessToken().getJwtToken();
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
        const session = await Auth.currentSession();
        const user = await Auth.currentAuthenticatedUser();

        const token = session.getAccessToken().getJwtToken();
        const payload = JSON.parse(atob(token.split('.')[1]));
        const groups = (payload?.['cognito:groups'] as string[]) || [];
        const email = (payload?.['email'] as string) || (payload?.['username'] as string) || user.username;
        const userId = payload.sub || user.username;

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
        await Auth.signOut();
    } catch (error) {
        console.error('Failed to sign out:', error);
        throw error;
    }
}
