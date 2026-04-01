"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailIngestionService = void 0;
const db_1 = require("../../db");
const schema = __importStar(require("../../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
class MailIngestionService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async ingest() {
        const rawMessages = await this.provider.fetchMessages();
        for (const raw of rawMessages) {
            // Dedupe
            const existing = await db_1.db.select().from(schema.messages).where((0, drizzle_orm_1.eq)(schema.messages.providerId, raw.providerId));
            if (existing.length > 0)
                continue;
            // Thread grouping logic
            let threadId = raw.threadId;
            if (!threadId) {
                // Try to find thread by subject (naive grouping for mock)
                const existingThreadMsg = await db_1.db.select().from(schema.messages).where((0, drizzle_orm_1.eq)(schema.messages.subject, raw.subject));
                if (existingThreadMsg.length > 0 && existingThreadMsg[0].threadId) {
                    threadId = existingThreadMsg[0].threadId;
                }
                else {
                    threadId = (0, uuid_1.v4)();
                    await db_1.db.insert(schema.threads).values({
                        id: threadId,
                        subject: raw.subject,
                        status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }
            }
            const messageId = (0, uuid_1.v4)();
            // Basic classification placeholder
            let routeStatus = 'raw';
            if (raw.subject?.toLowerCase().includes('urgent'))
                routeStatus = 'escalated';
            else if (raw.from.includes('founder'))
                routeStatus = 'candidate';
            await db_1.db.insert(schema.messages).values({
                id: messageId,
                providerId: raw.providerId,
                threadId: threadId,
                from: raw.from,
                to: raw.to,
                subject: raw.subject,
                snippet: raw.snippet,
                plainTextBody: raw.plainTextBody,
                receivedAt: raw.receivedAt || new Date(),
                readState: false,
                routeStatus,
                sourceClassification: 'inbound_email',
            }).onConflictDoNothing({ target: schema.messages.providerId });
            // Update thread timestamp
            await db_1.db.update(schema.threads)
                .set({ updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema.threads.id, threadId));
        }
    }
}
exports.MailIngestionService = MailIngestionService;
