import { Injectable } from '@nestjs/common';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}

interface LogQueryOptions {
  level?: string;
  keyword?: string;
  limit: number;
}

@Injectable()
export class LogsService {
  private static readonly VALID_LEVELS: LogEntry['level'][] = ['error', 'warn', 'info', 'debug'];
  private logs: LogEntry[] = [];

  addLog(level: LogEntry['level'], message: string) {
    const log: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message: message.length > 10000 ? message.slice(0, 10000) + '...' : message,
    };
    this.logs.unshift(log);
    this.trimLogs();
  }

  error(message: string) {
    this.addLog('error', message);
  }

  warn(message: string) {
    this.addLog('warn', message);
  }

  info(message: string) {
    this.addLog('info', message);
  }

  debug(message: string) {
    this.addLog('debug', message);
  }

  async queryLogs(options: LogQueryOptions): Promise<LogEntry[]> {
    let result = [...this.logs];

    if (options.level) {
      if (LogsService.VALID_LEVELS.includes(options.level as LogEntry['level'])) {
        result = result.filter(log => log.level === options.level);
      }
    }

    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(keyword)
      );
    }

    return result.slice(0, options.limit);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private trimLogs() {
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
  }
}
