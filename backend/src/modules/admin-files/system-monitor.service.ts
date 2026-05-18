import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { execSync } from 'child_process';
import * as path from 'path';

export interface DiskInfo {
  mount: string;         // 挂载点 / 盘符（C:\, /data 等）
  total: number;         // 总容量 bytes
  used: number;          // 已用 bytes
  free: number;          // 可用 bytes
  usagePercent: number;  // 使用率 %
  isUploadDisk: boolean; // 是否为上传目录所在盘
}

export interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disks: DiskInfo[];
  uptime: number;
  processMemory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  uploadBaseDir: string;
}

@Injectable()
export class SystemMonitorService {
  async getStats(uploadBaseDir: string): Promise<SystemStats> {
    const [cpuUsage, disks] = await Promise.all([
      this.getCpuUsage(),
      this.getAllDisks(uploadBaseDir),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;

    const procMem = process.memoryUsage();

    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        loadAvg: os.loadavg().map(v => Math.round(v * 100) / 100),
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round(memUsage * 100) / 100,
      },
      disks,
      uptime: os.uptime(),
      processMemory: {
        rss: procMem.rss,
        heapUsed: procMem.heapUsed,
        heapTotal: procMem.heapTotal,
      },
      uploadBaseDir,
    };
  }

  /**
   * 通过采样两次 os.cpus() 计算 CPU 使用率
   */
  private async getCpuUsage(): Promise<number> {
    const start = this.getCpuTimes();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const end = this.getCpuTimes();

    const totalDiff = end.total - start.total;
    const idleDiff = end.idle - start.idle;

    if (totalDiff === 0) return 0;
    const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
    return Math.round(usage * 100) / 100;
  }

  private getCpuTimes() {
    const cpus = os.cpus();
    let total = 0;
    let idle = 0;
    for (const cpu of cpus) {
      for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    return { total, idle };
  }

  /**
   * 获取所有磁盘信息
   */
  private async getAllDisks(uploadBaseDir: string): Promise<DiskInfo[]> {
    const resolved = path.resolve(uploadBaseDir);

    try {
      if (process.platform === 'win32') {
        return this.getWindowsAllDisks(resolved);
      } else {
        return this.getUnixAllDisks(resolved);
      }
    } catch {
      return [];
    }
  }

  /**
   * 判断路径是否属于某挂载点（支持子路径匹配）
   * 例如 uploadDir=/data/uploads, mount=/data → true
   */
  private isPathOnMount(uploadDir: string, mount: string): boolean {
    const normalizedDir = uploadDir.replace(/\/+$/, '');
    const normalizedMount = mount.replace(/\/+$/, '');
    return normalizedDir === normalizedMount || normalizedDir.startsWith(normalizedMount + '/');
  }

  /**
   * Windows: wmic logicaldisk get 获取所有盘
   */
  private getWindowsAllDisks(uploadBaseDir: string): DiskInfo[] {
    const output = execSync(
      'wmic logicaldisk get DeviceID,Size,FreeSpace /format:list',
      { encoding: 'utf-8', timeout: 5000 }
    );

    const blocks = output.trim().split(/\r?\n\s*\r?\n/);
    const disks: DiskInfo[] = [];

    for (const block of blocks) {
      let device = '';
      let free = 0;
      let total = 0;

      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DeviceID=')) {
          device = trimmed.split('=')[1].trim();
        } else if (trimmed.startsWith('FreeSpace=')) {
          free = parseInt(trimmed.split('=')[1], 10) || 0;
        } else if (trimmed.startsWith('Size=')) {
          total = parseInt(trimmed.split('=')[1], 10) || 0;
        }
      }

      if (!device || total === 0) continue;

      const used = total - free;
      const usagePercent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0;
      const mount = device + '\\';

      disks.push({
        mount,
        total,
        used,
        free,
        usagePercent,
        isUploadDisk: uploadBaseDir.toUpperCase().startsWith(mount.toUpperCase()),
      });
    }

    return disks;
  }

  /**
   * Linux/Mac: df -k 获取所有挂载点
   */
  private getUnixAllDisks(uploadBaseDir: string): DiskInfo[] {
    const output = execSync('df -k', {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const lines = output.trim().split('\n');
    const disks: DiskInfo[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length < 6) continue;

      const fsName = parts[0];   // 如 /dev/sda1, tmpfs, overlay
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
      const free = parseInt(parts[3], 10) * 1024;
      const mount = parts[5];    // 如 /, /data, /boot

      if (total === 0) continue;

      // 只保留真实块设备，跳过虚拟文件系统（tmpfs/sysfs/proc/devtmpfs 等）
      if (!fsName.startsWith('/dev/') && fsName !== 'overlay') continue;

      const usagePercent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0;

      disks.push({
        mount,
        total,
        used,
        free,
        usagePercent,
        isUploadDisk: this.isPathOnMount(uploadBaseDir, mount),
      });
    }

    return disks;
  }
}
