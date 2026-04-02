import { db } from '../db';
import { entityLinks, drafts, tasks, evidenceFragments, browserTabs } from '../db/schema';
import { eq, isNotNull, and, not } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function migrate() {
  console.log('Starting Forensic Link Migration...');

  // 1. Migrate Drafts
  const draftsWithCompany = await db.select().from(drafts).where(isNotNull(drafts.companyId));
  console.log(`Found ${draftsWithCompany.length} drafts linked to companies.`);
  for (const draft of draftsWithCompany) {
    try {
      await db.insert(entityLinks).values({
        id: uuidv4(),
        sourceEntityId: draft.id,
        sourceEntityType: 'draft',
        targetEntityId: draft.companyId!,
        targetEntityType: 'company',
        linkType: 'related',
        metadataJson: JSON.stringify({ migratedFrom: 'drafts.companyId' }),
        createdAt: draft.createdAt || new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`Failed to migrate draft ${draft.id}:`, e);
    }
  }

  // 2. Migrate Tasks
  const tasksWithEntity = await db.select().from(tasks).where(isNotNull(tasks.relatedEntityId));
  console.log(`Found ${tasksWithEntity.length} tasks linked to entities.`);
  for (const task of tasksWithEntity) {
    // We need to guess the target entity type. If it starts with 'comp_', 'task_', etc.
    // In this system, IDs are usually UUIDs, but sometimes prefixed.
    // Let's assume most are companies for now, or check if we can determine type.
    let targetType = 'company'; 
    if (task.relatedEntityId?.startsWith('thread_')) targetType = 'thread';
    
    try {
      await db.insert(entityLinks).values({
        id: uuidv4(),
        sourceEntityId: task.id,
        sourceEntityType: 'task',
        targetEntityId: task.relatedEntityId!,
        targetEntityType: targetType,
        linkType: 'related',
        metadataJson: JSON.stringify({ migratedFrom: 'tasks.relatedEntityId' }),
        createdAt: task.createdAt || new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`Failed to migrate task ${task.id}:`, e);
    }
  }

  // 3. Migrate Evidence
  const evidenceWithCompany = await db.select().from(evidenceFragments).where(isNotNull(evidenceFragments.companyId));
  console.log(`Found ${evidenceWithCompany.length} evidence fragments linked to companies.`);
  for (const fragment of evidenceWithCompany) {
    try {
      await db.insert(entityLinks).values({
        id: uuidv4(),
        sourceEntityId: fragment.id,
        sourceEntityType: 'evidence',
        targetEntityId: fragment.companyId!,
        targetEntityType: 'company',
        linkType: 'related',
        metadataJson: JSON.stringify({ migratedFrom: 'evidence_fragments.companyId' }),
        createdAt: fragment.createdAt || new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`Failed to migrate evidence ${fragment.id}:`, e);
    }
  }

  // 4. Migrate Browser Tabs
  const tabsWithCompany = await db.select().from(browserTabs).where(isNotNull(browserTabs.linkedCompanyId));
  console.log(`Found ${tabsWithCompany.length} browser tabs linked to companies.`);
  for (const tab of tabsWithCompany) {
    try {
      await db.insert(entityLinks).values({
        id: uuidv4(),
        sourceEntityId: tab.id,
        sourceEntityType: 'browser_tab',
        targetEntityId: tab.linkedCompanyId!,
        targetEntityType: 'company',
        linkType: 'related',
        metadataJson: JSON.stringify({ migratedFrom: 'browser_tabs.linkedCompanyId' }),
        createdAt: tab.createdAt || new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`Failed to migrate browser tab ${tab.id}:`, e);
    }
  }

  console.log('Migration Complete.');
}

migrate().catch(console.error);
