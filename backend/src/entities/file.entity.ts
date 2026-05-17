import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'original_name', comment: '原始文件名' })
  originalName: string;

  @Column({ name: 'file_name', comment: '存储文件名' })
  fileName: string;

  @Column({ name: 'relative_path', comment: '相对路径 /年/月/日/文件名' })
  relativePath: string;

  @Column({ name: 'full_url', comment: '完整访问URL' })
  fullUrl: string;

  @Index()
  @Column({ comment: '文件SHA256哈希', nullable: true })
  hash: string;

  @Column({ name: 'hash_algorithm', comment: '哈希算法', default: 'sha256' })
  hashAlgorithm: string;

  @Column({ name: 'mime_type', comment: 'MIME类型' })
  mimeType: string;

  @Column({ type: 'bigint', comment: '文件大小(字节)' })
  size: number;

  @Column({ name: 'token_id', comment: '上传Token ID', nullable: true })
  tokenId: number;

  @Column({ name: 'token_name', comment: '上传Token名称', nullable: true })
  tokenName: string;

  @CreateDateColumn({ name: 'uploaded_at', comment: '上传时间' })
  uploadedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', comment: '软删除时间', nullable: true })
  deletedAt: Date;
}
