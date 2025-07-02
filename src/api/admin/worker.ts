// Admin API Worker - Main entry point

import { AdminEnv, SyncEvent } from './types';
import { AdminAPIRouter } from './router';
import { SyncProcessor } from './sync/processor';
import { createLogger } from '@/utils/logger';

export default {
  // HTTP requests handler
  async fetch(request: Request, env: AdminEnv, ctx: ExecutionContext): Promise<Response> {
    const logger = createLogger(env, { service: 'admin-api' });
    
    try {
      logger.info('Received request', {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      });

      const router = new AdminAPIRouter(env);
      return await router.handle(request);

    } catch (error) {
      logger.error('Unhandled error in admin API', error as Error);
      
      return new Response(JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Queue handler for DO->D1 sync events
  async queue(batch: MessageBatch<SyncEvent>, env: AdminEnv): Promise<void> {
    const logger = createLogger(env, { service: 'sync-queue' });
    const processor = new SyncProcessor(env);
    
    logger.info('Processing sync event batch', { 
      size: batch.messages.length 
    });

    for (const message of batch.messages) {
      try {
        await processor.processEvent(message.body);
        message.ack();
      } catch (error) {
        logger.error('Failed to process sync event', error as Error, {
          event: message.body
        });
        
        // Retry the message if it hasn't exceeded retry limit
        if (message.attempts < 3) {
          message.retry();
        } else {
          // Dead letter after 3 attempts
          logger.error('Sync event exceeded retry limit', error as Error, {
            event: message.body,
            attempts: message.attempts
          });
          message.ack(); // Acknowledge to remove from queue
        }
      }
    }
  }
};