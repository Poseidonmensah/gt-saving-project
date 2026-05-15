import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ name: 'user_id' })          userId: string;
  @Column({ name: 'username', unique: true })   username: string;
  @Column({ name: 'email', unique: true })      email: string;
  @Column({ name: 'password_hash' })            passwordHash: string;
  @Column({ name: 'full_name' })                fullName: string;
  @Column({ name: 'role' })                     role: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'status', default: 'active' }) status: string;
  @Column({ name: 'mfa_enabled', default: false }) mfaEnabled: boolean;
  @Column({ name: 'mfa_secret', nullable: true }) mfaSecret: string;
  @Column({ name: 'failed_login_count', default: 0 }) failedLoginCount: number;
  @Column({ name: 'last_login_at', nullable: true }) lastLoginAt: Date;
  @Column({ name: 'password_changed_at', nullable: true }) passwordChangedAt: Date;
  @Column({ name: 'must_change_password', default: true }) mustChangePassword: boolean;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
