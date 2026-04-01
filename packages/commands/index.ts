import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class CommandService {
  async createCompanyFromMessage(messageId: string, companyData: any) {
    const id = uuidv4();
    await db.insert(schema.companies).values({
      id,
      ...companyData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Link message
    // await db.update(schema.messages).set({ routeStatus: 'actioned' }).where(schema.messages.id === messageId);
    return id;
  }

  async escalateItem(entityType: string, entityId: string, reason: string) {
    const id = uuidv4();
    await db.insert(schema.tasks).values({
      id,
      title: `Escalation: ${entityType}`,
      type: 'escalation',
      status: 'needs-review',
      priority: 'high',
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      escalationReason: reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }
}
