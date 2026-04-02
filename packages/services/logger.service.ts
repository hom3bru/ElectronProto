import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class LoggerService {
  static async logNotebookEntry(
    entityType: string,
    entityId: string,
    entryType: string,
    message: string,
    opts?: {
      actorType?: string;
      actorName?: string;
      parentEntityType?: string;
      parentEntityId?: string;
      metadataJson?: Record<string, any>;
    }
  ) {
    const id = uuidv4();
    await db.insert(schema.notebookEntries).values({
      id,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      parentEntityType: opts?.parentEntityType,
      parentEntityId: opts?.parentEntityId,
      entryType,
      message,
      actorType: opts?.actorType ?? 'agent',
      actorName: opts?.actorName ?? 'System',
      metadataJson: opts?.metadataJson,
      createdAt: new Date(),
    });
  }
}
