import { db } from './index';
import * as schema from './schema';
import { v4 as uuidv4 } from 'uuid';
import { MockMailProvider } from '../packages/mail/mock-provider';
import { SyncEngine } from '../packages/mail/sync-engine';

export async function seed() {
  // 1. Setup a company
  const companyId = uuidv4();
  await db.insert(schema.companies).values({
    id: companyId,
    name: 'Acme Corp',
    domain: 'acme.com',
    hq: 'San Francisco',
    country: 'USA',
    sector: 'Technology',
    subsector: 'Software',
    status: 'Active',
    qualificationScore: 85,
    confidenceScore: 90,
    contradictionFlag: false,
    websiteStatus: 'Live',
    leadStage: 'Qualified',
    outreachState: 'Pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2. Setup a Mail Account
  const accountId = uuidv4();
  const internalEmail = 'agent@internal.com';
  await db.insert(schema.mailAccounts).values({
    id: accountId,
    provider: 'mock',
    email: internalEmail,
    displayName: 'Internal Agent',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Initialize Provider and Sync Engine
  const provider = new MockMailProvider(internalEmail);
  await provider.initialize('{}');
  
  const engine = new SyncEngine(provider, accountId);
  
  console.log('Running initial mail synchronization...');
  await engine.runSync();

  // 4. Generate Task linked to newly synced thread (assuming thread got generated)
  // We'll just grab the first message we synced
  const firstMsg = await db.select().from(schema.messages).limit(1).then(r => r[0]);

  if (firstMsg) {
    await db.insert(schema.tasks).values({
      id: uuidv4(),
      title: 'Review inbound lead from Acme Corp',
      type: 'review-inbox-item',
      status: 'queued',
      priority: 'high',
      relatedEntityType: 'message',
      relatedEntityId: firstMsg.id,
      owner: 'Agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log('Database seeded successfully.');
}

if (require.main === module) {
  seed().catch(console.error);
}
