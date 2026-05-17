import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('upload_sessions')
@Index(['fileHash', 'status'])
export class UploadSessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'upload_id', unique: true, comment: '上传会话唯一标识' })
  uploadId: string;

  @Column({ name: 'file_hash', comment: '文件SHA256哈希', nullable: true })
  fileHash: string;

  @Column({ name: 'original_name', comment: '原始文件名' })
  originalName: string;

  @Column({ type: 'bigint', name: 'file_size', comment: '文件总大小(字节)' })
  fileSize: number;

  @Column({ name: 'chunk_size', type: 'bigint', comment: '切片大小(字节)' })
  chunkSize: number;

  @Column({ name: 'total_chunks', comment: '总切片数' })
  totalChunks: number;

  @Column({ name: 'mime_type', comment: 'MIME类型', nullable: true })
  mimeType: string;

  @Column({ name: 'token_id', comment: '上传Token ID', nullable: true })
  tokenId: number;

  @Column({ name: 'status', default: 'uploading', comment: '状态: uploading/merged/expired' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
