import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { ChartResourceType, AggregationType } from '~/common/ai/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

@Entity('saved_charts')
export class SavedChart {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  @Index({ unique: true })
  id: string; // UUID auto-generated on server

  @Column({ nullable: true })
  @Index()
  createdFromConversationId?: string; // Optional UUID reference to source conversation

  @Column()
  @Index()
  userId: string; // Denormalized for efficient querying

  @Column()
  name: string; // User-provided custom name/label (max 200 chars)

  @Column({ nullable: true })
  description?: string; // User-provided description (max 500 chars)

  // Chart configuration parameters (stored for re-execution)
  @Column({
    type: 'enum',
    enum: ChartResourceType,
  })
  resourceType: ChartResourceType;

  @Column({
    type: 'enum',
    enum: AggregationType,
  })
  aggregationType: AggregationType;

  @Column({ nullable: true })
  from?: string; // ISO 8601 date string

  @Column({ nullable: true })
  to?: string; // ISO 8601 date string

  @Column({ nullable: true })
  status?: string;

  @Column({ nullable: true })
  currency?: string;

  @Column({
    type: 'enum',
    enum: PaymentChannel,
    nullable: true,
  })
  channel?: PaymentChannel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
