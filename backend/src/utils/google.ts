import { google } from 'googleapis';

export function createOauthClient() {
  const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:4000/auth/callback';
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export async function getAuthorizedGmailClient(account: any) {
  const oauth2Client = createOauthClient();

  oauth2Client.setCredentials({
    access_token: account.googleAccessToken,
    refresh_token: account.googleRefreshToken || undefined,
  });

  // Check if token expired or missing
  const expired = !account.tokenExpiresAt || new Date() >= account.tokenExpiresAt;

  if (expired) {
    console.log('Access token expired, refreshing...');
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    // Update DB
    account.googleAccessToken = credentials.access_token;
    account.tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // ~60 minutes
    await account.save();

    oauth2Client.setCredentials(credentials);
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}