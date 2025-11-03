const request = require('supertest');
// Ensure Sequelize in server can initialize without a real DB during tests
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.NODE_ENV = 'test';

// Mock puppeteer before requiring the server so workers pick up the mock.
jest.doMock('puppeteer', () => ({
  launch: async () => {
    throw new Error('Mocked puppeteer failure');
  }
}));

const app = require('../server').default;
const sequelize = require('../sequelize').default;
const { User, Account, Category, Email } = require('../models');

describe('AI Email Sorter API integration', () => {
  let userId: string;
  let accountId: string;
  let categoryId: string;
  let emailId: string;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const user = await User.create({ name: 'Test User', email: 'test@example.com' });
    userId = user.id;
    const account = await Account.create({ userId: userId });
    accountId = account.id;
    const email = await Email.create({
        accountId,
        gmailMessageId: 'test-gmail-id',
        fromEmail: 'from@example.com',
        toEmail: 'to@example.com',
        subject: 'Test Email',
        importedAt: new Date(),
        aiCategoryId: categoryId,
        archived: false,
        unsubscribeLinks: [],
        status: {},
    });
    emailId = email.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('x-test-user', userId)
      .send({ name: 'TestCat', description: 'desc' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestCat');
    categoryId = res.body.id;

    // Update email to belong to this category
    await Email.update({ aiCategoryId: categoryId }, { where: { id: emailId } });
  });

  it('fetches all categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('x-test-user', userId);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for invalid category', async () => {
    const res = await request(app)
      .get(`/api/categories/invalid-id/emails`)
      .set('x-test-user', userId);
    expect(res.status).toBe(404);
  });

  it('returns 404 for invalid email', async () => {
    const res = await request(app)
      .get(`/api/emails/invalid-id`)
      .set('x-test-user', userId);
    expect(res.status).toBe(404);
  });

  it('returns 401 for missing session', async () => {
    const res = await request(app)
      .get(`/api/categories/${categoryId}/emails`);
    expect(res.status).toBe(401);
  });

  it('archives email and sets archived flag', async () => {
    // Simulate archiving by updating the flag
    await Email.update({ archived: true }, { where: { id: emailId } });
    const email = await Email.findByPk(emailId);
    expect(email?.archived).toBe(true);
  });

  it('handles Gmail API error gracefully (mock)', async () => {
    // Simulate Gmail API error by calling unsubscribe with a fake link
    await Email.update({ unsubscribeLinks: ['http://invalid-link'] }, { where: { id: emailId } });
    // The worker will encounter mocked puppeteer failure and return a failed result
    const res = await request(app)
      .post(`/api/emails/${emailId}/unsubscribe`)
      .set('x-test-user', userId);
    // The route returns 400 when worker returns a failure result
    expect(res.status).toBe(400);
  });

  it('fetches emails for a category', async () => {
    const res = await request(app)
      .get(`/api/categories/${categoryId}/emails`)
      .set('x-test-user', userId);
    expect(res.status).toBe(200);
    expect(res.body.emails.length).toBe(1);
    expect(res.body.emails[0].subject).toBe('Test Email');
  });

  it('fetches email content', async () => {
    const res = await request(app)
      .get(`/api/emails/${emailId}`)
      .set('x-test-user', userId);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Test Email');
  });

  it('skips unsubscribe when no links', async () => {
    // Ensure email has no unsubscribe links so worker is skipped
    await Email.update({ unsubscribeLinks: [] }, { where: { id: emailId } });
    const res = await request(app)
      .post(`/api/emails/${emailId}/unsubscribe`)
      .set('x-test-user', userId);
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
  });

  it('deletes email', async () => {
    const res = await request(app)
      .post('/api/emails/delete')
      .set('x-test-user', userId)
      .send({ emailIds: [emailId] });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    const check = await Email.findByPk(emailId);
    expect(check).toBeNull();
  });

  it('deletes category', async () => {
    const res = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('x-test-user', userId);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    const check = await Category.findByPk(categoryId);
    expect(check).toBeNull();
  });
});
