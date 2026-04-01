import { MailProvider } from './provider';
import { v4 as uuidv4 } from 'uuid';

export class MockMailProvider implements MailProvider {
  id = 'mock-provider';
  name = 'Mock Local Provider';

  async connect() {
    console.log('Mock provider connected');
  }

  async disconnect() {
    console.log('Mock provider disconnected');
  }

  async fetchMessages(since?: Date) {
    return [
      {
        providerId: `mock-${uuidv4()}`,
        from: 'founder@acme.com',
        to: 'agent@internal.com',
        subject: 'Interested in your product',
        snippet: 'Hi, we are looking for a solution...',
        plainTextBody: 'Hi, we are looking for a solution to our problem. Can we chat?',
        receivedAt: new Date(),
      },
      {
        providerId: `mock-${uuidv4()}`,
        from: 'urgent@startup.io',
        to: 'agent@internal.com',
        subject: 'URGENT: Partnership opportunity',
        snippet: 'We need to move fast on this...',
        plainTextBody: 'We need to move fast on this. Please review the attached deck.',
        receivedAt: new Date(Date.now() - 3600000), // 1 hour ago
      }
    ];
  }

  async sendDraft(draftId: string) {
    console.log(`Mock sent draft ${draftId}`);
  }
}
