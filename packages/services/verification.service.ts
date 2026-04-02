import { WebContents, BaseWindow, WebContentsView, app } from 'electron';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { LoggerService } from './logger.service';

/**
 * Background service for forensic link verification.
 * Uses a hidden WebContents to poll evidence URLs for 'drift'.
 */
export class VerificationService {
  private static workerView: WebContentsView | null = null;
  private static isRunning = false;
  private static pollInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the background verifier.
   * Attaches a hidden WebContentsView to the main window.
   */
  static async init(mainWindow: BaseWindow) {
    if (this.workerView) return;

    this.workerView = new WebContentsView({
      webPreferences: {
        offscreen: true,
        partition: 'persist:verification-sandbox',
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Hide it by setting it to a microscopic size far off-screen
    mainWindow.contentView.addChildView(this.workerView);
    this.workerView.setBounds({ x: -100, y: -100, width: 1, height: 1 });

    console.log('[Verification] Background Service Initialized');
    
    // Start the periodic polling (every 4 hours by default, or immediately for test)
    this.startPolling(4 * 60 * 60 * 1000); 
  }

  static startPolling(intervalMs: number) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    
    this.pollInterval = setInterval(() => {
      this.runVerificationSweep().catch(console.error);
    }, intervalMs);

    // Initial sweep
    this.runVerificationSweep().catch(console.error);
  }

  /**
   * Scans all evidence fragments and verifies their URLs.
   */
  static async runVerificationSweep() {
    if (this.isRunning || !this.workerView) return;
    this.isRunning = true;
    console.log('[Verification] Starting evidence sweep...');

    try {
      const fragments = await db.select()
        .from(schema.evidenceFragments)
        .where(eq(schema.evidenceFragments.type, 'web_fragment'));

      for (const frag of fragments) {
        if (!frag.url) continue;

        try {
          const status = await this.checkUrl(frag.url);
          
          if (status !== 200) {
            await LoggerService.logNotebookEntry('evidence', frag.id, 'verification_warning', 
              `Forensic Drift: URL returned status ${status}. Evidence may be compromised.`,
              { actorType: 'system', metadataJson: { url: frag.url, status } }
            );
          } else {
            console.log(`[Verification] Valid: ${frag.id}`);
          }
        } catch (e: any) {
          await LoggerService.logNotebookEntry('evidence', frag.id, 'verification_failed', 
            `Forensic Check Failed: ${e.message}. Link may be dead.`,
            { actorType: 'system', metadataJson: { url: frag.url, error: e.message } }
          );
        }

        // Rate limit the sweep to be polite to host servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } finally {
      this.isRunning = false;
      console.log('[Verification] Sweep complete.');
    }
  }

  /**
   * Uses the hidden WebContents to verify a URL's status.
   */
  private static async checkUrl(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.workerView) return reject(new Error('No worker view'));

      const timeout = setTimeout(() => {
        this.workerView?.webContents.stop();
        reject(new Error('Timeout'));
      }, 20000);

      this.workerView.webContents.loadURL(url).catch(() => {
        clearTimeout(timeout);
        reject(new Error('Load failed'));
      });

      // Simple success: The page loaded. For forensic verification,
      // 'loaded' is consider a success.
      this.workerView.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve(200);
      });
      
      this.workerView.webContents.once('did-fail-load', (e, code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
  }
}
