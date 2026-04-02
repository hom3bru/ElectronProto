import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

export class TaskRepository {
  static async getTasks() {
    return db.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt));
  }

  static async getTask(taskId: string) {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
    return task ?? null;
  }

  static async getTasksByEntity(entityType: string, entityId: string) {
    return db.select().from(schema.tasks)
      .where(eq(schema.tasks.relatedEntityType, entityType))
      .orderBy(desc(schema.tasks.createdAt));
  }
}
