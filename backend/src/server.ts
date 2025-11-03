import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import emailRoutes from './routes/emails';
import { initSequelize } from './sequelize';

dotenv.config();
const app = express();
const frontendOrigin = process.env.FRONTEND_URL;
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());

app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: 'lax',
  })
);

// Test helper middleware: when running under NODE_ENV=test, allow tests to set
// an authenticated user by passing an `x-test-user` header containing the userId.
// This keeps production code unchanged while making integration tests reliable.
if (process.env.NODE_ENV === 'test') {
  app.use((req, _res, next) => {
    const testUser = req.header('x-test-user');
    if (testUser) {
      // cookie-session exposes req.session as a mutable object
      // assign the test user id so downstream routes see an authenticated session
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      req.session = { userId: testUser };
    }
    next();
  });
}

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', emailRoutes);

app.get('/', (req, res) => res.send('AI Email Sorter backend'));


const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const shouldSync = process.env.SEQ_SYNC === 'true';
      await initSequelize({ sync: shouldSync });
      // Start the classifier worker if OPENROUTER_API_KEY is set
      if (process.env.OPENROUTER_API_KEY) {
        const { startClassifierWorker } = await import('./workers/classifierWorker');
        startClassifierWorker().catch(err => {
          console.error('Error starting classifier worker:', err);
        });
        console.log('Classifier worker started');
      } else {
        console.warn('OPENROUTER_API_KEY not set, classifier worker disabled');
      }
      app.listen(port, () => console.log(`Listening ${port}`));
    } catch (err) {
      console.error('Failed to initialize Sequelize', err);
      process.exit(1);
    }
  })();
}

export default app;
