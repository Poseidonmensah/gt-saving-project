import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_sessions')
export class UserSessionEntity {
  @PrimaryColumn({ name: 'session_id' })        sessionId: string;
  @Column({ name: 'user_id' })                  userId: string;
  @Column({ name: 'token_hash' })               tokenHash: string;
  @Column({ name: 'refresh_token_hash', nullable: true }) refreshTokenHash: string;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @Column({ name: 'device_fingerprint', nullable: true }) deviceFingerprint: string;
  @Column({ name: 'user_agent', nullable: true }) userAgent: string;
  @Column({ name: 'expires_at' })               expiresAt: Date;
  @Column({ name: 'revoked_at', nullable: true }) revokedAt: Date;
  @CreateDateColumn({ name: 'created_at' })     createdAt: Date;
}
