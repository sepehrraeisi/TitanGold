import amqp from 'amqplib';

/**
 * Message Queue Service
 * ----------------------
 * این سرویس برای هماهنگی بین AI Agents و Artemis Orchestrator استفاده می‌شود.
 * از RabbitMQ برای پیام‌رسانی استفاده می‌کند.
 * 
 * توجه: اگر RabbitMQ در دسترس نباشد، سیستم به صورت fallback از در-memory queue استفاده می‌کند.
 */

class MessageQueue {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.fallbackQueue = {
      ai_agent_tasks: [],
      trading_signals: [],
      notifications: [],
    };
    this.fallbackIntervals = {
      ai_agent_tasks: null,
      trading_signals: null,
      notifications: null,
    };
  }

  /**
   * اتصال به RabbitMQ
   */
  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // ایجاد Queue ها
      await this.channel.assertQueue('ai_agent_tasks', { durable: true });
      await this.channel.assertQueue('trading_signals', { durable: true });
      await this.channel.assertQueue('notifications', { durable: true });
      
      this.isConnected = true;
      console.log('✅ Connected to RabbitMQ');
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err);
        this.isConnected = false;
      });
      
      this.connection.on('close', () => {
        console.warn('⚠️ RabbitMQ connection closed');
        this.isConnected = false;
      });
      
    } catch (error) {
      console.warn('⚠️ RabbitMQ not available, using in-memory fallback:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * ارسال Task به AI Agent
   */
  async publishAgentTask(task) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.sendToQueue(
          'ai_agent_tasks',
          Buffer.from(JSON.stringify(task)),
          { persistent: true }
        );
        return true;
      } catch (error) {
        console.error('Failed to publish agent task to RabbitMQ:', error);
        // Fallback to in-memory queue
        this.fallbackQueue.ai_agent_tasks.push(task);
        return false;
      }
    } else {
      // Fallback: استفاده از in-memory queue
      this.fallbackQueue.ai_agent_tasks.push(task);
      return false;
    }
  }

  /**
   * دریافت Task از Queue
   */
  async consumeAgentTasks(callback) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.consume('ai_agent_tasks', (msg) => {
          if (msg) {
            const task = JSON.parse(msg.content.toString());
            callback(task);
            this.channel.ack(msg);
          }
        });
        return true;
      } catch (error) {
        console.error('Failed to consume agent tasks from RabbitMQ:', error);
        return false;
      }
    } else {
      // Fallback: پردازش در-memory queue
      // Clear existing interval to prevent memory leak
      if (this.fallbackIntervals.ai_agent_tasks) {
        clearInterval(this.fallbackIntervals.ai_agent_tasks);
      }
      this.fallbackIntervals.ai_agent_tasks = setInterval(() => {
        if (this.fallbackQueue.ai_agent_tasks.length > 0) {
          const task = this.fallbackQueue.ai_agent_tasks.shift();
          callback(task);
        }
      }, 1000); // Check every second
      return false;
    }
  }

  /**
   * ارسال Trading Signal
   */
  async publishTradingSignal(signal) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.sendToQueue(
          'trading_signals',
          Buffer.from(JSON.stringify(signal)),
          { persistent: true }
        );
        return true;
      } catch (error) {
        console.error('Failed to publish trading signal to RabbitMQ:', error);
        this.fallbackQueue.trading_signals.push(signal);
        return false;
      }
    } else {
      this.fallbackQueue.trading_signals.push(signal);
      return false;
    }
  }

  /**
   * دریافت Trading Signals
   */
  async consumeTradingSignals(callback) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.consume('trading_signals', (msg) => {
          if (msg) {
            const signal = JSON.parse(msg.content.toString());
            callback(signal);
            this.channel.ack(msg);
          }
        });
        return true;
      } catch (error) {
        console.error('Failed to consume trading signals from RabbitMQ:', error);
        return false;
      }
    } else {
      // Clear existing interval to prevent memory leak
      if (this.fallbackIntervals.trading_signals) {
        clearInterval(this.fallbackIntervals.trading_signals);
      }
      this.fallbackIntervals.trading_signals = setInterval(() => {
        if (this.fallbackQueue.trading_signals.length > 0) {
          const signal = this.fallbackQueue.trading_signals.shift();
          callback(signal);
        }
      }, 1000);
      return false;
    }
  }

  /**
   * ارسال Notification
   */
  async publishNotification(notification) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.sendToQueue(
          'notifications',
          Buffer.from(JSON.stringify(notification)),
          { persistent: true }
        );
        return true;
      } catch (error) {
        console.error('Failed to publish notification to RabbitMQ:', error);
        this.fallbackQueue.notifications.push(notification);
        return false;
      }
    } else {
      this.fallbackQueue.notifications.push(notification);
      return false;
    }
  }

  /**
   * دریافت Notifications
   */
  async consumeNotifications(callback) {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.consume('notifications', (msg) => {
          if (msg) {
            const notification = JSON.parse(msg.content.toString());
            callback(notification);
            this.channel.ack(msg);
          }
        });
        return true;
      } catch (error) {
        console.error('Failed to consume notifications from RabbitMQ:', error);
        return false;
      }
    } else {
      // Clear existing interval to prevent memory leak
      if (this.fallbackIntervals.notifications) {
        clearInterval(this.fallbackIntervals.notifications);
      }
      this.fallbackIntervals.notifications = setInterval(() => {
        if (this.fallbackQueue.notifications.length > 0) {
          const notification = this.fallbackQueue.notifications.shift();
          callback(notification);
        }
      }, 1000);
      return false;
    }
  }

  /**
   * بستن اتصال
   */
  async close() {
    // Clear all fallback intervals
    Object.values(this.fallbackIntervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    this.fallbackIntervals = {
      ai_agent_tasks: null,
      trading_signals: null,
      notifications: null,
    };
    
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.isConnected = false;
    console.log('✅ RabbitMQ connection closed');
  }

  /**
   * بررسی وضعیت اتصال
   */
  getStatus() {
    return {
      connected: this.isConnected,
      fallbackMode: !this.isConnected,
      queueSizes: {
        ai_agent_tasks: this.fallbackQueue.ai_agent_tasks.length,
        trading_signals: this.fallbackQueue.trading_signals.length,
        notifications: this.fallbackQueue.notifications.length,
      },
    };
  }
}

export const messageQueue = new MessageQueue();

// Auto-connect disabled - will be called manually from server.js
// This prevents duplicate connections and memory leaks

