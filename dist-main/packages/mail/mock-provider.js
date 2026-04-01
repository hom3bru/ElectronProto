"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMailProvider = void 0;
class MockMailProvider {
    id = 'mock-provider';
    name = 'Mock Local Provider';
    async connect() {
        console.log('Mock provider connected');
    }
    async disconnect() {
        console.log('Mock provider disconnected');
    }
    async fetchMessages(since) {
        return [
            {
                providerId: 'mock-msg-founder-1',
                from: 'founder@acme.com',
                to: 'agent@internal.com',
                subject: 'Interested in your product',
                snippet: 'Hi, we are looking for a solution...',
                plainTextBody: 'Hi, we are looking for a solution to our problem. Can we chat?',
                receivedAt: new Date(Date.now() - 3600000 * 24), // 1 day ago
            },
            {
                providerId: 'mock-msg-urgent-2',
                from: 'urgent@startup.io',
                to: 'agent@internal.com',
                subject: 'URGENT: Partnership opportunity',
                snippet: 'We need to move fast on this...',
                plainTextBody: 'We need to move fast on this. Please review the attached deck at https://startup.io/deck.pdf and let me know.',
                receivedAt: new Date(Date.now() - 3600000), // 1 hour ago
            }
        ];
    }
    async sendDraft(draftId) {
        console.log(`Mock sent draft ${draftId}`);
    }
}
exports.MockMailProvider = MockMailProvider;
