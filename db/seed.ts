import { db } from './index';
import * as schema from './schema';
import { v4 as uuidv4 } from 'uuid';

export async function seed() {
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

  const messageId = uuidv4();
  await db.insert(schema.messages).values({
    id: messageId,
    from: 'founder@acme.com',
    to: 'agent@internal.com',
    subject: 'Interested in your product',
    snippet: 'Hi, we are looking for a solution...',
    plainTextBody: 'Hi, we are looking for a solution to our problem. Can we chat?',
    receivedAt: new Date(),
    readState: false,
    routeStatus: 'candidate',
  });

  await db.insert(schema.tasks).values({
    id: uuidv4(),
    title: 'Review inbound lead from Acme Corp',
    type: 'review-inbox-item',
    status: 'queued',
    priority: 'high',
    relatedEntityType: 'message',
    relatedEntityId: messageId,
    owner: 'Agent',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Database seeded successfully.');
}

if (require.main === module) {
  seed().catch(console.error);
}
