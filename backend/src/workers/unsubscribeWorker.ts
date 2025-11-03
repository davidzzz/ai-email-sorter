import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import axios from 'axios';
import { Email, UnsubscribeJob } from '../models';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

interface UnsubscribeResult {
  success: boolean;
  message: string;
}

export async function performUnsubscribe(emailId: string): Promise<UnsubscribeResult> {
  let browser = null;
  try {
    // Get email details
    const email = await Email.findByPk(emailId);
    if (!email || !email.unsubscribeLinks || email.unsubscribeLinks.length === 0) {
      return { success: false, message: 'No unsubscribe links found' };
    }

    // Try each unsubscribe link
    for (const link of email.unsubscribeLinks) {
      try {
        // First try mailto: links if present
        if (link.startsWith('mailto:')) {
          // Store this as a task to send an unsubscribe email later
          await Email.update(
            { status: { ...email.status, unsubscribeRequested: true, unsubscribeMethod: 'mailto' } },
            { where: { id: email.id } }
          );
          return { success: true, message: 'Unsubscribe email will be sent' };
        }

        // For HTTP links, use puppeteer to navigate and interact
        browser = await puppeteer.launch({
          headless: true,
        });
        
        const page = await browser.newPage();
        
        // Set a reasonable viewport size
        await page.setViewport({ width: 1280, height: 800 });
        
        // Navigate to the unsubscribe page with timeout
        await page.goto(link, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });

        // Use GPT to analyze the page and determine the right action
        const pageContent = await page.content();
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant helping to unsubscribe from emails. 
              Analyze the HTML content and describe the steps needed to unsubscribe.
              Return JSON in this format:
              {
                "actions": [
                  { "type": "click", "selector": "CSS selector" },
                  { "type": "input", "selector": "CSS selector", "value": "text to input" },
                  { "type": "select", "selector": "CSS selector", "value": "option value" }
                ]
              }`
            },
            {
              role: 'user',
              content: `Here's the unsubscribe page HTML. What steps should I take to unsubscribe?
              ${pageContent}`
            }
          ],
          temperature: 0.3,
        });

        const content = completion.choices[0].message?.content || "";
        const cleanedContent = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const actions = JSON.parse(cleanedContent).actions;

        // Execute the actions
        for (const action of actions) {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          
          switch (action.type) {
            case 'click':
              await page.click(action.selector);
              break;
            case 'input':
              await page.type(action.selector, action.value);
              break;
            case 'select':
              await page.select(action.selector, action.value);
              break;
          }
          // Wait for any network activity to settle
          await page.waitForNetworkIdle({ timeout: 5000 });
        }

        // Wait a bit to ensure the action completes
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update email status
        await Email.update(
          { 
            status: { 
              ...email.status, 
              unsubscribed: true, 
              unsubscribeMethod: 'automated',
              unsubscribeDate: new Date().toISOString()
            } 
          },
          { where: { id: email.id } }
        );

        // Insert UnsubscribeJob record (cast to any so Sequelize will fill auto fields)
        await UnsubscribeJob.create({
          emailId: email.id,
          jobStatus: 'completed',
          lastAttemptedAt: new Date(),
          result: { success: true, message: 'Successfully unsubscribed' }
        } as any);

        return { success: true, message: 'Successfully unsubscribed' };
      } catch (error) {
        console.error('Error processing unsubscribe link:', link, error);
        if (browser) {
          await browser.close();
        }
        continue; // Try next link if available
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    return { success: false, message: 'Failed to unsubscribe using available links' };
  } catch (error) {
    console.error('Error in unsubscribe process:', error);
    if (browser) {
      await browser.close();
    }
    return { success: false, message: 'Internal error during unsubscribe process' };
  }
}