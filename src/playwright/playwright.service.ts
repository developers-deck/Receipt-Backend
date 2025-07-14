import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Browser, chromium } from 'playwright';

@Injectable()
export class PlaywrightService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private readonly logger = new Logger(PlaywrightService.name);

  async onModuleInit() {
    this.logger.log('Initializing Playwright browser...');
    try {
      this.browser = await chromium.launch({
        headless: true, // Run in headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Necessary for some environments
      });
      this.logger.log('Playwright browser initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to launch Playwright browser', error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Playwright browser...');
      await this.browser.close();
      this.browser = null;
      this.logger.log('Playwright browser closed.');
    }
  }

  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error('Playwright browser is not initialized.');
    }
    return this.browser;
  }
}
