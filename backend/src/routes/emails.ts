import express from 'express';
import { Email, Category, Account } from '../models';
import { authenticate } from '../middleware/auth';
import { performUnsubscribe } from '../workers/unsubscribeWorker';
import { Op } from 'sequelize';
import { getAuthorizedGmailClient } from '../utils/google';

const router = express.Router();

// Middleware to ensure user is authenticated
router.use(authenticate);

// Get emails for a category (supports pagination)
router.get('/categories/:categoryId/emails', async (req, res) => {
  try {
    const category = await Category.findOne({
      where: {
        id: req.params.categoryId,
        userId: req.session.userId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Pagination params
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || '20', 10)));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Email.findAndCountAll({
      where: {
        aiCategoryId: category.id,
      },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset,
    });

    res.json({
      emails: rows,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Get email content
router.get('/emails/:emailId', async (req, res) => {
  try {
    // Verify user owns this email through categories
    const userCategories = await Category.findAll({
      where: { userId: req.session.userId }
    });

    const email = await Email.findOne({
      where: {
        id: req.params.emailId,
        aiCategoryId: { [Op.in]: userCategories.map(c => c.id) }
      }
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({
      id: email.id,
      subject: email.subject,
      fromEmail: email.fromEmail,
      toEmail: email.toEmail,
      content: email.storedText,
      createdAt: email.createdAt,
      aiSummary: email.aiSummary,
      snippet: email.snippet
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

// Delete emails
router.post('/emails/delete', async (req, res) => {
  try {
    const { emailIds } = req.body;
    if (!Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    // First verify user owns these emails through categories
    const userCategories = await Category.findAll({
      where: { userId: req.session.userId }
    });

    const categoryIds = userCategories.map(c => c.id);

    const emails = await Email.findAll({
      where: {
        id: { [Op.in]: emailIds },
        aiCategoryId: { [Op.in]: categoryIds }
      }
    });

    if (emails.length !== emailIds.length) {
      return res.status(403).json({ error: 'Some emails are not accessible' });
    }

    // Delete from Gmail first
    for (const email of emails) {
      try {
        const account = await Account.findByPk(email.accountId);
        if (!account) {
          console.error(`Account not found for email ${email.id}`);
          continue;
        }

        // Get Gmail client
        const gmail = await getAuthorizedGmailClient(account);

        // Delete the message from Gmail
        await gmail.users.messages.delete({
          userId: 'me',
          id: email.gmailMessageId
        });
      } catch (error) {
        console.error(`Failed to delete email ${email.id} from Gmail:`, error);
        // Continue with local deletion even if Gmail deletion fails
      }
    }

    // Delete from local database
    await Email.destroy({
      where: {
        id: { [Op.in]: emailIds }
      }
    });

    res.json({ message: 'Emails deleted successfully' });
  } catch (error) {
    console.error('Error deleting emails:', error);
    res.status(500).json({ error: 'Failed to delete emails' });
  }
});

// Unsubscribe from an email
router.post('/emails/:emailId/unsubscribe', async (req, res) => {
  try {
    const emailId = req.params.emailId;

    // Verify user owns this email through categories
    const userCategories = await Category.findAll({
      where: { userId: req.session.userId }
    });

    const email = await Email.findOne({
      where: {
        id: emailId,
        aiCategoryId: { [Op.in]: userCategories.map(c => c.id) }
      }
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // If there are no unsubscribe links, skip calling the worker and return OK
    if (!email.unsubscribeLinks || (Array.isArray(email.unsubscribeLinks) && email.unsubscribeLinks.length === 0)) {
      // Do not mark as failed on the frontend — return 200 with a clear message
      return res.json({ message: 'No unsubscribe links available for this email', skipped: true });
    }

    // Start unsubscribe process
    const result = await performUnsubscribe(emailId);

    if (result.success) {
      res.json({ message: 'Unsubscribe successful' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

export default router;