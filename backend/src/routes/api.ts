import express from 'express';
import { Category, Account } from '../models';
import { authenticate } from '../middleware/auth';
import { createOauthClient } from '../utils/google';
import { CreationAttributes } from 'sequelize';

const router = express.Router();

// Type safety for request with session
declare global {
  namespace Express {
    interface Request {
      session: {
        userId: string;
      };
    }
  }
}

// Middleware to ensure user is authenticated for all API routes
router.use(authenticate);

// Type for category request body
interface CategoryCreateRequest {
  name: string;
  description: string;
}

// Get all categories for the current user
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { userId: req.session.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body as CategoryCreateRequest;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const categoryData: CreationAttributes<Category> = {
      name,
      description: description || '',
      userId: req.session.userId
    };

    const category = await Category.create(categoryData);
    res.status(201).json(category);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Delete a category
router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findOne({
      where: {
        id: req.params.id,
        userId: req.session.userId
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await category.destroy();
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get all connected accounts for the current user
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.findAll({
      where: { userId: req.session.userId },
      attributes: ['id', 'providerUserEmail', 'createdAt']
    });
    
    const transformedAccounts = accounts.map(account => ({
      id: account.id,
      email: account.providerUserEmail,
      provider: 'Google',
      connectedAt: account.createdAt
    }));

    res.json(transformedAccounts);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to fetch connected accounts' });
  }
});

// Remove a connected account
router.delete('/accounts/:id', async (req, res) => {
  try {
    const account = await Account.findOne({
      where: {
        id: req.params.id,
        userId: req.session.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Revoke Google OAuth token if it exists
    if (account.googleAccessToken) {
      try {
        const oauth2Client = createOauthClient();
        oauth2Client.setCredentials({
          access_token: account.googleAccessToken,
          refresh_token: account.googleRefreshToken
        });
        await oauth2Client.revokeToken(account.googleAccessToken);
      } catch (err) {
        console.error('Error revoking Google token:', err);
        // Continue with account deletion even if token revocation fails
      }
    }

    await account.destroy();
    res.json({ message: 'Account disconnected successfully' });
  } catch (err) {
    console.error('Error removing account:', err);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

export default router;
