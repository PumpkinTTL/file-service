/**
 * MIME 魔数校验工具 — 通过文件头部字节验证真实类型
 * 仅覆盖项目 ALLOWED_FILE_TYPES 中的常见格式
 */

// 已知 magic bytes 映射：hex 字符串 → MIME type
const MAGIC_SIGNATURES: { hex: string; mime: string; ext: string }[] = [
  // 图片
  { hex: 'FFD8FF', mime: 'image/jpeg', ext: 'jpg' },
  { hex: '89504E470D0A1A0A', mime: 'image/png', ext: 'png' },
  { hex: '47494638', mime: 'image/gif', ext: 'gif' },
  { hex: '52494646', mime: 'image/webp', ext: 'webp' }, // RIFF...WEBP
  // 文档
  { hex: '25504446', mime: 'application/pdf', ext: 'pdf' }, // %PDF
  // Office (ZIP-based: docx, xlsx)
  { hex: '504B0304', mime: 'application/zip', ext: 'zip' }, // PK.. (also docx, xlsx, rar5)
  { hex: '52617221', mime: 'application/x-rar-compressed', ext: 'rar' }, // Rar!
  // 视频/音频
  { hex: '000000', mime: 'video/mp4', ext: 'mp4' }, // partial match — see below
  { hex: '49443303', mime: 'audio/mpeg', ext: 'mp3' }, // ID3 tag
  { hex: 'FFFB', mime: 'audio/mpeg', ext: 'mp3' }, // MP3 sync word
  { hex: 'FFF3', mime: 'audio/mpeg', ext: 'mp3' }, // MP3 sync word (MPEG1 Layer3)
  { hex: 'FFF9', mime: 'audio/mpeg', ext: 'mp3' }, // MP3 sync word variant
];

// 特殊校验函数
function detectMp4(buffer: Buffer): boolean {
  // ftyp box at offset 4
  if (buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString('ascii');
  if (ftyp === 'ftyp') return true;
  return false;
}

function detectWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return buffer.slice(0, 4).toString('ascii') === 'RIFF'
    && buffer.slice(8, 12).toString('ascii') === 'WEBP';
}

function detectOfficeDoc(buffer: Buffer, targetExt: string): boolean {
  // .docx / .xlsx are ZIP archives with specific entries
  if (buffer.length < 4) return false;
  const sig = buffer.slice(0, 4).toString('hex').toUpperCase();
  if (sig !== '504B0304') return false;
  // Scan for known strings in the ZIP content
  const text = buffer.toString('latin1');
  if (targetExt === 'docx') return text.includes('word/');
  if (targetExt === 'xlsx') return text.includes('xl/');
  return false;
}

export interface MimeTypeCheckResult {
  valid: boolean;
  detectedExt?: string;
  reason?: string;
}

/**
 * 校验 Buffer 的真实类型是否与声称的扩展名一致
 * @param buffer 文件前 N 字节（建议至少 512 字节）
 * @param claimedExt 声称的扩展名（不含点号）
 */
export function verifyMimeType(buffer: Buffer, claimedExt: string): MimeTypeCheckResult {
  if (buffer.length < 4) {
    return { valid: false, reason: '文件数据太小，无法校验类型' };
  }

  // 文本文件跳过魔数校验（txt 无固定 magic bytes）
  if (claimedExt === 'txt') {
    return { valid: true };
  }

  // MP4 特殊检测
  if (claimedExt === 'mp4') {
    return detectMp4(buffer) ? { valid: true, detectedExt: 'mp4' } : { valid: false, reason: '文件内容不是有效的 MP4 格式' };
  }

  // WebP 特殊检测
  if (claimedExt === 'webp') {
    return detectWebp(buffer) ? { valid: true, detectedExt: 'webp' } : { valid: false, reason: '文件内容不是有效的 WebP 格式' };
  }

  // Office 文档特殊检测
  if (claimedExt === 'docx') {
    return detectOfficeDoc(buffer, 'docx') ? { valid: true, detectedExt: 'docx' } : { valid: false, reason: '文件内容不是有效的 DOCX 格式' };
  }
  if (claimedExt === 'xlsx') {
    return detectOfficeDoc(buffer, 'xlsx') ? { valid: true, detectedExt: 'xlsx' } : { valid: false, reason: '文件内容不是有效的 XLSX 格式' };
  }

  // 通用 magic bytes 匹配
  const headerHex = buffer.slice(0, 16).toString('hex').toUpperCase();
  for (const sig of MAGIC_SIGNATURES) {
    if (headerHex.startsWith(sig.hex.toUpperCase())) {
      // zip-based formats are ambiguous — if claimed is doc/xls, they pass the zip check
      // but we already handled those above. For plain zip/rar, check directly.
      if (sig.ext === claimedExt) {
        return { valid: true, detectedExt: sig.ext };
      }
      // jpg covers both jpg and jpeg
      if (sig.ext === 'jpg' && (claimedExt === 'jpg' || claimedExt === 'jpeg')) {
        return { valid: true, detectedExt: 'jpg' };
      }
      // Extension mismatch — magic says different type
      return { valid: false, reason: `文件实际类型为 ${sig.ext}，与声称的 ${claimedExt} 不匹配` };
    }
  }

  // 对于未识别的 magic bytes，仅做扩展名白名单校验（不阻塞，记录 warning）
  return { valid: true, reason: '未识别文件魔数，已跳过内容校验' };
}
