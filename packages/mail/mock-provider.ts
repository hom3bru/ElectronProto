import { MailProvider } from './provider';

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
    return [];
  }

  async sendDraft(draftId: string) {
    console.log(`Mock sent draft ${draftId}`);
  }
}
