import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty, validateEnum,
  TASK_STATUS, TASK_PRIORITY, TaskStatus, TaskPriority,
} from '../shared/command';

export interface TaskWorkflowUpdate {
  owner?: string;
  notes?: string;
  recommendedNextAction?: string;
  escalationReason?: string;
  blockedReason?: string;
  status?: string;
  priority?: string;
}

export class TaskService {
  static async createTask(
    title: string,
    type: string,
    priority: string,
    opts?: {
      relatedEntityType?: string;
      relatedEntityId?: string;
      owner?: string;
      notes?: string;
      recommendedNextAction?: string;
      escalationReason?: string;
    }
  ): Promise<CommandResult<string>> {
    const titleV = validateNonEmpty(title, 'title', 500);
    if (!titleV.ok) return titleV;

    const typeV = validateNonEmpty(type, 'type', 100);
    if (!typeV.ok) return typeV;

    const priorityV = validateEnum(priority, TASK_PRIORITY, 'priority');
    if (!priorityV.ok) return priorityV;

    if (opts?.relatedEntityType !== undefined) {
      const etV = validateNonEmpty(opts.relatedEntityType, 'relatedEntityType', 100);
      if (!etV.ok) return etV;
    }
    if (opts?.relatedEntityId !== undefined) {
      const eiV = validateId(opts.relatedEntityId, 'relatedEntityId');
      if (!eiV.ok) return eiV;
    }

    const id = uuidv4();
    await db.insert(schema.tasks).values({
      id,
      title: titleV.data,
      type: typeV.data,
      status: 'queued',
      priority: priorityV.data,
      relatedEntityType: opts?.relatedEntityType,
      relatedEntityId: opts?.relatedEntityId,
      owner: opts?.owner || null,
      notes: opts?.notes || null,
      recommendedNextAction: opts?.recommendedNextAction || null,
      escalationReason: opts?.escalationReason || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return ok(id);
  }

  static async updateTaskStatus(taskId: string, status: string): Promise<CommandResult<void>> {
    const idV = validateId(taskId, 'taskId');
    if (!idV.ok) return idV;

    const statusV = validateEnum(status, TASK_STATUS, 'status');
    if (!statusV.ok) return statusV;

    const [existing] = await db.select({ id: schema.tasks.id, status: schema.tasks.status })
      .from(schema.tasks).where(eq(schema.tasks.id, idV.data));
    if (!existing) return fail('NOT_FOUND', `Task ${taskId} not found`);

    await db.update(schema.tasks).set({
      status: statusV.data,
      completedAt: statusV.data === 'completed' ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(eq(schema.tasks.id, idV.data));

    return okVoid();
  }

  /** Rich workflow update for mediation/escalation */
  static async updateTaskWorkflow(taskId: string, update: TaskWorkflowUpdate): Promise<CommandResult<void>> {
    const idV = validateId(taskId, 'taskId');
    if (!idV.ok) return idV;

    const [existing] = await db.select({ id: schema.tasks.id })
      .from(schema.tasks).where(eq(schema.tasks.id, idV.data));
    if (!existing) return fail('NOT_FOUND', `Task ${taskId} not found`);

    const set: any = { updatedAt: new Date() };
    if (update.status) {
      const v = validateEnum(update.status, TASK_STATUS, 'status');
      if (!v.ok) return v;
      set.status = v.data;
      if (v.data === 'completed') set.completedAt = new Date();
    }
    if (update.priority) {
      const v = validateEnum(update.priority, TASK_PRIORITY, 'priority');
      if (!v.ok) return v;
      set.priority = v.data;
    }
    if (update.owner !== undefined) set.owner = update.owner;
    if (update.notes !== undefined) set.notes = update.notes;
    if (update.recommendedNextAction !== undefined) set.recommendedNextAction = update.recommendedNextAction;
    if (update.escalationReason !== undefined) set.escalationReason = update.escalationReason;
    if (update.blockedReason !== undefined) set.blockedReason = update.blockedReason;

    await db.update(schema.tasks).set(set).where(eq(schema.tasks.id, idV.data));

    return okVoid();
  }

  static async appendNotebookEntryFromBrowserTab(tabId: string, message: string): Promise<CommandResult<void>> {
    const tabV = validateId(tabId, 'tabId');
    if (!tabV.ok) return tabV;

    const msgV = validateNonEmpty(message, 'message', 5000);
    if (!msgV.ok) return msgV;

    await LoggerService.logNotebookEntry('browser_tab', tabV.data, 'note', msgV.data);
    return okVoid();
  }
}
