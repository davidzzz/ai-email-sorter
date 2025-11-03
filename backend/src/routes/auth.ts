import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { User, Account } from '../models';
import sequelize from '../sequelize';

dotenv.config();
const router = express.Router();

const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:4000/auth/callback';

function createOauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

router.get('/login', (req, res) => {
  const oauth2Client = createOauthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'openid',
      'profile',
      'email'
    ],
    include_granted_scopes: false,
    prompt: 'consent'
  });
  res.redirect(url);
});

router.get('/connect/google', (req: any, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const oauth2Client = createOauthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'openid',
      'profile',
      'email'
    ],
    include_granted_scopes: false,
    prompt: 'consent',
    state: JSON.stringify({ isAdditionalAccount: true })
  });
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state ? JSON.parse(req.query.state as string) : {};
  if (!code) return res.status(400).send('Missing code');
  
  const oauth2Client = createOauthClient();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // fetch user info
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data: profile } = await oauth2.userinfo.get();
    const email = profile.email as string | undefined;
    const name = profile.name || "Unnamed User";
    if (!email) return res.status(500).send('Unable to determine user email from Google');

    await sequelize.transaction(async (tx) => {
      let user: User | null = null;
      if (state.isAdditionalAccount && (req as any).session?.userId) {
        // Adding additional account - use existing user
        const userId = (req as any).session.userId;
        user = await User.findByPk(userId);
        if (!user) {
          throw new Error('User not found');
        }
      } else {
        // Initial login - create or find user and primary account
        [user] = await User.findOrCreate({ 
          where: { email }, 
          defaults: { name, email }
        });

        // Set session
        (req as any).session = (req as any).session || {};
        (req as any).session.userId = user.id;
      }

      const [account] = await Account.findOrCreate({
        where: { providerUserEmail: email },
        defaults: {
          userId: user.id,
          providerUserEmail: email,
          googleRefreshToken: tokens.refresh_token ?? null,
          googleAccessToken: tokens.access_token ?? null,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        }
      });

      // Update tokens if provided (only overwrite refresh token when present)
      let changed = false;
      if (tokens.access_token) {
        account.googleAccessToken = tokens.access_token;
        changed = true;
      }
      if (tokens.refresh_token) {
        account.googleRefreshToken = tokens.refresh_token;
        changed = true;
      }
      if (tokens.expiry_date) {
        account.tokenExpiresAt = new Date(tokens.expiry_date);
        changed = true;
      }
      if (changed) await account.save();
    });

    // redirect to frontend app
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(frontend);
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('OAuth error');
  }
});

router.get('/logout', (req, res) => {
  (req as any).session = null;
  res.send({ ok: true });
});

router.get('/me', async (req, res) => {
  const sid = (req as any).session?.userId;
  if (!sid) return res.status(200).json({ user: null });
  try {
    const user = await User.findByPk(sid);
    if (!user) return res.status(200).json({ user: null });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('me route error', err);
    res.status(500).send('error');
  }
});

export default router;
