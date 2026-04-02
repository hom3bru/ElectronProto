import { db } from '../../db';
import * as schema from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { LoggerService } from './logger.service';
import {
  CommandResult, ok, okVoid, fail,
  validateId, validateNonEmpty,
  RELATIONSHIP_TYPE, RelationshipType,
} from '../shared/command';

import { LinkService } from './link.service';

export class CrmService {

  /** Create a company from a message's sender — includes dedup check on domain. */
  static async createCompanyFromMessage(messageId: string): Promise<CommandResult<string>> {
    const idV = validateId(messageId, 'messageId');
    if (!idV.ok) return idV;

    const [msg] = await db.select({ from: schema.messages.from })
      .from(schema.messages).where(eq(schema.messages.id, idV.data));
    if (!msg) return fail('NOT_FOUND', `Message ${messageId} not found`);

    // Extract domain from the sender
    const domain = msg.from.includes('@')
      ? msg.from.split('@')[1].replace('>', '').trim()
      : 'unknown.com';
    const name = msg.from.includes('<')
      ? msg.from.split('<')[0].trim() || domain
      : domain;

    // Dedup: check if a company with this domain already exists
    const [existing] = await db.select({ id: schema.companies.id })
      .from(schema.companies).where(eq(schema.companies.domain, domain));
    if (existing) {
      // Still link the message, then return existing company
      await LinkService.createLink('message', idV.data, 'company', existing.id, 'mentions');
      return ok(existing.id);
    }

    const id = uuidv4();
    await db.insert(schema.companies).values({
      id,
      name,
      domain,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await LinkService.createLink('message', idV.data, 'company', id, 'mentions');
    return ok(id);
  }

  /** Update company fields — safe patch, only writes what is explicitly provided. */
  static async updateCompany(
    companyId: string,
    patch: {
      leadStage?: string;
      outreachState?: string;
      qualificationScore?: number;
      status?: string;
      sector?: string;
    },
  ): Promise<CommandResult<void>> {
    const idV = validateId(companyId, 'companyId');
    if (!idV.ok) return idV;

    const [existing] = await db.select({ id: schema.companies.id })
      .from(schema.companies).where(eq(schema.companies.id, idV.data));
    if (!existing) return fail('NOT_FOUND', `Company ${companyId} not found`);

    await db.update(schema.companies).set({
      ...patch,
      updatedAt: new Date(),
    }).where(eq(schema.companies.id, idV.data));

    return okVoid();
  }

  /** Create a contact and associate them with a company. */
  static async createContact(
    companyId: string,
    name: string,
    email?: string,
    role?: string,
  ): Promise<CommandResult<string>> {
    const idV = validateId(companyId, 'companyId');
    if (!idV.ok) return idV;

    const nameV = validateNonEmpty(name, 'name', 200);
    if (!nameV.ok) return nameV;

    const [company] = await db.select({ id: schema.companies.id })
      .from(schema.companies).where(eq(schema.companies.id, idV.data));
    if (!company) return fail('NOT_FOUND', `Company ${companyId} not found`);

    const id = uuidv4();
    await db.insert(schema.contacts).values({
      id,
      companyId: idV.data,
      name: nameV.data,
      email: email?.trim() || null,
      role: role?.trim() || null,
      createdAt: new Date(),
    });
    return ok(id);
  }

  static async linkMessageToCompany(messageId: string, companyId: string): Promise<CommandResult<void>> {
    const msgV = validateId(messageId, 'messageId');
    if (!msgV.ok) return msgV;
    const coV = validateId(companyId, 'companyId');
    if (!coV.ok) return coV;

    const result = await LinkService.createLink('message', msgV.data, 'company', coV.data, 'mentions');
    return result.ok ? okVoid() : result;
  }

  static async linkBrowserTabToCompany(
    tabId: string,
    companyId?: string | null,
    url?: string,
  ): Promise<CommandResult<{ companyId: string }>> {
    const tabV = validateId(tabId, 'tabId');
    if (!tabV.ok) return tabV;

    let resolvedCompanyId = companyId;

    if (!resolvedCompanyId && url) {
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        const existing = await db.select({ id: schema.companies.id })
          .from(schema.companies).where(eq(schema.companies.domain, domain));

        if (existing.length > 0) {
          resolvedCompanyId = existing[0].id;
        } else {
          resolvedCompanyId = uuidv4();
          await db.insert(schema.companies).values({
            id: resolvedCompanyId,
            name: domain,
            domain,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (e) {
        return fail('VALIDATION_ERROR', 'url is not a valid URL for company auto-detection', 'url');
      }
    }

    if (!resolvedCompanyId) {
      return fail('VALIDATION_ERROR', 'Either companyId or a valid url must be provided');
    }

    // Graph link is now the authoritative source for all new tab associations.
    // The unique constraint on entity_links means this is safe to call even if already linked.
    await LinkService.createLink('browser_tab', tabV.data, 'company', resolvedCompanyId, 'related', {
      source: 'browser_tab_link',
    });

    return ok({ companyId: resolvedCompanyId });
  }
}
