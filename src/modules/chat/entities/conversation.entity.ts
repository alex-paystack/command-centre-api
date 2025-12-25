import { Entity, ObjectIdColumn, Column, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Message } from './message.entity';
import { ChatMode, PageContext } from '~/common/ai/types';

@Entity('conversations')
export class Conversation {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  @Index({ unique: true })
  id: string; // UUID generated on client

  @Column()
  title: string;

  @Column()
  @Index()
  userId: string;

  @Column('json', { nullable: true })
  pageContext?: PageContext;

  @Column()
  @Index()
  mode: ChatMode;

  @Column({ nullable: true })
  summary?: string;

  @Column({ default: 0 })
  summaryCount: number;

  @Column({ nullable: true })
  previousSummary?: string;

  @Column({ nullable: true })
  lastSummarizedMessageId?: string;

  @Column({ default: 0 })
  totalTokensUsed: number;

  @Column({ default: false })
  isClosed: boolean;

  @Column()
  @Index()
  lastActivityAt: Date;

  @Column()
  @Index({ expireAfterSeconds: 0 })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.conversation, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  messages: Message[];
}
