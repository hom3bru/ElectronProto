import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider } from './provider';

export class MailIngestionService {
  private provider: MailProvider;

  constructor(provider: MailProvider) {
    this.provider = provider;
  }

  async ingest() {
    // Legacy ingest - replaced by sync engine
  }
}
