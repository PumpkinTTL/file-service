import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('upload_tokens')
export class UploadTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '签发对象名称' })
  name: string;

  @Column({ name: 'token_hash', comment: 'Token哈希值' })
  tokenHash: string;

  @Column({ name: 'token_prefix', length: 8, comment: 'Token前缀用于显示' })
  tokenPrefix: string;

  @Column({ comment: '描述', nullable: true })
  description: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ name: 'expires_at', type: 'datetime', comment: '过期时间', nullable: true })
  expiresAt: Date;

  @Column({ name: 'last_used_at', type: 'datetime', comment: '最后使用时间', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'last_used_ip', comment: '最后使用IP', nullable: true })
  lastUsedIp: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', comment: '吊销时间', nullable: true })
  revokedAt: Date;
}
