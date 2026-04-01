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
exports.seed = seed;
const index_1 = require("./index");
const schema = __importStar(require("./schema"));
const uuid_1 = require("uuid");
async function seed() {
    const companyId = (0, uuid_1.v4)();
    await index_1.db.insert(schema.companies).values({
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
    const messageId = (0, uuid_1.v4)();
    await index_1.db.insert(schema.messages).values({
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
    await index_1.db.insert(schema.tasks).values({
        id: (0, uuid_1.v4)(),
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
