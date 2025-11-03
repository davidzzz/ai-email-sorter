import { google } from 'googleapis';
import { Account, Category, Email } from '../models';
import OpenAI from 'openai';
import { createOauthClient, getAuthorizedGmailClient } from '../utils/google';
import { Op } from 'sequelize';

interface EmailData {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: {
    text?: string;
    html?: string;
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

async function getEmailContent(gmail: any, messageId: string): Promise<EmailData> {
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = message.data.payload.headers;
  const from = headers.find((h: any) => h.name === 'From')?.value || '';
  const to = headers.find((h: any) => h.name === 'To')?.value || '';
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
  const threadId = message.data.threadId;

  let textBody = '';
  let htmlBody = '';

  function getBody(part: any) {
    if (part.mimeType === 'text/plain') {
      textBody = Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (part.mimeType === 'text/html') {
      htmlBody = Buffer.from(part.body.data, 'base64').toString('utf8');
    }
    if (part.parts) {
      part.parts.forEach(getBody);
    }
  }

  if (message.data.payload.parts) {
    message.data.payload.parts.forEach(getBody);
  } else if (message.data.payload.body.data) {
    textBody = Buffer.from(message.data.payload.body.data, 'base64').toString('utf8');
  }

  return {
    id: message.data.id,
    threadId,
    from: from.split('<').pop()?.replace('>', '') || from,
    to: to.split('<').pop()?.replace('>', '') || to,
    subject,
    snippet: message.data.snippet || '',
    body: {
      text: textBody,
      html: htmlBody,
    },
  };
}

async function classifyEmail(
  emailContent: EmailData,
  categories: Category[]
): Promise<{ categoryId: string | null; confidence: number; summary: string }> {
  const categoriesContext = categories
    .map((cat) => `Category "${cat.name}": ${cat.description}`)
    .join('\n');

  const prompt = `Given these email categories:
${categoriesContext}

Analyze this email:
Subject: ${emailContent.subject}
Snippet: ${emailContent.snippet}
Content: ${emailContent.body.text || emailContent.body.html || ''}

Tasks:
1. Determine the most appropriate category for this email
2. Provide a brief summary of the email content
3. Rate your confidence in the categorization from 0 to 1

Format your response as JSON with these fields:
- category: The name of the best matching category
- confidence: Your confidence score (0-1)
- summary: A brief summary of the email

Response:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an email classifier that helps organize emails into categories. Respond only with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0].message?.content || "";
    const cleanedContent = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const response = JSON.parse(cleanedContent);
    const matchedCategory = categories.find((c) => c.name === response.category);

    return {
      categoryId: matchedCategory?.id || null,
      confidence: response.confidence || 0,
      summary: response.summary || '',
    };
  } catch (error) {
    console.error('Error classifying email:', error);
    return {
      categoryId: null,
      confidence: 0,
      summary: '',
    };
  }
}

async function archiveEmail(gmail: any, messageId: string): Promise<void> {
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['INBOX'],
    },
  });

  await Email.update({ archived: true }, { where: { gmailMessageId: messageId } });
}

interface GmailMessage {
  id: string;
  threadId?: string;
  data?: {
    payload: {
      headers: Array<{
        name: string;
        value: string;
      }>;
    };
  };
}

interface EmailCreateData {
  accountId: string;
  gmailMessageId: string;
  threadId?: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet?: string;
  storedText?: string;
  storedHtmlLocation?: string;
  importedAt?: Date;
  aiSummary?: string;
  aiCategoryId?: string;
  aiConfidence?: number;
  archived: boolean;
  unsubscribeLinks?: any;
  status?: any;
}


export async function processUnclassifiedEmails(accountId: string): Promise<void> {
  try {
    const account = await Account.findByPk(accountId);

    if (!account || !account.googleAccessToken) {
      throw new Error('Account not found or missing credentials');
    }

    const gmail = await getAuthorizedGmailClient(account);

    // Get all categories for this user
    const categories = await Category.findAll({
      where: { userId: account.userId },
    });

    if (categories.length === 0) {
      console.log('No categories defined for this user');
      return;
    }

    // Fetch unread emails today from Gmail
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 3,
      q: `in:inbox is:unread after:${yesterday.getFullYear()}/${yesterday.getMonth() + 1}/${yesterday.getDate()}`,
    });

    const messages = (res.data.messages || []) as GmailMessage[];
    console.log(`Found ${messages.length} unread messages`);

    for (const message of messages) {
      if (!message.id) {
        console.warn('Message without ID found, skipping');
        continue;
      }

      try {
        // Check if we've already processed this email
        const existingEmail = await Email.findOne({
          where: {
            gmailMessageId: message.id,
          },
        });

        if (existingEmail) {
          console.log(`Email ${message.id} already processed`);
          continue;
        }

        // Get email content
        const emailContent = await getEmailContent(gmail, message.id);

        // Classify the email
        const { categoryId, confidence, summary } = await classifyEmail(emailContent, categories);

        // Extract unsubscribe links from email headers and body
        const unsubscribeLinks: string[] = [];
        
        // Check List-Unsubscribe header
        if (message.data?.payload?.headers) {
          const unsubscribeHeader = message.data.payload.headers.find(
            (h: { name: string; value: string }) => h.name.toLowerCase() === 'list-unsubscribe'
          );
          if (unsubscribeHeader?.value) {
            const headerLinks = unsubscribeHeader.value
              .split(',')
              .map((link: string) => link.trim().replace(/[<>]/g, ''))
              .filter((link: string) => link.startsWith('http') || link.startsWith('mailto'));
            unsubscribeLinks.push(...headerLinks);
          }
        }

        // Look for unsubscribe links in HTML content
        if (emailContent.body.html) {
          const unsubscribeRegex = /<a[^>]+href=["']((?:https?:\/\/|mailto:)[^"']+(?:unsubscribe|opt[- ]?out|remove)[^"']*)/gi;
          const matches = emailContent.body.html.matchAll(unsubscribeRegex);
          for (const match of matches) {
            if (match[1] && !unsubscribeLinks.includes(match[1])) {
              unsubscribeLinks.push(match[1]);
            }
          }
        }

        // Store the email in our database
        const emailData: EmailCreateData = {
          accountId,
          gmailMessageId: emailContent.id,
          threadId: emailContent.threadId || undefined,
          fromEmail: emailContent.from,
          toEmail: emailContent.to,
          subject: emailContent.subject,
          snippet: emailContent.snippet || undefined,
          storedText: emailContent.body.text || undefined,
          importedAt: new Date(),
          aiSummary: summary || undefined,
          aiCategoryId: categoryId || undefined,
          aiConfidence: confidence || undefined,
          archived: false,
          unsubscribeLinks: unsubscribeLinks.length > 0 ? unsubscribeLinks : undefined,
          status: { processed: true }
        };

        await Email.create(emailData);

        // Archive the email in Gmail
        await archiveEmail(gmail, message.id);

        console.log(`Processed and archived email ${message.id}`);
      } catch (error) {
        //console.error(`Error processing message ${message.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in classifier worker:', error);
    throw error;
  }
}

export async function startClassifierWorker(): Promise<void> {
  // Process emails for all accounts every minute
  setInterval(async () => {
    try {
      const accounts = await Account.findAll({
        where: {
          googleAccessToken: {
            [Op.not]: null,
          },
        },
      });

      for (const account of accounts) {
        await processUnclassifiedEmails(account.id);
      }
    } catch (error) {
      console.error('Error in classifier worker interval:', error);
    }
  }, 60000); // Run every minute
}
